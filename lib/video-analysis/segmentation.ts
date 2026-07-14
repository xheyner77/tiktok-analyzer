export interface SegmentTranscriptInput {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface SegmentTranscriptWordInput {
  id: string;
  segmentId: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface SegmentFrameInput {
  id: string;
  timestampSec: number;
}

export interface TimelineSceneCutInput {
  timestamp: number;
  score?: number;
}

export type TimelineBoundaryEventKind = 'scene_cut' | 'silence_boundary';

export interface TimelineBoundaryEvent {
  kind: TimelineBoundaryEventKind;
  timestampSec: number;
  /** FFmpeg scene score when available. Silence boundaries use zero. */
  strength: number;
  /** True when this event is itself one of the retained segment boundaries. */
  selectedAsBoundary: boolean;
}

export interface TimelineEventCoverage {
  sceneCutCount: number;
  silenceBoundaryCount: number;
  originalCount: number;
  includedCount: number;
  omittedCount: number;
  representativeEvents: TimelineBoundaryEvent[];
  canonicalEventsPreservedInTechnicalSignals: true;
}

export interface TimelineSegmentSpec {
  id: string;
  startTime: number;
  endTime: number;
  transcript: string;
  transcriptRefs: string[];
  /** Word-level references retained for this exact slice when word timing exists. */
  transcriptWordRefs: string[];
  /** Parent transcript segments retained so exact quotes remain traceable end-to-end. */
  transcriptSegmentRefs: string[];
  transcriptTimingPrecision: 'word' | 'segment' | 'mixed' | 'unavailable';
  transcriptTimingNote: string;
  frameRefs: string[];
  evidenceRefs: string[];
  /** Bounded prompt view; counts make any event fusion explicit rather than silent. */
  eventCoverage: TimelineEventCoverage;
}

export const TIMELINE_SEGMENTS_PER_PROVIDER_CALL = 8;
export const MAX_TIMELINE_PROVIDER_CALLS = 10;
export const MAX_TIMELINE_SEGMENTS = TIMELINE_SEGMENTS_PER_PROVIDER_CALL * MAX_TIMELINE_PROVIDER_CALLS;

const MIN_SEGMENT_SEC = 1;
const STRONG_SCENE_SCORE = 0.45;
const MAX_REPRESENTATIVE_EVENTS_PER_SEGMENT = 12;

function roundMillis(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function uniqueSorted(values: number[], duration: number): number[] {
  return [...new Set(values
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= duration)
    .map(roundMillis))]
    .sort((a, b) => a - b);
}

interface InternalBoundaryEvent {
  kind: TimelineBoundaryEventKind;
  timestampSec: number;
  strength: number;
}

function normalizeSceneCut(value: number | TimelineSceneCutInput): InternalBoundaryEvent | null {
  const timestamp = typeof value === 'number' ? value : Number(value.timestamp);
  if (!Number.isFinite(timestamp)) return null;
  const suppliedScore = typeof value === 'number' ? 1 : Number(value.score);
  return {
    kind: 'scene_cut',
    timestampSec: roundMillis(timestamp),
    strength: Number.isFinite(suppliedScore)
      ? Math.max(0, Math.min(1, suppliedScore))
      : 0,
  };
}

function normalizeBoundaryEvents(input: {
  durationSec: number;
  sceneCuts: Array<number | TimelineSceneCutInput>;
  silenceBoundaries: number[];
}): InternalBoundaryEvent[] {
  const events = [
    ...input.sceneCuts.flatMap((value) => {
      const event = normalizeSceneCut(value);
      return event ? [event] : [];
    }),
    ...input.silenceBoundaries
      .filter(Number.isFinite)
      .map((timestampSec): InternalBoundaryEvent => ({
        kind: 'silence_boundary',
        timestampSec: roundMillis(timestampSec),
        strength: 0,
      })),
  ].filter((event) => event.timestampSec > 0 && event.timestampSec < input.durationSec);

  const deduplicated = new Map<string, InternalBoundaryEvent>();
  for (const event of events) {
    const key = `${event.kind}:${event.timestampSec.toFixed(3)}`;
    const previous = deduplicated.get(key);
    if (!previous || event.strength > previous.strength) deduplicated.set(key, event);
  }
  return [...deduplicated.values()].sort((left, right) => (
    left.timestampSec - right.timestampSec
    || right.strength - left.strength
    || left.kind.localeCompare(right.kind)
  ));
}

function buildCoverageBoundaries(durationSec: number, maxSegmentSec: number): number[] {
  const boundaries = [0];
  if (durationSec > 3) boundaries.push(3);
  let cursor = boundaries[boundaries.length - 1];
  while (durationSec - cursor > maxSegmentSec + 0.001) {
    cursor = roundMillis(cursor + maxSegmentSec);
    boundaries.push(cursor);
  }
  if (boundaries[boundaries.length - 1] !== durationSec) boundaries.push(durationSec);
  return boundaries;
}

function maximumBoundaryGap(boundaries: readonly number[]): number {
  return boundaries.slice(1).reduce(
    (maximum, boundary, index) => Math.max(maximum, boundary - boundaries[index]),
    0,
  );
}

/**
 * Segment-only transcripts cannot be truthfully split at an arbitrary timeline
 * boundary. When the budget permits it, protect their exact provider bounds and
 * remove the coverage boundary that would otherwise cut through their text.
 */
function alignBoundariesToSegmentTimedTranscript(input: {
  baseBoundaries: number[];
  transcriptSegments: SegmentTranscriptInput[];
  transcriptWords: SegmentTranscriptWordInput[];
  durationSec: number;
  maxSegmentSec: number;
  maxSegments: number;
}): number[] {
  const segmentIdsWithWords = new Set(input.transcriptWords.map((word) => word.segmentId));
  let aligned = [...input.baseBoundaries];
  const candidates = input.transcriptSegments
    .filter((segment) => (
      !segmentIdsWithWords.has(segment.id)
      && Number.isFinite(segment.startSec)
      && Number.isFinite(segment.endSec)
      && segment.startSec >= 0
      && segment.endSec <= input.durationSec
      && segment.endSec > segment.startSec
      && segment.endSec - segment.startSec <= input.maxSegmentSec + 0.001
    ))
    .sort((left, right) => left.startSec - right.startSec || left.endSec - right.endSec);

  for (const transcript of candidates) {
    const proposed = uniqueSorted([
      ...aligned.filter((boundary) => (
        boundary <= transcript.startSec + 0.001 || boundary >= transcript.endSec - 0.001
      )),
      transcript.startSec,
      transcript.endSec,
    ], input.durationSec);
    if (
      proposed.length - 1 <= input.maxSegments
      && maximumBoundaryGap(proposed) <= input.maxSegmentSec + 0.001
    ) {
      aligned = proposed;
    }
  }
  return aligned;
}

function distanceToClosestBoundary(timestampSec: number, boundaries: readonly number[]): number {
  return boundaries.reduce(
    (minimum, boundary) => Math.min(minimum, Math.abs(boundary - timestampSec)),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * Keeps the strongest event first, then distributes the remaining choices over
 * the full duration. This prevents equal-score fast cuts near the opening from
 * consuming the whole budget while still retaining an exceptional scene score.
 */
function selectTierCandidates(
  candidates: readonly InternalBoundaryEvent[],
  capacity: number,
): InternalBoundaryEvent[] {
  if (capacity <= 0 || candidates.length === 0) return [];
  if (candidates.length <= capacity) return [...candidates];

  const strongest = [...candidates].sort((left, right) => (
    right.strength - left.strength
    || left.timestampSec - right.timestampSec
  ))[0];
  const selected = new Map<string, InternalBoundaryEvent>([[
    `${strongest.kind}:${strongest.timestampSec}`,
    strongest,
  ]]);
  const remaining = candidates.filter((candidate) => candidate !== strongest);
  const remainingCapacity = capacity - selected.size;
  for (let index = 0; index < remainingCapacity; index += 1) {
    const sourceIndex = remainingCapacity === 1
      ? Math.floor((remaining.length - 1) / 2)
      : Math.round((index * (remaining.length - 1)) / Math.max(1, remainingCapacity - 1));
    const candidate = remaining[sourceIndex];
    if (candidate) selected.set(`${candidate.kind}:${candidate.timestampSec}`, candidate);
  }

  if (selected.size < capacity) {
    for (const candidate of [...remaining].sort((left, right) => (
      right.strength - left.strength || left.timestampSec - right.timestampSec
    ))) {
      selected.set(`${candidate.kind}:${candidate.timestampSec}`, candidate);
      if (selected.size >= capacity) break;
    }
  }
  return [...selected.values()].sort((left, right) => left.timestampSec - right.timestampSec);
}

function retainEventBoundaries(input: {
  baseBoundaries: number[];
  events: InternalBoundaryEvent[];
  maxSegments: number;
  durationSec: number;
}): number[] {
  const selected = [...input.baseBoundaries];
  let remainingCapacity = input.maxSegments - (selected.length - 1);
  if (remainingCapacity <= 0) return selected;

  const addTier = (tier: InternalBoundaryEvent[]) => {
    if (remainingCapacity <= 0) return;
    const eligible = tier.filter((event) => (
      distanceToClosestBoundary(event.timestampSec, selected) >= MIN_SEGMENT_SEC
    ));
    const preferred = selectTierCandidates(eligible, remainingCapacity);
    const fallback = [...eligible]
      .filter((event) => !preferred.includes(event))
      .sort((left, right) => right.strength - left.strength || left.timestampSec - right.timestampSec);

    for (const event of [...preferred, ...fallback]) {
      if (remainingCapacity <= 0) break;
      if (distanceToClosestBoundary(event.timestampSec, selected) < MIN_SEGMENT_SEC) continue;
      selected.push(event.timestampSec);
      remainingCapacity -= 1;
    }
  };

  const strongScenes = input.events.filter((event) => (
    event.kind === 'scene_cut' && event.strength >= STRONG_SCENE_SCORE
  ));
  const otherScenes = input.events.filter((event) => (
    event.kind === 'scene_cut' && event.strength < STRONG_SCENE_SCORE
  ));
  const silence = input.events.filter((event) => event.kind === 'silence_boundary');
  addTier(strongScenes);
  addTier(otherScenes);
  addTier(silence);

  return uniqueSorted(selected, input.durationSec);
}

function representativeEvents(
  events: InternalBoundaryEvent[],
  selectedBoundaries: readonly number[],
): TimelineBoundaryEvent[] {
  const decorate = (event: InternalBoundaryEvent): TimelineBoundaryEvent => ({
    ...event,
    selectedAsBoundary: selectedBoundaries.some((boundary) => Math.abs(boundary - event.timestampSec) <= 0.001),
  });
  if (events.length <= MAX_REPRESENTATIVE_EVENTS_PER_SEGMENT) return events.map(decorate);

  const strongest = [...events].sort((left, right) => (
    (right.kind === 'scene_cut' ? 1 : 0) - (left.kind === 'scene_cut' ? 1 : 0)
    || right.strength - left.strength
    || left.timestampSec - right.timestampSec
  ))[0];
  const selected = new Map<string, InternalBoundaryEvent>([[
    `${strongest.kind}:${strongest.timestampSec}`,
    strongest,
  ]]);
  const distributed = selectTierCandidates(
    events.filter((event) => event !== strongest),
    MAX_REPRESENTATIVE_EVENTS_PER_SEGMENT - 1,
  );
  for (const event of distributed) selected.set(`${event.kind}:${event.timestampSec}`, event);
  return [...selected.values()]
    .sort((left, right) => left.timestampSec - right.timestampSec)
    .slice(0, MAX_REPRESENTATIVE_EVENTS_PER_SEGMENT)
    .map(decorate);
}

function buildBoundaries(input: {
  durationSec: number;
  sceneCuts: Array<number | TimelineSceneCutInput>;
  silenceBoundaries: number[];
  transcriptSegments: SegmentTranscriptInput[];
  transcriptWords: SegmentTranscriptWordInput[];
  maxSegmentSec: number;
  maxSegments: number;
}): number[] {
  const baseBoundaries = alignBoundariesToSegmentTimedTranscript({
    baseBoundaries: buildCoverageBoundaries(input.durationSec, input.maxSegmentSec),
    transcriptSegments: input.transcriptSegments,
    transcriptWords: input.transcriptWords,
    durationSec: input.durationSec,
    maxSegmentSec: input.maxSegmentSec,
    maxSegments: input.maxSegments,
  });
  if (baseBoundaries.length - 1 > input.maxSegments) {
    throw new Error('TIMELINE_SEGMENT_BUDGET_TOO_SMALL');
  }
  const events = normalizeBoundaryEvents(input);
  const retained = retainEventBoundaries({
    baseBoundaries,
    events,
    maxSegments: input.maxSegments,
    durationSec: input.durationSec,
  });
  if (retained.length - 1 > input.maxSegments) {
    throw new Error('TIMELINE_SEGMENT_BUDGET_EXCEEDED');
  }
  return retained;
}

export function buildTimelineSegments(input: {
  durationSec: number;
  transcriptSegments: SegmentTranscriptInput[];
  transcriptWords?: SegmentTranscriptWordInput[];
  frames: SegmentFrameInput[];
  sceneCuts?: Array<number | TimelineSceneCutInput>;
  silenceBoundaries?: number[];
  maxSegmentSec?: number;
  maxSegments?: number;
}): TimelineSegmentSpec[] {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    throw new TypeError('La durée doit être positive.');
  }
  const maxSegmentSec = Math.max(4, Math.min(15, input.maxSegmentSec ?? 12));
  const maxSegments = Math.max(1, Math.min(
    MAX_TIMELINE_SEGMENTS,
    Math.floor(input.maxSegments ?? MAX_TIMELINE_SEGMENTS),
  ));
  const transcriptWords = (input.transcriptWords ?? []).filter((word) => (
    Number.isFinite(word.startSec)
    && Number.isFinite(word.endSec)
    && word.endSec >= word.startSec
    && word.startSec >= 0
    && word.endSec <= input.durationSec
  ));
  const events = normalizeBoundaryEvents({
    durationSec: input.durationSec,
    sceneCuts: input.sceneCuts ?? [],
    silenceBoundaries: input.silenceBoundaries ?? [],
  });
  const boundaries = buildBoundaries({
    durationSec: input.durationSec,
    sceneCuts: input.sceneCuts ?? [],
    silenceBoundaries: input.silenceBoundaries ?? [],
    transcriptSegments: input.transcriptSegments,
    transcriptWords,
    maxSegmentSec,
    maxSegments,
  });

  return boundaries.slice(0, -1).map((startTime, index) => {
    const endTime = boundaries[index + 1];
    const overlappingTranscripts = input.transcriptSegments.filter((segment) => (
      segment.startSec < endTime && segment.endSec > startTime
    ));
    const words = transcriptWords.filter((word) => {
      const midpoint = (word.startSec + word.endSec) / 2;
      return midpoint >= startTime && (midpoint < endTime || endTime === input.durationSec);
    });
    const selectedWordSegmentIds = new Set(words.map((word) => word.segmentId));
    const fullyContainedSegmentTimedTranscripts = overlappingTranscripts.filter((segment) => (
      !transcriptWords.some((word) => word.segmentId === segment.id)
      && segment.startSec >= startTime - 0.001
      && segment.endSec <= endTime + 0.001
    ));
    const transcriptWordRefs = words.map((word) => word.id);
    const transcriptSegmentRefs = [...new Set([
      ...overlappingTranscripts
        .filter((segment) => selectedWordSegmentIds.has(segment.id))
        .map((segment) => segment.id),
      ...fullyContainedSegmentTimedTranscripts.map((segment) => segment.id),
    ])];
    const transcriptParts = [
      ...words.map((word) => word.text),
      ...fullyContainedSegmentTimedTranscripts.map((segment) => segment.text),
    ];
    const transcript = transcriptParts
      .join(' ')
      .replace(/\s+([,.;:!?â€¦])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    const omittedSegmentTimedTranscript = overlappingTranscripts.some((segment) => (
      !transcriptWords.some((word) => word.segmentId === segment.id)
      && !fullyContainedSegmentTimedTranscripts.includes(segment)
    ));
    const transcriptTimingPrecision = words.length && fullyContainedSegmentTimedTranscripts.length
      ? 'mixed' as const
      : words.length
        ? 'word' as const
        : fullyContainedSegmentTimedTranscripts.length
          ? 'segment' as const
          : 'unavailable' as const;
    const transcriptTimingNote = omittedSegmentTimedTranscript
      ? 'Un segment de transcription chevauche cette tranche sans horodatage par mot; son texte n\'est pas attribuÃ© Ã  une sous-plage pour Ã©viter une fausse prÃ©cision.'
      : transcriptTimingPrecision === 'word'
        ? 'Texte reconstruit uniquement avec les mots dont le milieu horodatÃ© appartient Ã  cette tranche.'
        : transcriptTimingPrecision === 'segment'
          ? 'Texte utilisÃ© uniquement parce que les bornes du segment de transcription sont entiÃ¨rement contenues dans cette tranche.'
          : transcriptTimingPrecision === 'mixed'
            ? 'Texte composÃ© de mots horodatÃ©s et de segments entiÃ¨rement contenus; aucune portion chevauchante non alignÃ©e n\'est dupliquÃ©e.'
            : 'Aucune parole horodatÃ©e attribuable avec prÃ©cision Ã  cette tranche.';
    const frames = input.frames.filter((frame) => (
      frame.timestampSec >= startTime && (frame.timestampSec < endTime || endTime === input.durationSec)
    ));
    const transcriptRefs = [...new Set([...transcriptWordRefs, ...transcriptSegmentRefs])];
    const frameRefs = frames.map((frame) => frame.id);
    const evidenceRefs = [...new Set([...frameRefs, ...transcriptRefs])];
    const segmentEvents = events.filter((event) => (
      event.timestampSec >= startTime
      && (event.timestampSec < endTime || endTime === input.durationSec)
    ));
    const representatives = representativeEvents(segmentEvents, boundaries);
    return {
      id: `timeline-${String(index + 1).padStart(3, '0')}`,
      startTime: roundMillis(startTime),
      endTime: roundMillis(endTime),
      transcript,
      transcriptRefs,
      transcriptWordRefs,
      transcriptSegmentRefs,
      transcriptTimingPrecision,
      transcriptTimingNote,
      frameRefs,
      evidenceRefs,
      eventCoverage: {
        sceneCutCount: segmentEvents.filter((event) => event.kind === 'scene_cut').length,
        silenceBoundaryCount: segmentEvents.filter((event) => event.kind === 'silence_boundary').length,
        originalCount: segmentEvents.length,
        includedCount: representatives.length,
        omittedCount: Math.max(0, segmentEvents.length - representatives.length),
        representativeEvents: representatives,
        canonicalEventsPreservedInTechnicalSignals: true,
      },
    };
  });
}

export function buildTimelineProviderBatches(
  specs: readonly TimelineSegmentSpec[],
): TimelineSegmentSpec[][] {
  const callCount = Math.ceil(specs.length / TIMELINE_SEGMENTS_PER_PROVIDER_CALL);
  if (callCount > MAX_TIMELINE_PROVIDER_CALLS) {
    throw new Error('TIMELINE_PROVIDER_CALL_BUDGET_EXCEEDED');
  }
  const batches: TimelineSegmentSpec[][] = [];
  for (let index = 0; index < specs.length; index += TIMELINE_SEGMENTS_PER_PROVIDER_CALL) {
    batches.push(specs.slice(index, index + TIMELINE_SEGMENTS_PER_PROVIDER_CALL));
  }
  return batches;
}

export function timelineCoversDuration(
  segments: Array<{ startTime: number; endTime: number }>,
  durationSec: number,
  toleranceSec = 0.1,
): boolean {
  if (!segments.length || Math.abs(segments[0].startTime) > toleranceSec) return false;
  if (Math.abs(segments[segments.length - 1].endTime - durationSec) > toleranceSec) return false;
  return segments.every((segment, index) => (
    segment.endTime > segment.startTime
    && (index === 0 || Math.abs(segment.startTime - segments[index - 1].endTime) <= toleranceSec)
  ));
}
