import 'server-only';
import { join } from 'node:path';
import { FatalError } from 'workflow';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import {
  buildCreatorMemoryV2Context,
  learnCreatorMemoryV2,
  loadCreatorMemoryV2,
} from '@/lib/creator-memory/v2-adapter';
import {
  extractAdaptiveFramesWithFfmpeg,
  extractAudioToWavFile,
  getVideoFileSize,
  measureTechnicalSignalsWithFfmpeg,
  probeVideoStrict,
  validateVideoAgainstLimits,
  VideoPipelineLimitError,
} from '@/lib/ffmpeg-video-pipeline';
import {
  SpecialistDiagnosticSchema,
  TimelineSegmentSchema,
  type FinalAnalysisResult,
} from '@/lib/analysis-engine/index';
import {
  createArtifactSignedUrls,
  listJobArtifacts,
  persistFrameArtifacts,
  persistTemporaryAudioArtifact,
  removeAllJobArtifacts,
  removeArtifact,
} from './artifacts';
import { VIDEO_ANALYSIS_LIMITS } from './config';
import { VIDEO_ANALYSIS_VERSIONS } from './config';
import { getAnalysisProfileFromMetadata } from './analysis-profiles';
import { buildDeterministicEvidence } from './evidence';
import {
  cleanupTerminalJobStorage,
  createInputSignedUrl,
  completeAnalysisJob,
  getAnalysisJobForWorkflow,
  incrementJobAttempts,
  markJobFailed,
  recordCompletedJobMemoryOutcome,
  updateJobStage,
} from './jobs';
import { toHonestLegacyAnalysisResult } from './legacy-adapter';
import { assertCrossVideoRecommendationsDistinct } from './cross-video-genericity';
import {
  buildProviderCostRollup,
  finalizeExpiredProviderAttempts,
  persistProviderCostRollup,
} from './provider-ledger';
import { assessDecodedFrameCoverage } from '@/lib/video-pipeline/sampling';
import { runSpecialistAnalyses, type SpecialistStepResult } from './specialists';
import {
  parseSynthesisCheckpoint,
  runCritiqueAndSynthesis,
  type CritiqueAndSynthesisResult,
  type SynthesisCheckpoint,
} from './synthesis';
import { parsePublicAnalysisFailure } from './public-errors';
import { createAnalysisTempDir, downloadPrivateFile, removeAnalysisTempDir } from './temp-files';
import { analyzeCompleteTimeline, type TimelineAnalysisStepResult } from './timeline-analysis';
import { transcribeCompleteAudio } from './transcription';
import { analyzeAllFrames, type VisualAnalysisStepResult } from './visual-analysis';
import { classifyAnalysisStepError } from './workflow-error-policy';

function samplingReason(reasons: string[]): string {
  if (reasons.includes('first_frame') || reasons.includes('opening_detail')) return 'opening';
  if (reasons.some((reason) => reason.startsWith('scene_'))) return 'scene_change';
  if (reasons.some((reason) => reason.startsWith('silence_'))) return 'silence_boundary';
  if (reasons.includes('end')) return 'ending';
  return 'adaptive_interval';
}

function publicPipelineError(error: unknown): { code: string; message: string; permanent: boolean } {
  if (error instanceof VideoPipelineLimitError) {
    return { code: error.code, message: error.message, permanent: true };
  }
  const code = error instanceof Error ? error.message : 'ANALYSIS_PREPROCESSING_FAILED';
  const knownPermanent: Record<string, string> = {
    ANALYSIS_PRIVATE_DOWNLOAD_TOO_LARGE: 'Le fichier dépasse la limite technique annoncée.',
    ANALYSIS_UPLOAD_SIZE_MISMATCH: 'Le fichier envoyé est incomplet.',
    VIDEO_METADATA_INCOMPLETE: 'Les métadonnées indispensables de la vidéo sont illisibles.',
    VIDEO_FRAME_COVERAGE_INCOMPLETE: 'Impossible d’extraire suffisamment d’images de cette vidéo. Vérifie son format ou essaie de la réencoder. Ton quota n’a pas été consommé.',
  };
  return {
    code: knownPermanent[code] ? code : 'ANALYSIS_PREPROCESSING_FAILED',
    message: knownPermanent[code] ?? 'Le prétraitement vidéo a échoué après plusieurs tentatives.',
    permanent: Boolean(knownPermanent[code]),
  };
}

function assertJobNotFailed(job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>): void {
  if (job.status === 'failed') {
    throw new FatalError('ANALYSIS_JOB_ALREADY_FAILED:Ce traitement est déjà terminé en erreur.');
  }
}

function assertJobCanPerformProviderWork(job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>): void {
  assertJobNotFailed(job);
  if (job.status === 'completed') {
    throw new FatalError('ANALYSIS_JOB_ALREADY_COMPLETED:Cette analyse est déjà enregistrée.');
  }
}

export interface WorkflowDisposition {
  status: 'runnable' | 'completed' | 'failed';
  analysisId: string | null;
}

export async function getWorkflowDispositionStep(jobId: string): Promise<WorkflowDisposition> {
  'use step';
  const job = await getAnalysisJobForWorkflow(jobId);
  if (job.status === 'completed') return { status: 'completed', analysisId: job.analysis_id };
  if (job.status === 'failed') return { status: 'failed', analysisId: null };
  if (job.quota_state !== 'reserved') {
    throw new FatalError('ANALYSIS_QUOTA_NOT_RESERVED:Le quota n’a pas été réservé pour ce traitement.');
  }
  return { status: 'runnable', analysisId: null };
}

export interface PreprocessStepResult {
  durationSeconds: number;
  frameCount: number;
  hasAudio: boolean;
  audioBytes: number;
  stageDurationMs: number;
}

export async function preprocessVideoStep(jobId: string): Promise<PreprocessStepResult> {
  'use step';

  const existing = await getAnalysisJobForWorkflow(jobId);
  assertJobNotFailed(existing);
  const existingFrames = await listJobArtifacts(jobId, 'frame');
  if (
    existing.probe
    && typeof existing.source_metadata?.frameCount === 'number'
    && existingFrames.length === existing.source_metadata.frameCount
  ) {
    return {
      durationSeconds: Number(existing.source_metadata.durationSeconds) || 0,
      frameCount: existingFrames.length,
      hasAudio: existing.source_metadata.hasAudio === true,
      audioBytes: Number(existing.source_metadata.audioBytes) || 0,
      stageDurationMs: Number(existing.cost_metrics.preprocessingDurationMs) || 0,
    };
  }
  assertJobCanPerformProviderWork(existing);
  const analysisProfile = getAnalysisProfileFromMetadata(existing.source_metadata);

  await updateJobStage({ jobId, status: 'preprocessing', progress: 10 });
  await incrementJobAttempts(jobId);
  await removeAllJobArtifacts(jobId);
  const startedAt = Date.now();
  const tempDir = await createAnalysisTempDir(jobId);
  const inputPath = join(tempDir, 'input-video');
  const audioPath = join(tempDir, 'audio.wav');

  try {
    const signedUrl = await createInputSignedUrl(existing, 300);
    await downloadPrivateFile({
      signedUrl,
      destination: inputPath,
      maxBytes: VIDEO_ANALYSIS_LIMITS.maxFileBytes,
      timeoutMs: 180_000,
    });
    const actualBytes = await getVideoFileSize(inputPath);
    const probe = await probeVideoStrict(inputPath);
    await validateVideoAgainstLimits(probe, {
      fileSizeBytes: actualBytes,
      limits: {
        maxFileBytes: VIDEO_ANALYSIS_LIMITS.maxFileBytes,
        maxDurationSec: analysisProfile.maxDurationSeconds,
        maxFrames: analysisProfile.maxFrames,
        maxCoverageGapSec: 12,
      },
    });

    if (
      !probe.durationSec
      || !probe.width
      || !probe.height
      || !probe.fps
      || !probe.container
      || !probe.videoCodec
    ) {
      throw new Error('VIDEO_METADATA_INCOMPLETE');
    }

    const technicalSignals = await measureTechnicalSignalsWithFfmpeg(inputPath, probe);
    const sceneCuts = technicalSignals.sceneCuts.availability === 'measured'
      ? technicalSignals.sceneCuts.value
      : [];
    const silenceBoundaries = technicalSignals.audio.silenceIntervals.availability === 'measured'
      ? technicalSignals.audio.silenceIntervals.value.flatMap((interval) => [
          interval.startTimeSec,
          interval.endTimeSec,
        ])
      : [];
    const frames = await extractAdaptiveFramesWithFfmpeg(inputPath, {
      metadata: probe,
      sceneCuts,
      silenceBoundariesSec: silenceBoundaries,
      maxFrames: analysisProfile.maxFrames,
      maxCoverageGapSec: 12,
    });
    if (!frames.length) throw new Error('VIDEO_FRAME_COVERAGE_INCOMPLETE');

    const timestamps = frames.map((frame) => frame.timestampSec).sort((a, b) => a - b);
    const coverage = assessDecodedFrameCoverage(timestamps, probe.durationSec, probe.fps, 12);
    if (!coverage.usable) {
      throw new Error('VIDEO_FRAME_COVERAGE_INCOMPLETE');
    }

    await persistFrameArtifacts({
      job: existing,
      frames: frames.map((frame) => ({
        dataBase64: frame.dataBase64,
        timestampSeconds: frame.timestampSec,
        width: probe.displayWidth ?? probe.width as number,
        height: probe.displayHeight ?? probe.height as number,
        reason: samplingReason(frame.reasons),
      })),
    });

    let audioBytes = 0;
    if (probe.hasAudio) {
      const extractedAudio = await extractAudioToWavFile(inputPath, audioPath, probe.durationSec);
      audioBytes = extractedAudio.byteLength;
      if (audioBytes > 25 * 1024 * 1024) throw new Error('ANALYSIS_AUDIO_TOO_LARGE');
      await persistTemporaryAudioArtifact({
        job: existing,
        filePath: audioPath,
        durationSeconds: probe.durationSec,
        contentType: 'audio/wav',
      });
    }

    const durationMs = Date.now() - startedAt;
    await updateJobStage({
      jobId,
      status: 'preprocessing',
      progress: 28,
      values: {
        probe,
        technical_signals: technicalSignals,
        source_metadata: {
          ...existing.source_metadata,
          durationSeconds: probe.durationSec,
          hasAudio: probe.hasAudio,
          audioBytes,
          frameCount: frames.length,
          coverageStartSeconds: timestamps[0],
          coverageEndSeconds: timestamps.at(-1),
          maximumFrameGapSeconds: coverage.largestGapSec,
          samplingStrategy: 'opening+regular+scene-change+silence-boundary+ending',
        },
        cost_metrics: {
          ...existing.cost_metrics,
          videoDurationSeconds: probe.durationSec,
          inputBytes: actualBytes,
          audioBytes,
          frameCount: frames.length,
          preprocessingDurationMs: durationMs,
        },
      },
    });
    return {
      durationSeconds: probe.durationSec,
      frameCount: frames.length,
      hasAudio: probe.hasAudio,
      audioBytes,
      stageDurationMs: durationMs,
    };
  } catch (error) {
    const descriptor = publicPipelineError(error);
    if (descriptor.permanent) throw new FatalError(`${descriptor.code}:${descriptor.message}`);
    throw error;
  } finally {
    await removeAnalysisTempDir(tempDir);
  }
}

export interface TranscriptionStepResult {
  available: boolean;
  segmentCount: number;
  wordCount: number;
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stageDurationMs: number;
  providerDurationMs: number;
}

export async function transcribeVideoStep(jobId: string): Promise<TranscriptionStepResult> {
  'use step';

  let job = await getAnalysisJobForWorkflow(jobId);
  assertJobNotFailed(job);
  if (job.transcript && typeof job.transcript === 'object') {
    const staleAudioArtifacts = await listJobArtifacts(jobId, 'audio');
    for (const artifact of staleAudioArtifacts) await removeArtifact(artifact);
    const transcript = job.transcript as {
      status?: unknown;
      normalized?: { segments?: unknown[]; words?: unknown[] };
    };
    return {
      available: transcript.status === 'available',
      segmentCount: transcript.normalized?.segments?.length ?? 0,
      wordCount: transcript.normalized?.words?.length ?? 0,
      providerCalls: Number(job.cost_metrics.transcriptionProviderCalls) || 0,
      inputTokens: Number(job.cost_metrics.transcriptionInputTokens) || 0,
      outputTokens: Number(job.cost_metrics.transcriptionOutputTokens) || 0,
      retries: Number(job.cost_metrics.transcriptionRetries) || 0,
      stageDurationMs: Number(job.cost_metrics.transcriptionDurationMs) || 0,
      providerDurationMs: Number(job.cost_metrics.transcriptionProviderDurationMs) || 0,
    };
  }
  assertJobCanPerformProviderWork(job);

  await updateJobStage({ jobId, status: 'transcribing', progress: 32 });
  job = await getAnalysisJobForWorkflow(jobId);
  const audioArtifacts = await listJobArtifacts(jobId, 'audio');
  const audioArtifact = audioArtifacts[0];
  const tempDir = await createAnalysisTempDir(jobId);
  const audioPath = join(tempDir, 'audio.wav');

  try {
    if (audioArtifact) {
      const urls = await createArtifactSignedUrls([audioArtifact], 300);
      const signedUrl = urls.get(audioArtifact.id);
      if (!signedUrl) throw new Error('ANALYSIS_AUDIO_URL_FAILED');
      await downloadPrivateFile({
        signedUrl,
        destination: audioPath,
        maxBytes: 25 * 1024 * 1024,
        timeoutMs: 120_000,
      });
    }

    const contextLanguage = typeof job.creator_context.language === 'string'
      ? job.creator_context.language
      : undefined;
    const result = await transcribeCompleteAudio({
      audioPath,
      hasAudio: Boolean(audioArtifact),
      expectedLanguage: contextLanguage,
      idempotencyKey: job.id,
      audioDurationSeconds: audioArtifact
        ? Math.max(0, Number(audioArtifact.end_time) - Number(audioArtifact.start_time))
        : undefined,
      analysisProfileId: getAnalysisProfileFromMetadata(job.source_metadata).id,
    });
    const segmentCount = result.transcription.status === 'available'
      ? result.transcription.normalized.segments.length
      : 0;
    const wordCount = result.transcription.status === 'available'
      ? result.transcription.normalized.words.length
      : 0;

    await updateJobStage({
      jobId,
      status: 'transcribing',
      progress: 45,
      values: {
        transcript: result.transcription,
        cost_metrics: {
          ...job.cost_metrics,
          transcriptionProviderCalls: result.metrics.providerCalls,
          transcriptionInputTokens: result.metrics.inputTokens,
          transcriptionOutputTokens: result.metrics.outputTokens,
          transcriptionRetries: result.metrics.retries,
          transcriptionDurationMs: result.metrics.durationMs,
          transcriptionProviderDurationMs: result.metrics.providerDurationMs,
          transcriptionModels: result.metrics.models,
          transcriptSegmentCount: segmentCount,
          transcriptWordCount: wordCount,
        },
      },
    });
    if (audioArtifact) await removeArtifact(audioArtifact);
    return {
      available: result.transcription.status === 'available',
      segmentCount,
      wordCount,
      providerCalls: result.metrics.providerCalls,
      inputTokens: result.metrics.inputTokens,
      outputTokens: result.metrics.outputTokens,
      retries: result.metrics.retries,
      stageDurationMs: result.metrics.durationMs,
      providerDurationMs: result.metrics.providerDurationMs,
    };
  } finally {
    await removeAnalysisTempDir(tempDir);
  }
}

export async function visualAnalysisStep(jobId: string): Promise<VisualAnalysisStepResult> {
  'use step';
  try {
    const job = await getAnalysisJobForWorkflow(jobId);
    assertJobCanPerformProviderWork(job);
    return await analyzeAllFrames(jobId);
  } catch (error) {
    throw classifyAnalysisStepError(error);
  }
}

visualAnalysisStep.maxRetries = 1;

export type SpecialistWorkflowStepResult = Omit<SpecialistStepResult, 'diagnostics'>;

export async function specialistAnalysisStep(jobId: string): Promise<SpecialistWorkflowStepResult> {
  'use step';
  const job = await getAnalysisJobForWorkflow(jobId);
  assertJobCanPerformProviderWork(job);
  const { diagnostics: _diagnostics, ...metrics } = await runSpecialistAnalyses(jobId);
  return metrics;
}

export type TimelineWorkflowStepResult = Omit<TimelineAnalysisStepResult, 'timeline'>;

export async function timelineAnalysisStep(jobId: string): Promise<TimelineWorkflowStepResult> {
  'use step';
  const job = await getAnalysisJobForWorkflow(jobId);
  assertJobCanPerformProviderWork(job);
  const { timeline: _timeline, ...metrics } = await analyzeCompleteTimeline(jobId);
  return metrics;
}

export interface SynthesisPersistenceStepResult {
  analysisId: string;
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stageDurationMs: number;
  estimatedCostUsd: number | null;
  models: string[];
  repaired: boolean;
  qualityIssueCount: number;
  creatorMemoryStatus: string;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function numericMetric(source: Record<string, unknown>, key: string): number {
  const value = Number(source[key]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function prepareCreatorMemory(input: {
  userId: string;
  consent: boolean;
}): Promise<{
  context: string;
  plan: string;
  contextStatus: string;
  analysisCount: number;
}> {
  if (!input.consent) {
    return { context: '', plan: 'free', contextStatus: 'not_consented', analysisCount: 0 };
  }
  try {
    const profile = await getUserById(input.userId);
    if (!profile) {
      return { context: '', plan: 'free', contextStatus: 'profile_unavailable', analysisCount: 0 };
    }
    const plan = getEffectivePlan(profile);
    const snapshot = await loadCreatorMemoryV2({
      userId: input.userId,
      plan,
      consent: true,
    });
    const context = buildCreatorMemoryV2Context(snapshot, {
      userId: input.userId,
      consent: true,
    });
    return {
      context,
      plan,
      contextStatus: context ? 'loaded' : 'eligible_but_empty_or_unavailable',
      analysisCount: snapshot?.analysis_count ?? 0,
    };
  } catch {
    console.warn('[creator-memory-v2-safe] context_load_failed', { userId: input.userId });
    return { context: '', plan: 'free', contextStatus: 'load_failed', analysisCount: 0 };
  }
}

function persistenceMetrics(
  synthesis: CritiqueAndSynthesisResult,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const providerCalls = synthesis.metrics.providerCalls
    + numericMetric(previous, 'transcriptionProviderCalls')
    + numericMetric(previous, 'visualProviderCalls')
    + numericMetric(previous, 'specialistProviderCalls')
    + numericMetric(previous, 'timelineProviderCalls');
  const inputTokens = synthesis.metrics.inputTokens
    + numericMetric(previous, 'transcriptionInputTokens')
    + numericMetric(previous, 'visualInputTokens')
    + numericMetric(previous, 'specialistInputTokens')
    + numericMetric(previous, 'timelineInputTokens');
  const outputTokens = synthesis.metrics.outputTokens
    + numericMetric(previous, 'transcriptionOutputTokens')
    + numericMetric(previous, 'visualOutputTokens')
    + numericMetric(previous, 'specialistOutputTokens')
    + numericMetric(previous, 'timelineOutputTokens');
  const retries = synthesis.metrics.retries
    + numericMetric(previous, 'transcriptionRetries')
    + numericMetric(previous, 'visualRetries')
    + numericMetric(previous, 'specialistRetries')
    + numericMetric(previous, 'timelineRetries');
  return {
    ...previous,
    providerCalls,
    inputTokens,
    outputTokens,
    retries,
    segmentCount: numericMetric(previous, 'timelineSegmentCount'),
    synthesisProviderCalls: synthesis.metrics.providerCalls,
    synthesisInputTokens: synthesis.metrics.inputTokens,
    synthesisOutputTokens: synthesis.metrics.outputTokens,
    synthesisRetries: synthesis.metrics.retries,
    synthesisDurationMs: synthesis.metrics.stageDurationMs,
    synthesisProviderDurationMs: synthesis.metrics.calls.reduce(
      (sum, call) => sum + (Number(call.providerDurationMs) || 0),
      0,
    ),
    synthesisEstimatedCostUsd: synthesis.metrics.estimatedCostUsd,
    synthesisModels: synthesis.metrics.models,
    synthesisCalls: synthesis.metrics.calls,
    repaired: synthesis.repaired,
    qualityIssueCount: synthesis.quality.issues.length,
    // Replaced immediately below by the durable provider-ledger rollup. Keeping
    // a null sentinel prevents a partial synthesis-only value from escaping.
    estimatedCostUsd: null,
    estimatedCostScope: 'pending_provider_ledger_rollup',
    stageDurationsMs: {
      preprocessing: numericMetric(previous, 'preprocessingDurationMs'),
      transcription: numericMetric(previous, 'transcriptionDurationMs'),
      visualAnalysis: numericMetric(previous, 'visualDurationMs'),
      specialistAnalysis: numericMetric(previous, 'specialistDurationMs'),
      timelineAnalysis: numericMetric(previous, 'timelineDurationMs'),
      synthesis: synthesis.metrics.stageDurationMs,
    },
  };
}

export async function synthesizeValidateAndPersistStep(jobId: string): Promise<SynthesisPersistenceStepResult> {
  'use step';
  let job = await getAnalysisJobForWorkflow(jobId);
  if (job.status === 'completed' && job.analysis_id) {
    return {
      analysisId: job.analysis_id,
      providerCalls: numericMetric(job.cost_metrics, 'synthesisProviderCalls'),
      inputTokens: numericMetric(job.cost_metrics, 'synthesisInputTokens'),
      outputTokens: numericMetric(job.cost_metrics, 'synthesisOutputTokens'),
      retries: numericMetric(job.cost_metrics, 'synthesisRetries'),
      stageDurationMs: numericMetric(job.cost_metrics, 'synthesisDurationMs'),
      estimatedCostUsd: typeof job.cost_metrics.estimatedCostUsd === 'number'
        ? job.cost_metrics.estimatedCostUsd
        : null,
      models: stringArray(job.cost_metrics.synthesisModels),
      repaired: job.cost_metrics.repaired === true,
      qualityIssueCount: numericMetric(job.cost_metrics, 'qualityIssueCount'),
      creatorMemoryStatus: typeof job.cost_metrics.creatorMemoryStatus === 'string'
        ? job.cost_metrics.creatorMemoryStatus
        : 'unknown',
    };
  }
  assertJobCanPerformProviderWork(job);
  await updateJobStage({ jobId, status: 'synthesis', progress: 84 });
  job = await getAnalysisJobForWorkflow(jobId);
  const frames = await listJobArtifacts(jobId, 'frame');
  const evidence = buildDeterministicEvidence(job, frames);
  const specialists = Array.isArray(job.source_metadata.specialists)
    ? job.source_metadata.specialists.map((value) => SpecialistDiagnosticSchema.parse(value))
    : [];
  const timeline = Array.isArray(job.source_metadata.timeline)
    ? job.source_metadata.timeline.map((value) => TimelineSegmentSchema.parse(value))
    : [];
  if (!specialists.length) throw new Error('SPECIALISTS_MISSING');
  if (!timeline.length) throw new Error('TIMELINE_MISSING');

  const creatorMemory = await prepareCreatorMemory({
    userId: job.user_id,
    consent: evidence.creatorContext.memoryConsent === true,
  });

  let synthesisCheckpoint = parseSynthesisCheckpoint(job.source_metadata.synthesisCheckpoint);
  const persistSynthesisCheckpoint = async (checkpoint: SynthesisCheckpoint) => {
    synthesisCheckpoint = checkpoint;
    job = {
      ...job,
      source_metadata: { ...job.source_metadata, synthesisCheckpoint: checkpoint },
    };
    await updateJobStage({
      jobId,
      status: 'synthesis',
      progress: checkpoint.narrative ? 92 : 88,
      values: { source_metadata: job.source_metadata },
    });
  };
  const synthesis = await runCritiqueAndSynthesis({
    jobId,
    analysisId: jobId,
    evidence,
    specialists,
    timeline,
    creatorMemoryContext: creatorMemory.context || undefined,
    analysisProfileId: getAnalysisProfileFromMetadata(job.source_metadata).id,
  }, {
    checkpoint: synthesisCheckpoint,
    persistCheckpoint: persistSynthesisCheckpoint,
  });
  const preliminaryCostMetrics = persistenceMetrics(synthesis, job.cost_metrics);
  await assertCrossVideoRecommendationsDistinct({
    userId: job.user_id,
    current: synthesis.result,
  });
  const providerRollup = await buildProviderCostRollup(job, preliminaryCostMetrics);
  const nextCostMetrics = { ...preliminaryCostMetrics, ...providerRollup };
  await updateJobStage({
    jobId,
    status: 'validation',
    progress: 96,
    values: {
      cost_metrics: nextCostMetrics,
      source_metadata: {
        ...job.source_metadata,
        qualityGate: {
          validForPersistence: synthesis.quality.validForPersistence,
          issueCodes: synthesis.quality.issues.map((issue) => issue.code),
          repaired: synthesis.repaired,
        },
      },
    },
  });

  const modelVersion = [...new Set([
    ...stringArray(job.cost_metrics.transcriptionModels),
    ...stringArray(job.cost_metrics.visualModels),
    ...stringArray(job.cost_metrics.specialistModels),
    ...stringArray(job.cost_metrics.timelineModels),
    ...synthesis.metrics.models,
  ])].join(',');
  const engineResult = synthesis.result as unknown as Record<string, unknown>;
  const analysisId = await completeAnalysisJob({
    jobId,
    userId: job.user_id,
    videoUrl: `viralynz-analysis://${jobId}`,
    legacyResult: toHonestLegacyAnalysisResult(synthesis.result),
    engineResult,
    schemaVersion: VIDEO_ANALYSIS_VERSIONS.schema,
    promptVersion: VIDEO_ANALYSIS_VERSIONS.prompt,
    pipelineVersion: VIDEO_ANALYSIS_VERSIONS.pipeline,
    modelVersion,
  });
  let learningStatus = evidence.creatorContext.memoryConsent === true
    ? 'skipped'
    : 'not_consented';
  try {
    const learned = await learnCreatorMemoryV2({
      userId: job.user_id,
      plan: creatorMemory.plan,
      consent: evidence.creatorContext.memoryConsent === true,
      result: synthesis.result,
    });
    learningStatus = learned.status === 'skipped'
      ? `skipped:${learned.reason}`
      : learned.status;
  } catch {
    learningStatus = 'learn_failed';
    console.warn('[creator-memory-v2-safe] learning_failed', { analysisId });
  }
  const creatorMemoryStatus = `${creatorMemory.contextStatus}/${learningStatus}`;
  try {
    await recordCompletedJobMemoryOutcome({
      jobId,
      userId: job.user_id,
      costMetrics: {
        ...nextCostMetrics,
        creatorMemoryStatus,
        creatorMemoryContextAnalysisCount: creatorMemory.analysisCount,
      },
    });
  } catch {
    // The canonical analysis is already committed. Memory telemetry must never
    // turn a successful, quota-consumed analysis into a user-visible failure.
  }
  return {
    analysisId,
    providerCalls: numericMetric(nextCostMetrics, 'providerCalls'),
    inputTokens: numericMetric(nextCostMetrics, 'inputTokens'),
    outputTokens: numericMetric(nextCostMetrics, 'outputTokens'),
    retries: numericMetric(nextCostMetrics, 'retries'),
    stageDurationMs: synthesis.metrics.stageDurationMs,
    estimatedCostUsd: typeof nextCostMetrics.estimatedCostUsd === 'number'
      ? nextCostMetrics.estimatedCostUsd
      : null,
    models: synthesis.metrics.models,
    repaired: synthesis.repaired,
    qualityIssueCount: synthesis.quality.issues.length,
    creatorMemoryStatus,
  };
}

function parseFatalWorkflowMessage(error: unknown): { code: string; message: string } {
  const serialized = error instanceof Error ? error.message : '';
  return parsePublicAnalysisFailure(serialized);
}

export async function failVideoAnalysisStep(jobId: string, serializedError: string): Promise<void> {
  'use step';
  const job = await getAnalysisJobForWorkflow(jobId);
  if (job.status === 'completed') return;
  const descriptor = parseFatalWorkflowMessage(new Error(serializedError));
  const failureAtMs = Date.now();
  const currentStageStartedAt = Date.parse(job.updated_at);
  const previousStageDurations = job.cost_metrics.stageDurationsMs
    && typeof job.cost_metrics.stageDurationsMs === 'object'
    && !Array.isArray(job.cost_metrics.stageDurationsMs)
    ? job.cost_metrics.stageDurationsMs as Record<string, unknown>
    : {};
  const stageKeyByStatus: Partial<Record<typeof job.status, string>> = {
    preprocessing: 'preprocessing',
    transcribing: 'transcription',
    visual_analysis: 'visualAnalysis',
    audio_analysis: 'specialistAnalysis',
    segment_analysis: 'timelineAnalysis',
    synthesis: 'synthesis',
    validation: 'validation',
  };
  const failedStage = stageKeyByStatus[job.status];
  const partialStageWallMs = Number.isFinite(currentStageStartedAt)
    ? Math.max(0, Math.round(failureAtMs - currentStageStartedAt))
    : null;
  const failedCostMetrics = failedStage && partialStageWallMs !== null
    ? {
        ...job.cost_metrics,
        stageDurationsMs: {
          ...previousStageDurations,
          [failedStage]: Math.max(
            numericMetric(previousStageDurations, failedStage),
            partialStageWallMs,
          ),
        },
      }
    : job.cost_metrics;
  await markJobFailed(job, descriptor.code, descriptor.message);
  const failedJob = await getAnalysisJobForWorkflow(jobId);
  try {
    await finalizeExpiredProviderAttempts(jobId);
    await persistProviderCostRollup(failedJob, failedCostMetrics);
  } finally {
    const cleanupErrors = await cleanupTerminalJobStorage(failedJob);
    if (cleanupErrors > 0) throw new Error('ANALYSIS_TERMINAL_CLEANUP_PENDING');
  }
}

export async function cleanupCompletedInputStep(jobId: string): Promise<void> {
  'use step';
  const job = await getAnalysisJobForWorkflow(jobId);
  if (job.status !== 'completed') return;
  const cleanupErrors = await cleanupTerminalJobStorage(job);
  if (cleanupErrors > 0) throw new Error('ANALYSIS_TERMINAL_CLEANUP_PENDING');
}
