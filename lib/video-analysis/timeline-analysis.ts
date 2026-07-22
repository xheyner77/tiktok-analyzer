import 'server-only';
import { FatalError } from 'workflow';
import { TimelineSegmentSchema, type TimelineSegment } from '@/lib/analysis-engine/index';
import { listJobArtifacts } from './artifacts';
import { getVideoAnalysisModelConfig } from './config';
import {
  buildFrameObservationCatalog,
  buildKnownEvidenceSet,
  measuredTechnicalCatalog,
  safeJsonForPrompt,
  TECHNICAL_EVIDENCE_IDS,
  technicalEvidenceIds,
  transcriptFromJob,
} from './grounding';
import { TimelineAnalysisChunkSchema } from './intermediate-schemas';
import { getAnalysisJobForWorkflow, updateJobStage } from './jobs';
import { parseStructuredResponse } from './openai-client';
import {
  buildTimelineProviderBatches,
  buildTimelineSegments,
  timelineCoversDuration,
  type TimelineSegmentSpec,
} from './segmentation';

function measuredValue<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { availability?: unknown; value?: unknown };
  return row.availability === 'measured' ? row.value as T : null;
}

function timeSignals(job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>) {
  const technical = job.technical_signals && typeof job.technical_signals === 'object'
    ? job.technical_signals as Record<string, unknown>
    : {};
  const audio = technical.audio && typeof technical.audio === 'object'
    ? technical.audio as Record<string, unknown>
    : {};
  const sceneCuts = measuredValue<Array<{ timestamp?: unknown; score?: unknown }>>(technical.sceneCuts) ?? [];
  const silence = measuredValue<Array<{ startTimeSec?: unknown; endTimeSec?: unknown }>>(audio.silenceIntervals) ?? [];
  return {
    sceneCuts: sceneCuts.flatMap((item) => {
      const timestamp = Number(item.timestamp);
      const score = Number(item.score);
      return Number.isFinite(timestamp)
        ? [{ timestamp, ...(Number.isFinite(score) ? { score } : {}) }]
        : [];
    }),
    silenceBoundaries: silence
      .flatMap((item) => [Number(item.startTimeSec), Number(item.endTimeSec)])
      .filter(Number.isFinite),
  };
}

function exactSegmentMatch(output: TimelineSegment, spec: TimelineSegmentSpec): boolean {
  return output.id === spec.id
    && Math.abs(output.startTime - spec.startTime) <= 0.01
    && Math.abs(output.endTime - spec.endTime) <= 0.01;
}

function observationReferences(value: TimelineSegment['transcript']): string[] {
  return value.status === 'available' ? value.evidence : [];
}

function overlapsSegment(
  segment: TimelineSegmentSpec,
  startSec: number,
  endSec = startSec,
): boolean {
  return Number.isFinite(startSec)
    && Number.isFinite(endSec)
    && endSec >= segment.startTime - 0.05
    && startSec <= segment.endTime + 0.05;
}

function measuredRecordValue<T>(source: Record<string, unknown>, key: string): T | null {
  return measuredValue<T>(source[key]);
}

/**
 * Aggregate measurements are not automatically valid proof for every moment.
 * Expose a technical ID only when its canonical samples or intervals overlap
 * the segment, except for a segment that explicitly covers the whole video.
 */
function segmentScopedTechnicalEvidence(
  job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>,
  spec: TimelineSegmentSpec,
): Set<string> {
  const available = technicalEvidenceIds(job);
  const scoped = new Set<string>();
  const technical = job.technical_signals && typeof job.technical_signals === 'object'
    ? job.technical_signals as Record<string, unknown>
    : {};
  const audio = technical.audio && typeof technical.audio === 'object'
    ? technical.audio as Record<string, unknown>
    : {};
  const durationSec = Number(job.source_metadata.durationSeconds);
  const coversWholeVideo = Number.isFinite(durationSec)
    && spec.startTime <= 0.05
    && spec.endTime >= durationSec - 0.05;
  const include = (id: string, condition: boolean) => {
    if (condition && available.has(id)) scoped.add(id);
  };

  const sceneCuts = measuredRecordValue<Array<{ timestamp?: unknown }>>(technical, 'sceneCuts') ?? [];
  include(TECHNICAL_EVIDENCE_IDS.sceneCutCount, sceneCuts.some((cut) => (
    overlapsSegment(spec, Number(cut.timestamp))
  )));

  const blackIntervals = measuredRecordValue<Array<{ startTimeSec?: unknown; endTimeSec?: unknown }>>(technical, 'blackIntervals') ?? [];
  include(TECHNICAL_EVIDENCE_IDS.blackFrames, blackIntervals.some((interval) => (
    overlapsSegment(spec, Number(interval.startTimeSec), Number(interval.endTimeSec))
  )));

  const freezeIntervals = measuredRecordValue<Array<{ startTimeSec?: unknown; endTimeSec?: unknown }>>(technical, 'freezeIntervals') ?? [];
  include(TECHNICAL_EVIDENCE_IDS.freezes, freezeIntervals.some((interval) => (
    overlapsSegment(spec, Number(interval.startTimeSec), Number(interval.endTimeSec))
  )));

  const silenceIntervals = measuredRecordValue<Array<{ startTimeSec?: unknown; endTimeSec?: unknown }>>(audio, 'silenceIntervals') ?? [];
  include(TECHNICAL_EVIDENCE_IDS.silence, silenceIntervals.some((interval) => (
    overlapsSegment(spec, Number(interval.startTimeSec), Number(interval.endTimeSec))
  )));

  const loudnessSamples = measuredRecordValue<Array<{ timestampSec?: unknown }>>(audio, 'loudnessSamples') ?? [];
  include(TECHNICAL_EVIDENCE_IDS.loudness, loudnessSamples.some((sample) => (
    overlapsSegment(spec, Number(sample.timestampSec))
  )));

  const initialSilence = Number(measuredRecordValue<number>(audio, 'initialSilenceDurationSec'));
  include(
    TECHNICAL_EVIDENCE_IDS.initialSilence,
    Number.isFinite(initialSilence) && initialSilence > 0 && overlapsSegment(spec, 0, initialSilence),
  );

  const transcript = transcriptFromJob(job);
  const firstSpeech = transcript.status === 'available'
    ? transcript.segments[0]?.startSec
    : Number(measuredRecordValue<number>(audio, 'firstSpeechTimeSec'));
  include(
    TECHNICAL_EVIDENCE_IDS.firstSpeech,
    typeof firstSpeech === 'number' && Number.isFinite(firstSpeech) && overlapsSegment(spec, firstSpeech),
  );
  const hasPause = transcript.words.slice(1).some((word, index) => {
    const previous = transcript.words[index];
    return word.startSec - previous.endSec >= 0.4
      && overlapsSegment(spec, previous.endSec, word.startSec);
  });
  include(TECHNICAL_EVIDENCE_IDS.pauses, hasPause);

  if (coversWholeVideo) {
    [
      TECHNICAL_EVIDENCE_IDS.cutsPerMinute,
      TECHNICAL_EVIDENCE_IDS.averageLuma,
      TECHNICAL_EVIDENCE_IDS.brightnessVariation,
      TECHNICAL_EVIDENCE_IDS.meanVolume,
      TECHNICAL_EVIDENCE_IDS.peakVolume,
      TECHNICAL_EVIDENCE_IDS.speechRatio,
      TECHNICAL_EVIDENCE_IDS.speakingRate,
      TECHNICAL_EVIDENCE_IDS.averageSentenceLength,
      TECHNICAL_EVIDENCE_IDS.wordDensity,
      TECHNICAL_EVIDENCE_IDS.repeatedPhrases,
      TECHNICAL_EVIDENCE_IDS.hesitations,
    ].forEach((id) => include(id, true));
  }
  return scoped;
}

function allowedSegmentEvidence(input: {
  job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>;
  spec: TimelineSegmentSpec;
  knownEvidence: Set<string>;
}): Set<string> {
  return new Set([
    ...input.spec.transcriptRefs,
    ...input.spec.frameRefs,
    ...segmentScopedTechnicalEvidence(input.job, input.spec),
  ].filter((reference) => input.knownEvidence.has(reference)));
}

export function validateTimelineChunk(input: {
  output: TimelineSegment[];
  specs: TimelineSegmentSpec[];
  allowedEvidenceBySegment: ReadonlyMap<string, ReadonlySet<string>>;
  hasAudio: boolean;
}) {
  if (input.output.length !== input.specs.length) throw new Error('TIMELINE_SEGMENT_COUNT_MISMATCH');
  return input.output.map((segment, index) => {
    const spec = input.specs[index];
    if (!exactSegmentMatch(segment, spec)) throw new Error('TIMELINE_BOUNDARY_MISMATCH');
    if (!spec.frameRefs.length && segment.visualObservation.status !== 'unavailable') {
      throw new Error('TIMELINE_VISUAL_INVENTED');
    }
    const references = [
      ...segment.evidence,
      ...observationReferences(segment.transcript),
      ...observationReferences(segment.visualObservation),
      ...observationReferences(segment.audioObservation),
      ...observationReferences(segment.editingObservation),
    ];
    const allowedEvidence = input.allowedEvidenceBySegment.get(spec.id);
    if (!allowedEvidence || references.some((reference) => !allowedEvidence.has(reference))) {
      throw new Error('TIMELINE_OUT_OF_RANGE_EVIDENCE');
    }
    if (segment.transcript.status === 'available') {
      if (
        !spec.transcript
        || segment.transcript.text.replace(/\s+/g, ' ').trim() !== spec.transcript.replace(/\s+/g, ' ').trim()
        || segment.transcript.evidence.some((ref) => !spec.transcriptRefs.includes(ref))
      ) {
        throw new Error('TIMELINE_TRANSCRIPT_EVIDENCE_MISMATCH');
      }
      if (
        (spec.transcriptTimingPrecision === 'word' || spec.transcriptTimingPrecision === 'mixed')
        && !segment.transcript.evidence.some((ref) => spec.transcriptWordRefs.includes(ref))
      ) {
        throw new Error('TIMELINE_TRANSCRIPT_WORD_EVIDENCE_REQUIRED');
      }
    } else if (spec.transcript) {
      throw new Error('TIMELINE_TRANSCRIPT_OMITTED');
    }
    if (
      segment.visualObservation.status === 'available'
      && segment.visualObservation.evidence.some((ref) => !spec.frameRefs.includes(ref))
    ) {
      throw new Error('TIMELINE_VISUAL_EVIDENCE_MISMATCH');
    }
    if (!input.hasAudio && segment.audioObservation.status !== 'unavailable') {
      throw new Error('TIMELINE_AUDIO_INVENTED');
    }
    return TimelineSegmentSchema.parse(segment);
  });
}

const TIMELINE_INSTRUCTIONS = [
  'Le transcript exact est deja decoupe selon transcriptTimingPrecision. Quand elle vaut word ou mixed, cite au moins une transcriptWordRefs; ne remplace jamais ce texte par le segment parent entier.',
  'Si frameRefs est vide, visualObservation doit obligatoirement etre status=unavailable: une frame voisine hors de la plage ne prouve rien sur ce segment.',
  'Tu construis la timeline éditoriale complète de Viralynz.',
  'Tu dois retourner exactement les segments, IDs et bornes fournis, dans le même ordre.',
  'Chaque observation et chaque segment cite seulement les evidenceRefs autorisées pour ce segment; une preuve d’une autre plage est interdite.',
  'Un champ sans preuve devient status=unavailable avec une raison factuelle.',
  'Observation = présent dans la vidéo; diagnostic = impact possible sur l’objectif; action = changement précis avec formulation ou geste applicable.',
  'Ne prédis jamais un départ spectateur et ne présente jamais un risque éditorial comme une rétention réelle.',
  'Les problèmes génériques isolés sont interdits.',
  'Réponds uniquement selon le schéma structuré.',
].join('\n');

export interface TimelineAnalysisStepResult {
  timeline: TimelineSegment[];
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stageDurationMs: number;
  providerDurationMs: number;
  models: string[];
}

export async function analyzeCompleteTimeline(jobId: string): Promise<TimelineAnalysisStepResult> {
  let job = await getAnalysisJobForWorkflow(jobId);
  const cached = job.source_metadata.timeline;
  if (Array.isArray(cached)) {
    return {
      timeline: cached.map((segment) => TimelineSegmentSchema.parse(segment)),
      providerCalls: Number(job.cost_metrics.timelineProviderCalls) || 0,
      inputTokens: Number(job.cost_metrics.timelineInputTokens) || 0,
      outputTokens: Number(job.cost_metrics.timelineOutputTokens) || 0,
      retries: Number(job.cost_metrics.timelineRetries) || 0,
      stageDurationMs: Number(job.cost_metrics.timelineDurationMs) || 0,
      providerDurationMs: Number(job.cost_metrics.timelineProviderDurationMs) || 0,
      models: Array.isArray(job.cost_metrics.timelineModels)
        ? job.cost_metrics.timelineModels.filter((value): value is string => typeof value === 'string')
        : [],
    };
  }
  if (job.status === 'failed' || job.status === 'completed') {
    throw new FatalError('ANALYSIS_JOB_TERMINAL');
  }

  await updateJobStage({ jobId, status: 'segment_analysis', progress: 73 });
  job = await getAnalysisJobForWorkflow(jobId);
  const frames = await listJobArtifacts(jobId, 'frame');
  const transcript = transcriptFromJob(job);
  const durationSec = Number(job.source_metadata.durationSeconds);
  const times = timeSignals(job);
  const specs = buildTimelineSegments({
    durationSec,
    transcriptSegments: transcript.segments,
    transcriptWords: transcript.words,
    frames: frames.map((frame) => ({ id: frame.id, timestampSec: Number(frame.start_time) })),
    sceneCuts: times.sceneCuts,
    silenceBoundaries: times.silenceBoundaries,
  });
  if (!timelineCoversDuration(specs, durationSec)) throw new Error('TIMELINE_SPEC_COVERAGE_FAILED');

  const knownEvidence = buildKnownEvidenceSet(job, frames);
  const frameCatalog = buildFrameObservationCatalog(frames);
  const technicalEvidence = [...technicalEvidenceIds(job)];
  const batches = buildTimelineProviderBatches(specs);
  const calls: Array<{
    inputTokens: number;
    outputTokens: number;
    retries: number;
    model: string;
    providerDurationMs: number;
  }> = [];
  const startedAt = Date.now();
  const timeline: TimelineSegment[] = [];

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const batchStart = batch[0].startTime;
    const batchEnd = batch[batch.length - 1].endTime;
    const relevantFrames = frameCatalog.filter((frame) => (
      frame.timestampSec >= batchStart - 0.1 && frame.timestampSec <= batchEnd + 0.1
    ));
    const allowedEvidenceBySegment = new Map(batch.map((spec) => [
      spec.id,
      allowedSegmentEvidence({ job, spec, knownEvidence }),
    ]));
    const promptContext = {
      creatorContext: job.creator_context,
      hasAudio: job.source_metadata.hasAudio === true,
      exactSegments: batch,
      frameObservations: relevantFrames,
      technicalEvidenceIds: technicalEvidence,
      technicalMeasurements: measuredTechnicalCatalog(job),
      allowedEvidenceRefsBySegment: Object.fromEntries(
        [...allowedEvidenceBySegment].map(([segmentId, references]) => [segmentId, [...references]]),
      ),
    };
    const response = await parseStructuredResponse({
      candidates: getVideoAnalysisModelConfig().extractionCandidates,
      schema: TimelineAnalysisChunkSchema,
      schemaName: 'viralynz_timeline_chunk',
      instructions: TIMELINE_INSTRUCTIONS,
      prompt: [
        `Chunk ${index + 1}/${batches.length}; durée vidéo exacte ${durationSec.toFixed(3)} s.`,
        'Utilise exclusivement allowedEvidenceRefsBySegment pour chaque segment, y compris segment.evidence et les observations audio/montage.',
        'Les exactSegments contiennent le transcript réel déjà associé à chaque plage. Ne le paraphrase pas dans transcript.text.',
        safeJsonForPrompt(promptContext),
      ].join('\n'),
      maxOutputTokens: 6_000,
      maxRetries: 1,
      idempotencyKey: `${job.id}:timeline:${index + 1}`,
    });
    calls.push(response.metrics);
    timeline.push(...validateTimelineChunk({
      output: response.value.segments,
      specs: batch,
      allowedEvidenceBySegment,
      hasAudio: job.source_metadata.hasAudio === true,
    }));
  }

  if (!timelineCoversDuration(timeline, durationSec)) throw new Error('TIMELINE_COVERAGE_INCOMPLETE');
  const stageDurationMs = Date.now() - startedAt;
  const sourceMetadata = { ...job.source_metadata, timeline };
  const costMetrics = {
    ...job.cost_metrics,
    timelineProviderCalls: calls.length,
    timelineInputTokens: calls.reduce((sum, call) => sum + call.inputTokens, 0),
    timelineOutputTokens: calls.reduce((sum, call) => sum + call.outputTokens, 0),
    timelineRetries: calls.reduce((sum, call) => sum + call.retries, 0),
    timelineDurationMs: stageDurationMs,
    timelineProviderDurationMs: calls.reduce((sum, call) => sum + call.providerDurationMs, 0),
    timelineModels: [...new Set(calls.map((call) => call.model))],
    timelineSegmentCount: timeline.length,
  };
  await updateJobStage({
    jobId,
    status: 'segment_analysis',
    progress: 81,
    values: { source_metadata: sourceMetadata, cost_metrics: costMetrics },
  });
  return {
    timeline,
    providerCalls: calls.length,
    inputTokens: costMetrics.timelineInputTokens,
    outputTokens: costMetrics.timelineOutputTokens,
    retries: costMetrics.timelineRetries,
    stageDurationMs,
    providerDurationMs: costMetrics.timelineProviderDurationMs,
    models: costMetrics.timelineModels,
  };
}
