import 'server-only';

import { z } from 'zod';
import {
  ANALYSIS_SECTION_CRITERIA,
  AnalysisCritiqueSchema,
  FinalAnalysisResultSchema,
  SpecialistDiagnosticSchema,
  TimelineSegmentSchema,
  VIRALYNZ_RUBRIC,
  computeDeterministicScores,
  validateAnalysisQuality,
  type AnalysisCritique,
  type FinalAnalysisResult,
  type QualityValidationReport,
  type SpecialistDiagnostic,
  type TimelineSegment,
} from '@/lib/analysis-engine/index';
import {
  VIDEO_ANALYSIS_BUDGET,
  VIDEO_ANALYSIS_VERSIONS,
  getVideoAnalysisModelConfig,
} from './config';
import type { DeterministicEvidenceBundle } from './evidence';
import {
  SYNTHESIS_PROMPT_MAX_CHARACTERS,
  assertPromptCharacterBudget,
  buildDistributedTemporalPromptView,
  buildTranscriptPromptView,
  compactValueForPrompt,
  safeJsonForPrompt,
} from './grounding';
import {
  estimateConfiguredModelCost,
  parseStructuredResponse,
  type StructuredCallMetrics,
} from './openai-client';

/**
 * This is deliberately the only shape generated during synthesis. Evidence,
 * specialists, timeline, score values and version metadata are not fields the
 * model can return: they are merged by the server after the call.
 */
export const GeneratedAnalysisNarrativeSchema = FinalAnalysisResultSchema.pick({
  strategicSummary: true,
  hook: true,
  script: true,
  editing: true,
  visual: true,
  textAndCaptions: true,
  audio: true,
  storytelling: true,
  conversion: true,
  priorities: true,
  correctionPlan: true,
  improvedVersion: true,
  rubric: true,
}).strict();

export type GeneratedAnalysisNarrative = z.infer<typeof GeneratedAnalysisNarrativeSchema>;

export interface CritiqueAndSynthesisInput {
  jobId: string;
  analysisId: string;
  evidence: DeterministicEvidenceBundle;
  specialists: SpecialistDiagnostic[];
  timeline: TimelineSegment[];
  /** Consent-bound historical context. Never part of current-video evidence or scoring. */
  creatorMemoryContext?: string;
  /** Kept injectable so a durable retry can preserve one generation timestamp. */
  generatedAt?: string;
}

export type SynthesisStage = 'critique' | 'synthesis' | 'repair';

export interface SynthesisCallMetric extends StructuredCallMetrics {
  stage: SynthesisStage;
  estimatedCostUsd: number | null;
}

export interface CritiqueAndSynthesisMetrics {
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  stageDurationMs: number;
  estimatedCostUsd: number | null;
  models: string[];
  /** Contains operational counters only: never prompts, responses or user data. */
  calls: SynthesisCallMetric[];
}

export interface CritiqueAndSynthesisResult {
  result: FinalAnalysisResult;
  critique: AnalysisCritique;
  quality: QualityValidationReport;
  metrics: CritiqueAndSynthesisMetrics;
  repaired: boolean;
}

type StructuredCall = typeof parseStructuredResponse;

interface SynthesisDependencies {
  structuredCall?: StructuredCall;
  now?: () => Date;
  checkpoint?: SynthesisCheckpoint | null;
  persistCheckpoint?: (checkpoint: SynthesisCheckpoint) => Promise<void>;
}

export interface SynthesisCheckpoint {
  version: 'synthesis-checkpoint-v1';
  promptVersion: string;
  generatedAt: string;
  critique?: AnalysisCritique;
  narrative?: GeneratedAnalysisNarrative;
  calls: SynthesisCallMetric[];
}

export function parseSynthesisCheckpoint(value: unknown): SynthesisCheckpoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    row.version !== 'synthesis-checkpoint-v1'
    || row.promptVersion !== VIDEO_ANALYSIS_VERSIONS.prompt
    || typeof row.generatedAt !== 'string'
    || !Number.isFinite(Date.parse(row.generatedAt))
    || !Array.isArray(row.calls)
  ) return null;
  const calls = row.calls.filter((call): call is SynthesisCallMetric => {
    if (!call || typeof call !== 'object' || Array.isArray(call)) return false;
    const metricRow = call as Record<string, unknown>;
    return ['critique', 'synthesis', 'repair'].includes(String(metricRow.stage))
      && typeof metricRow.model === 'string'
      && ['inputTokens', 'outputTokens', 'retries', 'durationMs', 'providerDurationMs']
        .every((key) => Number.isFinite(Number(metricRow[key])));
  });
  if (calls.length !== row.calls.length) return null;
  const critique = row.critique === undefined
    ? undefined
    : AnalysisCritiqueSchema.safeParse(row.critique);
  if (critique && !critique.success) return null;
  const narrative = row.narrative === undefined
    ? undefined
    : GeneratedAnalysisNarrativeSchema.safeParse(row.narrative);
  if (narrative && !narrative.success) return null;
  return {
    version: 'synthesis-checkpoint-v1',
    promptVersion: VIDEO_ANALYSIS_VERSIONS.prompt,
    generatedAt: row.generatedAt,
    calls,
    ...(critique ? { critique: critique.data } : {}),
    ...(narrative ? { narrative: narrative.data } : {}),
  };
}

export class FinalAnalysisQualityError extends Error {
  readonly report: QualityValidationReport;

  constructor(report: QualityValidationReport) {
    super('FINAL_ANALYSIS_QUALITY_REJECTED');
    this.name = 'FinalAnalysisQualityError';
    this.report = report;
  }
}

function measuredSignalId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const signal = value as { status?: unknown; id?: unknown };
  return signal.status === 'measured' && typeof signal.id === 'string' ? signal.id : null;
}

/** Mirrors the evidence catalogue accepted by the global quality gate. */
export function collectDeterministicEvidenceIds(
  evidence: DeterministicEvidenceBundle,
): Set<string> {
  const ids = new Set(evidence.frames.map((frame) => frame.id));
  if (evidence.transcription.status === 'available') {
    evidence.transcription.normalized.segments.forEach((segment) => ids.add(segment.id));
    evidence.transcription.normalized.words.forEach((word) => ids.add(word.id));
  }
  for (const signal of [
    ...Object.values(evidence.audioSignals),
    ...Object.values(evidence.visualSignals),
  ]) {
    const id = measuredSignalId(signal);
    if (id) ids.add(id);
  }
  if (evidence.audioSignals.pauseIntervals.status === 'measured') {
    evidence.audioSignals.pauseIntervals.value.forEach((pause) => ids.add(pause.id));
  }
  if (evidence.observedMetrics.status === 'available') {
    evidence.observedMetrics.metrics.forEach((metric) => ids.add(metric.id));
  }
  if (evidence.retention.status === 'available') {
    evidence.retention.points.forEach((point) => ids.add(point.id));
  }
  return ids;
}

function critiqueTargetIds(input: CritiqueAndSynthesisInput): Set<string> {
  return new Set([
    input.analysisId,
    ...collectDeterministicEvidenceIds(input.evidence),
    ...input.specialists.map((diagnostic) => diagnostic.id),
    ...input.specialists.flatMap((diagnostic) => diagnostic.findings.map((finding) => finding.id)),
    ...input.timeline.map((segment) => segment.id),
  ]);
}

export function validateCrossCritique(
  critiqueCandidate: unknown,
  input: CritiqueAndSynthesisInput,
): AnalysisCritique {
  const critique = AnalysisCritiqueSchema.parse(critiqueCandidate);
  const expectedDiagnostics = new Set(input.specialists.map((diagnostic) => diagnostic.id));
  const reviewedDiagnostics = new Set(critique.reviewedDiagnosticIds);
  if (
    reviewedDiagnostics.size !== critique.reviewedDiagnosticIds.length
    || reviewedDiagnostics.size !== expectedDiagnostics.size
    || [...expectedDiagnostics].some((id) => !reviewedDiagnostics.has(id))
  ) {
    throw new Error('CROSS_CRITIQUE_INCOMPLETE');
  }

  const allowedTargets = critiqueTargetIds(input);
  for (const issue of critique.issues) {
    if (issue.targetIds.some((id) => !allowedTargets.has(id))) {
      throw new Error('CROSS_CRITIQUE_UNKNOWN_TARGET');
    }
  }
  if (critique.issues.some((issue) => issue.severity === 'error')) {
    throw new Error('CROSS_CRITIQUE_UNRESOLVED_ERROR');
  }
  return critique;
}

export function validateCrossCritiqueOrFallback(
  critiqueCandidate: unknown,
  input: CritiqueAndSynthesisInput,
): AnalysisCritique {
  try {
    const critique = validateCrossCritique(critiqueCandidate, input);
    if (critique.verdict === 'reject') throw new Error('CROSS_CRITIQUE_REJECTED');
    return critique;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('CROSS_CRITIQUE_')) throw error;
    return {
      version: 'analysis-critique-v1',
      verdict: 'revise',
      reviewedDiagnosticIds: input.specialists.map((diagnostic) => diagnostic.id),
      issues: [],
      contradictionsResolved: [],
      limitations: [
        'Critique fournisseur écartée car elle ne respectait pas les identifiants de preuve validés par le serveur.',
      ],
    };
  }
}

function validateDeterministicInputs(input: CritiqueAndSynthesisInput) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(input.analysisId)) {
    throw new Error('ANALYSIS_ID_INVALID');
  }
  if (!input.jobId.trim()) throw new Error('ANALYSIS_JOB_ID_INVALID');
  const specialists = input.specialists.map((diagnostic) => SpecialistDiagnosticSchema.parse(diagnostic));
  const timeline = input.timeline.map((segment) => TimelineSegmentSchema.parse(segment));
  if (specialists.length === 0) throw new Error('SPECIALISTS_MISSING');
  if (timeline.length === 0) throw new Error('TIMELINE_MISSING');
  return { specialists, timeline };
}

interface EvidencePromptView {
  view: unknown;
  evidenceIds: string[];
}

interface SpecialistPromptView {
  view: unknown;
  findingIds: string[];
}

interface TimelinePromptView {
  view: unknown;
  segmentIds: string[];
}

interface PromptViewLimits {
  frames: number;
  transcriptSegments: number;
  transcriptWords: number;
  retentionPoints: number;
  findingsPerSpecialist: number;
  timelineSegments: number;
}

const DEFAULT_PROMPT_VIEW_LIMITS: PromptViewLimits = {
  frames: 18,
  transcriptSegments: 30,
  transcriptWords: 0,
  retentionPoints: 30,
  findingsPerSpecialist: 3,
  timelineSegments: 20,
};

const REPAIR_PROMPT_VIEW_LIMITS: PromptViewLimits = {
  frames: 10,
  transcriptSegments: 16,
  transcriptWords: 0,
  retentionPoints: 16,
  findingsPerSpecialist: 2,
  timelineSegments: 12,
};

function measuredEvidenceIds(evidence: DeterministicEvidenceBundle): string[] {
  return [
    ...Object.values(evidence.audioSignals),
    ...Object.values(evidence.visualSignals),
  ].flatMap((signal) => {
    const id = measuredSignalId(signal);
    return id ? [id] : [];
  });
}

function evidenceForPrompt(
  evidence: DeterministicEvidenceBundle,
  limits: PromptViewLimits = DEFAULT_PROMPT_VIEW_LIMITS,
): EvidencePromptView {
  const frameView = buildDistributedTemporalPromptView({
    items: evidence.frames,
    maximumItems: limits.frames,
    getId: (frame) => frame.id,
    getStartSec: (frame) => frame.timestampSec,
    getEndSec: (frame) => frame.timestampSec,
  });
  const frames = {
    items: frameView.items.map((frame) => compactValueForPrompt(frame, {
      maximumStringCharacters: 360,
      maximumArrayItems: 40,
    })),
    coverage: frameView.coverage,
  };

  const transcriptView = evidence.transcription.status === 'available'
    ? buildTranscriptPromptView({
        status: 'available',
        text: evidence.transcription.normalized.text,
        segments: evidence.transcription.normalized.segments,
        words: evidence.transcription.normalized.words,
      }, {
        maximumSegments: limits.transcriptSegments,
        maximumWords: limits.transcriptWords,
        maximumSegmentCharacters: 480,
        maximumWordCharacters: 80,
      })
    : null;
  const transcript = evidence.transcription.status === 'available' && transcriptView
    ? {
        source: evidence.transcription.source,
        model: evidence.transcription.model,
        timingPrecision: evidence.transcription.timingPrecision,
        language: evidence.transcription.normalized.language,
        generatedAt: evidence.transcription.generatedAt,
        ...transcriptView,
      }
    : evidence.transcription;

  const transcriptIds = transcriptView
    ? [
        ...transcriptView.segments.coverage.includedIds,
        ...transcriptView.words.coverage.includedIds,
      ]
    : [];

  const retentionPointView = evidence.retention.status === 'available'
    ? buildDistributedTemporalPromptView({
        items: evidence.retention.points,
        maximumItems: limits.retentionPoints,
        getId: (point) => point.id,
        getStartSec: (point) => point.timestampSec,
        getEndSec: (point) => point.timestampSec,
      })
    : null;
  const retention = evidence.retention.status === 'available' && retentionPointView
    ? (() => {
        return {
          status: evidence.retention.status,
          source: evidence.retention.source,
          sourceReference: evidence.retention.sourceReference,
          observedAt: evidence.retention.observedAt,
          points: retentionPointView,
        };
      })()
    : evidence.retention;

  const observedMetricIds = evidence.observedMetrics.status === 'available'
    ? evidence.observedMetrics.metrics.map((metric) => metric.id)
    : [];
  const retentionIds = retentionPointView
    ? retentionPointView.coverage.includedIds
    : [];

  return {
    view: {
      canonicalDataPolicy: {
        preservedInFinalResult: true,
        fullTranscriptDuplicatedInPrompt: false,
        omissionIsAlwaysDeclaredByCoverage: true,
      },
      video: compactValueForPrompt(evidence.video, { maximumStringCharacters: 500, maximumArrayItems: 40 }),
      creatorContext: compactValueForPrompt(evidence.creatorContext, {
        maximumStringCharacters: 600,
        maximumArrayItems: 40,
      }),
      frames,
      transcription: transcript,
      audioSignals: compactValueForPrompt(evidence.audioSignals, {
        maximumStringCharacters: 360,
        maximumArrayItems: 80,
      }),
      visualSignals: compactValueForPrompt(evidence.visualSignals, {
        maximumStringCharacters: 360,
        maximumArrayItems: 80,
      }),
      observedMetrics: compactValueForPrompt(evidence.observedMetrics, {
        maximumStringCharacters: 500,
        maximumArrayItems: 100,
      }),
      retention,
    },
    evidenceIds: [...new Set([
      ...frameView.coverage.includedIds,
      ...transcriptIds,
      ...measuredEvidenceIds(evidence),
      ...observedMetricIds,
      ...retentionIds,
    ])],
  };
}

function specialistsForPrompt(
  specialists: readonly SpecialistDiagnostic[],
  durationSec: number,
  maximumFindings = DEFAULT_PROMPT_VIEW_LIMITS.findingsPerSpecialist,
): SpecialistPromptView {
  const findingIds: string[] = [];
  const items = specialists.map((diagnostic) => {
    const indexedFindings = diagnostic.findings.map((finding, index) => ({ finding, index }));
    const findingView = buildDistributedTemporalPromptView({
      items: indexedFindings,
      maximumItems: maximumFindings,
      getId: ({ finding }) => finding.id,
      getStartSec: ({ finding, index }) => (
        finding.timeRange?.startSec ?? ((index * durationSec) / Math.max(1, diagnostic.findings.length))
      ),
      getEndSec: ({ finding, index }) => (
        finding.timeRange?.endSec ?? ((index * durationSec) / Math.max(1, diagnostic.findings.length))
      ),
    });
    findingIds.push(...findingView.coverage.includedIds);
    return {
      id: diagnostic.id,
      specialist: diagnostic.specialist,
      summary: compactValueForPrompt(diagnostic.summary, { maximumStringCharacters: 600 }),
      findings: {
        items: findingView.items.map(({ finding }) => compactValueForPrompt(finding, {
          maximumStringCharacters: 600,
          maximumArrayItems: 40,
        })),
        coverage: findingView.coverage,
      },
      limitations: compactValueForPrompt(diagnostic.limitations, {
        maximumStringCharacters: 500,
        maximumArrayItems: 20,
      }),
    };
  });
  return {
    view: {
      items,
      coverage: {
        originalCount: specialists.length,
        includedCount: specialists.length,
        omittedCount: 0,
        canonicalDataPreservedOutsidePrompt: true,
      },
    },
    findingIds,
  };
}

function timelineForPrompt(
  timeline: readonly TimelineSegment[],
  maximumSegments = DEFAULT_PROMPT_VIEW_LIMITS.timelineSegments,
): TimelinePromptView {
  const timelineView = buildDistributedTemporalPromptView({
    items: timeline,
    maximumItems: maximumSegments,
    getId: (segment) => segment.id,
    getStartSec: (segment) => segment.startTime,
    getEndSec: (segment) => segment.endTime,
  });
  return {
    view: {
      items: timelineView.items.map((segment) => compactValueForPrompt(segment, {
        maximumStringCharacters: 500,
        maximumArrayItems: 24,
      })),
      coverage: timelineView.coverage,
    },
    segmentIds: timelineView.coverage.includedIds,
  };
}

const CRITIQUE_INSTRUCTIONS = [
  'Les vues temporelles sont distribuees sur ouverture, milieu et fin; toute omission est explicite dans coverage et ne doit jamais etre inventee.',
  'Controle que supportingSourceIds cite uniquement des findings specialistes ou segments timeline visibles et directement compatibles avec la recommandation.',
  'Controle que toute transcriptCitation disponible reproduit mot pour mot le texte du segment visible associe.',
  'Tu es la passe de critique croisée du moteur Viralynz, pas un rédacteur marketing.',
  'Relis tous les diagnostics fournis et chaque segment inclus dans la vue timeline distribuee avant de rendre ton verdict.',
  'Vérifie les contradictions, les références de preuve, les timecodes, les affirmations de métriques, la rétention réelle et les formulations génériques.',
  'Une absence de donnée doit rester une limitation. N’invente jamais vues, watch time, engagement, rétention, émotion ou intention.',
  'Une recommandation doit découler d’une observation citée; sinon signale unsupported_claim.',
  'reviewedDiagnosticIds doit contenir exactement tous les diagnostics fournis, une fois chacun.',
  'targetIds ne peut citer que les identifiants autorisés fournis dans la demande.',
  'Utilise reject seulement si les preuves déterministes sont fondamentalement inutilisables; sinon revise et décris ce que la synthèse doit écarter ou corriger.',
  'Réponds uniquement selon le schéma structuré.',
].join('\n');

const SYNTHESIS_INSTRUCTIONS = [
  'Chaque recommandation et chaque etape renseigne timeRange, observation, why ou rationale, objective, objectiveFit, action ou text, example, supportingSourceIds, transcriptCitation, nature et evidence selon son schema.',
  'Pour hook, script, editing, visual, textAndCaptions, audio, storytelling et conversion, renseigne la propriete section exacte et la matrice criteria complete imposee par le schema; aucun critere ne peut manquer, etre duplique ou changer de section.',
  'Chaque critere utilise seulement observed, not_observed ou unavailable. observed et not_observed citent au moins une preuve; unavailable cite evidence=[] et explique honnetement le signal manquant dans note.',
  'timeRange est la plage prouvee quand elle existe et null pour une observation globale ou un signal non localisable. Ne fabrique jamais un timecode pour remplir ce champ.',
  'Une section entierement non mesurable doit etre status=unavailable tout en conservant sa matrice complete, avec tous ses criteres unavailable.',
  'supportingSourceIds cite uniquement les IDs visibles de findings specialistes ou segments timeline qui soutiennent directement et sans contradiction la recommandation.',
  'Une transcriptCitation disponible doit reprendre mot pour mot un extrait du transcript visible et citer le segmentId compatible avec le timeRange; sinon utilise not_applicable avec une raison factuelle autorisee.',
  'La timeline fournie comporte objective, objectiveFit, example et transcriptCitation: conserve cette precision dans toutes les decisions derivees.',
  'improvedVersion.bestHook est seulement un selecteur {hookId, why, evidence} vers exactement un des trois hooks proposes; ne genere jamais un quatrieme hook.',
  'Les vues temporelles couvrent ouverture, milieu et fin; coverage declare toute omission et les donnees canoniques restent conservees hors prompt.',
  'Tu es Viralynz, un coach de repost précis: analyse présente → diagnostic → décision de montage → V2 testable.',
  'Tu produis uniquement les sections éditoriales et les évaluations de rubrique demandées par le schéma.',
  'Les preuves, la timeline, les diagnostics, les scores, les versions et les métadonnées sont fusionnés côté serveur: ne les recrée pas.',
  'Chaque champ evidence cite uniquement un identifiant du catalogue autorisé.',
  'La mémoire créateur éventuelle est un contexte historique non probant: elle ne peut jamais servir de preuve, de score ou d’observation de la vidéo courante.',
  'Chaque critère de rubrique apparaît exactement une fois. unavailable + evidence=[] si le signal nécessaire manque.',
  'Distingue toujours une observation réelle d’un risque éditorial. N’affirme jamais qu’un spectateur part ou que la rétention chute sans courbe plateforme citée.',
  'N’invente jamais vues, likes, engagement, watch time, conversion, intention, émotion, visage, voix, musique ou métrique non mesurée.',
  'Écris en français, concret et directement applicable: quoi couper, avancer, réécrire, garder, republier ou tester en V2.',
  'Interdiction des conseils génériques isolés comme “améliore le hook”, “rends la vidéo dynamique” ou “optimise ton contenu”.',
  'La V2 doit rester fidèle au sujet, au ton, à l’audience et à l’objectif fournis; elle ne promet aucun résultat futur.',
  'Réponds uniquement selon le schéma structuré.',
].join('\n');

const REPAIR_INSTRUCTIONS = [
  SYNTHESIS_INSTRUCTIONS,
  'Tu répares une synthèse refusée par la gate qualité.',
  'Corrige exactement les problèmes listés sans modifier les faits déterministes, la timeline ni les diagnostics.',
  'Si une affirmation ne peut pas être prouvée, retire-la ou rends la section indisponible avec une limitation factuelle.',
  'N’ajoute aucun champ hors schéma.',
].join('\n');

// Must remain valid for every configured fallback, including GPT-4o/4o-mini.
const MAX_SYNTHESIS_OUTPUT_TOKENS = VIDEO_ANALYSIS_BUDGET.maxSynthesisOutputTokens;
const SYNTHESIS_PROVIDER_TIMEOUT_MS = 240_000;

function synthesisContext(
  input: CritiqueAndSynthesisInput,
  critique: AnalysisCritique,
  limits: PromptViewLimits = DEFAULT_PROMPT_VIEW_LIMITS,
) {
  const evidence = evidenceForPrompt(input.evidence, limits);
  const specialists = specialistsForPrompt(
    input.specialists,
    input.evidence.video.durationSec,
    limits.findingsPerSpecialist,
  );
  const timeline = timelineForPrompt(input.timeline, limits.timelineSegments);
  const supportingSourceIds = [...new Set([
    ...specialists.findingIds,
    ...timeline.segmentIds,
  ])];
  return {
    creatorContext: compactValueForPrompt(input.evidence.creatorContext, {
      maximumStringCharacters: 600,
      maximumArrayItems: 40,
    }),
    video: compactValueForPrompt(input.evidence.video, {
      maximumStringCharacters: 500,
      maximumArrayItems: 40,
    }),
    evidence: evidence.view,
    evidenceIds: evidence.evidenceIds,
    specialists: specialists.view,
    critique: compactValueForPrompt(critique, {
      maximumStringCharacters: 600,
      maximumArrayItems: 100,
    }),
    timeline: timeline.view,
    rubric: VIRALYNZ_RUBRIC.map(({ id, dimension, weight }) => ({ id, dimension, weight })),
    sourcePolicy: {
      supportingSourceIds,
      rule: 'Only these visible specialist finding IDs and timeline segment IDs may be used in supportingSourceIds, and each source must directly support the claim.',
      transcriptCitation: 'A quote must be exact verbatim text from a visible transcript segment with a compatible segmentId and timeRange; otherwise use not_applicable.',
      canonicalDataPreservedOutsidePrompt: true,
    },
    ...(input.creatorMemoryContext?.trim()
      ? { creatorMemoryHistoricalContext: input.creatorMemoryContext.trim().slice(0, 3_600) }
      : {}),
  };
}

export function buildCritiquePrompt(input: CritiqueAndSynthesisInput): string {
  const evidence = evidenceForPrompt(input.evidence);
  const specialists = specialistsForPrompt(input.specialists, input.evidence.video.durationSec);
  const timeline = timelineForPrompt(input.timeline);
  const targets = [...new Set([
    input.analysisId,
    ...input.specialists.map((diagnostic) => diagnostic.id),
    ...evidence.evidenceIds,
    ...specialists.findingIds,
    ...timeline.segmentIds,
  ])];
  const prompt = [
    `Analyse: ${input.analysisId}`,
    `Diagnostics a couvrir exactement: ${input.specialists.map((item) => item.id).join(', ')}`,
    `TargetIds autorises et visibles: ${targets.join(', ')}`,
    'Contexte deterministe distribue JSON:',
    safeJsonForPrompt({
      evidence: evidence.view,
      specialists: specialists.view,
      timeline: timeline.view,
      sourcePolicy: {
        supportingSourceIds: [...new Set([...specialists.findingIds, ...timeline.segmentIds])],
        transcriptCitation: 'Exact verbatim quote from a visible transcript segment only.',
        omittedContent: 'Never infer content declared omitted by a coverage object.',
      },
    }, 90_000),
  ].join('\n');
  return assertPromptCharacterBudget(
    prompt,
    SYNTHESIS_PROMPT_MAX_CHARACTERS,
    'CRITIQUE_PROMPT_TOO_LARGE',
  );
}

export function buildSynthesisPrompt(
  input: CritiqueAndSynthesisInput,
  critique: AnalysisCritique,
): string {
  const prompt = [
    `Analyse: ${input.analysisId}`,
    `Version de prompt: ${VIDEO_ANALYSIS_VERSIONS.prompt}`,
    'Les IDs crees dans les recommandations, etapes, scripts et tests A/B doivent etre uniques dans toute la reponse.',
    'supportingSourceIds doit citer une source visible et directement compatible; transcriptCitation doit etre exacte et verbatim.',
    'improvedVersion.bestHook selectionne par hookId un des trois hooks proposes et ne constitue pas un quatrieme hook.',
    'Contexte complet distribue JSON:',
    safeJsonForPrompt(synthesisContext(input, critique), 120_000),
  ].join('\n');
  return assertPromptCharacterBudget(
    prompt,
    SYNTHESIS_PROMPT_MAX_CHARACTERS,
    'SYNTHESIS_PROMPT_TOO_LARGE',
  );
}

const NARRATIVE_KEYS = [
  'strategicSummary', 'hook', 'script', 'editing', 'visual', 'textAndCaptions',
  'audio', 'storytelling', 'conversion', 'priorities', 'correctionPlan',
  'improvedVersion', 'rubric',
] as const satisfies readonly (keyof GeneratedAnalysisNarrative)[];

export const GeneratedAnalysisNarrativePatchSchema = GeneratedAnalysisNarrativeSchema.partial().strict();

function repairKeys(quality: QualityValidationReport): Array<keyof GeneratedAnalysisNarrative> {
  const allowed = new Set<string>(NARRATIVE_KEYS);
  const selected = quality.issues.flatMap((issue) => {
    const root = issue.path?.[0];
    return typeof root === 'string' && allowed.has(root)
      ? [root as keyof GeneratedAnalysisNarrative]
      : [];
  });
  const fallback: Array<keyof GeneratedAnalysisNarrative> = ['strategicSummary'];
  return [...new Set(selected.length ? selected : fallback)];
}

function repairPrompt(input: {
  request: CritiqueAndSynthesisInput;
  critique: AnalysisCritique;
  previous: GeneratedAnalysisNarrative;
  quality: QualityValidationReport;
}): string {
  const compactContext = synthesisContext(
    input.request,
    input.critique,
    REPAIR_PROMPT_VIEW_LIMITS,
  );
  const keys = repairKeys(input.quality);
  const previous = Object.fromEntries(keys.map((key) => [key, input.previous[key]]));
  const prompt = [
    `Analyse: ${input.request.analysisId}`,
    'Problemes de qualite a corriger:',
    safeJsonForPrompt(input.quality.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      path: issue.path,
      targetId: issue.targetId,
      message: issue.message,
    })), 30_000),
    `Retourne uniquement ces champs racine: ${keys.join(', ')}`,
    'Champs refuses uniquement:',
    safeJsonForPrompt(compactValueForPrompt(previous, {
      maximumStringCharacters: 320,
      maximumArrayItems: 16,
    }), 28_000),
    'Sources compactes autorisees:',
    safeJsonForPrompt({
      evidenceIds: compactContext.evidenceIds,
      sourcePolicy: compactContext.sourcePolicy,
      specialists: compactContext.specialists,
      timeline: compactContext.timeline,
    }, 38_000),
  ].join('\n');
  return assertPromptCharacterBudget(
    prompt,
    SYNTHESIS_PROMPT_MAX_CHARACTERS,
    'REPAIR_PROMPT_TOO_LARGE',
  );
}

export function buildDeterministicFallbackNarrative(reason: string): GeneratedAnalysisNarrative {
  const unavailable = 'Cette partie n’a pas pu être reconstruite de façon fiable dans le budget de l’analyse.';
  const section = (key: keyof typeof ANALYSIS_SECTION_CRITERIA) => ({
    section: key,
    status: 'unavailable' as const,
    reason: unavailable,
    limitations: [reason],
    criteria: ANALYSIS_SECTION_CRITERIA[key].map((criterionId) => ({
      criterionId,
      status: 'unavailable' as const,
      note: unavailable,
      evidence: [],
      timeRange: null,
      confidence: 'low' as const,
    })),
  });
  const unavailableBlock = {
    status: 'unavailable' as const,
    reason: unavailable,
    limitations: [reason],
  };
  return GeneratedAnalysisNarrativeSchema.parse({
    strategicSummary: unavailableBlock,
    hook: section('hook'),
    script: section('script'),
    editing: section('editing'),
    visual: section('visual'),
    textAndCaptions: section('textAndCaptions'),
    audio: section('audio'),
    storytelling: section('storytelling'),
    conversion: section('conversion'),
    priorities: unavailableBlock,
    correctionPlan: unavailableBlock,
    improvedVersion: unavailableBlock,
    rubric: {
      version: 'viralynz-rubric-v1',
      assessments: VIRALYNZ_RUBRIC.map((criterion) => ({
        criterionId: criterion.id,
        status: 'unavailable' as const,
        evidence: [],
        observation: unavailable,
        positive: null,
        penalty: null,
      })),
    },
  });
}

function operationalFallbackReason(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.split(':', 1)[0] : fallback;
  const code = raw.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
  return code || fallback;
}

export function buildFinalAnalysisCandidate(input: {
  request: CritiqueAndSynthesisInput;
  critique: AnalysisCritique;
  narrative: GeneratedAnalysisNarrative;
  generatedAt: string;
}): FinalAnalysisResult {
  const narrative = GeneratedAnalysisNarrativeSchema.parse(input.narrative);
  const scores = computeDeterministicScores(narrative.rubric.assessments);
  return FinalAnalysisResultSchema.parse({
    version: 'viralynz-analysis-v2',
    schemaVersion: '2.0.0',
    engineVersion: VIDEO_ANALYSIS_VERSIONS.pipeline,
    analysisId: input.request.analysisId,
    generatedAt: input.generatedAt,
    creatorContext: input.request.evidence.creatorContext,
    video: input.request.evidence.video,
    evidence: {
      frames: input.request.evidence.frames,
      transcription: input.request.evidence.transcription,
      audioSignals: input.request.evidence.audioSignals,
      visualSignals: input.request.evidence.visualSignals,
      observedMetrics: input.request.evidence.observedMetrics,
      retention: input.request.evidence.retention,
    },
    specialists: input.request.specialists,
    critique: input.critique,
    ...narrative,
    timeline: input.request.timeline,
    scores,
  });
}

function metric(stage: SynthesisStage, value: StructuredCallMetrics): SynthesisCallMetric {
  return {
    stage,
    ...value,
    estimatedCostUsd: estimateConfiguredModelCost(
      value.model,
      value.inputTokens,
      value.outputTokens,
    ),
  };
}

function aggregateMetrics(calls: SynthesisCallMetric[], stageDurationMs: number): CritiqueAndSynthesisMetrics {
  const knownCosts = calls.map((call) => call.estimatedCostUsd);
  const allCostsKnown = knownCosts.every((cost): cost is number => cost !== null);
  return {
    providerCalls: calls.length,
    inputTokens: calls.reduce((sum, call) => sum + call.inputTokens, 0),
    outputTokens: calls.reduce((sum, call) => sum + call.outputTokens, 0),
    retries: calls.reduce((sum, call) => sum + call.retries, 0),
    stageDurationMs,
    estimatedCostUsd: allCostsKnown
      ? Number(knownCosts.reduce((sum, cost) => sum + cost, 0).toFixed(6))
      : null,
    models: [...new Set(calls.map((call) => call.model))],
    calls,
  };
}

/**
 * Runs one cross-critique, one synthesis and at most one quality repair.
 * It never writes to Supabase; the durable workflow owns metrics persistence
 * and the final atomic save after this function returns a passing report.
 */
export async function runCritiqueAndSynthesis(
  input: CritiqueAndSynthesisInput,
  dependencies: SynthesisDependencies = {},
): Promise<CritiqueAndSynthesisResult> {
  const { specialists, timeline } = validateDeterministicInputs(input);
  const request = { ...input, specialists, timeline };
  const structuredCall = dependencies.structuredCall ?? parseStructuredResponse;
  const reusableCheckpoint = dependencies.checkpoint?.version === 'synthesis-checkpoint-v1'
    && dependencies.checkpoint.promptVersion === VIDEO_ANALYSIS_VERSIONS.prompt
    ? dependencies.checkpoint
    : null;
  const generatedAt = reusableCheckpoint?.generatedAt
    ?? input.generatedAt
    ?? (dependencies.now?.() ?? new Date()).toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('ANALYSIS_GENERATED_AT_INVALID');
  const startedAt = Date.now();
  const calls: SynthesisCallMetric[] = [...(reusableCheckpoint?.calls ?? [])];
  const models = getVideoAnalysisModelConfig().synthesisCandidates;
  const persistCheckpoint = async (value: Pick<SynthesisCheckpoint, 'critique' | 'narrative'>) => {
    await dependencies.persistCheckpoint?.({
      version: 'synthesis-checkpoint-v1',
      promptVersion: VIDEO_ANALYSIS_VERSIONS.prompt,
      generatedAt,
      calls: [...calls],
      ...(value.critique ? { critique: value.critique } : {}),
      ...(value.narrative ? { narrative: value.narrative } : {}),
    });
  };

  let critique = reusableCheckpoint?.critique;
  if (!critique) {
    const critiqueResponse = await structuredCall({
      candidates: models,
      schema: AnalysisCritiqueSchema,
      schemaName: 'viralynz_cross_critique',
      instructions: CRITIQUE_INSTRUCTIONS,
      prompt: buildCritiquePrompt(request),
      maxOutputTokens: 4_000,
      maxRetries: VIDEO_ANALYSIS_BUDGET.maxProviderRetries,
      idempotencyKey: `${input.jobId}:critique:${VIDEO_ANALYSIS_VERSIONS.prompt}`,
    });
    calls.push(metric('critique', critiqueResponse.metrics));
    critique = validateCrossCritiqueOrFallback(critiqueResponse.value, request);
    await persistCheckpoint({ critique });
  }

  let narrative = reusableCheckpoint?.narrative;
  let fallbackUsed = false;
  if (!narrative) {
    try {
      const synthesisResponse = await structuredCall({
        candidates: models,
        schema: GeneratedAnalysisNarrativeSchema,
        schemaName: 'viralynz_final_narrative',
        instructions: SYNTHESIS_INSTRUCTIONS,
        prompt: buildSynthesisPrompt(request, critique),
        maxOutputTokens: MAX_SYNTHESIS_OUTPUT_TOKENS,
        timeoutMs: SYNTHESIS_PROVIDER_TIMEOUT_MS,
        maxRetries: 0,
        idempotencyKey: `${input.jobId}:synthesis:${VIDEO_ANALYSIS_VERSIONS.prompt}`,
      });
      calls.push(metric('synthesis', synthesisResponse.metrics));
      narrative = GeneratedAnalysisNarrativeSchema.parse(synthesisResponse.value);
      // Durability boundary: the expensive provider output is saved before the
      // quality gate, so a Workflow retry never regenerates it.
      await persistCheckpoint({ critique, narrative });
    } catch (error) {
      narrative = buildDeterministicFallbackNarrative(
        operationalFallbackReason(error, 'SYNTHESIS_UNAVAILABLE'),
      );
      fallbackUsed = true;
      await persistCheckpoint({ critique, narrative });
    }
  }
  let result = buildFinalAnalysisCandidate({ request, critique, narrative, generatedAt });
  let quality = validateAnalysisQuality(result);
  let repaired = false;

  if (!quality.validForPersistence && !fallbackUsed && VIDEO_ANALYSIS_BUDGET.maxRepairs > 0) {
    try {
      const keys = new Set(repairKeys(quality));
      const repairResponse = await structuredCall({
        candidates: models,
        schema: GeneratedAnalysisNarrativePatchSchema,
        schemaName: 'viralynz_repaired_narrative_fields',
        instructions: REPAIR_INSTRUCTIONS,
        prompt: repairPrompt({ request, critique, previous: narrative, quality }),
        maxOutputTokens: VIDEO_ANALYSIS_BUDGET.maxRepairOutputTokens,
        timeoutMs: SYNTHESIS_PROVIDER_TIMEOUT_MS,
        maxRetries: 0,
        idempotencyKey: `${input.jobId}:synthesis-repair:${VIDEO_ANALYSIS_VERSIONS.prompt}`,
      });
      calls.push(metric('repair', repairResponse.metrics));
      const patch = GeneratedAnalysisNarrativePatchSchema.parse(repairResponse.value);
      const scopedPatch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => keys.has(key as keyof GeneratedAnalysisNarrative)),
      );
      if (Object.keys(scopedPatch).length === 0) throw new Error('ANALYSIS_REPAIR_EMPTY_PATCH');
      narrative = GeneratedAnalysisNarrativeSchema.parse({ ...narrative, ...scopedPatch });
      result = buildFinalAnalysisCandidate({ request, critique, narrative, generatedAt });
      quality = validateAnalysisQuality(result);
      repaired = true;
      await persistCheckpoint({ critique, narrative });
    } catch (error) {
      narrative = buildDeterministicFallbackNarrative(
        operationalFallbackReason(error, 'REPAIR_UNAVAILABLE'),
      );
      result = buildFinalAnalysisCandidate({ request, critique, narrative, generatedAt });
      quality = validateAnalysisQuality(result);
      repaired = true;
      fallbackUsed = true;
      await persistCheckpoint({ critique, narrative });
    }
  }

  if (!quality.validForPersistence) {
    narrative = buildDeterministicFallbackNarrative('FINAL_ANALYSIS_QUALITY_REJECTED');
    result = buildFinalAnalysisCandidate({ request, critique, narrative, generatedAt });
    quality = validateAnalysisQuality(result);
    await persistCheckpoint({ critique, narrative });
  }

  if (!quality.validForPersistence) throw new FinalAnalysisQualityError(quality);
  return {
    result,
    critique,
    quality,
    repaired,
    metrics: aggregateMetrics(calls, Date.now() - startedAt),
  };
}
