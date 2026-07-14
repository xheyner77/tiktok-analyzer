import type {
  AudioLoudnessSample,
  BrightnessMeasurement,
  FfmpegProbeMetadata,
  FfmpegSceneCut,
  TimeInterval,
  VideoFramePoint,
} from './types';

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rounded(value: number, precision = 1_000) {
  return Math.round(value * precision) / precision;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : greatestCommonDivisor(b, a % b);
}

function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) return undefined;
  const hours = finiteNumber(match[1]);
  const minutes = finiteNumber(match[2]);
  const seconds = finiteNumber(match[3]);
  if (hours === undefined || minutes === undefined || seconds === undefined || minutes >= 60 || seconds >= 60) {
    return undefined;
  }
  return rounded((hours * 3600) + (minutes * 60) + seconds);
}

function parseBitrate(line: string | undefined): number | undefined {
  const kilobits = finiteNumber(line?.match(/(?:^|,\s*)([\d.]+)\s*kb\/s(?:\s*\([^)]*\))?(?:,|$)/i)?.[1]);
  return kilobits === undefined ? undefined : Math.round(kilobits * 1000);
}

function parseAudioChannels(line: string | undefined): number | undefined {
  if (!line) return undefined;
  if (/(?:^|,\s*)mono(?:,|$)/i.test(line)) return 1;
  if (/(?:^|,\s*)stereo(?:,|$)/i.test(line)) return 2;
  const explicit = finiteNumber(line.match(/(?:^|,\s*)(\d+)\s+channels?(?:,|$)/i)?.[1]);
  if (explicit !== undefined) return explicit;
  const surround = line.match(/(?:^|,\s*)(\d+)\.(\d+)(?:\([^)]*\))?(?:,|$)/)?.slice(1).map(Number);
  return surround?.length === 2 && surround.every(Number.isFinite) ? surround[0] + surround[1] : undefined;
}

/**
 * Parses the stable input banner emitted by the pinned FFmpeg executable.
 * Only the Input #0 section is considered, so output stream summaries cannot
 * overwrite source metadata.
 */
export function parseFfmpegProbeOutput(raw: string): FfmpegProbeMetadata {
  const inputStart = raw.search(/^Input #0,/m);
  const inputEnd = raw.search(/^Stream mapping:|^Output #0,/m);
  const input = inputStart >= 0
    ? raw.slice(inputStart, inputEnd > inputStart ? inputEnd : undefined)
    : raw;
  const inputHeader = input.match(/^Input #0,\s*([^,\s]+)(?:,[^,]*)*,\s*from\s+/m);
  const durationLine = input.match(/^\s*Duration:\s*([^,]+),\s*start:\s*([^,]+),\s*bitrate:\s*([^\r\n]+)/m);
  const videoLine = input.match(/^\s*Stream #0:\d+(?:\[[^\]]+\])?(?:\([^)]*\))?:\s*Video:\s*([^\r\n]+)/m)?.[1];
  const audioLine = input.match(/^\s*Stream #0:\d+(?:\[[^\]]+\])?(?:\([^)]*\))?:\s*Audio:\s*([^\r\n]+)/m)?.[1];
  const dimensions = videoLine?.match(/(?:^|,\s*)(\d{2,5})x(\d{2,5})(?:\s|,|$)/);
  const width = finiteNumber(dimensions?.[1]);
  const height = finiteNumber(dimensions?.[2]);
  const rotation = finiteNumber(input.match(/displaymatrix:\s*rotation of\s*(-?[\d.]+)\s*degrees/i)?.[1]);
  const normalizedRotation = rotation === undefined ? undefined : ((Math.round(rotation) % 360) + 360) % 360;
  const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  const displayWidth = swapsDimensions ? height : width;
  const displayHeight = swapsDimensions ? width : height;
  const divisor = displayWidth && displayHeight ? greatestCommonDivisor(displayWidth, displayHeight) : undefined;
  const duration = parseDuration(durationLine?.[1]?.trim());
  const startTime = finiteNumber(durationLine?.[2]?.trim());
  const overallBitrateKbps = finiteNumber(durationLine?.[3]?.match(/^([\d.]+)\s*kb\/s/i)?.[1]);

  return {
    container: inputHeader?.[1]?.trim() || undefined,
    durationSec: duration,
    startTimeSec: startTime,
    width,
    height,
    displayWidth,
    displayHeight,
    aspectRatio: displayWidth && displayHeight ? rounded(displayWidth / displayHeight) : undefined,
    aspectRatioLabel: displayWidth && displayHeight && divisor
      ? `${displayWidth / divisor}:${displayHeight / divisor}`
      : undefined,
    fps: finiteNumber(videoLine?.match(/(?:^|,\s*)([\d.]+)\s+fps(?:,|$)/i)?.[1]),
    bitrate: overallBitrateKbps === undefined ? undefined : Math.round(overallBitrateKbps * 1000),
    videoBitrate: parseBitrate(videoLine),
    audioBitrate: parseBitrate(audioLine),
    videoCodec: videoLine?.match(/^([^\s,(]+)/)?.[1],
    audioCodec: audioLine?.match(/^([^\s,(]+)/)?.[1],
    audioChannels: parseAudioChannels(audioLine),
    audioSampleRateHz: finiteNumber(audioLine?.match(/(?:^|,\s*)(\d+)\s*Hz(?:,|$)/i)?.[1]),
    rotationDeg: normalizedRotation,
    hasVideo: Boolean(videoLine),
    hasAudio: Boolean(audioLine),
  };
}

/** Parses one showinfo line per decoded frame and preserves the decoder index. */
export function parseFfmpegShowinfoTimeline(raw: string): VideoFramePoint[] {
  const frames = new Map<number, number>();
  for (const line of raw.split(/\r?\n/)) {
    if (!/showinfo(?:_\d+)?\b/i.test(line)) continue;
    const frameIndex = finiteNumber(line.match(/\bn:\s*(\d+)/)?.[1]);
    const sourceTimestampSec = finiteNumber(
      line.match(/\bpts_time:\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i)?.[1],
    );
    if (frameIndex === undefined || sourceTimestampSec === undefined || !Number.isInteger(frameIndex) || frameIndex < 0) {
      continue;
    }
    if (!frames.has(frameIndex)) frames.set(frameIndex, sourceTimestampSec);
  }
  const timestampedFrames = [...frames.entries()]
    .sort(([left], [right]) => left - right)
    .map(([frameIndex, sourceTimestampSec]) => ({ frameIndex, sourceTimestampSec }));
  const origin = timestampedFrames[0]?.sourceTimestampSec ?? 0;
  return timestampedFrames.map(({ sourceTimestampSec, frameIndex }) => ({
    frameIndex,
    sourceTimestampSec: rounded(sourceTimestampSec),
    timestampSec: rounded(Math.max(0, sourceTimestampSec - origin)),
  }));
}

interface MetadataPoint {
  timestampSec: number;
  value: number;
}

export function parseFfmpegMetadataSeries(output: string, key: string): MetadataPoint[] {
  const points: MetadataPoint[] = [];
  let timestampSec: number | undefined;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // FFmpeg prefixes metadata lines with the filter instance on some builds.
  const valuePattern = new RegExp(
    `${escapedKey}=(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)\\s*$`,
    'i',
  );
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const time = line.match(/\bpts_time:(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i)?.[1];
    if (time !== undefined) timestampSec = finiteNumber(time);
    const value = line.match(valuePattern)?.[1];
    const parsedValue = finiteNumber(value);
    if (timestampSec !== undefined && parsedValue !== undefined) {
      points.push({ timestampSec: rounded(timestampSec), value: parsedValue });
    }
  }
  return points;
}

export function parseSceneCutsOutput(output: string): FfmpegSceneCut[] {
  const deduplicated = new Map<number, FfmpegSceneCut>();
  for (const point of parseFfmpegMetadataSeries(output, 'lavfi.scene_score')) {
    const timestamp = rounded(point.timestampSec);
    const existing = deduplicated.get(timestamp);
    if (!existing || point.value > existing.score) {
      deduplicated.set(timestamp, { timestamp, score: rounded(point.value, 10_000) });
    }
  }
  return [...deduplicated.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function interval(start: number, end: number, duration?: number): TimeInterval | null {
  const safeEnd = duration === undefined ? end : Math.min(end, duration);
  const safeStart = Math.max(0, start);
  if (!Number.isFinite(safeStart) || !Number.isFinite(safeEnd) || safeEnd < safeStart) return null;
  return {
    startTimeSec: rounded(safeStart),
    endTimeSec: rounded(safeEnd),
    durationSec: rounded(safeEnd - safeStart),
  };
}

function parseIntervals(
  output: string,
  prefix: 'black' | 'freeze' | 'silence',
  mediaDurationSec?: number,
): TimeInterval[] {
  const starts: number[] = [];
  const intervals: TimeInterval[] = [];
  const startPattern = new RegExp(`${prefix}_start:\\s*(-?[\\d.]+)`);
  const endPattern = new RegExp(`${prefix}_end:\\s*(-?[\\d.]+)`);
  for (const line of output.split(/\r?\n/)) {
    const start = finiteNumber(line.match(startPattern)?.[1]);
    if (start !== undefined) starts.push(start);
    const end = finiteNumber(line.match(endPattern)?.[1]);
    if (end !== undefined) {
      const currentStart = starts.shift();
      if (currentStart !== undefined) {
        const parsed = interval(currentStart, end, mediaDurationSec);
        if (parsed) intervals.push(parsed);
      }
    }
  }
  if (mediaDurationSec !== undefined) {
    for (const currentStart of starts) {
      const parsed = interval(currentStart, mediaDurationSec, mediaDurationSec);
      if (parsed) intervals.push(parsed);
    }
  }
  return intervals;
}

export function parseBlackIntervals(output: string, durationSec?: number) {
  return parseIntervals(output, 'black', durationSec);
}

export function parseFreezeIntervals(output: string, durationSec?: number) {
  return parseIntervals(output, 'freeze', durationSec);
}

export function parseSilenceIntervals(output: string, durationSec?: number) {
  return parseIntervals(output, 'silence', durationSec);
}

export function parseVolumeOutput(output: string) {
  const meanVolumeDb = finiteNumber(output.match(/mean_volume:\s*(-?[\d.]+)\s*dB/i)?.[1]);
  const peakVolumeDb = finiteNumber(output.match(/max_volume:\s*(-?[\d.]+)\s*dB/i)?.[1]);
  return { meanVolumeDb, peakVolumeDb };
}

export function parseBrightnessOutput(output: string, sampleRateHz: number): BrightnessMeasurement | undefined {
  const values = parseFfmpegMetadataSeries(output, 'lavfi.signalstats.YAVG').map((point) => point.value);
  if (values.length === 0) return undefined;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return {
    sampleRateHz,
    sampleCount: values.length,
    meanLuma: rounded(mean),
    minLuma: rounded(Math.min(...values)),
    maxLuma: rounded(Math.max(...values)),
    standardDeviation: rounded(Math.sqrt(variance)),
  };
}

export function parseLoudnessOutput(output: string): AudioLoudnessSample[] {
  return parseFfmpegMetadataSeries(output, 'lavfi.r128.M')
    .filter((point) => point.value > -120 && point.value < 20)
    .map((point) => ({ timestampSec: point.timestampSec, momentaryLufs: rounded(point.value) }));
}
