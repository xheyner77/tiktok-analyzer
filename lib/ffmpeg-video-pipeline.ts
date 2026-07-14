import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  parseBlackIntervals,
  parseBrightnessOutput,
  parseFfmpegProbeOutput,
  parseFfmpegShowinfoTimeline,
  parseFreezeIntervals,
  parseLoudnessOutput,
  parseSceneCutsOutput,
  parseSilenceIntervals,
  parseVolumeOutput,
} from './video-pipeline/parsers';
import { buildAdaptiveSamplePlan, resolveSamplePlanToFrames } from './video-pipeline/sampling';
import {
  VIDEO_PIPELINE_LIMITS,
  VideoPipelineLimitError,
  type AudioTechnicalSignals,
  type ExtractedAudio,
  type ExtractedVideoFrame,
  type FfmpegProbeMetadata,
  type FfmpegSceneCut,
  type Measurement,
  type TimeInterval,
  type VideoFramePoint,
  type VideoPipelineLimits,
  type VideoTechnicalSignals,
} from './video-pipeline/types';

export * from './video-pipeline/parsers';
export * from './video-pipeline/sampling';
export * from './video-pipeline/types';

const FFMPEG_PATH = resolve(
  process.cwd(),
  'vendor',
  'ffmpeg',
  `${process.platform}-${process.arch}`,
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
);
const SAFE_INPUT_FORMATS = 'mov,matroska,webm,mpeg,mpegvideo';
const MAX_FFMPEG_ALLOCATION_BYTES = 256 * 1024 * 1024;
const MAX_PROBE_BYTES = 32 * 1024 * 1024;
const MAX_ANALYZE_DURATION_MICROSECONDS = 15_000_000;

export function getFfmpegExecutablePath() {
  return FFMPEG_PATH;
}

export function buildFfmpegSpawnEnvironment(
  sourceEnvironment: Readonly<NodeJS.ProcessEnv> = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: sourceEnvironment.NODE_ENV ?? 'production',
    LANG: 'C',
    LC_ALL: 'C',
    PATH: process.platform === 'win32'
      ? join(sourceEnvironment.SystemRoot ?? 'C:\\Windows', 'System32')
      : '/usr/bin:/bin',
    TEMP: tmpdir(),
    TMP: tmpdir(),
    TMPDIR: tmpdir(),
  };
  if (process.platform === 'win32') {
    environment.SystemRoot = sourceEnvironment.SystemRoot ?? 'C:\\Windows';
    environment.WINDIR = sourceEnvironment.WINDIR ?? environment.SystemRoot;
  }
  return environment;
}

export function buildSafeFfmpegInputArgs(filePath: string): string[] {
  if (!filePath || filePath.includes('\0')) {
    throw new VideoPipelineCommandError('COMMAND_FAILED');
  }
  return [
    '-max_alloc', String(MAX_FFMPEG_ALLOCATION_BYTES),
    '-protocol_whitelist', 'file',
    '-format_whitelist', SAFE_INPUT_FORMATS,
    '-probesize', String(MAX_PROBE_BYTES),
    '-analyzeduration', String(MAX_ANALYZE_DURATION_MICROSECONDS),
    '-threads', '2',
    '-filter_threads', '2',
    '-i', resolve(filePath),
  ];
}

class VideoPipelineCommandError extends Error {
  readonly errorCode: 'BINARY_UNAVAILABLE' | 'COMMAND_TIMEOUT' | 'OUTPUT_LIMIT' | 'COMMAND_FAILED';
  readonly exitCode?: number;

  constructor(
    errorCode: VideoPipelineCommandError['errorCode'],
    exitCode?: number,
  ) {
    super(`ffmpeg failed (${errorCode})`);
    this.name = 'VideoPipelineCommandError';
    this.errorCode = errorCode;
    this.exitCode = exitCode;
  }
}

interface RunOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

function runFfmpeg(
  args: string[],
  options: RunOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  const command = FFMPEG_PATH;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxOutputBytes = options.maxOutputBytes ?? 16 * 1024 * 1024;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: tmpdir(),
      env: buildFfmpegSpawnEnvironment(),
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const onOutput = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        child.kill('SIGKILL');
        settle(() => rejectPromise(new VideoPipelineCommandError('OUTPUT_LIMIT')));
        return;
      }
      target.push(chunk);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(() => rejectPromise(new VideoPipelineCommandError('COMMAND_TIMEOUT')));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => onOutput(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => onOutput(stderr, chunk));
    child.once('error', (error: NodeJS.ErrnoException) => settle(() => rejectPromise(
      new VideoPipelineCommandError(error.code === 'ENOENT' ? 'BINARY_UNAVAILABLE' : 'COMMAND_FAILED'),
    )));
    child.once('close', (code) => {
      settle(() => {
        if (code === 0) {
          resolvePromise({ stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
        } else {
          rejectPromise(new VideoPipelineCommandError('COMMAND_FAILED', code ?? undefined));
        }
      });
    });
  });
}

function timeoutForDuration(durationSec?: number) {
  return Math.min(240_000, Math.max(45_000, 30_000 + ((durationSec ?? 60) * 300)));
}

function measured<T>(value: T, method: string): Measurement<T> {
  return { availability: 'measured', value, method };
}

function unavailable<T>(reason: string): Measurement<T> {
  return { availability: 'unavailable', reason };
}

function logPipelineFailure(stage: string, error: unknown) {
  const errorCode = error instanceof VideoPipelineCommandError ? error.errorCode : 'UNEXPECTED_ERROR';
  // Never log paths, media content, transcripts or provider output.
  console.warn('[video-pipeline]', { stage, errorCode });
}

export async function isFfmpegAvailable() {
  try {
    await access(FFMPEG_PATH);
    const { stdout } = await runFfmpeg(['-version'], { timeoutMs: 5_000, maxOutputBytes: 512_000 });
    return /^ffmpeg version n8\.1\.2-22-g94138f6973\b/m.test(stdout);
  } catch {
    return false;
  }
}

export async function probeVideoStrict(filePath: string): Promise<FfmpegProbeMetadata> {
  await access(filePath);
  const { stderr } = await runFfmpeg([
    '-hide_banner',
    '-nostdin',
    '-nostats',
    ...buildSafeFfmpegInputArgs(filePath),
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c', 'copy',
    '-frames:v', '0',
    '-frames:a', '0',
    '-f', 'null',
    '-',
  ], { timeoutMs: 30_000, maxOutputBytes: 4 * 1024 * 1024 });
  return parseFfmpegProbeOutput(stderr);
}

/** Compatibility wrapper. New pipeline code should use probeVideoStrict and handle a typed failure. */
export async function probeVideoWithFfmpeg(filePath: string): Promise<FfmpegProbeMetadata | null> {
  try {
    return await probeVideoStrict(filePath);
  } catch (error) {
    logPipelineFailure('probe', error);
    return null;
  }
}

export async function validateVideoAgainstLimits(
  metadata: FfmpegProbeMetadata,
  options: { fileSizeBytes?: number; limits?: Partial<VideoPipelineLimits> } = {},
) {
  const limits = { ...VIDEO_PIPELINE_LIMITS, ...options.limits };
  if (!metadata.hasVideo) {
    throw new VideoPipelineLimitError('VIDEO_STREAM_MISSING', 'Le fichier ne contient aucun flux vidéo lisible.');
  }
  if (metadata.durationSec === undefined || !Number.isFinite(metadata.durationSec) || metadata.durationSec <= 0) {
    throw new VideoPipelineLimitError('VIDEO_DURATION_UNAVAILABLE', 'La durée complète de la vidéo ne peut pas être déterminée.');
  }
  if (metadata.durationSec > limits.maxDurationSec) {
    throw new VideoPipelineLimitError(
      'VIDEO_DURATION_EXCEEDED',
      `La vidéo dure ${metadata.durationSec} s. La limite technique est ${limits.maxDurationSec} s ; aucune analyse partielle n’a été lancée.`,
      { observed: metadata.durationSec, maximum: limits.maxDurationSec },
    );
  }
  if (options.fileSizeBytes !== undefined && options.fileSizeBytes > limits.maxFileBytes) {
    throw new VideoPipelineLimitError(
      'VIDEO_FILE_TOO_LARGE',
      `Le fichier dépasse la limite technique de ${Math.round(limits.maxFileBytes / 1024 / 1024)} Mo ; aucune analyse partielle n’a été lancée.`,
      { observed: options.fileSizeBytes, maximum: limits.maxFileBytes },
    );
  }
  const pixelCount = (metadata.width ?? 0) * (metadata.height ?? 0);
  if (pixelCount > limits.maxPixelCount) {
    throw new VideoPipelineLimitError(
      'VIDEO_RESOLUTION_EXCEEDED',
      'La résolution dépasse la limite technique acceptée ; aucune analyse partielle n’a été lancée.',
      { observed: pixelCount, maximum: limits.maxPixelCount },
    );
  }
  if (metadata.fps !== undefined && metadata.fps > limits.maxFps) {
    throw new VideoPipelineLimitError(
      'VIDEO_FRAME_RATE_EXCEEDED',
      `La cadence vidéo de ${metadata.fps} i/s dépasse la limite technique de ${limits.maxFps} i/s.`,
      { observed: metadata.fps, maximum: limits.maxFps },
    );
  }
  const pixelRate = metadata.fps === undefined ? undefined : pixelCount * metadata.fps;
  if (pixelRate !== undefined && pixelRate > limits.maxPixelRate) {
    throw new VideoPipelineLimitError(
      'VIDEO_PIXEL_RATE_EXCEEDED',
      'Le débit de pixels à décoder dépasse la limite technique acceptée.',
      { observed: pixelRate, maximum: limits.maxPixelRate },
    );
  }
}

export async function probeFrameTimelineWithFfmpeg(
  filePath: string,
  durationSec?: number,
): Promise<VideoFramePoint[]> {
  const { stderr } = await runFfmpeg([
    '-hide_banner',
    '-nostdin',
    '-nostats',
    ...buildSafeFfmpegInputArgs(filePath),
    '-map', '0:v:0',
    '-an',
    '-sn',
    '-dn',
    '-vf', 'showinfo',
    '-fps_mode', 'passthrough',
    '-f', 'null',
    '-',
  ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 64 * 1024 * 1024 });
  const timeline = parseFfmpegShowinfoTimeline(stderr);
  const measuredFps = durationSec && durationSec > 0 ? timeline.length / durationSec : undefined;
  if (
    timeline.length > VIDEO_PIPELINE_LIMITS.maxDecodedFrames
    || (measuredFps !== undefined && measuredFps > VIDEO_PIPELINE_LIMITS.maxFps + 0.5)
  ) {
    throw new VideoPipelineLimitError(
      'VIDEO_FRAME_RATE_EXCEEDED',
      'Le nombre de frames décodées dépasse la limite technique acceptée.',
      {
        observed: measuredFps ?? timeline.length,
        maximum: measuredFps === undefined ? VIDEO_PIPELINE_LIMITS.maxDecodedFrames : VIDEO_PIPELINE_LIMITS.maxFps,
      },
    );
  }
  return timeline;
}

export async function detectSceneCutsStrict(
  filePath: string,
  options: { threshold?: number; durationSec?: number } = {},
): Promise<FfmpegSceneCut[]> {
  const threshold = Math.min(1, Math.max(0.05, options.threshold ?? 0.28));
  const { stderr } = await runFfmpeg([
    '-hide_banner',
    '-nostdin',
    '-nostats',
    ...buildSafeFfmpegInputArgs(filePath),
    '-map', '0:v:0',
    '-an',
    '-sn',
    '-dn',
    '-filter:v', `select=gt(scene\\,${threshold}),metadata=print:key=lavfi.scene_score`,
    '-fps_mode', 'vfr',
    '-f', 'null',
    '-',
  ], { timeoutMs: timeoutForDuration(options.durationSec), maxOutputBytes: 12 * 1024 * 1024 });
  return parseSceneCutsOutput(stderr);
}

export async function detectSceneCutsWithFfmpeg(filePath: string): Promise<FfmpegSceneCut[]> {
  try {
    return await detectSceneCutsStrict(filePath);
  } catch (error) {
    logPipelineFailure('scene_detection', error);
    return [];
  }
}

async function createPipelineTempDirectory(purpose: 'audio' | 'frames') {
  return mkdtemp(join(tmpdir(), `viralynz-video-${purpose}-`));
}

export async function safeRemovePipelineTempDirectory(directoryPath: string) {
  const resolvedDirectory = resolve(directoryPath);
  const resolvedTmp = resolve(tmpdir());
  const isOwnedDirectory = dirname(resolvedDirectory) === resolvedTmp
    && /^viralynz-video-(audio|frames)-/.test(resolvedDirectory.slice(resolvedTmp.length + 1));
  if (!isOwnedDirectory) throw new Error('Refus de supprimer un dossier temporaire non créé par le pipeline vidéo.');
  await rm(resolvedDirectory, { recursive: true, force: true });
}

export async function extractAudioToWavFile(filePath: string, outputPath: string, durationSec?: number) {
  await runFfmpeg([
    '-hide_banner',
    '-nostdin',
    '-nostats',
    '-y',
    ...buildSafeFfmpegInputArgs(filePath),
    '-map', '0:a:0',
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    outputPath,
  ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 4 * 1024 * 1024 });
  const outputStat = await stat(outputPath);
  return { outputPath, byteLength: outputStat.size, sampleRateHz: 16_000 as const, channels: 1 as const };
}

/** Extracts the complete audio track. There is deliberately no duration truncation. */
export async function extractAudioWithFfmpeg(filePath: string): Promise<ExtractedAudio | null> {
  const directory = await createPipelineTempDirectory('audio');
  const outputPath = join(directory, 'audio.wav');
  try {
    const metadata = await probeVideoStrict(filePath);
    await validateVideoAgainstLimits(metadata);
    if (!metadata.hasAudio) return null;
    const extracted = await extractAudioToWavFile(filePath, outputPath, metadata.durationSec);
    const bytes = await readFile(outputPath);
    return {
      audioBase64: bytes.toString('base64'),
      mimeType: 'audio/wav',
      byteLength: extracted.byteLength,
      sampleRateHz: 16_000,
      channels: 1,
    };
  } catch (error) {
    logPipelineFailure('audio_extraction', error);
    return null;
  } finally {
    await safeRemovePipelineTempDirectory(directory);
  }
}

async function extractResolvedFrames(
  filePath: string,
  resolvedFrames: ReturnType<typeof resolveSamplePlanToFrames>,
  durationSec: number,
): Promise<ExtractedVideoFrame[]> {
  if (resolvedFrames.length === 0) return [];
  const directory = await createPipelineTempDirectory('frames');
  try {
    const selectExpression = resolvedFrames.map((frame) => `eq(n\\,${frame.frameIndex})`).join('+');
    await runFfmpeg([
      '-hide_banner',
      '-nostdin',
      '-nostats',
      '-y',
      ...buildSafeFfmpegInputArgs(filePath),
      '-map', '0:v:0',
      '-an',
      '-sn',
      '-dn',
      '-vf', `select=${selectExpression},scale=min(720\\,iw):-2`,
      '-fps_mode', 'vfr',
      '-q:v', '3',
      join(directory, 'frame-%04d.jpg'),
    ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 6 * 1024 * 1024 });

    const fileNames = (await readdir(directory)).filter((fileName) => /^frame-\d{4}\.jpg$/.test(fileName)).sort();
    if (fileNames.length !== resolvedFrames.length) {
      throw new VideoPipelineCommandError('COMMAND_FAILED');
    }
    return Promise.all(fileNames.map(async (fileName, index) => ({
      ...resolvedFrames[index],
      dataBase64: (await readFile(join(directory, fileName))).toString('base64'),
      mimeType: 'image/jpeg' as const,
    })));
  } finally {
    await safeRemovePipelineTempDirectory(directory);
  }
}

export interface AdaptiveFrameExtractionOptions {
  metadata?: FfmpegProbeMetadata;
  sceneCuts?: FfmpegSceneCut[];
  silenceBoundariesSec?: number[];
  maxFrames?: number;
  maxCoverageGapSec?: number;
}

export async function extractAdaptiveFramesWithFfmpeg(
  filePath: string,
  options: AdaptiveFrameExtractionOptions = {},
): Promise<ExtractedVideoFrame[]> {
  const metadata = options.metadata ?? await probeVideoStrict(filePath);
  await validateVideoAgainstLimits(metadata);
  const durationSec = metadata.durationSec as number;
  const [timeline, sceneCuts] = await Promise.all([
    probeFrameTimelineWithFfmpeg(filePath, durationSec),
    options.sceneCuts
      ? Promise.resolve(options.sceneCuts)
      : detectSceneCutsStrict(filePath, { durationSec }),
  ]);
  const plan = buildAdaptiveSamplePlan(durationSec, sceneCuts, {
    maxFrames: options.maxFrames,
    maxCoverageGapSec: options.maxCoverageGapSec,
    silenceBoundariesSec: options.silenceBoundariesSec,
  });
  const resolvedFrames = resolveSamplePlanToFrames(plan, timeline);
  return extractResolvedFrames(filePath, resolvedFrames, durationSec);
}

/** Compatibility wrapper: uniformly distributed count is replaced by real adaptive coverage. */
export async function extractKeyFramesWithFfmpeg(filePath: string, maxFrames = 10): Promise<string[]> {
  try {
    const frames = await extractAdaptiveFramesWithFfmpeg(filePath, { maxFrames: Math.max(10, maxFrames) });
    return frames.map((frame) => frame.dataBase64);
  } catch (error) {
    logPipelineFailure('frame_extraction', error);
    return [];
  }
}

async function measureBlackFreezeAndBrightness(filePath: string, durationSec: number) {
  const brightnessSampleRateHz = 2;
  const [intervalOutput, brightnessOutput] = await Promise.all([
    runFfmpeg([
      '-hide_banner', '-nostdin', '-nostats', ...buildSafeFfmpegInputArgs(filePath),
      '-map', '0:v:0', '-an', '-sn', '-dn',
      '-vf', 'blackdetect=d=0.1:pix_th=0.10,freezedetect=n=-60dB:d=1',
      '-f', 'null', '-',
    ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 8 * 1024 * 1024 }),
    runFfmpeg([
      '-hide_banner', '-nostdin', '-nostats', ...buildSafeFfmpegInputArgs(filePath),
      '-map', '0:v:0', '-an', '-sn', '-dn',
      '-vf', `fps=${brightnessSampleRateHz},signalstats,metadata=print:key=lavfi.signalstats.YAVG`,
      '-f', 'null', '-',
    ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 12 * 1024 * 1024 }),
  ]);
  return {
    blackIntervals: parseBlackIntervals(intervalOutput.stderr, durationSec),
    freezeIntervals: parseFreezeIntervals(intervalOutput.stderr, durationSec),
    brightness: parseBrightnessOutput(brightnessOutput.stderr, brightnessSampleRateHz),
  };
}

async function measureAudioSignals(filePath: string, durationSec: number, hasAudio: boolean): Promise<AudioTechnicalSignals> {
  if (!hasAudio) {
    const noAudio = 'Aucun flux audio mesurable.';
    return {
      silenceIntervals: unavailable(noAudio),
      initialSilenceDurationSec: unavailable(noAudio),
      firstNonSilentAudioSec: unavailable(noAudio),
      firstSpeechTimeSec: unavailable(noAudio),
      meanVolumeDb: unavailable(noAudio),
      peakVolumeDb: unavailable(noAudio),
      loudnessSamples: unavailable(noAudio),
      voiceMusicBalance: unavailable(noAudio),
      saturation: unavailable(noAudio),
    };
  }

  const [silenceAndVolume, loudness] = await Promise.all([
    runFfmpeg([
      '-hide_banner', '-nostdin', '-nostats', ...buildSafeFfmpegInputArgs(filePath),
      '-map', '0:a:0', '-vn', '-sn', '-dn',
      '-af', 'silencedetect=noise=-42dB:d=0.15,volumedetect',
      '-f', 'null', '-',
    ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 8 * 1024 * 1024 }),
    runFfmpeg([
      '-hide_banner', '-nostdin', '-nostats', ...buildSafeFfmpegInputArgs(filePath),
      '-map', '0:a:0', '-vn', '-sn', '-dn',
      '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M',
      '-f', 'null', '-',
    ], { timeoutMs: timeoutForDuration(durationSec), maxOutputBytes: 16 * 1024 * 1024 }),
  ]);

  const silenceIntervals = parseSilenceIntervals(silenceAndVolume.stderr, durationSec);
  const initialSilenceInterval = silenceIntervals.find((item) => item.startTimeSec <= 0.02);
  const initialSilence = initialSilenceInterval?.durationSec ?? 0;
  const silentForWholeTrack = Boolean(initialSilenceInterval && initialSilenceInterval.endTimeSec >= durationSec - 0.02);
  const volume = parseVolumeOutput(silenceAndVolume.stderr);
  const loudnessSamples = parseLoudnessOutput(loudness.stderr);
  return {
    silenceIntervals: measured(silenceIntervals, 'ffmpeg silencedetect -42 dB / 150 ms'),
    initialSilenceDurationSec: measured(initialSilence, 'ffmpeg silencedetect -42 dB / 150 ms'),
    firstNonSilentAudioSec: silentForWholeTrack
      ? unavailable('Aucun signal au-dessus du seuil -42 dB n’a été détecté sur la piste complète.')
      : measured(initialSilence, 'fin du silence initial mesuré ; ne prouve pas la présence de parole'),
    firstSpeechTimeSec: unavailable('FFmpeg ne peut pas distinguer de façon fiable la parole de la musique ; utiliser les segments de transcription.'),
    meanVolumeDb: volume.meanVolumeDb === undefined
      ? unavailable('Volume moyen absent de la sortie FFmpeg.')
      : measured(volume.meanVolumeDb, 'ffmpeg volumedetect'),
    peakVolumeDb: volume.peakVolumeDb === undefined
      ? unavailable('Pic de volume absent de la sortie FFmpeg.')
      : measured(volume.peakVolumeDb, 'ffmpeg volumedetect'),
    loudnessSamples: loudnessSamples.length > 0
      ? measured(loudnessSamples, 'ffmpeg ebur128, mesure momentanée')
      : unavailable('Mesures de loudness indisponibles.'),
    voiceMusicBalance: unavailable('Aucun modèle de séparation de sources fiable n’est exécuté.'),
    saturation: unavailable('Le pic numérique seul ne permet pas de confirmer une saturation audible.'),
  };
}

export async function measureTechnicalSignalsWithFfmpeg(
  filePath: string,
  suppliedMetadata?: FfmpegProbeMetadata,
): Promise<VideoTechnicalSignals> {
  const metadata = suppliedMetadata ?? await probeVideoStrict(filePath);
  await validateVideoAgainstLimits(metadata);
  const durationSec = metadata.durationSec as number;
  const [sceneCuts, videoSignals, audio] = await Promise.all([
    detectSceneCutsStrict(filePath, { durationSec }),
    measureBlackFreezeAndBrightness(filePath, durationSec),
    measureAudioSignals(filePath, durationSec, metadata.hasAudio),
  ]);
  const cutIntervalsSec = sceneCuts.slice(1).map((cut, index) =>
    Math.round((cut.timestamp - sceneCuts[index].timestamp) * 1_000) / 1_000);
  return {
    sceneCuts: measured(sceneCuts, 'ffmpeg select scene score > 0.28'),
    cutIntervalsSec: measured(cutIntervalsSec, 'différence entre changements de scène mesurés'),
    cutDensityPerMinute: measured(
      Math.round(((sceneCuts.length / durationSec) * 60) * 100) / 100,
      'changements de scène mesurés / durée FFmpeg',
    ),
    blackIntervals: measured(videoSignals.blackIntervals, 'ffmpeg blackdetect, 100 ms minimum'),
    freezeIntervals: measured(videoSignals.freezeIntervals, 'ffmpeg freezedetect, 1 s minimum'),
    brightness: videoSignals.brightness
      ? measured(videoSignals.brightness, 'YAVG signalstats échantillonné à 2 Hz')
      : unavailable('Variation de luminosité indisponible.'),
    audio,
  };
}

/** Utility for callers that need the current input size before validation. */
export async function getVideoFileSize(filePath: string) {
  return (await stat(filePath)).size;
}
