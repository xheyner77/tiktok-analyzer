import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VIDEO_PIPELINE_LIMITS,
  buildFfmpegSpawnEnvironment,
  buildSafeFfmpegInputArgs,
  buildAdaptiveSamplePlan,
  extractAdaptiveFramesWithFfmpeg,
  extractAudioWithFfmpeg,
  getFfmpegExecutablePath,
  isFfmpegAvailable,
  measureTechnicalSignalsWithFfmpeg,
  parseBlackIntervals,
  parseBrightnessOutput,
  parseFfmpegMetadataSeries,
  parseFfmpegProbeOutput,
  parseFfmpegShowinfoTimeline,
  parseSceneCutsOutput,
  parseSilenceIntervals,
  parseVolumeOutput,
  probeVideoStrict,
  resolveSamplePlanToFrames,
  safeRemovePipelineTempDirectory,
  validateVideoAgainstLimits,
} from '@/lib/ffmpeg-video-pipeline';

function runFixtureCommand(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(getFfmpegExecutablePath(), args, {
      env: buildFfmpegSpawnEnvironment(),
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`fixture generation failed (${code}): ${stderr.slice(-300)}`));
    });
  });
}

describe('video preprocessing parsers', () => {
  it('parses exact technical metadata without inventing unavailable values', () => {
    const parsed = parseFfmpegProbeOutput([
      "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'fixture.mp4':",
      '  Duration: 00:00:12.345, start: 0.050000, bitrate: 1234.567 kb/s',
      '  Stream #0:0(und): Video: h264 (High), yuv420p, 1080x1920 [SAR 1:1 DAR 9:16], 1100 kb/s, 29.97 fps, 30 tbr',
      '    Side data:',
      '      displaymatrix: rotation of -90.00 degrees',
      '  Stream #0:1(und): Audio: aac (LC), 48000 Hz, stereo, fltp, 128 kb/s (default)',
      'Stream mapping:',
      '  Stream #0:0 -> #0:0 (copy)',
    ].join('\n'));

    expect(parsed).toMatchObject({
      durationSec: 12.345,
      startTimeSec: 0.05,
      width: 1080,
      height: 1920,
      displayWidth: 1920,
      displayHeight: 1080,
      aspectRatioLabel: '16:9',
      fps: 29.97,
      bitrate: 1234567,
      videoBitrate: 1100000,
      audioBitrate: 128000,
      videoCodec: 'h264',
      audioCodec: 'aac',
      hasVideo: true,
      hasAudio: true,
    });
  });

  it('keeps actual decoded frame timestamps relative to the first frame', () => {
    const timeline = parseFfmpegShowinfoTimeline([
      '[Parsed_showinfo_0 @ abc] n:   0 pts: 1500 pts_time:1.500000e+0 duration: 100',
      '[Parsed_showinfo_0 @ abc] n:   1 pts: 1600 pts_time:1.600000 duration: 100',
      '[Parsed_showinfo_0 @ abc] n:   2 pts: 1700 pts_time:1.700000 duration: 100',
    ].join('\n'));
    expect(timeline).toEqual([
      { frameIndex: 0, sourceTimestampSec: 1.5, timestampSec: 0 },
      { frameIndex: 1, sourceTimestampSec: 1.6, timestampSec: 0.1 },
      { frameIndex: 2, sourceTimestampSec: 1.7, timestampSec: 0.2 },
    ]);
  });

  it('uses a minimal secret-free child environment and strict local media allowlists', () => {
    const environment = buildFfmpegSpawnEnvironment({
      NODE_ENV: 'test',
      SystemRoot: 'C:\\Windows',
      OPENAI_API_KEY: 'must-not-leak',
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak-either',
    });
    expect(environment).not.toHaveProperty('OPENAI_API_KEY');
    expect(environment).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
    expect(environment.LC_ALL).toBe('C');

    const args = buildSafeFfmpegInputArgs(join(tmpdir(), 'fixture.mp4'));
    expect(args.slice(args.indexOf('-protocol_whitelist'), args.indexOf('-protocol_whitelist') + 2))
      .toEqual(['-protocol_whitelist', 'file']);
    expect(args[args.indexOf('-format_whitelist') + 1]).toBe('mov,matroska,webm,mpeg,mpegvideo');
    expect(args).not.toContain('http');
    expect(args).not.toContain('https');
  });

  it('parses scene scores, intervals, volume and brightness from measured FFmpeg output', () => {
    const metadataOutput = [
      'frame:0 pts:100 pts_time:5e-1',
      'lavfi.scene_score=0.4123',
      'frame:1 pts:400 pts_time:2',
      'lavfi.scene_score=0.8000',
    ].join('\n');
    expect(parseFfmpegMetadataSeries(metadataOutput, 'lavfi.scene_score')).toHaveLength(2);
    expect(parseSceneCutsOutput(metadataOutput)).toEqual([
      { timestamp: 0.5, score: 0.4123 },
      { timestamp: 2, score: 0.8 },
    ]);
    expect(parseBlackIntervals('[blackdetect] black_start:0 black_end:0.45 black_duration:0.45', 4)).toEqual([
      { startTimeSec: 0, endTimeSec: 0.45, durationSec: 0.45 },
    ]);
    expect(parseSilenceIntervals('[silencedetect] silence_start: 3.2', 4)).toEqual([
      { startTimeSec: 3.2, endTimeSec: 4, durationSec: 0.8 },
    ]);
    expect(parseVolumeOutput('mean_volume: -18.4 dB\nmax_volume: -0.7 dB')).toEqual({
      meanVolumeDb: -18.4,
      peakVolumeDb: -0.7,
    });
    const brightness = parseBrightnessOutput([
      'frame:0 pts:0 pts_time:0', 'lavfi.signalstats.YAVG=10',
      'frame:1 pts:1 pts_time:0.5', 'lavfi.signalstats.YAVG=30',
    ].join('\n'), 2);
    expect(brightness).toMatchObject({ sampleRateHz: 2, sampleCount: 2, meanLuma: 20, minLuma: 10, maxLuma: 30 });
    expect(brightness?.standardDeviation).toBe(10);
  });
});

describe('adaptive full-duration sampling', () => {
  it('covers the exact opening anchors, middle, scene changes and end within the budget', () => {
    const plan = buildAdaptiveSamplePlan(120, [
      { timestamp: 18.25, score: 0.7 },
      { timestamp: 82.4, score: 0.9 },
    ]);
    const timestamps = plan.map((sample) => sample.requestedTimestampSec);
    for (const opening of [0, 0.2, 0.5, 1, 1.5, 2, 3]) expect(timestamps).toContain(opening);
    expect(plan.find((sample) => sample.reasons.includes('midpoint'))).toBeDefined();
    expect(plan.find((sample) => sample.reasons.includes('scene_change'))).toBeDefined();
    expect(plan.find((sample) => sample.reasons.includes('scene_context_before'))).toBeDefined();
    expect(plan.find((sample) => sample.reasons.includes('scene_context_after'))).toBeDefined();
    expect(plan.find((sample) => sample.reasons.includes('end'))?.requestedTimestampSec).toBeGreaterThanOrEqual(119.9);
    expect(plan.length).toBeLessThanOrEqual(VIDEO_PIPELINE_LIMITS.maxFrames);

    const largestGap = Math.max(...timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]));
    expect(largestGap).toBeLessThanOrEqual(VIDEO_PIPELINE_LIMITS.maxCoverageGapSec);
  });

  it('still represents an accepted ten-minute video from first to last frame', () => {
    const plan = buildAdaptiveSamplePlan(VIDEO_PIPELINE_LIMITS.maxDurationSec);
    const timestamps = plan.map((sample) => sample.requestedTimestampSec);
    expect(timestamps[0]).toBe(0);
    expect(timestamps.at(-1)).toBeGreaterThan(599.9);
    expect(plan.length).toBeLessThanOrEqual(VIDEO_PIPELINE_LIMITS.maxFrames);
    expect(Math.max(...timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index])))
      .toBeLessThanOrEqual(VIDEO_PIPELINE_LIMITS.maxCoverageGapSec);
  });

  it('adds frames on both sides of detected silence boundaries', () => {
    const plan = buildAdaptiveSamplePlan(30, [], {
      silenceBoundariesSec: [4.2, 9.8],
    });

    expect(plan.some((sample) => sample.reasons.includes('silence_boundary'))).toBe(true);
    expect(plan.some((sample) => sample.reasons.includes('silence_context_before'))).toBe(true);
    expect(plan.some((sample) => sample.reasons.includes('silence_context_after'))).toBe(true);
    expect(plan.length).toBeLessThanOrEqual(VIDEO_PIPELINE_LIMITS.maxFrames);
  });

  it('maps requested samples to real frame times and merges duplicate decoded frames', () => {
    const timeline = Array.from({ length: 11 }, (_, frameIndex) => ({
      frameIndex,
      timestampSec: frameIndex / 10,
      sourceTimestampSec: 5 + (frameIndex / 10),
    }));
    const resolved = resolveSamplePlanToFrames([
      { requestedTimestampSec: 0, reasons: ['first_frame'] },
      { requestedTimestampSec: 0.04, reasons: ['opening_detail'] },
      { requestedTimestampSec: 0.26, reasons: ['opening_detail'] },
    ], timeline);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({ frameIndex: 0, timestampSec: 0, requestedTimestampsSec: [0, 0.04] });
    expect(resolved[1]).toMatchObject({ frameIndex: 3, timestampSec: 0.3 });
  });

  it('rejects over-limit inputs explicitly instead of truncating them', async () => {
    await expect(validateVideoAgainstLimits({
      durationSec: VIDEO_PIPELINE_LIMITS.maxDurationSec + 0.001,
      hasVideo: true,
      hasAudio: true,
    })).rejects.toMatchObject({
      code: 'VIDEO_DURATION_EXCEEDED',
      maximum: VIDEO_PIPELINE_LIMITS.maxDurationSec,
    });
  });

  it('rejects hostile frame and pixel rates before full decoding', async () => {
    await expect(validateVideoAgainstLimits({
      durationSec: 10,
      width: 1920,
      height: 1080,
      fps: VIDEO_PIPELINE_LIMITS.maxFps + 1,
      hasVideo: true,
      hasAudio: false,
    })).rejects.toMatchObject({ code: 'VIDEO_FRAME_RATE_EXCEEDED' });

    await expect(validateVideoAgainstLimits({
      durationSec: 10,
      width: 4096,
      height: 2160,
      fps: 61,
      hasVideo: true,
      hasAudio: false,
    })).rejects.toMatchObject({ code: 'VIDEO_PIXEL_RATE_EXCEEDED' });
  });

  it('refuses cleanup outside a pipeline-owned temporary directory', async () => {
    await expect(safeRemovePipelineTempDirectory(tmpdir())).rejects.toThrow(/Refus de supprimer/);
  });
});

describe('FFmpeg preprocessing integration', () => {
  it('probes, samples and measures a complete synthetic video', async () => {
    expect(await isFfmpegAvailable()).toBe(true);
    const directory = await mkdtemp(join(tmpdir(), 'viralynz-test-fixture-'));
    const fixturePath = join(directory, 'fixture.mp4');
    try {
      await runFixtureCommand([
        '-hide_banner', '-nostats', '-y',
        '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=10:d=0.5',
        '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=10:d=1.5',
        '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=10:d=2',
        '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono:d=0.6',
        '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=16000:duration=3.4',
        '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0[v];[3:a][4:a]concat=n=2:v=0:a=1[a]',
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
        fixturePath,
      ]);

      const metadata = await probeVideoStrict(fixturePath);
      expect(metadata).toMatchObject({ width: 320, height: 180, hasVideo: true, hasAudio: true });
      expect(metadata.durationSec).toBeGreaterThanOrEqual(3.9);
      expect(metadata.durationSec).toBeLessThanOrEqual(4.1);

      const frames = await extractAdaptiveFramesWithFfmpeg(fixturePath, { metadata, maxFrames: 16 });
      expect(frames.length).toBeGreaterThanOrEqual(8);
      expect(frames[0]).toMatchObject({ timestampSec: 0, mimeType: 'image/jpeg' });
      expect(frames.at(-1)?.timestampSec).toBeGreaterThan(3.8);
      expect(frames.every((frame) => frame.dataBase64.length > 100)).toBe(true);

      const audio = await extractAudioWithFfmpeg(fixturePath);
      expect(audio).toMatchObject({ mimeType: 'audio/wav', sampleRateHz: 16000, channels: 1 });
      expect(audio?.byteLength).toBeGreaterThan(120_000);

      const signals = await measureTechnicalSignalsWithFfmpeg(fixturePath, metadata);
      expect(signals.sceneCuts.availability).toBe('measured');
      if (signals.sceneCuts.availability === 'measured') {
        expect(signals.sceneCuts.value.length).toBeGreaterThanOrEqual(2);
        expect(signals.sceneCuts.value.every((cut) => cut.score > 0)).toBe(true);
      }
      expect(signals.blackIntervals).toMatchObject({ availability: 'measured' });
      if (signals.blackIntervals.availability === 'measured') {
        expect(signals.blackIntervals.value[0]?.startTimeSec).toBe(0);
      }
      expect(signals.freezeIntervals.availability).toBe('measured');
      expect(signals.brightness.availability).toBe('measured');
      expect(signals.audio.initialSilenceDurationSec.availability).toBe('measured');
      if (signals.audio.initialSilenceDurationSec.availability === 'measured') {
        expect(signals.audio.initialSilenceDurationSec.value).toBeGreaterThan(0.4);
      }
      expect(signals.audio.firstSpeechTimeSec).toMatchObject({ availability: 'unavailable' });
      expect(signals.audio.voiceMusicBalance).toMatchObject({ availability: 'unavailable' });
      expect(signals.audio.saturation).toMatchObject({ availability: 'unavailable' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 45_000);

  it('rejects playlist input instead of resolving nested network resources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'viralynz-test-playlist-'));
    const playlistPath = join(directory, 'disguised.mp4');
    try {
      await writeFile(playlistPath, '#EXTM3U\n#EXT-X-TARGETDURATION:10\nhttps://example.invalid/video.ts\n', 'utf8');
      await expect(probeVideoStrict(playlistPath)).rejects.toMatchObject({ errorCode: 'COMMAND_FAILED' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
