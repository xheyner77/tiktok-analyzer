import type {
  FfmpegSceneCut,
  FrameSampleReason,
  PlannedFrameSample,
  ResolvedFrameSample,
  VideoFramePoint,
} from './types';
import { VIDEO_PIPELINE_LIMITS } from './types';

const OPENING_TIMESTAMPS_SEC = [0, 0.2, 0.5, 1, 1.5, 2, 3] as const;
const TIMESTAMP_PRECISION = 1_000;

function roundTimestamp(value: number) {
  return Math.round(value * TIMESTAMP_PRECISION) / TIMESTAMP_PRECISION;
}

function addSample(
  target: Map<number, Set<FrameSampleReason>>,
  timestampSec: number,
  reason: FrameSampleReason,
  durationSec: number,
) {
  if (!Number.isFinite(timestampSec) || timestampSec < 0 || timestampSec >= durationSec) return;
  const timestamp = roundTimestamp(timestampSec);
  const existingTimestamp = [...target.keys()].find((item) => Math.abs(item - timestamp) <= 0.025);
  const key = existingTimestamp ?? timestamp;
  const reasons = target.get(key) ?? new Set<FrameSampleReason>();
  reasons.add(reason);
  target.set(key, reasons);
}

function chooseDistributedSceneCuts(sceneCuts: FfmpegSceneCut[], durationSec: number, maximum: number) {
  if (maximum <= 0) return [];
  const valid = sceneCuts
    .filter((cut) => Number.isFinite(cut.timestamp) && Number.isFinite(cut.score) && cut.timestamp > 0 && cut.timestamp < durationSec)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (valid.length <= maximum) return valid;

  const bucketWidth = durationSec / maximum;
  const byBucket = new Map<number, FfmpegSceneCut>();
  for (const cut of valid) {
    const bucket = Math.min(maximum - 1, Math.floor(cut.timestamp / bucketWidth));
    const current = byBucket.get(bucket);
    if (!current || cut.score > current.score) byBucket.set(bucket, cut);
  }

  const selected = [...byBucket.values()];
  if (selected.length < maximum) {
    const selectedKeys = new Set(selected.map((cut) => `${cut.timestamp}:${cut.score}`));
    const remaining = [...valid]
      .sort((a, b) => b.score - a.score)
      .filter((cut) => !selectedKeys.has(`${cut.timestamp}:${cut.score}`));
    selected.push(...remaining.slice(0, maximum - selected.length));
  }
  return selected.sort((a, b) => a.timestamp - b.timestamp).slice(0, maximum);
}

export interface AdaptiveSamplingOptions {
  maxFrames?: number;
  maxCoverageGapSec?: number;
  sceneContextOffsetSec?: number;
  maxSceneEvents?: number;
  silenceBoundariesSec?: number[];
  maxSilenceEvents?: number;
}

export interface FrameCoverageAssessment {
  usable: boolean;
  frameCount: number;
  startGapSec: number;
  endGapSec: number;
  largestGapSec: number;
  boundaryToleranceSec: number;
  gapToleranceSec: number;
}

/**
 * Assesses only timestamps of frames that were actually decoded. Small codec/FPS
 * offsets around the bounds are tolerated, but a real blind area still fails.
 */
export function assessDecodedFrameCoverage(
  timestampsSec: number[],
  durationSec: number,
  fps: number,
  maxCoverageGapSec: number,
): FrameCoverageAssessment {
  const timestamps = [...new Set(timestampsSec
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= durationSec)
    .map(roundTimestamp))]
    .sort((a, b) => a - b);
  const boundaryToleranceSec = 0.5;
  const gapToleranceSec = Math.min(0.5, Math.max(0.25, 2 / Math.max(1, fps)));
  const first = timestamps[0];
  const last = timestamps.at(-1);
  const startGapSec = first === undefined ? durationSec : first;
  const endGapSec = last === undefined ? durationSec : Math.max(0, durationSec - last);
  const largestGapSec = timestamps.length < 2
    ? durationSec
    : Math.max(...timestamps.slice(1).map((value, index) => value - timestamps[index]));
  const minimumFrameCount = durationSec <= boundaryToleranceSec * 2 ? 1 : 2;

  return {
    usable: timestamps.length >= minimumFrameCount
      && startGapSec <= boundaryToleranceSec
      && endGapSec <= boundaryToleranceSec
      && largestGapSec <= maxCoverageGapSec + gapToleranceSec,
    frameCount: timestamps.length,
    startGapSec,
    endGapSec,
    largestGapSec,
    boundaryToleranceSec,
    gapToleranceSec,
  };
}

function chooseDistributedTimestamps(values: number[], durationSec: number, maximum: number): number[] {
  const valid = [...new Set(values
    .filter((value) => Number.isFinite(value) && value > 0 && value < durationSec)
    .map(roundTimestamp))]
    .sort((a, b) => a - b);
  if (valid.length <= maximum) return valid;
  return Array.from({ length: maximum }, (_, index) => (
    valid[Math.min(valid.length - 1, Math.floor((index * valid.length) / maximum))]
  ));
}

/**
 * Builds a cost-bounded plan that always represents the opening, middle and end.
 * Scene samples consume only the capacity left after deterministic full-duration coverage.
 */
export function buildAdaptiveSamplePlan(
  durationSec: number,
  sceneCuts: FfmpegSceneCut[] = [],
  options: AdaptiveSamplingOptions = {},
): PlannedFrameSample[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];

  const maxFrames = Math.max(2, Math.floor(options.maxFrames ?? VIDEO_PIPELINE_LIMITS.maxFrames));
  const maxCoverageGapSec = Math.max(1, options.maxCoverageGapSec ?? VIDEO_PIPELINE_LIMITS.maxCoverageGapSec);
  const contextOffset = Math.max(0.08, options.sceneContextOffsetSec ?? 0.18);
  const samples = new Map<number, Set<FrameSampleReason>>();

  for (const timestamp of OPENING_TIMESTAMPS_SEC) {
    addSample(samples, timestamp, timestamp === 0 ? 'first_frame' : 'opening_detail', durationSec);
  }

  const endTimestamp = Math.max(0, durationSec - Math.min(0.05, durationSec / 2));
  addSample(samples, durationSec / 2, 'midpoint', durationSec);
  addSample(samples, endTimestamp, 'end', durationSec);

  // Aim for roughly 32 regular observations, while never leaving more than 12 s unseen.
  const regularGapSec = Math.min(maxCoverageGapSec, Math.max(2, durationSec / 32));
  for (let timestamp = regularGapSec; timestamp < endTimestamp; timestamp += regularGapSec) {
    addSample(samples, timestamp, 'regular_coverage', durationSec);
  }

  // When the budget is tight, preserve full-duration coverage first. Opening detail
  // then consumes only spare capacity, so a duplicate early anchor cannot create a
  // large blind area later in the video.
  if (samples.size > maxFrames) {
    samples.clear();
    addSample(samples, 0, 'first_frame', durationSec);
    addSample(samples, endTimestamp, 'end', durationSec);

    const requiredSegments = Math.max(1, Math.ceil(endTimestamp / maxCoverageGapSec));
    const coverageSegments = Math.min(requiredSegments, maxFrames - 1);
    for (let index = 1; index < coverageSegments; index++) {
      const timestamp = (endTimestamp * index) / coverageSegments;
      const isMiddle = index * 2 === coverageSegments;
      addSample(samples, timestamp, isMiddle ? 'midpoint' : 'regular_coverage', durationSec);
    }

    for (const timestamp of OPENING_TIMESTAMPS_SEC.slice(1)) {
      if (samples.size >= maxFrames) break;
      addSample(samples, timestamp, 'opening_detail', durationSec);
    }
  }

  const availableForSilence = Math.max(0, maxFrames - samples.size);
  const maximumSilenceEvents = Math.min(
    Math.max(0, Math.floor(options.maxSilenceEvents ?? 6)),
    Math.floor(availableForSilence / 3),
  );
  const selectedSilenceBoundaries = chooseDistributedTimestamps(
    options.silenceBoundariesSec ?? [],
    durationSec,
    maximumSilenceEvents,
  );
  for (const timestamp of selectedSilenceBoundaries) {
    if (samples.size >= maxFrames) break;
    addSample(samples, timestamp, 'silence_boundary', durationSec);
    if (samples.size >= maxFrames) break;
    addSample(samples, timestamp - 0.12, 'silence_context_before', durationSec);
    if (samples.size >= maxFrames) break;
    addSample(samples, timestamp + 0.12, 'silence_context_after', durationSec);
  }

  const availableForScenes = Math.max(0, maxFrames - samples.size);
  const configuredSceneEvents = Math.max(0, Math.floor(options.maxSceneEvents ?? 12));
  // Reserve three samples per selected event: transition, immediate before and immediate after.
  const maximumSceneEvents = Math.min(configuredSceneEvents, Math.floor(availableForScenes / 3));
  const selectedCuts = chooseDistributedSceneCuts(sceneCuts, durationSec, maximumSceneEvents);

  // First make the actual scene transitions visible.
  for (const cut of selectedCuts) {
    if (samples.size >= maxFrames) break;
    addSample(samples, cut.timestamp, 'scene_change', durationSec);
  }

  // Then spend remaining capacity on context immediately before/after the strongest cuts.
  const strongestCuts = [...selectedCuts].sort((a, b) => b.score - a.score);
  for (const cut of strongestCuts) {
    if (samples.size >= maxFrames) break;
    addSample(samples, cut.timestamp - contextOffset, 'scene_context_before', durationSec);
    if (samples.size >= maxFrames) break;
    addSample(samples, cut.timestamp + contextOffset, 'scene_context_after', durationSec);
  }

  return [...samples.entries()]
    .map(([requestedTimestampSec, reasons]) => ({
      requestedTimestampSec,
      reasons: [...reasons],
    }))
    .sort((a, b) => a.requestedTimestampSec - b.requestedTimestampSec)
    .slice(0, maxFrames);
}

function closestFrameIndex(timeline: VideoFramePoint[], requestedTimestampSec: number) {
  let low = 0;
  let high = timeline.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (timeline[middle].timestampSec < requestedTimestampSec) low = middle + 1;
    else high = middle - 1;
  }
  const after = timeline[Math.min(timeline.length - 1, low)];
  const before = timeline[Math.max(0, low - 1)];
  if (!after) return before?.frameIndex ?? 0;
  if (!before) return after.frameIndex;
  return Math.abs(before.timestampSec - requestedTimestampSec) <= Math.abs(after.timestampSec - requestedTimestampSec)
    ? before.frameIndex
    : after.frameIndex;
}

/** Resolves requested timestamps to actual decoded frame timestamps and merges duplicates. */
export function resolveSamplePlanToFrames(
  plan: PlannedFrameSample[],
  timeline: VideoFramePoint[],
): ResolvedFrameSample[] {
  if (timeline.length === 0) return [];
  const byFrame = new Map<number, ResolvedFrameSample>();
  const pointsByIndex = new Map(timeline.map((point) => [point.frameIndex, point]));

  for (const sample of plan) {
    const frameIndex = closestFrameIndex(timeline, sample.requestedTimestampSec);
    const point = pointsByIndex.get(frameIndex);
    if (!point) continue;
    const existing = byFrame.get(frameIndex);
    if (existing) {
      existing.requestedTimestampsSec.push(sample.requestedTimestampSec);
      existing.reasons = [...new Set([...existing.reasons, ...sample.reasons])];
      continue;
    }
    byFrame.set(frameIndex, {
      ...point,
      requestedTimestampsSec: [sample.requestedTimestampSec],
      reasons: [...sample.reasons],
    });
  }

  return [...byFrame.values()].sort((a, b) => a.frameIndex - b.frameIndex);
}
