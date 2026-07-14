export interface VideoPipelineLimits {
  maxDurationSec: number;
  maxFileBytes: number;
  maxPixelCount: number;
  maxFps: number;
  maxPixelRate: number;
  maxDecodedFrames: number;
  maxFrames: number;
  maxCoverageGapSec: number;
}

export const VIDEO_PIPELINE_LIMITS = {
  maxDurationSec: 600,
  maxFileBytes: 500 * 1024 * 1024,
  maxPixelCount: 4096 * 2160,
  maxFps: 120,
  maxPixelRate: 4096 * 2160 * 60,
  maxDecodedFrames: 600 * 120,
  maxFrames: 72,
  maxCoverageGapSec: 12,
} as const satisfies VideoPipelineLimits;

export type Measurement<T> =
  | { availability: 'measured'; value: T; method: string }
  | { availability: 'unavailable'; reason: string };

export interface FfmpegProbeMetadata {
  container?: string;
  durationSec?: number;
  startTimeSec?: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  aspectRatio?: number;
  aspectRatioLabel?: string;
  fps?: number;
  bitrate?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRateHz?: number;
  rotationDeg?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface FfmpegSceneCut {
  timestamp: number;
  score: number;
}

export type FrameSampleReason =
  | 'first_frame'
  | 'opening_detail'
  | 'regular_coverage'
  | 'midpoint'
  | 'end'
  | 'scene_change'
  | 'scene_context_before'
  | 'scene_context_after'
  | 'silence_boundary'
  | 'silence_context_before'
  | 'silence_context_after';

export interface PlannedFrameSample {
  requestedTimestampSec: number;
  reasons: FrameSampleReason[];
}

export interface VideoFramePoint {
  frameIndex: number;
  timestampSec: number;
  sourceTimestampSec: number;
}

export interface ResolvedFrameSample extends VideoFramePoint {
  requestedTimestampsSec: number[];
  reasons: FrameSampleReason[];
}

export interface ExtractedVideoFrame extends ResolvedFrameSample {
  dataBase64: string;
  mimeType: 'image/jpeg';
}

export interface ExtractedAudio {
  audioBase64: string;
  mimeType: 'audio/wav';
  byteLength: number;
  sampleRateHz: 16_000;
  channels: 1;
}

export interface TimeInterval {
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
}

export interface BrightnessMeasurement {
  sampleRateHz: number;
  sampleCount: number;
  meanLuma: number;
  minLuma: number;
  maxLuma: number;
  standardDeviation: number;
}

export interface AudioLoudnessSample {
  timestampSec: number;
  momentaryLufs: number;
}

export interface AudioTechnicalSignals {
  silenceIntervals: Measurement<TimeInterval[]>;
  initialSilenceDurationSec: Measurement<number>;
  firstNonSilentAudioSec: Measurement<number>;
  firstSpeechTimeSec: Measurement<number>;
  meanVolumeDb: Measurement<number>;
  peakVolumeDb: Measurement<number>;
  loudnessSamples: Measurement<AudioLoudnessSample[]>;
  voiceMusicBalance: Measurement<number>;
  saturation: Measurement<boolean>;
}

export interface VideoTechnicalSignals {
  sceneCuts: Measurement<FfmpegSceneCut[]>;
  cutIntervalsSec: Measurement<number[]>;
  cutDensityPerMinute: Measurement<number>;
  blackIntervals: Measurement<TimeInterval[]>;
  freezeIntervals: Measurement<TimeInterval[]>;
  brightness: Measurement<BrightnessMeasurement>;
  audio: AudioTechnicalSignals;
}

export type VideoPipelineLimitCode =
  | 'VIDEO_DURATION_UNAVAILABLE'
  | 'VIDEO_DURATION_EXCEEDED'
  | 'VIDEO_FILE_TOO_LARGE'
  | 'VIDEO_RESOLUTION_EXCEEDED'
  | 'VIDEO_FRAME_RATE_EXCEEDED'
  | 'VIDEO_PIXEL_RATE_EXCEEDED'
  | 'VIDEO_STREAM_MISSING';

export class VideoPipelineLimitError extends Error {
  readonly code: VideoPipelineLimitCode;
  readonly observed?: number;
  readonly maximum?: number;

  constructor(code: VideoPipelineLimitCode, message: string, details: { observed?: number; maximum?: number } = {}) {
    super(message);
    this.name = 'VideoPipelineLimitError';
    this.code = code;
    this.observed = details.observed;
    this.maximum = details.maximum;
  }
}
