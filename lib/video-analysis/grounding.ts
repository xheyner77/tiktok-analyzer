import type { AnalysisArtifactRow } from './artifacts';
import type { AnalysisJobRow } from './types';

export const SPECIALIST_PROMPT_MAX_CHARACTERS = 120_000;
export const SYNTHESIS_PROMPT_MAX_CHARACTERS = 350_000;

export interface DistributedPromptCoverage {
  strategy: 'distributed_full_duration';
  originalCount: number;
  includedCount: number;
  omittedCount: number;
  includedIds: string[];
  openingId: string | null;
  midpointId: string | null;
  endingId: string | null;
  sourceStartSec: number | null;
  sourceEndSec: number | null;
  canonicalDataPreservedOutsidePrompt: true;
}

export interface DistributedTemporalPromptView<T> {
  items: T[];
  coverage: DistributedPromptCoverage;
}

function finiteTime(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Deterministic selection that always includes first, middle and last. */
export function distributedPromptSample<T>(items: readonly T[], maximumItems: number): T[] {
  const maximum = Math.max(1, Math.floor(maximumItems));
  if (items.length <= maximum) return [...items];
  if (maximum === 1) return [items[0]];
  const indices = Array.from({ length: maximum }, (_, index) => (
    Math.round((index * (items.length - 1)) / (maximum - 1))
  ));
  return indices.map((index) => items[index]);
}

export function buildDistributedTemporalPromptView<T>(input: {
  items: readonly T[];
  maximumItems: number;
  getId: (item: T, index: number) => string;
  getStartSec: (item: T) => number;
  getEndSec: (item: T) => number;
}): DistributedTemporalPromptView<T> {
  const indexed = input.items
    .map((item, index) => ({ item, sourceIndex: index }))
    .sort((left, right) => input.getStartSec(left.item) - input.getStartSec(right.item));
  const selected = distributedPromptSample(indexed, input.maximumItems);
  const sourceStartSec = indexed.length ? finiteTime(input.getStartSec(indexed[0].item)) : null;
  const sourceEndSec = indexed.length
    ? finiteTime(input.getEndSec(indexed[indexed.length - 1].item))
    : null;
  const midpointSec = sourceStartSec !== null && sourceEndSec !== null
    ? sourceStartSec + ((sourceEndSec - sourceStartSec) / 2)
    : null;
  const midpoint = midpointSec === null || !selected.length
    ? null
    : selected.reduce((nearest, candidate) => {
        const candidateMidpoint = (input.getStartSec(candidate.item) + input.getEndSec(candidate.item)) / 2;
        const nearestMidpoint = (input.getStartSec(nearest.item) + input.getEndSec(nearest.item)) / 2;
        return Math.abs(candidateMidpoint - midpointSec) < Math.abs(nearestMidpoint - midpointSec)
          ? candidate
          : nearest;
      });
  const id = (entry: { item: T; sourceIndex: number } | null): string | null => (
    entry ? input.getId(entry.item, entry.sourceIndex) : null
  );

  return {
    items: selected.map((entry) => entry.item),
    coverage: {
      strategy: 'distributed_full_duration',
      originalCount: indexed.length,
      includedCount: selected.length,
      omittedCount: Math.max(0, indexed.length - selected.length),
      includedIds: selected.map((entry) => input.getId(entry.item, entry.sourceIndex)),
      openingId: id(selected[0] ?? null),
      midpointId: id(midpoint),
      endingId: id(selected[selected.length - 1] ?? null),
      sourceStartSec,
      sourceEndSec,
      canonicalDataPreservedOutsidePrompt: true,
    },
  };
}

export function compactPromptText(value: string, maximumCharacters = 800): string {
  const maximum = Math.max(0, Math.floor(maximumCharacters));
  if (value.length <= maximum) return value;
  let omittedCount = Math.max(0, value.length - maximum);
  let marker = `...[${omittedCount} characters omitted from prompt view; canonical source preserved]...`;
  for (let pass = 0; pass < 3; pass += 1) {
    omittedCount = value.length - Math.max(0, maximum - marker.length);
    marker = `...[${omittedCount} characters omitted from prompt view; canonical source preserved]...`;
  }
  if (marker.length >= maximum) return marker.slice(0, maximum);
  const available = maximum - marker.length;
  const openingLength = Math.ceil(available * 0.6);
  const endingLength = Math.max(0, available - openingLength);
  return `${value.slice(0, openingLength)}${marker}${endingLength ? value.slice(-endingLength) : ''}`;
}

export function compactValueForPrompt(
  value: unknown,
  options: { maximumStringCharacters?: number; maximumArrayItems?: number; depth?: number } = {},
): unknown {
  const maximumStringCharacters = options.maximumStringCharacters ?? 800;
  const maximumArrayItems = options.maximumArrayItems ?? 120;
  const depth = options.depth ?? 0;
  if (depth > 12) return '[depth omitted from prompt view; canonical source preserved]';
  if (typeof value === 'string') return compactPromptText(value, maximumStringCharacters);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const selected = distributedPromptSample(value, maximumArrayItems);
    const items = selected.map((item) => compactValueForPrompt(item, {
      maximumStringCharacters,
      maximumArrayItems,
      depth: depth + 1,
    }));
    if (selected.length === value.length) return items;
    return {
      promptView: 'distributed_array',
      items,
      coverage: {
        strategy: 'distributed_full_duration',
        originalCount: value.length,
        includedCount: selected.length,
        omittedCount: value.length - selected.length,
        canonicalDataPreservedOutsidePrompt: true,
      },
    };
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    compactValueForPrompt(item, {
      maximumStringCharacters,
      maximumArrayItems,
      depth: depth + 1,
    }),
  ]));
}

export function assertPromptCharacterBudget(
  prompt: string,
  maximumCharacters: number,
  errorCode = 'ANALYSIS_PROMPT_CONTEXT_TOO_LARGE',
): string {
  if (prompt.length >= maximumCharacters) throw new Error(errorCode);
  return prompt;
}

export const TECHNICAL_EVIDENCE_IDS = Object.freeze({
  sceneCutCount: 'signal-visual-scene-count',
  cutsPerMinute: 'signal-visual-cut-density',
  blackFrames: 'signal-visual-black',
  freezes: 'signal-visual-freeze',
  averageLuma: 'signal-visual-brightness-mean',
  brightnessVariation: 'signal-visual-brightness-variation',
  silence: 'signal-audio-silence',
  meanVolume: 'signal-audio-mean-volume',
  peakVolume: 'signal-audio-peak-volume',
  loudness: 'signal-audio-loudness',
  speechLoudnessVariation: 'signal-audio-speech-loudness-variation',
  nonSpeechLoudness: 'signal-audio-non-speech-loudness',
  saturationRisk: 'signal-audio-saturation-risk',
  backgroundNoise: 'signal-audio-background-noise-risk',
  vocalEnergyVariation: 'signal-audio-vocal-energy-variation',
  initialSilence: 'signal-audio-initial-silence',
  firstSpeech: 'signal-audio-first-speech',
  speechRatio: 'signal-transcript-speech-ratio',
  speakingRate: 'signal-transcript-speaking-rate',
  averageSentenceLength: 'signal-transcript-average-sentence-length',
  wordDensity: 'signal-transcript-word-density',
  repeatedPhrases: 'signal-transcript-repeated-phrases',
  hesitations: 'signal-transcript-hesitations',
  pauses: 'signal-transcript-pauses',
} as const);

function measured(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as { availability?: unknown }).availability === 'measured');
}

export function transcriptFromJob(job: AnalysisJobRow): {
  status: 'available' | 'unavailable';
  text: string;
  segments: Array<{ id: string; startSec: number; endSec: number; text: string; wordIds: string[] }>;
  words: Array<{ id: string; segmentId: string; startSec: number; endSec: number; text: string }>;
} {
  if (!job.transcript || typeof job.transcript !== 'object') {
    return { status: 'unavailable', text: '', segments: [], words: [] };
  }
  const transcript = job.transcript as Record<string, unknown>;
  const normalized = transcript.normalized && typeof transcript.normalized === 'object'
    ? transcript.normalized as Record<string, unknown>
    : {};
  const segments = Array.isArray(normalized.segments)
    ? normalized.segments.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const startSec = Number(row.startSec);
        const endSec = Number(row.endSec);
        if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || typeof row.id !== 'string') return [];
        return [{
          id: row.id,
          startSec,
          endSec,
          text: typeof row.text === 'string' ? row.text : '',
          wordIds: Array.isArray(row.wordIds)
            ? row.wordIds.filter((id): id is string => typeof id === 'string')
            : [],
        }];
      })
    : [];
  const words = Array.isArray(normalized.words)
    ? normalized.words.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const startSec = Number(row.startSec);
        const endSec = Number(row.endSec);
        if (
          !Number.isFinite(startSec)
          || !Number.isFinite(endSec)
          || typeof row.id !== 'string'
          || typeof row.segmentId !== 'string'
        ) return [];
        return [{
          id: row.id,
          segmentId: row.segmentId,
          startSec,
          endSec,
          text: typeof row.text === 'string' ? row.text : '',
        }];
      })
    : [];
  return {
    status: transcript.status === 'available' ? 'available' : 'unavailable',
    text: typeof normalized.text === 'string' ? normalized.text : '',
    segments,
    words,
  };
}

type PromptTranscript = ReturnType<typeof transcriptFromJob>;

export function buildTranscriptPromptView(
  transcript: PromptTranscript,
  options: {
    maximumSegments?: number;
    maximumWords?: number;
    maximumSegmentCharacters?: number;
    maximumWordCharacters?: number;
  } = {},
) {
  const segmentView = buildDistributedTemporalPromptView({
    items: transcript.segments,
    maximumItems: options.maximumSegments ?? 100,
    getId: (segment) => segment.id,
    getStartSec: (segment) => segment.startSec,
    getEndSec: (segment) => segment.endSec,
  });
  const wordView = buildDistributedTemporalPromptView({
    items: transcript.words,
    maximumItems: options.maximumWords ?? 480,
    getId: (word) => word.id,
    getStartSec: (word) => word.startSec,
    getEndSec: (word) => word.endSec,
  });
  return {
    status: transcript.status,
    canonicalTranscriptStorage: 'analysis_jobs.transcript + final engine evidence',
    fullTextDuplicatedInPrompt: false,
    segments: {
      items: segmentView.items.map((segment) => ({
        id: segment.id,
        startSec: segment.startSec,
        endSec: segment.endSec,
        text: compactPromptText(segment.text, options.maximumSegmentCharacters ?? 480),
        wordIds: distributedPromptSample(segment.wordIds, 80),
        wordIdCoverage: {
          strategy: 'distributed_full_duration',
          originalCount: segment.wordIds.length,
          includedCount: Math.min(segment.wordIds.length, 80),
          omittedCount: Math.max(0, segment.wordIds.length - 80),
          canonicalDataPreservedOutsidePrompt: true,
        },
      })),
      coverage: segmentView.coverage,
    },
    words: {
      columns: ['id', 'segmentId', 'startSec', 'endSec', 'text'],
      items: wordView.items.map((word) => [
        word.id,
        word.segmentId,
        word.startSec,
        word.endSec,
        compactPromptText(word.text, options.maximumWordCharacters ?? 80),
      ]),
      coverage: wordView.coverage,
    },
  };
}

export function technicalEvidenceIds(job: AnalysisJobRow): Set<string> {
  const ids = new Set<string>();
  const signals = job.technical_signals && typeof job.technical_signals === 'object'
    ? job.technical_signals as Record<string, unknown>
    : {};
  const audio = signals.audio && typeof signals.audio === 'object'
    ? signals.audio as Record<string, unknown>
    : {};
  if (measured(signals.sceneCuts)) ids.add(TECHNICAL_EVIDENCE_IDS.sceneCutCount);
  if (measured(signals.cutDensityPerMinute)) ids.add(TECHNICAL_EVIDENCE_IDS.cutsPerMinute);
  if (measured(signals.blackIntervals)) ids.add(TECHNICAL_EVIDENCE_IDS.blackFrames);
  if (measured(signals.freezeIntervals)) ids.add(TECHNICAL_EVIDENCE_IDS.freezes);
  if (measured(signals.brightness)) {
    ids.add(TECHNICAL_EVIDENCE_IDS.averageLuma);
    ids.add(TECHNICAL_EVIDENCE_IDS.brightnessVariation);
  }
  if (measured(audio.silenceIntervals)) ids.add(TECHNICAL_EVIDENCE_IDS.silence);
  if (measured(audio.meanVolumeDb)) ids.add(TECHNICAL_EVIDENCE_IDS.meanVolume);
  if (measured(audio.peakVolumeDb)) ids.add(TECHNICAL_EVIDENCE_IDS.peakVolume);
  if (measured(audio.loudnessSamples)) ids.add(TECHNICAL_EVIDENCE_IDS.loudness);
  if (measured(audio.initialSilenceDurationSec)) ids.add(TECHNICAL_EVIDENCE_IDS.initialSilence);
  if (measured(audio.firstSpeechTimeSec)) ids.add(TECHNICAL_EVIDENCE_IDS.firstSpeech);
  const transcript = transcriptFromJob(job);
  if (transcript.status === 'available' && transcript.segments.length) {
    ids.add(TECHNICAL_EVIDENCE_IDS.speechRatio);
    ids.add(TECHNICAL_EVIDENCE_IDS.firstSpeech);
    ids.add(TECHNICAL_EVIDENCE_IDS.speakingRate);
    ids.add(TECHNICAL_EVIDENCE_IDS.averageSentenceLength);
    ids.add(TECHNICAL_EVIDENCE_IDS.wordDensity);
    ids.add(TECHNICAL_EVIDENCE_IDS.repeatedPhrases);
    ids.add(TECHNICAL_EVIDENCE_IDS.hesitations);
  }
  if (transcript.words.length > 1) ids.add(TECHNICAL_EVIDENCE_IDS.pauses);
  return ids;
}

export function buildKnownEvidenceSet(job: AnalysisJobRow, frames: AnalysisArtifactRow[]): Set<string> {
  const transcript = transcriptFromJob(job);
  return new Set([
    ...frames.map((frame) => frame.id),
    ...transcript.segments.map((segment) => segment.id),
    ...transcript.words.map((word) => word.id),
    ...technicalEvidenceIds(job),
  ]);
}

export function buildFrameObservationCatalog(frames: AnalysisArtifactRow[]) {
  return frames.map((frame) => ({
    evidenceRef: frame.id,
    timestampSec: Number(frame.start_time),
    samplingReason: frame.metadata.samplingReason,
    visualObservation: frame.metadata.visualObservation ?? null,
  }));
}

export function buildFrameObservationPromptView(
  frames: AnalysisArtifactRow[],
  maximumFrames = 36,
) {
  const catalog = buildFrameObservationCatalog(frames);
  const view = buildDistributedTemporalPromptView({
    items: catalog,
    maximumItems: maximumFrames,
    getId: (frame) => frame.evidenceRef,
    getStartSec: (frame) => frame.timestampSec,
    getEndSec: (frame) => frame.timestampSec,
  });
  return {
    items: view.items.map((frame) => ({
      ...frame,
      visualObservation: compactValueForPrompt(frame.visualObservation, {
        maximumStringCharacters: 240,
        maximumArrayItems: 12,
      }),
    })),
    coverage: view.coverage,
  };
}

function compactMeasuredArray(value: unknown, maximum: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const measurement = value as Record<string, unknown>;
  if (measurement.availability !== 'measured' || !Array.isArray(measurement.value)) return value;
  const original = measurement.value;
  if (original.length <= maximum) return value;
  const sampled = Array.from({ length: maximum }, (_, index) => (
    original[Math.min(original.length - 1, Math.floor((index * original.length) / maximum))]
  ));
  return {
    ...measurement,
    value: sampled,
    promptSampling: {
      strategy: 'distributed_full_duration',
      originalCount: original.length,
      includedCount: sampled.length,
      omittedCount: original.length - sampled.length,
      canonicalDataPreservedOutsidePrompt: true,
    },
  };
}

export function measuredTechnicalCatalog(job: AnalysisJobRow): Record<string, unknown> {
  const signals = job.technical_signals && typeof job.technical_signals === 'object'
    ? job.technical_signals as Record<string, unknown>
    : {};
  const audio = signals.audio && typeof signals.audio === 'object'
    ? signals.audio as Record<string, unknown>
    : {};
  return {
    evidenceIds: [...technicalEvidenceIds(job)],
    probe: job.probe,
    signals: {
      ...signals,
      sceneCuts: compactMeasuredArray(signals.sceneCuts, 240),
      cutIntervalsSec: compactMeasuredArray(signals.cutIntervalsSec, 240),
      blackIntervals: compactMeasuredArray(signals.blackIntervals, 200),
      freezeIntervals: compactMeasuredArray(signals.freezeIntervals, 200),
      audio: {
        ...audio,
        silenceIntervals: compactMeasuredArray(audio.silenceIntervals, 200),
        loudnessSamples: compactMeasuredArray(audio.loudnessSamples, 240),
      },
    },
    coverage: {
      durationSeconds: job.source_metadata.durationSeconds,
      hasAudio: job.source_metadata.hasAudio,
      frameCount: job.source_metadata.frameCount,
      coverageStartSeconds: job.source_metadata.coverageStartSeconds,
      coverageEndSeconds: job.source_metadata.coverageEndSeconds,
      maximumFrameGapSeconds: job.source_metadata.maximumFrameGapSeconds,
      samplingStrategy: job.source_metadata.samplingStrategy,
    },
  };
}

export function safeJsonForPrompt(value: unknown, maximumCharacters = 120_000): string {
  const serialized = JSON.stringify(value);
  if (serialized.length > maximumCharacters) {
    throw new Error('ANALYSIS_PROMPT_CONTEXT_TOO_LARGE');
  }
  return serialized;
}
