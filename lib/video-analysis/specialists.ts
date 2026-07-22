import 'server-only';
import { FatalError } from 'workflow';
import {
  SpecialistDiagnosticSchema,
  type SpecialistDiagnostic,
} from '@/lib/analysis-engine/index';
import { listJobArtifacts } from './artifacts';
import { configuredProfileModels, getAnalysisProfileFromMetadata } from './analysis-profiles';
import {
  SPECIALIST_PROMPT_MAX_CHARACTERS,
  assertPromptCharacterBudget,
  buildFrameObservationCatalog,
  buildFrameObservationPromptView,
  buildTranscriptPromptView,
  compactValueForPrompt,
  distributedPromptSample,
  measuredTechnicalCatalog,
  safeJsonForPrompt,
  TECHNICAL_EVIDENCE_IDS,
  transcriptFromJob,
} from './grounding';
import { getAnalysisJobForWorkflow, updateJobStage } from './jobs';
import { parseStructuredResponse } from './openai-client';
import { AnalysisBudgetExceededError } from './budget';

export type SpecialistName = SpecialistDiagnostic['specialist'];

const SPECIALISTS: readonly SpecialistName[] = [
  'hook',
  'script',
  'audio',
  'editing',
  'storytelling',
  'visual_text',
  'cta',
];

const SPECIALIST_FOCUS: Record<SpecialistName, string> = {
  hook: 'première frame, hook verbal, hook visuel/sonore, temps avant compréhension et bénéfice',
  script: 'clarté, densité, répétitions, progression, preuves, payoff, phrases à couper/raccourcir/réécrire',
  audio: 'silences, pauses, débit, niveaux mesurés et variation de loudness; ne qualifie jamais la voix si le signal ne le prouve pas',
  editing: 'cuts, changements de plans, rythme, temps morts, transitions, démonstration et décisions de montage horodatées',
  storytelling: 'promesse, tension, progression, preuve, objection, payoff et charge cognitive',
  visual_text: 'cadrage, lumière, composition, texte écran, lisibilité, safe zones, produit/B-roll et cohérence image-paroles',
  cta: 'proposition de valeur, preuve, friction et CTA strictement aligné sur l’objectif choisi',
};

const SPECIALIST_INSTRUCTIONS = [
  'Tu es un spécialiste du moteur Viralynz, coach de repost.',
  'Chaque finding sépare: claim = observation présente, implication = diagnostic lié à l’objectif, decision = action exacte avec exemple applicable.',
  'Chaque finding cite au moins une evidenceRef du catalogue et une timeRange si la preuve est temporelle.',
  'N’utilise jamais seul: améliore ton hook, ajoute du dynamisme, raccourcis, CTA plus fort, ajoute des sous-titres, sois authentique.',
  'Tu n’inventes ni vues, ni rétention, ni intention, ni émotion, ni performance.',
  'Une donnée absente produit findings=[] et une limitation explicite.',
  'Réponds uniquement selon le schéma structuré.',
].join('\n');

interface TemporalEvidenceRange {
  startSec: number;
  endSec: number;
}

export interface SpecialistEvidenceScope {
  evidenceIds: string[];
  temporalRanges: Map<string, TemporalEvidenceRange[]>;
  globalTechnicalEvidenceIds: Set<string>;
}

export interface SpecialistPromptContext {
  context: unknown;
  evidenceIds: string[];
  evidenceScope: SpecialistEvidenceScope;
}

const GLOBAL_TECHNICAL_EVIDENCE_IDS = new Set<string>([
  TECHNICAL_EVIDENCE_IDS.sceneCutCount,
  TECHNICAL_EVIDENCE_IDS.cutsPerMinute,
  TECHNICAL_EVIDENCE_IDS.blackFrames,
  TECHNICAL_EVIDENCE_IDS.freezes,
  TECHNICAL_EVIDENCE_IDS.averageLuma,
  TECHNICAL_EVIDENCE_IDS.brightnessVariation,
  TECHNICAL_EVIDENCE_IDS.silence,
  TECHNICAL_EVIDENCE_IDS.meanVolume,
  TECHNICAL_EVIDENCE_IDS.peakVolume,
  TECHNICAL_EVIDENCE_IDS.speechLoudnessVariation,
  TECHNICAL_EVIDENCE_IDS.nonSpeechLoudness,
  TECHNICAL_EVIDENCE_IDS.saturationRisk,
  TECHNICAL_EVIDENCE_IDS.backgroundNoise,
  TECHNICAL_EVIDENCE_IDS.vocalEnergyVariation,
  TECHNICAL_EVIDENCE_IDS.speechRatio,
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function visiblePromptItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  return record.promptView === 'distributed_array' && Array.isArray(record.items)
    ? record.items
    : [];
}

function measuredPromptValue(value: unknown): unknown {
  const measurement = asRecord(value);
  return measurement.availability === 'measured' ? measurement.value : undefined;
}

function finiteRange(start: unknown, end: unknown = start): TemporalEvidenceRange | null {
  const startSec = Number(start);
  const endSec = Number(end);
  return Number.isFinite(startSec) && Number.isFinite(endSec) && startSec >= 0 && endSec >= startSec
    ? { startSec, endSec }
    : null;
}

function addRange(
  ranges: Map<string, TemporalEvidenceRange[]>,
  allowed: Set<string>,
  evidenceId: string,
  range: TemporalEvidenceRange | null,
) {
  if (!range || !allowed.has(evidenceId)) return;
  const current = ranges.get(evidenceId) ?? [];
  current.push(range);
  ranges.set(evidenceId, current);
}

function buildSpecialistEvidenceScope(input: {
  job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>;
  frames: Awaited<ReturnType<typeof listJobArtifacts>>;
  technicalPromptView: unknown;
  evidenceIds: readonly string[];
}): SpecialistEvidenceScope {
  const evidenceIds = [...new Set(input.evidenceIds)];
  const allowed = new Set(evidenceIds);
  const temporalRanges = new Map<string, TemporalEvidenceRange[]>();
  const transcript = transcriptFromJob(input.job);

  for (const frame of input.frames) {
    addRange(
      temporalRanges,
      allowed,
      frame.id,
      finiteRange(frame.start_time),
    );
  }
  for (const segment of transcript.segments) {
    addRange(
      temporalRanges,
      allowed,
      segment.id,
      finiteRange(segment.startSec, segment.endSec),
    );
  }
  for (const word of transcript.words) {
    addRange(
      temporalRanges,
      allowed,
      word.id,
      finiteRange(word.startSec, word.endSec),
    );
  }

  const technical = asRecord(input.technicalPromptView);
  const signals = asRecord(technical.signals);
  const audio = asRecord(signals.audio);
  const addTechnicalItems = (
    evidenceId: string,
    measurement: unknown,
    toRange: (item: Record<string, unknown>) => TemporalEvidenceRange | null,
  ) => {
    for (const item of visiblePromptItems(measuredPromptValue(measurement))) {
      addRange(temporalRanges, allowed, evidenceId, toRange(asRecord(item)));
    }
  };

  addTechnicalItems(
    TECHNICAL_EVIDENCE_IDS.sceneCutCount,
    signals.sceneCuts,
    (item) => finiteRange(item.timestamp),
  );
  addTechnicalItems(
    TECHNICAL_EVIDENCE_IDS.blackFrames,
    signals.blackIntervals,
    (item) => finiteRange(item.startTimeSec, item.endTimeSec),
  );
  addTechnicalItems(
    TECHNICAL_EVIDENCE_IDS.freezes,
    signals.freezeIntervals,
    (item) => finiteRange(item.startTimeSec, item.endTimeSec),
  );
  addTechnicalItems(
    TECHNICAL_EVIDENCE_IDS.silence,
    audio.silenceIntervals,
    (item) => finiteRange(item.startTimeSec, item.endTimeSec),
  );
  addTechnicalItems(
    TECHNICAL_EVIDENCE_IDS.loudness,
    audio.loudnessSamples,
    (item) => finiteRange(item.timestampSec),
  );

  const initialSilenceDuration = Number(measuredPromptValue(audio.initialSilenceDurationSec));
  if (Number.isFinite(initialSilenceDuration) && initialSilenceDuration > 0) {
    addRange(
      temporalRanges,
      allowed,
      TECHNICAL_EVIDENCE_IDS.initialSilence,
      finiteRange(0, initialSilenceDuration),
    );
  }
  const firstSpeechFromTranscript = transcript.status === 'available'
    ? transcript.segments.find((segment) => allowed.has(segment.id))?.startSec
    : undefined;
  const firstSpeechFromMeasurement = Number(measuredPromptValue(audio.firstSpeechTimeSec));
  const firstSpeech = firstSpeechFromTranscript ?? (
    Number.isFinite(firstSpeechFromMeasurement) ? firstSpeechFromMeasurement : undefined
  );
  addRange(
    temporalRanges,
    allowed,
    TECHNICAL_EVIDENCE_IDS.firstSpeech,
    finiteRange(firstSpeech),
  );

  const visibleWordIds = new Set(transcript.words
    .filter((word) => allowed.has(word.id))
    .map((word) => word.id));
  transcript.words.slice(1).forEach((word, index) => {
    const previous = transcript.words[index];
    if (
      visibleWordIds.has(previous.id)
      && visibleWordIds.has(word.id)
      && word.startSec - previous.endSec >= 0.4
    ) {
      addRange(
        temporalRanges,
        allowed,
        TECHNICAL_EVIDENCE_IDS.pauses,
        finiteRange(previous.endSec, word.startSec),
      );
    }
  });

  return {
    evidenceIds,
    temporalRanges,
    globalTechnicalEvidenceIds: new Set(
      evidenceIds.filter((id) => GLOBAL_TECHNICAL_EVIDENCE_IDS.has(id)),
    ),
  };
}

export function buildSpecialistPromptContext(input: {
  specialist: SpecialistName;
  job: Awaited<ReturnType<typeof getAnalysisJobForWorkflow>>;
  frames: Awaited<ReturnType<typeof listJobArtifacts>>;
}): SpecialistPromptContext {
  const transcript = transcriptFromJob(input.job);
  const frameCatalog = buildFrameObservationCatalog(input.frames);
  const allFrames = buildFrameObservationPromptView(input.frames, 20);
  const transcriptView = buildTranscriptPromptView(transcript, {
    maximumSegments: 28,
    maximumWords: 0,
    maximumSegmentCharacters: 320,
    maximumWordCharacters: 80,
  });
  const earlyFrames = distributedPromptSample(
    frameCatalog.filter((frame) => frame.timestampSec <= 3.1),
    8,
  );
  const endingFrames = distributedPromptSample(frameCatalog.slice(-8), 8);
  const earlyTranscript = distributedPromptSample(
    transcript.segments.filter((segment) => segment.startSec <= 5),
    12,
  );
  const endingTranscript = distributedPromptSample(transcript.segments.slice(-12), 12);
  const technicalCatalog = measuredTechnicalCatalog(input.job);
  const technical = compactValueForPrompt(technicalCatalog, {
    maximumStringCharacters: 360,
    maximumArrayItems: 120,
  });
  const common = {
    objective: input.job.creator_context,
    durationSec: input.job.source_metadata.durationSeconds,
    technical,
    promptCoverageRule: [
      'Distributed prompt views expose originalCount, includedCount, omittedCount, openingId, midpointId and endingId.',
      'Canonical transcript, frames and measurements remain preserved outside the prompt; never infer omitted content.',
      'Cite only an EvidenceRef explicitly included in this prompt view.',
    ],
  };

  const transcriptEvidenceIds = [
    ...transcriptView.segments.coverage.includedIds,
    ...transcriptView.words.coverage.includedIds,
  ];
  const frameEvidenceIds = allFrames.coverage.includedIds;
  const technicalEvidenceIds = Array.isArray(asRecord(technical).evidenceIds)
    ? (asRecord(technical).evidenceIds as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  const result = (context: unknown, extraEvidenceIds: readonly string[] = []): SpecialistPromptContext => {
    const evidenceIds = [...new Set([
      ...technicalEvidenceIds,
      ...transcriptEvidenceIds,
      ...extraEvidenceIds,
    ])];
    return {
      context,
      evidenceIds,
      evidenceScope: buildSpecialistEvidenceScope({
        job: input.job,
        frames: input.frames,
        technicalPromptView: technical,
        evidenceIds,
      }),
    };
  };

  switch (input.specialist) {
    case 'hook':
      return result({
        ...common,
        transcript: transcriptView,
        focusWindow: {
          frames: compactValueForPrompt(earlyFrames, { maximumStringCharacters: 240, maximumArrayItems: 16 }),
          transcript: compactValueForPrompt(earlyTranscript, { maximumStringCharacters: 480, maximumArrayItems: 24 }),
        },
      }, [
        ...earlyFrames.map((frame) => frame.evidenceRef),
        ...earlyTranscript.map((segment) => segment.id),
      ]);
    case 'script':
      return result({ ...common, transcript: transcriptView });
    case 'audio':
      return result({ ...common, transcript: transcriptView, frames: [] });
    case 'editing':
      return result({ ...common, frames: allFrames, transcript: transcriptView }, frameEvidenceIds);
    case 'visual_text':
      return result({
        ...common,
        frames: allFrames,
        transcript: transcriptView,
        persistentTextGroups: compactValueForPrompt(input.job.cost_metrics.persistentTextGroups ?? [], {
          maximumStringCharacters: 320,
          maximumArrayItems: 80,
        }),
      }, frameEvidenceIds);
    case 'cta':
      return result({
        ...common,
        transcript: transcriptView,
        focusWindow: {
          frames: compactValueForPrompt(endingFrames, { maximumStringCharacters: 240, maximumArrayItems: 16 }),
          transcript: compactValueForPrompt(endingTranscript, { maximumStringCharacters: 480, maximumArrayItems: 24 }),
        },
      }, [
        ...endingFrames.map((frame) => frame.evidenceRef),
        ...endingTranscript.map((segment) => segment.id),
      ]);
    case 'storytelling':
      return result({ ...common, frames: allFrames, transcript: transcriptView }, frameEvidenceIds);
  }
}

export function buildSpecialistPrompt(input: {
  specialist: SpecialistName;
  durationSec: number;
  evidenceIds: readonly string[];
  promptContext: unknown;
}): string {
  const prompt = [
    `Specialiste requis: ${input.specialist}`,
    `Identifiant de sortie obligatoire: specialist-${input.specialist}`,
    `Focus: ${SPECIALIST_FOCUS[input.specialist]}`,
    `Duree exacte: ${input.durationSec.toFixed(3)} s`,
    `EvidenceRefs autorisees et visibles dans cette vue: ${input.evidenceIds.join(', ')}`,
    'Les vues distribuees couvrent ouverture, milieu et fin et declarent toute omission.',
    'Une observation ou citation ne peut utiliser que du texte et une source explicitement inclus dans la vue.',
    'Contexte et observations JSON:',
    safeJsonForPrompt(input.promptContext, 100_000),
  ].join('\n');
  return assertPromptCharacterBudget(
    prompt,
    SPECIALIST_PROMPT_MAX_CHARACTERS,
    'SPECIALIST_PROMPT_TOO_LARGE',
  );
}

function deterministicUnavailable(
  specialist: SpecialistName,
  reason: string,
): SpecialistDiagnostic {
  return {
    id: `specialist-${specialist}`,
    specialist,
    summary: `Analyse ${specialist} indisponible faute de signal vérifiable.`,
    findings: [],
    limitations: [reason],
  };
}

function shouldSkipSpecialist(
  specialist: SpecialistName,
  transcriptAvailable: boolean,
  hasAudio: boolean,
): string | null {
  if (specialist === 'audio' && !hasAudio) return 'Aucune piste audio n’est présente dans la vidéo.';
  if (specialist === 'script' && !transcriptAvailable) return 'Aucune parole exploitable n’a été transcrite.';
  return null;
}

function rangesOverlap(
  left: TemporalEvidenceRange,
  right: TemporalEvidenceRange,
  toleranceSec = 0.05,
): boolean {
  return left.endSec >= right.startSec - toleranceSec
    && left.startSec <= right.endSec + toleranceSec;
}

export function validateSpecialistDiagnostic(input: {
  diagnostic: SpecialistDiagnostic;
  specialist: SpecialistName;
  evidenceScope: SpecialistEvidenceScope;
  durationSec: number;
}): SpecialistDiagnostic {
  if (input.diagnostic.specialist !== input.specialist) throw new Error('SPECIALIST_IDENTITY_MISMATCH');
  const allowedEvidence = new Set(input.evidenceScope.evidenceIds);
  for (const finding of input.diagnostic.findings) {
    if (finding.evidenceRefs.some((reference) => !allowedEvidence.has(reference))) {
      throw new Error('SPECIALIST_EVIDENCE_NOT_VISIBLE');
    }
    if (
      finding.timeRange
      && (finding.timeRange.startSec < 0 || finding.timeRange.endSec > input.durationSec + 0.05)
    ) {
      throw new Error('SPECIALIST_TIMESTAMP_OUT_OF_RANGE');
    }
    const temporalReferences = finding.evidenceRefs.flatMap((reference) => (
      input.evidenceScope.temporalRanges.get(reference) ?? []
    ));
    const hasNonGlobalTemporalReference = finding.evidenceRefs.some((reference) => (
      !input.evidenceScope.globalTechnicalEvidenceIds.has(reference)
      && (input.evidenceScope.temporalRanges.get(reference)?.length ?? 0) > 0
    ));
    if (!finding.timeRange && hasNonGlobalTemporalReference) {
      throw new Error('SPECIALIST_TIMESTAMP_REQUIRED_FOR_VISIBLE_EVIDENCE');
    }
    if (finding.timeRange) {
      const findingRange = {
        startSec: finding.timeRange.startSec,
        endSec: finding.timeRange.endSec,
      };
      const overlapsVisibleEvidence = temporalReferences.some((range) => (
        rangesOverlap(findingRange, range)
      ));
      const isExplicitWholeVideoRange = findingRange.startSec <= 0.05
        && findingRange.endSec >= input.durationSec - 0.05;
      const usesVisibleGlobalTechnicalEvidence = finding.evidenceRefs.some((reference) => (
        input.evidenceScope.globalTechnicalEvidenceIds.has(reference)
      ));
      if (!overlapsVisibleEvidence && !(isExplicitWholeVideoRange && usesVisibleGlobalTechnicalEvidence)) {
        throw new Error('SPECIALIST_TIMESTAMP_WITHOUT_VISIBLE_EVIDENCE');
      }
    }
  }
  return input.diagnostic;
}

export function validateSpecialistDiagnosticOrUnavailable(input: {
  diagnostic: SpecialistDiagnostic;
  specialist: SpecialistName;
  evidenceScope: SpecialistEvidenceScope;
  durationSec: number;
}): SpecialistDiagnostic {
  try {
    return validateSpecialistDiagnostic(input);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('SPECIALIST_')) throw error;
    return deterministicUnavailable(
      input.specialist,
      'Diagnostic spécialiste écarté car ses preuves ne correspondent pas aux signaux mesurés.',
    );
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await operation(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return result;
}

export interface SpecialistStepResult {
  diagnostics: SpecialistDiagnostic[];
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stageDurationMs: number;
  providerDurationMs: number;
  models: string[];
}

export async function runSpecialistAnalyses(jobId: string): Promise<SpecialistStepResult> {
  let job = await getAnalysisJobForWorkflow(jobId);
  const cached = job.source_metadata.specialists;
  if (Array.isArray(cached)) {
    const frames = await listJobArtifacts(jobId, 'frame');
    const durationSec = Number(job.source_metadata.durationSeconds);
    const parsed = cached.map((item) => {
      const diagnostic = SpecialistDiagnosticSchema.parse(item);
      const promptView = buildSpecialistPromptContext({
        specialist: diagnostic.specialist,
        job,
        frames,
      });
      return validateSpecialistDiagnostic({
        diagnostic,
        specialist: diagnostic.specialist,
        evidenceScope: promptView.evidenceScope,
        durationSec,
      });
    });
    return {
      diagnostics: parsed,
      providerCalls: Number(job.cost_metrics.specialistProviderCalls) || 0,
      inputTokens: Number(job.cost_metrics.specialistInputTokens) || 0,
      outputTokens: Number(job.cost_metrics.specialistOutputTokens) || 0,
      retries: Number(job.cost_metrics.specialistRetries) || 0,
      stageDurationMs: Number(job.cost_metrics.specialistDurationMs) || 0,
      providerDurationMs: Number(job.cost_metrics.specialistProviderDurationMs) || 0,
      models: Array.isArray(job.cost_metrics.specialistModels)
        ? job.cost_metrics.specialistModels.filter((value): value is string => typeof value === 'string')
        : [],
    };
  }
  if (job.status === 'failed' || job.status === 'completed') {
    throw new FatalError('ANALYSIS_JOB_TERMINAL');
  }

  await updateJobStage({ jobId, status: 'audio_analysis', progress: 63 });
  job = await getAnalysisJobForWorkflow(jobId);
  const analysisProfile = getAnalysisProfileFromMetadata(job.source_metadata);
  const frames = await listJobArtifacts(jobId, 'frame');
  const transcript = transcriptFromJob(job);
  const durationSec = Number(job.source_metadata.durationSeconds);
  const hasAudio = job.source_metadata.hasAudio === true;
  const startedAt = Date.now();
  const calls: Array<{
    inputTokens: number;
    outputTokens: number;
    retries: number;
    model: string;
    providerDurationMs: number;
  }> = [];

  const diagnostics = await mapWithConcurrency(
    SPECIALISTS.filter((specialist) => analysisProfile.specialists.includes(specialist)),
    1,
    async (specialist) => {
    const skipReason = shouldSkipSpecialist(specialist, transcript.status === 'available', hasAudio);
    if (skipReason) return deterministicUnavailable(specialist, skipReason);
    const promptView = buildSpecialistPromptContext({ specialist, job, frames });
    let response;
    try {
      response = await parseStructuredResponse({
        candidates: configuredProfileModels(analysisProfile, 'specialist_analysis'),
        schema: SpecialistDiagnosticSchema,
        schemaName: `viralynz_${specialist}_diagnostic`,
        instructions: SPECIALIST_INSTRUCTIONS,
        prompt: buildSpecialistPrompt({
          specialist,
          durationSec,
          evidenceIds: promptView.evidenceIds,
          promptContext: promptView.context,
        }),
        maxOutputTokens: analysisProfile.stages.specialist_analysis.maxOutputTokensPerCall,
        maxRetries: analysisProfile.maxProviderRetries,
        idempotencyKey: `${job.id}:specialist:${specialist}`,
      });
    } catch (error) {
      if (error instanceof AnalysisBudgetExceededError) {
        return deterministicUnavailable(
          specialist,
          'Le budget économique de cette analyse ne permet pas un appel fournisseur supplémentaire.',
        );
      }
      throw error;
    }
    calls.push(response.metrics);
    return validateSpecialistDiagnosticOrUnavailable({
      diagnostic: response.value,
      specialist,
      evidenceScope: promptView.evidenceScope,
      durationSec,
    });
  });

  const stageDurationMs = Date.now() - startedAt;
  const sourceMetadata = { ...job.source_metadata, specialists: diagnostics };
  const costMetrics = {
    ...job.cost_metrics,
    specialistProviderCalls: calls.length,
    specialistInputTokens: calls.reduce((sum, call) => sum + call.inputTokens, 0),
    specialistOutputTokens: calls.reduce((sum, call) => sum + call.outputTokens, 0),
    specialistRetries: calls.reduce((sum, call) => sum + call.retries, 0),
    specialistDurationMs: stageDurationMs,
    specialistProviderDurationMs: calls.reduce((sum, call) => sum + call.providerDurationMs, 0),
    specialistModels: [...new Set(calls.map((call) => call.model))],
  };
  await updateJobStage({
    jobId,
    status: 'audio_analysis',
    progress: 71,
    values: { source_metadata: sourceMetadata, cost_metrics: costMetrics },
  });
  return {
    diagnostics,
    providerCalls: calls.length,
    inputTokens: costMetrics.specialistInputTokens,
    outputTokens: costMetrics.specialistOutputTokens,
    retries: costMetrics.specialistRetries,
    stageDurationMs,
    providerDurationMs: costMetrics.specialistProviderDurationMs,
    models: costMetrics.specialistModels,
  };
}
