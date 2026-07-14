import 'server-only';

import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import {
  ANALYSIS_SECTION_CRITERIA,
  FinalAnalysisResultSchema,
  type AnalysisSection as EngineAnalysisSection,
  type AnalysisSectionCriterionId,
  type AnalysisSectionKey,
  type ComputedScore,
  type FinalAnalysisResult,
} from '@/lib/analysis-engine/index';
import {
  createArtifactSignedUrls,
  listJobArtifacts,
} from '@/lib/video-analysis/artifacts';
import {
  classifyAnalysisTransparency,
  type AnalysisTransparencyState,
  type AnalysisResult,
  type DiagnosticItem,
  type DiagnosticSeverity,
  type RepostVersion,
} from '@/lib/types';
import type {
  ReconstructionPlan,
  ReconstructionSequence,
} from '@/types/reconstruction';

type DetailResult = Partial<AnalysisResult>;

interface AnalysisDetailRow {
  id: string;
  user_id: string;
  video_url: string | null;
  result: DetailResult | null;
  engine_result: unknown;
  created_at: string;
}

export type AnalysisDetailStatus = 'ok' | 'unauthenticated' | 'not_found' | 'forbidden';

export interface AnalysisMoment {
  time: string;
  title: string;
  diagnostic: string;
  correction: string;
  severity: DiagnosticSeverity;
  transcript?: string;
  observation?: string;
  objectiveFit?: string;
  example?: string;
  evidence?: string[];
  confidence?: 'faible' | 'moyenne' | 'élevée';
  nature?: string;
  frameUrl?: string | null;
}

export interface AnalysisDiagnostic {
  label: 'Hook' | 'Rythme' | 'Clarté' | 'Preuve' | 'CTA';
  score: number | null;
  problem: string;
  correction: string;
}

export interface EditingDecision {
  label: 'À couper' | 'À avancer' | 'À garder' | 'À réécrire' | 'À republier';
  decision: string;
}

export interface RecommendedV2Step {
  title: string;
  detail: string;
  timing: string;
}

export interface HookAlternative {
  hook: string;
  why: string;
}

export interface CtaRecommendation {
  main: string;
  why: string;
  directVariant: string;
  curiosityVariant: string;
}

export interface GroundedV2Item {
  id: string;
  time: string;
  observation: string;
  action: string;
  why: string;
  objectiveFit: string;
  example: string;
  confidence: 'faible' | 'moyenne' | 'élevée';
}

export interface ImprovedVersionDetail {
  fullScript: string;
  scriptSegments: Array<{
    id: string;
    purpose: string;
    text: string;
  }>;
  editPlan: GroundedV2Item[];
  shotList: GroundedV2Item[];
  onScreenText: GroundedV2Item[];
  effectsAndBRoll: GroundedV2Item[];
  caption: GroundedV2Item;
  firstLine: GroundedV2Item;
  abTests: Array<{
    id: string;
    variable: string;
    versionA: string;
    versionB: string;
    successCriterion: string;
  }>;
  limitations: string[];
}

export type AnalysisCriterionStatus = 'observed' | 'not_observed' | 'unavailable';

export interface AnalysisCriterionDetail {
  criterionId: AnalysisSectionCriterionId;
  label: string;
  status: AnalysisCriterionStatus;
  note: string;
  timeRange: string | null;
  confidence: 'faible' | 'moyenne' | 'élevée';
  evidence: string[];
}

export interface AnalysisSectionRecommendationDetail {
  id: string;
  timeRange: string;
  action: string;
  why: string;
  example: string;
}

export interface AnalysisSectionDetail {
  key: AnalysisSectionKey;
  label: string;
  status: 'available' | 'unavailable';
  summary: string;
  strengths: string[];
  problems: string[];
  recommendations: AnalysisSectionRecommendationDetail[];
  limitations: string[];
  criteria: AnalysisCriterionDetail[];
}

export interface AnalysisDetailData {
  id: string;
  videoUrl: string | null;
  createdAt: string;
  title: string;
  thumbnailUrl: string | null;
  duration: string;
  score: number | null;
  scoreLevel: string;
  scoreExplanation: string;
  transparency: AnalysisTransparencyState;
  verdict: string;
  summary: string;
  objective: string;
  niche: string;
  sourceLabel: string;
  formatLabel: string;
  keyMoments: AnalysisMoment[];
  diagnostics: AnalysisDiagnostic[];
  editingDecisions: EditingDecision[];
  recommendedV2: RecommendedV2Step[];
  hooks: HookAlternative[];
  cta: CtaRecommendation;
  analysisSections: AnalysisSectionDetail[];
  improvedVersion: ImprovedVersionDetail | null;
  repostPlan: string[];
  prepareHref: string;
  hooksHref: string;
  rawResult: DetailResult | null;
}

export interface AnalysisDetailLoadResult {
  status: AnalysisDetailStatus;
  data: AnalysisDetailData | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanText(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null;
  return value.replace(/\s+/g, ' ').trim();
}

function cleanTexts(values: unknown[] | null | undefined): string[] {
  return (values ?? []).map(cleanText).filter((value): value is string => Boolean(value));
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampScore(value: unknown): number | null {
  if (!finiteNumber(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non disponible';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDuration(seconds: unknown): string {
  if (!finiteNumber(seconds) || seconds <= 0) return 'Durée non disponible';
  return `${seconds.toFixed(seconds >= 20 ? 0 : 1)}s`;
}

function scoreLevel(score: number | null): string {
  if (score === null) return 'Score indisponible';
  if (score >= 85) return 'Très fort';
  if (score >= 70) return 'Bon';
  if (score >= 50) return 'Moyen';
  return 'Faible';
}

function scoreExplanation(score: number | null): string {
  if (score === null) return 'Score non affiché : Viralynz ne remplace pas une donnée absente par une note simulée.';
  if (score >= 85) return 'Le concept est solide. Le prochain gain vient surtout d’une V2 plus directe et plus tendue.';
  if (score >= 70) return 'La vidéo a une base exploitable, mais certains moments ralentissent l’attention avant le payoff.';
  if (score >= 50) return 'L’idée peut fonctionner, mais la structure explique avant de créer une vraie raison de rester.';
  return 'La vidéo demande une reconstruction nette : hook plus court, preuve avancée, CTA plus précis.';
}

function getVideoTitle(result: DetailResult | null, row: AnalysisDetailRow): string {
  return (
    firstText(
      result?.detectedVideoMeta?.caption,
      result?.analyzerMeta?.fileName,
      result?.coachAnalysis?.shareables?.screenshotTitle,
      result?.finalVerdict,
    )?.split('.').at(0)?.trim()
    || (row.video_url?.startsWith('http') ? 'Vidéo TikTok analysée' : null)
    || 'Vidéo analysée'
  );
}

function getSourceLabel(result: DetailResult | null): string {
  if (result?.analysisSource === 'vision_upload') return 'Upload vidéo';
  if (result?.analysisSource === 'url') return 'Lien TikTok';
  return 'Source non renseignée';
}

function getSubScores(result: DetailResult | null) {
  const subScores = result?.coachAnalysis?.subScores;
  const hook = clampScore(subScores?.hook ?? result?.hook?.score);
  const retention = clampScore(subScores?.retention ?? result?.retention?.score);
  const rhythm = clampScore(result?.editing?.score);
  const clarity = clampScore(subScores?.clarity);
  const explicitProof = result?.coachAnalysis?.detailedScores?.find((item) => /preuve|proof|payoff/i.test(`${item.key} ${item.label}`))?.value
    ?? result?.coachAnalysis?.scoreBreakdown?.find((item) => /preuve|proof|payoff/i.test(item.label))?.score;
  const proof = clampScore(explicitProof);
  const cta = clampScore(subScores?.cta);

  return { hook, retention, rhythm, clarity, proof, cta };
}

function findProblem(result: DetailResult | null, matcher: (item: DiagnosticItem) => boolean): DiagnosticItem | null {
  return result?.coachAnalysis?.detectedProblems?.find(matcher) ?? null;
}

function problemByIdOrTitle(result: DetailResult | null, terms: string[]): DiagnosticItem | null {
  const lowerTerms = terms.map((term) => term.toLowerCase());
  return findProblem(result, (item) => {
    const haystack = `${item.id} ${item.title} ${item.explanation}`.toLowerCase();
    return lowerTerms.some((term) => haystack.includes(term));
  });
}

function buildKeyMoments(result: DetailResult | null): AnalysisMoment[] {
  const problems = result?.coachAnalysis?.detectedProblems ?? [];
  const timeline = result?.coachAnalysis?.timeline ?? [];

  const moments = timeline.map((item): AnalysisMoment => {
    const relatedProblem = problems.find((problem) => problem.timecode === item.time)
      ?? problemByIdOrTitle(result, [item.type, item.label]);

    return {
      time: cleanText(item.time) ?? '—',
      title: cleanText(item.label) ?? 'Moment clé',
      diagnostic: cleanText(item.insight) ?? cleanText(relatedProblem?.explanation) ?? 'Diagnostic non disponible pour ce moment.',
      correction: cleanText(relatedProblem?.action) ?? correctionForMoment(item.type),
      severity: item.severity ?? relatedProblem?.severity ?? 'important',
    };
  });

  if (moments.length > 0) return moments.slice(0, 5);

  const problemMoments = problems.slice(0, 5).map((problem): AnalysisMoment => ({
    time: cleanText(problem.timecode) ?? '—',
    title: cleanText(problem.title) ?? 'Point de friction',
    diagnostic: cleanText(problem.explanation) ?? 'Diagnostic non disponible pour ce point.',
    correction: cleanText(problem.action) ?? 'Correction non disponible dans cette analyse.',
    severity: problem.severity ?? 'important',
  }));

  if (problemMoments.length > 0) return problemMoments;

  return [];
}

function correctionForMoment(type: string): string {
  if (type === 'hook') return 'Ouvre avec la tension principale, pas avec le contexte.';
  if (type === 'drop') return 'Avance la preuve avant la perte d’attention.';
  if (type === 'cta') return 'Pose une question simple ou demande un mot-clé.';
  if (type === 'rewatch') return 'Place le payoff plus tôt et garde une boucle ouverte.';
  return 'Correction non disponible dans cette analyse.';
}

function buildDiagnostics(result: DetailResult | null): AnalysisDiagnostic[] {
  const scores = getSubScores(result);
  const hookProblem = problemByIdOrTitle(result, ['hook']);
  const rhythmProblem = problemByIdOrTitle(result, ['pattern', 'rythme', 'interrupt']);
  const clarityProblem = problemByIdOrTitle(result, ['promise', 'promesse', 'clar']);
  const proofProblem = problemByIdOrTitle(result, ['payoff', 'preuve', 'open_loop']);
  const ctaProblem = problemByIdOrTitle(result, ['cta']);

  return [
    {
      label: 'Hook',
      score: scores.hook,
      problem: cleanText(hookProblem?.explanation) ?? firstText(result?.hook?.weaknesses?.[0], result?.hook?.analysis) ?? 'Donnée non disponible dans cette analyse.',
      correction: cleanText(hookProblem?.action) ?? 'Correction non disponible dans cette analyse.',
    },
    {
      label: 'Rythme',
      score: scores.rhythm,
      problem: cleanText(rhythmProblem?.explanation) ?? firstText(result?.editing?.weaknesses?.[0], result?.editing?.analysis) ?? 'Donnée non disponible dans cette analyse.',
      correction: cleanText(rhythmProblem?.action) ?? 'Correction non disponible dans cette analyse.',
    },
    {
      label: 'Clarté',
      score: scores.clarity,
      problem: cleanText(clarityProblem?.explanation) ?? 'Donnée non disponible dans cette analyse.',
      correction: cleanText(clarityProblem?.action) ?? 'Correction non disponible dans cette analyse.',
    },
    {
      label: 'Preuve',
      score: scores.proof,
      problem: cleanText(proofProblem?.explanation) ?? 'Donnée non disponible dans cette analyse.',
      correction: cleanText(proofProblem?.action) ?? 'Correction non disponible dans cette analyse.',
    },
    {
      label: 'CTA',
      score: scores.cta,
      problem: cleanText(ctaProblem?.explanation) ?? 'Donnée non disponible dans cette analyse.',
      correction: cleanText(ctaProblem?.action) ?? 'Correction non disponible dans cette analyse.',
    },
  ];
}

function buildEditingDecisions(result: DetailResult | null): EditingDecision[] {
  const cuts = result?.reconstructionIA?.cutsRecommended?.[0];
  const retentionFix = result?.reconstructionIA?.retentionFixes?.[0];
  const structuredCut = result?.structuredReconstructionIA?.optimizedStructure?.find((step) => step.move === 'cut');
  const structuredAdvance = result?.structuredReconstructionIA?.optimizedStructure?.find((step) => step.move === 'advance');
  const structuredKeep = result?.structuredReconstructionIA?.optimizedStructure?.find((step) => step.move === 'keep');
  const hookProblem = problemByIdOrTitle(result, ['hook']);
  const ctaProblem = problemByIdOrTitle(result, ['cta']);

  const candidates: Array<[EditingDecision['label'], string | null]> = [
    ['À couper', cleanText(structuredCut?.recommendation) ?? cleanText(cuts?.reason)],
    ['À avancer', cleanText(structuredAdvance?.recommendation) ?? cleanText(retentionFix?.fix)],
    ['À garder', cleanText(structuredKeep?.recommendation) ?? firstText(result?.hook?.strengths?.[0], result?.editing?.strengths?.[0])],
    ['À réécrire', cleanText(hookProblem?.action) ?? cleanText(ctaProblem?.action)],
    ['À republier', cleanText(result?.repostVersion?.shortVersion) ?? cleanText(result?.coachAnalysis?.repostEngine.bestOpportunity?.action)],
  ];

  return candidates.flatMap(([label, decision]) => decision ? [{ label, decision }] : []);
}

function structuredStepToV2(step: ReconstructionSequence): RecommendedV2Step {
  return {
    title: cleanText(step.title) ?? titleForMove(step.move, step.type),
    detail: cleanText(step.recommendation) ?? cleanText(step.retentionGoal) ?? 'Détail non disponible dans cette analyse.',
    timing: `${step.start} → ${step.end}`,
  };
}

function legacyStepToV2(step: NonNullable<AnalysisResult['reconstructionIA']>['optimizedStructure'][number]): RecommendedV2Step {
  return {
    title: titleForMove(step.move, step.type),
    detail: cleanText(step.recommendation) ?? cleanText(step.goal) ?? 'Détail non disponible dans cette analyse.',
    timing: `${step.start} → ${step.end}`,
  };
}

function repostStepToV2(step: string, index: number): RecommendedV2Step {
  const [maybeTiming, ...rest] = step.split(':');
  return {
    title: `Étape ${index + 1}`,
    detail: cleanText(rest.join(':')) ?? cleanText(step) ?? 'Détail non disponible dans cette analyse.',
    timing: rest.length > 0 ? maybeTiming.trim() : '—',
  };
}

function titleForMove(move: string | undefined, type: string): string {
  if (move === 'advance') return 'Avance la preuve';
  if (move === 'cut') return 'Coupe l’intro';
  if (move === 'rewrite') return 'Réécris le passage';
  if (move === 'insert') return 'Ajoute une relance';
  if (move === 'move_cta') return 'Déplace le CTA';
  if (type === 'HOOK') return 'Ouvre avec le résultat';
  if (type === 'PROOF' || type === 'PAYOFF') return 'Donne la preuve rapidement';
  if (type === 'CTA') return 'Termine avec un CTA clair';
  return 'Resserre la structure';
}

function buildRecommendedV2(result: DetailResult | null): RecommendedV2Step[] {
  const structured = result?.structuredReconstructionIA as ReconstructionPlan | undefined;
  const structuredSteps = structured?.optimizedStructure?.map(structuredStepToV2) ?? [];
  const legacySteps = result?.reconstructionIA?.optimizedStructure?.map(legacyStepToV2) ?? [];
  const repostSteps = result?.repostVersion?.structure?.map(repostStepToV2) ?? [];
  const steps = structuredSteps.length > 0
    ? structuredSteps
    : legacySteps.length > 0
      ? legacySteps
      : repostSteps;
  return steps.slice(0, 5);
}

function buildHooks(result: DetailResult | null): HookAlternative[] {
  const reconstructionHooks = result?.reconstructionIA?.alternativeHooks?.map((item) => item.hook) ?? [];
  const structuredHooks = result?.structuredReconstructionIA?.alternativeHooks?.map((item) => item.hook) ?? [];
  const hooks = uniqueStrings([
    ...(result?.repostVersion?.hook ? [result.repostVersion.hook] : []),
    ...(result?.repostVersion?.hookVariants ?? []),
    ...(result?.coachAnalysis?.hookVariants ?? []),
    ...reconstructionHooks,
    ...structuredHooks,
  ]).slice(0, 5);

  return hooks.map((hook, index) => ({
    hook,
    why: hook === result?.repostVersion?.hook
      ? 'C’est le hook le plus proche de la V2 recommandée.'
      : index === 0
        ? 'Première alternative enregistrée par l’analyse.'
        : 'Alternative enregistrée par l’analyse.',
  }));
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }
  return output;
}

function buildCta(result: DetailResult | null): CtaRecommendation {
  const structuredCtas = result?.structuredReconstructionIA?.optimizedCTAs ?? [];
  const legacyCtas = result?.reconstructionIA?.ctaRecommendations ?? [];
  const main = firstText(
    result?.repostVersion?.cta,
    result?.coachAnalysis?.optimizedCtas?.[0],
    structuredCtas[0]?.cta,
    legacyCtas[0]?.cta,
  ) ?? '—';

  return {
    main,
    why: firstText(
      structuredCtas[0]?.why,
      legacyCtas[0]?.why,
    ) ?? 'Explication non disponible dans cette analyse.',
    directVariant: firstText(result?.coachAnalysis?.optimizedCtas?.[1], structuredCtas[1]?.cta) ?? '—',
    curiosityVariant: firstText(result?.coachAnalysis?.optimizedCtas?.[2], structuredCtas[2]?.cta) ?? '—',
  };
}

function buildRepostPlan(result: DetailResult | null): string[] {
  const actionPlan = cleanTexts(result?.actionPlan);
  const problemActions = cleanTexts(result?.coachAnalysis?.detectedProblems?.map((item) => item.action));
  const improvements = cleanTexts(result?.improvements?.map((item) => item.tip));
  return uniqueStrings([...actionPlan, ...problemActions, ...improvements]).slice(0, 7);
}

function engineScore(score: ComputedScore): number | null {
  return score.status === 'computed' ? clampScore(score.value) : null;
}

function engineSectionText(section: EngineAnalysisSection, field: 'summary' | 'problem' | 'recommendation'): string {
  if (section.status === 'unavailable') return section.reason;
  if (field === 'summary') return section.summary;
  if (field === 'problem') return section.problems[0] ?? section.summary;
  return section.recommendations[0]?.text ?? 'Aucune correction supplémentaire n’est justifiée par les preuves disponibles.';
}

function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(remainder < 10 ? 1 : 0).padStart(4, '0')}`;
}

function formatRange(start: number, end: number): string {
  return `${formatTimestamp(start)}–${formatTimestamp(end)}`;
}

const ANALYSIS_SECTION_ORDER: AnalysisSectionKey[] = [
  'hook',
  'script',
  'editing',
  'visual',
  'textAndCaptions',
  'audio',
  'storytelling',
  'conversion',
];

const ANALYSIS_SECTION_LABELS: Record<AnalysisSectionKey, string> = {
  hook: 'Hook',
  script: 'Script',
  editing: 'Montage',
  visual: 'Visuel',
  textAndCaptions: 'Texte et sous-titres',
  audio: 'Audio',
  storytelling: 'Storytelling',
  conversion: 'Conversion',
};

const ANALYSIS_CRITERION_LABELS: Record<AnalysisSectionCriterionId, string> = {
  'hook.verbal_hook': 'Accroche verbale',
  'hook.visual_hook': 'Accroche visuelle',
  'hook.audio_hook': 'Accroche audio',
  'hook.first_frame': 'Première image',
  'hook.time_to_understanding': 'Temps avant compréhension',
  'hook.time_to_benefit': 'Temps avant bénéfice',
  'hook.specificity': 'Précision',
  'hook.curiosity': 'Curiosité',
  'hook.cross_modal_consistency': 'Cohérence texte, image et audio',
  'hook.exact_recommendation': 'Correction exacte du hook',
  'script.clarity': 'Clarté',
  'script.structure': 'Structure',
  'script.density': 'Densité',
  'script.repetitions': 'Répétitions',
  'script.credibility': 'Crédibilité',
  'script.evidence': 'Preuves',
  'script.progression': 'Progression',
  'script.payoff': 'Payoff',
  'script.cta': 'CTA',
  'script.phrases_to_remove': 'Phrases à supprimer',
  'script.phrases_to_shorten': 'Phrases à raccourcir',
  'script.phrases_to_rewrite': 'Phrases à réécrire',
  'editing.rhythm': 'Rythme',
  'editing.cuts': 'Coupes',
  'editing.shot_changes': 'Changements de plan',
  'editing.b_roll': 'B-roll',
  'editing.pattern_interrupts': 'Ruptures de pattern',
  'editing.dead_air': 'Temps morts',
  'editing.transitions': 'Transitions',
  'editing.zooms': 'Zooms',
  'editing.demonstrations': 'Démonstrations',
  'editing.timestamped_recommendations': 'Corrections de montage horodatées',
  'visual.framing': 'Cadrage',
  'visual.lighting': 'Éclairage',
  'visual.composition': 'Composition',
  'visual.background': 'Arrière-plan',
  'visual.contrast': 'Contraste',
  'visual.energy': 'Énergie visuelle',
  'visual.camera_gaze': 'Regard caméra',
  'visual.product_presence': 'Présence du produit',
  'visual.readability': 'Lisibilité',
  'visual.first_frame': 'Première image',
  'text_and_captions.presence': 'Présence du texte',
  'text_and_captions.readability': 'Lisibilité',
  'text_and_captions.synchronization': 'Synchronisation',
  'text_and_captions.size': 'Taille',
  'text_and_captions.contrast': 'Contraste',
  'text_and_captions.length': 'Longueur',
  'text_and_captions.hierarchy': 'Hiérarchie',
  'text_and_captions.safe_zones': 'Zones sûres',
  'text_and_captions.unemphasized_key_words': 'Mots clés non mis en avant',
  'text_and_captions.errors': 'Erreurs de texte',
  'audio.voice': 'Voix',
  'audio.delivery_rate': 'Débit',
  'audio.pauses': 'Pauses',
  'audio.energy': 'Énergie vocale',
  'audio.music': 'Musique',
  'audio.noise': 'Bruit de fond',
  'audio.saturation': 'Saturation',
  'audio.balance': 'Équilibre voix et fond sonore',
  'audio.problematic_moments': 'Moments audio problématiques',
  'storytelling.open_loop': 'Boucle ouverte',
  'storytelling.tension': 'Tension',
  'storytelling.curiosity': 'Curiosité',
  'storytelling.progression': 'Progression',
  'storytelling.surprise': 'Surprise',
  'storytelling.evidence': 'Preuve',
  'storytelling.objection': 'Objection',
  'storytelling.payoff': 'Payoff',
  'storytelling.cognitive_load': 'Charge cognitive',
  'storytelling.emotional_change': 'Variation émotionnelle',
  'conversion.value_proposition': 'Proposition de valeur',
  'conversion.evidence': 'Preuve de la promesse',
  'conversion.objection': 'Objection',
  'conversion.cta': 'CTA',
  'conversion.friction': 'Friction',
  'conversion.cta_timing': 'Timing du CTA',
  'conversion.objective_alignment': 'Alignement avec l’objectif',
};

const ENGINE_OBJECTIVE_LABELS: Record<FinalAnalysisResult['creatorContext']['objective'], string> = {
  retention: 'Resserrer les risques éditoriaux',
  views: 'Générer des vues',
  comments: 'Générer des commentaires',
  followers: 'Générer des abonnements',
  leads: 'Générer des leads',
  sales: 'Vendre un produit',
  authority: 'Construire son autorité',
  advertising: 'Améliorer une publicité',
  clip: 'Améliorer un clip',
  other: 'Objectif personnalisé',
};

const ENGINE_FORMAT_LABELS: Record<FinalAnalysisResult['creatorContext']['format'], string> = {
  facecam: 'Facecam',
  ugc: 'UGC',
  clip: 'Clip',
  demo: 'Démonstration',
  storytelling: 'Storytelling',
  advertising: 'Publicité',
  other: 'Format personnalisé',
};

const NARRATIVE_LABELS: Record<FinalAnalysisResult['timeline'][number]['narrativeFunction'], string> = {
  hook: 'Hook',
  context: 'Contexte',
  problem: 'Problème',
  promise: 'Promesse',
  tension: 'Tension',
  proof: 'Preuve',
  explanation: 'Explication',
  demonstration: 'Démonstration',
  objection: 'Objection',
  transition: 'Transition',
  payoff: 'Payoff',
  cta: 'CTA',
  dead_air: 'Temps mort',
  redundant_information: 'Information redondante',
  filler: 'Passage de liaison',
  unknown: 'Fonction à confirmer',
};

function buildEngineEvidenceLabels(engine: FinalAnalysisResult): Map<string, string> {
  const labels = new Map<string, string>();
  for (const frame of engine.evidence.frames) {
    labels.set(frame.id, `Frame observée à ${formatTimestamp(frame.timestampSec)}`);
  }
  if (engine.evidence.transcription.status === 'available') {
    for (const segment of engine.evidence.transcription.normalized.segments) {
      const excerpt = segment.text.trim().slice(0, 120);
      const confidence = typeof segment.confidence === 'number'
        ? ` · confiance ${Math.round(segment.confidence * 100)} %${segment.uncertainty ? ` (${segment.uncertainty === 'high' ? 'incertitude élevée' : segment.uncertainty === 'medium' ? 'incertitude moyenne' : 'incertitude faible'})` : ''}`
        : '';
      labels.set(segment.id, `Transcript ${formatRange(segment.startSec, segment.endSec)}${confidence}${excerpt ? ` : « ${excerpt} »` : ''}`);
    }
    for (const word of engine.evidence.transcription.normalized.words) {
      labels.set(word.id, `Mot horodaté ${formatTimestamp(word.startSec)} : « ${word.text} »`);
    }
  }
  const signalGroups = [engine.evidence.audioSignals, engine.evidence.visualSignals];
  for (const group of signalGroups) {
    for (const value of Object.values(group)) {
      if (!value || typeof value !== 'object' || !('status' in value) || value.status !== 'measured' || !('id' in value)) continue;
      const signal = value as { id: string; value: unknown; unit: string };
      const rendered = Array.isArray(signal.value)
        ? `${signal.value.length} intervalle(s)`
        : typeof signal.value === 'number'
          ? `${Number(signal.value.toFixed(3))} ${signal.unit}`
          : String(signal.value);
      labels.set(signal.id, `Mesure technique : ${rendered}`);
    }
  }
  if (engine.evidence.audioSignals.pauseIntervals.status === 'measured') {
    for (const pause of engine.evidence.audioSignals.pauseIntervals.value) {
      labels.set(pause.id, `Pause mesurée ${formatRange(pause.startSec, pause.endSec)}`);
    }
  }
  if (engine.evidence.observedMetrics.status === 'available') {
    for (const metric of engine.evidence.observedMetrics.metrics) {
      const rendered = metric.unit === 'ratio'
        ? `${Number((metric.value * 100).toFixed(1))} %`
        : `${metric.value} ${metric.unit === 'seconds' ? 's' : ''}`.trim();
      labels.set(metric.id, `Métrique observée ${metric.key} : ${rendered}`);
    }
  }
  if (engine.evidence.retention.status === 'available') {
    for (const point of engine.evidence.retention.points) {
      labels.set(
        point.id,
        `Rétention observée à ${formatTimestamp(point.timestampSec)} : ${Number((point.retainedRatio * 100).toFixed(1))} %`,
      );
    }
  }
  return labels;
}

function criterionConfidence(value: 'low' | 'medium' | 'high'): AnalysisCriterionDetail['confidence'] {
  if (value === 'high') return 'élevée';
  if (value === 'medium') return 'moyenne';
  return 'faible';
}

function readableEvidence(reference: string, labels: ReadonlyMap<string, string>): string {
  return labels.get(reference) ?? `Preuve référencée : ${reference}`;
}

function mapEngineSection(
  section: EngineAnalysisSection,
  evidenceLabels: ReadonlyMap<string, string>,
): AnalysisSectionDetail {
  const criteria: AnalysisCriterionDetail[] = section.criteria.map((criterion) => ({
    criterionId: criterion.criterionId,
    label: ANALYSIS_CRITERION_LABELS[criterion.criterionId],
    status: criterion.status,
    note: criterion.note,
    timeRange: criterion.timeRange
      ? formatRange(criterion.timeRange.startSec, criterion.timeRange.endSec)
      : null,
    confidence: criterionConfidence(criterion.confidence),
    evidence: criterion.evidence.map((reference) => readableEvidence(reference, evidenceLabels)),
  }));

  if (section.status === 'unavailable') {
    return {
      key: section.section,
      label: ANALYSIS_SECTION_LABELS[section.section],
      status: 'unavailable',
      summary: section.reason,
      strengths: [],
      problems: [],
      recommendations: [],
      limitations: section.limitations,
      criteria,
    };
  }

  return {
    key: section.section,
    label: ANALYSIS_SECTION_LABELS[section.section],
    status: 'available',
    summary: section.summary,
    strengths: section.strengths,
    problems: section.problems,
    recommendations: section.recommendations.map((recommendation) => ({
      id: recommendation.id,
      timeRange: formatRange(recommendation.timeRange.startSec, recommendation.timeRange.endSec),
      action: recommendation.text,
      why: recommendation.why,
      example: recommendation.example,
    })),
    limitations: section.limitations,
    criteria,
  };
}

function buildEngineAnalysisSections(engine: FinalAnalysisResult): AnalysisSectionDetail[] {
  const evidenceLabels = buildEngineEvidenceLabels(engine);
  const sections: Record<AnalysisSectionKey, EngineAnalysisSection> = {
    hook: engine.hook,
    script: engine.script,
    editing: engine.editing,
    visual: engine.visual,
    textAndCaptions: engine.textAndCaptions,
    audio: engine.audio,
    storytelling: engine.storytelling,
    conversion: engine.conversion,
  };

  return ANALYSIS_SECTION_ORDER.map((key) => mapEngineSection(sections[key], evidenceLabels));
}

function buildUnavailableAnalysisSections(reason: string): AnalysisSectionDetail[] {
  return ANALYSIS_SECTION_ORDER.map((key) => ({
    key,
    label: ANALYSIS_SECTION_LABELS[key],
    status: 'unavailable',
    summary: reason,
    strengths: [],
    problems: [],
    recommendations: [],
    limitations: [reason],
    criteria: ANALYSIS_SECTION_CRITERIA[key].map((criterionId) => ({
      criterionId,
      label: ANALYSIS_CRITERION_LABELS[criterionId],
      status: 'unavailable',
      note: 'Ce critère n’a pas été calculé par le moteur V2 pour cette analyse.',
      timeRange: null,
      confidence: 'faible',
      evidence: [],
    })),
  }));
}

function buildEngineMoments(
  engine: FinalAnalysisResult,
  frameUrls: ReadonlyMap<string, string>,
): AnalysisMoment[] {
  const evidenceLabels = buildEngineEvidenceLabels(engine);
  return engine.timeline.map((segment): AnalysisMoment => {
    const frameId = segment.evidence.find((reference) => frameUrls.has(reference))
      ?? engine.evidence.frames.find((frame) => frame.timestampSec >= segment.startTime && frame.timestampSec <= segment.endTime)?.id
      ?? null;
    const critiqueError = engine.critique.issues.some((issue) => (
      issue.severity === 'error' && issue.targetIds.includes(segment.id)
    ));
    const severity: DiagnosticSeverity = critiqueError
      ? 'critique'
      : segment.problems.length > 0
        ? 'important'
        : 'optimisation';
    const confidence = segment.confidence === 'high' ? 'élevée' : segment.confidence === 'medium' ? 'moyenne' : 'faible';
    const nature = segment.nature === 'observed'
      ? 'Observation directe'
      : segment.nature === 'mixed'
        ? 'Observation et inférence éditoriale'
        : 'Inférence éditoriale';
    return {
      time: formatRange(segment.startTime, segment.endTime),
      title: NARRATIVE_LABELS[segment.narrativeFunction],
      diagnostic: segment.diagnostic,
      correction: segment.recommendedAction || segment.action,
      severity,
      transcript: segment.transcript.status === 'available' ? segment.transcript.text : segment.transcript.reason,
      observation: segment.observation,
      objectiveFit: segment.objectiveFit,
      example: segment.example,
      evidence: segment.evidence.map((reference) => evidenceLabels.get(reference) ?? `Preuve interne ${reference}`),
      confidence,
      nature,
      frameUrl: frameId ? frameUrls.get(frameId) ?? null : null,
    };
  });
}

function buildEngineDiagnostics(engine: FinalAnalysisResult): AnalysisDiagnostic[] {
  const entries: Array<{
    label: AnalysisDiagnostic['label'];
    score: ComputedScore;
    section: EngineAnalysisSection;
  }> = [
    { label: 'Hook', score: engine.scores.hook, section: engine.hook },
    { label: 'Rythme', score: engine.scores.rhythm, section: engine.editing },
    { label: 'Clarté', score: engine.scores.clarity, section: engine.script },
    { label: 'Preuve', score: engine.scores.credibility, section: engine.storytelling },
    { label: 'CTA', score: engine.scores.cta, section: engine.conversion },
  ];
  return entries.map(({ label, score, section }) => ({
    label,
    score: engineScore(score),
    problem: engineSectionText(section, 'problem'),
    correction: engineSectionText(section, 'recommendation'),
  }));
}

type EngineCorrectionStep = Extract<FinalAnalysisResult['correctionPlan'], { status: 'available' }>['steps'][number];
type EngineImprovedVersion = Extract<FinalAnalysisResult['improvedVersion'], { status: 'available' }>;
type EngineGroundedRecommendation = EngineImprovedVersion['editPlan'][number];

function correctionWithRange(step: EngineCorrectionStep): string {
  const prefix = step.timeRange ? `${formatRange(step.timeRange.startSec, step.timeRange.endSec)} — ` : '';
  return `${prefix}${step.action}`;
}

function buildEngineEditingDecisions(engine: FinalAnalysisResult): EditingDecision[] {
  if (engine.correctionPlan.status === 'unavailable') return [];
  const steps = engine.correctionPlan.steps;
  const improvedVersion = engine.improvedVersion;
  const pick = (matcher: RegExp) => steps.find((step) => matcher.test(`${step.action} ${step.rationale}`));
  const values: Array<[EditingDecision['label'], string | null]> = [
    ['À couper', pick(/couper|supprimer|retirer|raccourcir/i) ? correctionWithRange(pick(/couper|supprimer|retirer|raccourcir/i)!) : null],
    ['À avancer', pick(/avancer|plus t[oô]t|d[eè]s la premi[eè]re/i) ? correctionWithRange(pick(/avancer|plus t[oô]t|d[eè]s la premi[eè]re/i)!) : null],
    ['À garder', engine.hook.status === 'available' ? engine.hook.strengths[0] ?? null : null],
    ['À réécrire', pick(/r[eé][eé]cri|remplacer|reformuler/i) ? correctionWithRange(pick(/r[eé][eé]cri|remplacer|reformuler/i)!) : null],
    ['À republier', improvedVersion.status === 'available'
      ? improvedVersion.hooks.find((hook) => hook.id === improvedVersion.bestHook.hookId)?.text ?? null
      : null],
  ];
  return values.flatMap(([label, decision]) => decision ? [{ label, decision }] : []);
}

const REWRITTEN_SCRIPT_PURPOSE_LABELS: Record<EngineImprovedVersion['fullRewrittenScript']['segments'][number]['purpose'], string> = {
  hook: 'Hook',
  context: 'Contexte',
  proof: 'Preuve',
  explanation: 'Explication',
  payoff: 'Payoff',
  cta: 'CTA',
};

function mapGroundedV2Item(item: EngineGroundedRecommendation): GroundedV2Item {
  return {
    id: item.id,
    time: formatRange(item.timeRange.startSec, item.timeRange.endSec),
    observation: item.observation,
    action: item.text,
    why: item.why,
    objectiveFit: item.objectiveFit,
    example: item.example,
    confidence: item.confidence === 'high' ? 'élevée' : item.confidence === 'medium' ? 'moyenne' : 'faible',
  };
}

function mapImprovedVersion(improved: EngineImprovedVersion | null): ImprovedVersionDetail | null {
  if (!improved) return null;
  return {
    fullScript: improved.fullRewrittenScript.fullText,
    scriptSegments: improved.fullRewrittenScript.segments.map((segment) => ({
      id: segment.id,
      purpose: REWRITTEN_SCRIPT_PURPOSE_LABELS[segment.purpose],
      text: segment.text,
    })),
    editPlan: improved.editPlan.map(mapGroundedV2Item),
    shotList: improved.shotList.map(mapGroundedV2Item),
    onScreenText: improved.onScreenText.map(mapGroundedV2Item),
    effectsAndBRoll: improved.effectsAndBRoll.map(mapGroundedV2Item),
    caption: mapGroundedV2Item(improved.caption),
    firstLine: mapGroundedV2Item(improved.firstLine),
    abTests: improved.abTests.map((test) => ({
      id: test.id,
      variable: test.variable,
      versionA: test.versionA,
      versionB: test.versionB,
      successCriterion: test.successCriterion,
    })),
    limitations: improved.limitations,
  };
}

function normalizeEngineAnalysis(
  row: AnalysisDetailRow,
  engine: FinalAnalysisResult,
  frameUrls: ReadonlyMap<string, string>,
): AnalysisDetailData {
  const overall = engineScore(engine.scores.overall);
  const overallCoverage = engine.scores.overall.evidenceCoverage;
  const analysisSections = buildEngineAnalysisSections(engine);
  const availableSectionCount = analysisSections.filter((section) => section.status === 'available').length;
  const totalCriterionCount = analysisSections.reduce((total, section) => total + section.criteria.length, 0);
  const unavailableCriterionCount = analysisSections
    .flatMap((section) => section.criteria)
    .filter((criterion) => criterion.status === 'unavailable').length;
  const unavailableSignalCount = [
    ...Object.values(engine.evidence.audioSignals),
    ...Object.values(engine.evidence.visualSignals),
  ].reduce((count, value) => (
    value
    && typeof value === 'object'
    && 'status' in value
    && value.status === 'unavailable'
      ? count + 1
      : count
  ), 0);
  const isComplete = engine.video.audioTrack.status === 'present'
    && engine.evidence.transcription.status === 'available'
    && unavailableSignalCount === 0
    && availableSectionCount === ANALYSIS_SECTION_ORDER.length
    && unavailableCriterionCount === 0;
  const unavailableData = [
    engine.video.audioTrack.status === 'absent'
      ? 'Piste audio absente, vérifiée par FFmpeg'
      : engine.video.audioTrack.status === 'unavailable'
        ? `Piste audio non vérifiable : ${engine.video.audioTrack.reason}`
        : null,
    engine.evidence.transcription.status === 'unavailable'
      ? `Transcription indisponible : ${engine.evidence.transcription.reason}`
      : null,
    unavailableSignalCount > 0
      ? `${unavailableSignalCount} signal${unavailableSignalCount > 1 ? 'aux' : ''} technique${unavailableSignalCount > 1 ? 's' : ''} indisponible${unavailableSignalCount > 1 ? 's' : ''}`
      : null,
    availableSectionCount < ANALYSIS_SECTION_ORDER.length
      ? `${ANALYSIS_SECTION_ORDER.length - availableSectionCount} rubrique${availableSectionCount === ANALYSIS_SECTION_ORDER.length - 1 ? '' : 's'} indisponible${availableSectionCount === ANALYSIS_SECTION_ORDER.length - 1 ? '' : 's'}`
      : null,
    unavailableCriterionCount > 0
      ? `${unavailableCriterionCount} critère${unavailableCriterionCount > 1 ? 's' : ''} explicitement indisponible${unavailableCriterionCount > 1 ? 's' : ''}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const observedData = [
    `${engine.evidence.frames.length} frames horodatées analysées`,
    `Vidéo couverte de 0 s à ${formatTimestamp(engine.video.durationSec)}`,
    engine.evidence.transcription.status === 'available'
      ? `${engine.evidence.transcription.normalized.segments.length} segments de transcription horodatés`
      : `Transcription indisponible : ${engine.evidence.transcription.reason}`,
    engine.video.audioTrack.status === 'present'
      ? `Piste audio ${engine.video.audioTrack.codec} détectée`
      : engine.video.audioTrack.status === 'absent'
        ? 'Aucune piste audio, absence vérifiée par FFmpeg'
        : `Piste audio non vérifiable : ${engine.video.audioTrack.reason}`,
    `${availableSectionCount}/${ANALYSIS_SECTION_ORDER.length} rubriques disponibles`,
    `${totalCriterionCount - unavailableCriterionCount}/${totalCriterionCount} critères documentés`,
  ];
  const transparency: AnalysisTransparencyState = {
    level: isComplete ? 'real' : 'partial',
    label: isComplete ? 'Analyse V2 complète et fondée sur preuves' : 'Analyse V2 partielle et fondée sur preuves',
    warning: isComplete
      ? 'Le score est une grille éditoriale déterministe fondée sur les preuves listées, pas une prédiction de vues ni une courbe de rétention TikTok.'
      : `Analyse partielle : ${unavailableData.join(' · ')}. Aucun signal manquant n’est remplacé par une donnée inventée.`,
    confidenceScore: Math.round(overallCoverage * 100),
    canShowRealBenchmark: false,
    includeInRealAggregates: false,
    observedData,
    aiHypotheses: ['Les diagnostics éditoriaux sont distingués des mesures FFmpeg, frames et timestamps.'],
    simulations: [],
    previews: [],
  };
  const strategic = engine.strategicSummary.status === 'available' ? engine.strategicSummary : null;
  const priorities = engine.priorities.status === 'available'
    ? [...engine.priorities.critical, ...engine.priorities.important, ...engine.priorities.optimizations]
    : [];
  const improved = engine.improvedVersion.status === 'available' ? engine.improvedVersion : null;
  const correctionSteps = engine.correctionPlan.status === 'available' ? engine.correctionPlan.steps : [];
  const hooks: HookAlternative[] = improved
    ? improved.hooks.map((hook) => ({ hook: hook.text, why: hook.why }))
    : [];
  const thumbnailFrame = engine.evidence.frames[0];
  const verdict = strategic?.diagnosis ?? priorities[0]?.text ?? 'Diagnostic non disponible.';

  return {
    id: row.id,
    videoUrl: cleanText(row.video_url),
    createdAt: formatDate(row.created_at),
    title: engine.video.fileName,
    thumbnailUrl: thumbnailFrame ? frameUrls.get(thumbnailFrame.id) ?? null : null,
    duration: formatDuration(engine.video.durationSec),
    score: overall,
    scoreLevel: scoreLevel(overall),
    scoreExplanation: transparency.warning ?? scoreExplanation(overall),
    transparency,
    verdict,
    summary: strategic ? `${strategic.firstDecision} ${strategic.whyNow}` : engine.hook.status === 'available' ? engine.hook.summary : verdict,
    objective: engine.creatorContext.objective === 'other'
      ? engine.creatorContext.objectiveDetails ?? ENGINE_OBJECTIVE_LABELS.other
      : ENGINE_OBJECTIVE_LABELS[engine.creatorContext.objective],
    niche: engine.creatorContext.niche,
    sourceLabel: 'Fichier vidéo entier',
    formatLabel: engine.creatorContext.format === 'other'
      ? engine.creatorContext.formatDetails ?? ENGINE_FORMAT_LABELS.other
      : ENGINE_FORMAT_LABELS[engine.creatorContext.format],
    keyMoments: buildEngineMoments(engine, frameUrls),
    diagnostics: buildEngineDiagnostics(engine),
    editingDecisions: buildEngineEditingDecisions(engine),
    recommendedV2: correctionSteps.map((step) => ({
      title: `Étape ${step.order}`,
      detail: `${step.action} ${step.rationale}`,
      timing: step.timeRange ? formatRange(step.timeRange.startSec, step.timeRange.endSec) : 'Toute la vidéo',
    })),
    hooks,
    cta: improved ? {
      main: improved.cta.text,
      why: improved.cta.why,
      directVariant: improved.abTests.find((test) => test.variable === 'cta')?.versionA ?? '—',
      curiosityVariant: improved.abTests.find((test) => test.variable === 'cta')?.versionB ?? '—',
    } : { main: '—', why: 'CTA non disponible.', directVariant: '—', curiosityVariant: '—' },
    analysisSections,
    improvedVersion: mapImprovedVersion(improved),
    repostPlan: correctionSteps.map((step) => correctionWithRange(step)),
    prepareHref: '#v2-recommandee',
    hooksHref: hooks[0]
      ? `/dashboard/hooks?objective=repost&analysisId=${encodeURIComponent(row.id)}&trendHook=${encodeURIComponent(hooks[0].hook)}&trendTitle=${encodeURIComponent(verdict)}`
      : `/dashboard/hooks?objective=repost&analysisId=${encodeURIComponent(row.id)}`,
    rawResult: row.result,
  };
}

function normalizeAnalysis(
  row: AnalysisDetailRow,
  engine: FinalAnalysisResult | null,
  frameUrls: ReadonlyMap<string, string>,
): AnalysisDetailData {
  if (engine) return normalizeEngineAnalysis(row, engine, frameUrls);
  const result = row.result;
  const transparency = classifyAnalysisTransparency(result);
  const score = clampScore(result?.viralityScore);
  const transparentScoreExplanation = transparency.warning ?? scoreExplanation(score);
  const title = getVideoTitle(result, row);
  const verdict = firstText(
    result?.coachAnalysis?.verdict,
    result?.analyzerMeta?.verdictShort,
    result?.finalVerdict,
    'Diagnostic non disponible.',
  ) ?? 'Diagnostic non disponible.';

  const hooks = buildHooks(result);
  const primaryHook = hooks[0]?.hook;

  return {
    id: row.id,
    videoUrl: cleanText(row.video_url),
    createdAt: formatDate(row.created_at),
    title,
    thumbnailUrl: null,
    duration: formatDuration(result?.detectedVideoMeta?.durationSec),
    score,
    scoreLevel: scoreLevel(score),
    scoreExplanation: transparentScoreExplanation,
    transparency,
    verdict,
    summary: firstText(
      result?.comparativeInsight,
      result?.coachAnalysis?.coachSummary,
      result?.hook?.analysis,
      transparentScoreExplanation,
    ) ?? transparentScoreExplanation,
    objective: firstText(result?.analyzerMeta?.objectiveLabel, result?.analyzerMeta?.objective) ?? 'Non renseigné',
    niche: firstText(result?.analyzerMeta?.nicheLabel, result?.analyzerMeta?.niche) ?? 'Non renseignée',
    sourceLabel: getSourceLabel(result),
    formatLabel: firstText(
      result?.coachAnalysis?.patternLabel,
      result?.coachAnalysis?.detectedVideoFormat?.primary,
    ) ?? 'Non détecté',
    keyMoments: buildKeyMoments(result),
    diagnostics: buildDiagnostics(result),
    editingDecisions: buildEditingDecisions(result),
    recommendedV2: buildRecommendedV2(result),
    hooks,
    cta: buildCta(result),
    analysisSections: buildUnavailableAnalysisSections(
      'La matrice des 78 critères est disponible uniquement pour les analyses produites par le moteur V2.',
    ),
    improvedVersion: null,
    repostPlan: buildRepostPlan(result),
    prepareHref: `#v2-recommandee`,
    hooksHref: primaryHook
      ? `/dashboard/hooks?objective=repost&analysisId=${encodeURIComponent(row.id)}&trendHook=${encodeURIComponent(primaryHook)}&trendTitle=${encodeURIComponent(verdict)}`
      : `/dashboard/hooks?objective=repost&analysisId=${encodeURIComponent(row.id)}`,
    rawResult: result,
  };
}

export async function getAnalysisDetailData(id: string): Promise<AnalysisDetailLoadResult> {
  const session = await getSession();
  if (!session) return { status: 'unauthenticated', data: null };

  const { data, error } = await supabase
    .from('analyses')
    .select('id, user_id, video_url, result, engine_result, created_at')
    .eq('id', id)
    .eq('user_id', session.userId)
    .maybeSingle();

  if (error || !data) return { status: 'not_found', data: null };

  const row = data as unknown as AnalysisDetailRow;
  if (row.user_id !== session.userId) return { status: 'forbidden', data: null };

  const parsedEngine = FinalAnalysisResultSchema.safeParse(row.engine_result);
  const engine = parsedEngine.success ? parsedEngine.data : null;
  const frameUrls = new Map<string, string>();
  if (engine) {
    const { data: job } = await supabase
      .from('analysis_jobs')
      .select('id, user_id')
      .eq('analysis_id', row.id)
      .eq('user_id', session.userId)
      .maybeSingle();
    const jobId = (job as { id?: unknown; user_id?: unknown } | null)?.id;
    const jobUserId = (job as { id?: unknown; user_id?: unknown } | null)?.user_id;
    if (typeof jobId === 'string' && jobUserId === session.userId) {
      try {
        const artifacts = await listJobArtifacts(jobId, 'frame');
        const signed = await createArtifactSignedUrls(artifacts, 15 * 60);
        for (const [artifactId, signedUrl] of signed) frameUrls.set(artifactId, signedUrl);
      } catch (artifactError) {
        console.warn('[analysis-detail] evidence_preview_unavailable', {
          analysisId: row.id,
          reason: artifactError instanceof Error ? artifactError.message : 'unknown',
        });
      }
    }
  }

  return {
    status: 'ok',
    data: normalizeAnalysis(row, engine, frameUrls),
  };
}
