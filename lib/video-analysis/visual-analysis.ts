import 'server-only';
import { FatalError } from 'workflow';
import {
  createArtifactSignedUrls,
  listJobArtifacts,
  updateArtifactMetadataBatch,
  type AnalysisArtifactRow,
} from './artifacts';
import { getAnalysisProfileFromMetadata, configuredProfileModels } from './analysis-profiles';
import {
  VisualBatchObservationSchema,
  type VisualBatchObservation,
  type VisualFrameObservation,
} from './intermediate-schemas';
import { getAnalysisJobForWorkflow, updateJobStage } from './jobs';
import { parseStructuredResponse, type StructuredCallMetrics } from './openai-client';

interface TranscriptSegmentLike {
  startSec: number;
  endSec: number;
  text: string;
}

export interface OverlappingVisualBatch<T> {
  /** Previous batch's last frame, supplied only to compare the first target. */
  contextFrame: T | null;
  /** Frames for which the provider must return an observation. */
  targetFrames: T[];
  /** Every frame the provider is allowed to cite in persistent text groups. */
  evidenceFrames: T[];
}

export function buildOverlappingVisualBatches<T>(
  frames: readonly T[],
  targetsPerBatch: number,
): OverlappingVisualBatch<T>[] {
  const batchSize = Math.max(1, Math.floor(targetsPerBatch));
  const batches: OverlappingVisualBatch<T>[] = [];
  for (let index = 0; index < frames.length; index += batchSize) {
    const targetFrames = frames.slice(index, index + batchSize);
    const contextFrame = index > 0 ? frames[index - 1] : null;
    batches.push({
      contextFrame,
      targetFrames,
      evidenceFrames: contextFrame ? [contextFrame, ...targetFrames] : [...targetFrames],
    });
  }
  return batches;
}

function transcriptSegments(value: unknown): TranscriptSegmentLike[] {
  if (!value || typeof value !== 'object') return [];
  const normalized = (value as { normalized?: unknown }).normalized;
  if (!normalized || typeof normalized !== 'object') return [];
  const segments = (normalized as { segments?: unknown }).segments;
  if (!Array.isArray(segments)) return [];
  return segments.flatMap((segment) => {
    if (!segment || typeof segment !== 'object') return [];
    const row = segment as Record<string, unknown>;
    const startSec = Number(row.startSec);
    const endSec = Number(row.endSec);
    const text = typeof row.text === 'string' ? row.text : '';
    return Number.isFinite(startSec) && Number.isFinite(endSec)
      ? [{ startSec, endSec, text }]
      : [];
  });
}

function frameTimestamp(frame: AnalysisArtifactRow): number {
  return Number(frame.start_time);
}

export function validateVisualBatch(
  output: VisualBatchObservation,
  targetFrames: AnalysisArtifactRow[],
  evidenceFrames: AnalysisArtifactRow[] = targetFrames,
  expectedBatchId?: string,
): VisualBatchObservation {
  if (expectedBatchId && output.batchId !== expectedBatchId) {
    throw new Error('VISUAL_BATCH_ID_MISMATCH');
  }
  const expected = new Map(targetFrames.map((frame) => [frame.id, frameTimestamp(frame)]));
  if (output.frames.length !== targetFrames.length) throw new Error('VISUAL_BATCH_FRAME_COUNT_MISMATCH');
  const seen = new Set<string>();
  for (const observation of output.frames) {
    const timestamp = expected.get(observation.evidenceRef);
    if (timestamp === undefined || seen.has(observation.evidenceRef)) {
      throw new Error('VISUAL_BATCH_EVIDENCE_MISMATCH');
    }
    if (Math.abs(timestamp - observation.timestampSec) > 0.08) {
      throw new Error('VISUAL_BATCH_TIMESTAMP_MISMATCH');
    }
    seen.add(observation.evidenceRef);
  }
  const allowedPersistentEvidence = new Set(evidenceFrames.map((frame) => frame.id));
  for (const group of output.persistentTextGroups) {
    const uniqueReferences = new Set(group.evidenceRefs);
    if (
      uniqueReferences.size !== group.evidenceRefs.length
      || group.evidenceRefs.some((reference) => !allowedPersistentEvidence.has(reference))
    ) {
      throw new Error('VISUAL_PERSISTENT_TEXT_EVIDENCE_MISMATCH');
    }
  }
  return output;
}

function normalizedPersistentText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mergePersistentTextGroups(
  groups: ReadonlyArray<{ text: string; evidenceRefs: string[] }>,
  frames: readonly Pick<AnalysisArtifactRow, 'id' | 'start_time'>[],
): Array<{ text: string; evidenceRefs: string[] }> {
  const frameOrder = new Map(frames.map((frame, index) => [frame.id, {
    index,
    timestampSec: Number(frame.start_time),
  }]));
  const merged = new Map<string, Array<{ text: string; evidenceRefs: Set<string> }>>();

  for (const group of groups) {
    const key = normalizedPersistentText(group.text);
    const references = new Set(group.evidenceRefs);
    if (
      !key
      || references.size !== group.evidenceRefs.length
      || group.evidenceRefs.some((reference) => !frameOrder.has(reference))
    ) {
      throw new Error('VISUAL_PERSISTENT_TEXT_EVIDENCE_MISMATCH');
    }
    const occurrences = merged.get(key) ?? [];
    const overlapping = occurrences.filter((occurrence) => (
      [...references].some((reference) => occurrence.evidenceRefs.has(reference))
    ));
    if (overlapping.length === 0) {
      occurrences.push({ text: group.text.trim(), evidenceRefs: references });
      merged.set(key, occurrences);
      continue;
    }

    const combined = overlapping[0];
    references.forEach((reference) => combined.evidenceRefs.add(reference));
    for (const occurrence of overlapping.slice(1)) {
      occurrence.evidenceRefs.forEach((reference) => combined.evidenceRefs.add(reference));
    }
    merged.set(key, [
      ...occurrences.filter((occurrence) => !overlapping.includes(occurrence)),
      combined,
    ]);
  }

  return [...merged.values()].flat()
    .map((group) => ({
      text: group.text,
      evidenceRefs: [...group.evidenceRefs].sort((left, right) => {
        const leftFrame = frameOrder.get(left);
        const rightFrame = frameOrder.get(right);
        if (!leftFrame || !rightFrame) return left.localeCompare(right);
        const leftTime = Number.isFinite(leftFrame.timestampSec) ? leftFrame.timestampSec : leftFrame.index;
        const rightTime = Number.isFinite(rightFrame.timestampSec) ? rightFrame.timestampSec : rightFrame.index;
        return leftTime - rightTime || leftFrame.index - rightFrame.index;
      }),
    }))
    .sort((left, right) => {
      const leftFirst = frameOrder.get(left.evidenceRefs[0]);
      const rightFirst = frameOrder.get(right.evidenceRefs[0]);
      return (leftFirst?.index ?? Number.MAX_SAFE_INTEGER) - (rightFirst?.index ?? Number.MAX_SAFE_INTEGER)
        || left.text.localeCompare(right.text, 'fr');
    });
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await operation(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return result;
}

export function buildVisualBatchPayload(input: {
  batchId: string;
  targetFrames: AnalysisArtifactRow[];
  contextFrame: AnalysisArtifactRow | null;
  signedUrls: Map<string, string>;
  segments: TranscriptSegmentLike[];
}): { prompt: string; images: Array<{ dataUrl: string; detail: 'low' }> } {
  const evidenceFrames = input.contextFrame
    ? [input.contextFrame, ...input.targetFrames]
    : input.targetFrames;
  const catalog = evidenceFrames.map((frame, index) => {
    const timestamp = frameTimestamp(frame);
    const isContext = input.contextFrame?.id === frame.id;
    const targetIndex = index + (input.contextFrame ? 0 : 1);
    return `${isContext ? 'context' : `target:${targetIndex}`}|${frame.id}|${timestamp.toFixed(3)}`;
  }).join('\n');

  const transcriptCatalog = input.segments.map((segment) => (
    `${segment.startSec.toFixed(2)}-${segment.endSec.toFixed(2)}|${segment.text.replace(/\s+/g, ' ').trim()}`
  )).filter((line) => !line.endsWith('|')).join('\n').slice(0, 4_000);

  const images = evidenceFrames.map((frame) => {
    const signedUrl = input.signedUrls.get(frame.id);
    if (!signedUrl) throw new Error('VISUAL_FRAME_URL_MISSING');
    return { dataUrl: signedUrl, detail: 'low' as const };
  });

  return {
    prompt: [
      `batchId=${input.batchId}`,
      'Analyse chaque image fournie, dans le même ordre que le catalogue.',
      `Retourne exactement ${input.targetFrames.length} observations frames, uniquement pour les images cibles.`,
      'Recopie exactement evidenceRef et timestampSec des images cibles. Ne crée aucun autre timestamp.',
      'L’image de contexte éventuelle permet de décrire changeFromPrevious sur la première cible et de relier un texte persistant; elle ne doit pas apparaître dans frames.',
      'persistentTextGroups peut citer seulement les evidenceRef du catalogue, contexte inclus, sans doublon.',
      'Décris uniquement ce qui est visible. Les paroles proches servent seulement à vérifier une cohérence éventuelle.',
      'Pour le texte écran, ne transcris que les caractères réellement lisibles. Utilise not_observed en cas de doute.',
      'Ne déduis jamais vues, rétention, comportement spectateur, intention ou performance.',
      'Regroupe dans persistentTextGroups le même texte resté visible sur plusieurs frames.',
      '',
      catalog,
      transcriptCatalog ? `\nParoles horodatées (contexte seulement):\n${transcriptCatalog}` : '',
    ].join('\n'),
    images,
  };
}

const VISUAL_INSTRUCTIONS = [
  'Tu es le module d’observation visuelle de Viralynz.',
  'Tu sépares strictement visibilité, contexte de paroles et inférence.',
  'Tu ne donnes aucun conseil marketing et aucune prédiction de rétention.',
  'Une image floue ou ambiguë doit produire une confiance faible et une limitation explicite.',
  'Réponds uniquement selon le schéma structuré fourni.',
].join('\n');

export interface VisualAnalysisStepResult {
  frameCount: number;
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stageDurationMs: number;
  providerDurationMs: number;
  models: string[];
}

export async function analyzeAllFrames(jobId: string): Promise<VisualAnalysisStepResult> {
  let job = await getAnalysisJobForWorkflow(jobId);
  const frames = await listJobArtifacts(jobId, 'frame');
  if (!frames.length) throw new Error('VISUAL_FRAMES_MISSING');
  if (frames.every((frame) => frame.metadata.visualObservation)) {
    return {
      frameCount: frames.length,
      providerCalls: Number(job.cost_metrics.visualProviderCalls) || 0,
      inputTokens: Number(job.cost_metrics.visualInputTokens) || 0,
      outputTokens: Number(job.cost_metrics.visualOutputTokens) || 0,
      retries: Number(job.cost_metrics.visualRetries) || 0,
      stageDurationMs: Number(job.cost_metrics.visualDurationMs) || 0,
      providerDurationMs: Number(job.cost_metrics.visualProviderDurationMs) || 0,
      models: Array.isArray(job.cost_metrics.visualModels)
        ? job.cost_metrics.visualModels.filter((value): value is string => typeof value === 'string')
        : [],
    };
  }
  if (job.status === 'failed' || job.status === 'completed') {
    throw new FatalError('ANALYSIS_JOB_TERMINAL');
  }

  await updateJobStage({ jobId, status: 'visual_analysis', progress: 48 });
  job = await getAnalysisJobForWorkflow(jobId);
  const analysisProfile = getAnalysisProfileFromMetadata(job.source_metadata);
  const signedUrls = await createArtifactSignedUrls(frames, 900);
  const segments = transcriptSegments(job.transcript);
  const batches = buildOverlappingVisualBatches(
    frames,
    analysisProfile.framesPerVisionBatch,
  );
  const startedAt = Date.now();
  const models = configuredProfileModels(analysisProfile, 'visual_analysis');
  const outputs = await mapWithConcurrency(batches, 1, async (batch, index) => {
    const batchId = `visual-batch-${String(index + 1).padStart(2, '0')}`;
    const prepared = buildVisualBatchPayload({
      batchId,
      targetFrames: batch.targetFrames,
      contextFrame: batch.contextFrame,
      signedUrls,
      segments,
    });
    const response = await parseStructuredResponse({
      candidates: models,
      schema: VisualBatchObservationSchema,
      schemaName: 'viralynz_visual_batch',
      instructions: VISUAL_INSTRUCTIONS,
      prompt: prepared.prompt,
      images: prepared.images,
      maxOutputTokens: analysisProfile.stages.visual_analysis.maxOutputTokensPerCall,
      maxRetries: analysisProfile.maxProviderRetries,
      idempotencyKey: `${job.id}:${batchId}`,
    });
    return {
      output: validateVisualBatch(
        response.value,
        batch.targetFrames,
        batch.evidenceFrames,
        batchId,
      ),
      metrics: response.metrics,
    };
  });

  const observations = new Map<string, VisualFrameObservation>();
  const rawPersistentTextGroups: Array<{ text: string; evidenceRefs: string[] }> = [];
  for (const { output } of outputs) {
    output.frames.forEach((frame) => observations.set(frame.evidenceRef, frame));
    rawPersistentTextGroups.push(...output.persistentTextGroups);
  }
  if (observations.size !== frames.length) throw new Error('VISUAL_COVERAGE_INCOMPLETE');
  const persistentTextGroups = mergePersistentTextGroups(rawPersistentTextGroups, frames);

  await updateArtifactMetadataBatch(frames.map((frame) => ({
    id: frame.id,
    metadata: {
      ...frame.metadata,
      visualObservation: observations.get(frame.id),
    },
  })));

  const metrics = outputs.map((output) => output.metrics);
  const stageDurationMs = Date.now() - startedAt;
  const values = {
    visualProviderCalls: metrics.length,
    visualInputTokens: metrics.reduce((sum, metric) => sum + metric.inputTokens, 0),
    visualOutputTokens: metrics.reduce((sum, metric) => sum + metric.outputTokens, 0),
    visualRetries: metrics.reduce((sum, metric) => sum + metric.retries, 0),
    visualDurationMs: stageDurationMs,
    visualProviderDurationMs: metrics.reduce((sum, metric) => sum + metric.providerDurationMs, 0),
    visualModels: [...new Set(metrics.map((metric: StructuredCallMetrics) => metric.model))],
    persistentTextGroups,
  };
  await updateJobStage({
    jobId,
    status: 'visual_analysis',
    progress: 60,
    values: { cost_metrics: { ...job.cost_metrics, ...values } },
  });
  return {
    frameCount: frames.length,
    providerCalls: values.visualProviderCalls,
    inputTokens: values.visualInputTokens,
    outputTokens: values.visualOutputTokens,
    retries: values.visualRetries,
    stageDurationMs,
    providerDurationMs: values.visualProviderDurationMs,
    models: values.visualModels,
  };
}
