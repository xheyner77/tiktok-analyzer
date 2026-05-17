import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface FfmpegProbeMetadata {
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio: boolean;
}

export interface FfmpegSceneCut {
  timestamp: number;
  score: number;
}

function run(command: string, args: string[], timeoutMs = 30_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} timeout`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 600)}`));
    });
  });
}

export async function isFfmpegAvailable() {
  try {
    await run('ffmpeg', ['-version'], 5_000);
    await run('ffprobe', ['-version'], 5_000);
    return true;
  } catch {
    return false;
  }
}

export async function probeVideoWithFfmpeg(filePath: string): Promise<FfmpegProbeMetadata | null> {
  try {
    await access(filePath);
    const { stdout } = await run('ffprobe', [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }>;
    };
    const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
    const audio = parsed.streams?.find((stream) => stream.codec_type === 'audio');
    const [fpsNum, fpsDen] = (video?.avg_frame_rate ?? '').split('/').map(Number);
    return {
      durationSec: parsed.format?.duration ? Math.round(Number(parsed.format.duration) * 10) / 10 : undefined,
      width: video?.width,
      height: video?.height,
      fps: fpsNum && fpsDen ? Math.round((fpsNum / fpsDen) * 10) / 10 : undefined,
      videoCodec: video?.codec_name,
      audioCodec: audio?.codec_name,
      hasAudio: Boolean(audio),
    };
  } catch (error) {
    console.warn('[ffmpeg-pipeline] probe failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function extractAudioWithFfmpeg(filePath: string): Promise<{ audioBase64: string; mimeType: 'audio/wav' } | null> {
  const dir = await mkdtemp(join(tmpdir(), 'viralynz-audio-'));
  const out = join(dir, 'audio.wav');
  try {
    await run('ffmpeg', ['-y', '-i', filePath, '-vn', '-ac', '1', '-ar', '16000', '-t', '90', out], 45_000);
    const bytes = await readFile(out);
    return { audioBase64: bytes.toString('base64'), mimeType: 'audio/wav' };
  } catch (error) {
    console.warn('[ffmpeg-pipeline] audio extraction failed:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function extractKeyFramesWithFfmpeg(filePath: string, maxFrames = 10): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), 'viralynz-frames-'));
  try {
    await run('ffmpeg', [
      '-y',
      '-i', filePath,
      '-vf', `fps=1,scale='min(720,iw)':-2`,
      '-frames:v', String(maxFrames),
      join(dir, 'frame-%03d.jpg'),
    ], 45_000);
    const frames: string[] = [];
    for (let index = 1; index <= maxFrames; index++) {
      try {
        const bytes = await readFile(join(dir, `frame-${String(index).padStart(3, '0')}.jpg`));
        frames.push(bytes.toString('base64'));
      } catch {
        break;
      }
    }
    return frames;
  } catch (error) {
    console.warn('[ffmpeg-pipeline] frame extraction failed:', error instanceof Error ? error.message : error);
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function detectSceneCutsWithFfmpeg(filePath: string): Promise<FfmpegSceneCut[]> {
  try {
    const { stderr } = await run('ffmpeg', [
      '-i', filePath,
      '-filter:v', "select='gt(scene,0.32)',showinfo",
      '-f', 'null',
      '-',
    ], 45_000);
    return stderr
      .split('\n')
      .map((line) => {
        const time = line.match(/pts_time:([\d.]+)/)?.[1];
        const score = line.match(/scene:([\d.]+)/)?.[1];
        if (!time) return null;
        return {
          timestamp: Math.round(Number(time) * 10) / 10,
          score: score ? Math.round(Number(score) * 100) : 65,
        };
      })
      .filter((item): item is FfmpegSceneCut => Boolean(item))
      .slice(0, 40);
  } catch (error) {
    console.warn('[ffmpeg-pipeline] scene detection failed:', error instanceof Error ? error.message : error);
    return [];
  }
}
