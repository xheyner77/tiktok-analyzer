import 'server-only';

import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
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
  created_at: string;
}

export type AnalysisDetailStatus = 'ok' | 'unauthenticated' | 'not_found' | 'forbidden';

export interface AnalysisMoment {
  time: string;
  title: string;
  diagnostic: string;
  correction: string;
  severity: DiagnosticSeverity;
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
  keyMoments: AnalysisMoment[];
  diagnostics: AnalysisDiagnostic[];
  editingDecisions: EditingDecision[];
  recommendedV2: RecommendedV2Step[];
  hooks: HookAlternative[];
  cta: CtaRecommendation;
  repostPlan: string[];
  prepareHref: string;
  hooksHref: string;
  rawResult: DetailResult | null;
}

export interface AnalysisDetailLoadResult {
  status: AnalysisDetailStatus;
  data: AnalysisDetailData | null;
}

const FALLBACK_HOOKS = [
  'Ton idée n’est pas mauvaise. C’est l’ordre qui tue la rétention.',
  'La preuve arrive trop tard, et c’est là que tu perds les viewers.',
  'Avant de republier, coupe ces 3 secondes.',
  'Si ta vidéo bloque à 300 vues, regarde ton payoff.',
  'Le hook annonce le sujet, mais pas l’enjeu.',
  'Avant de republier, coupe cette partie de ta vidéo.',
];

const FALLBACK_REPOST_PLAN = [
  'Couper l’intro qui pose le contexte sans créer d’enjeu.',
  'Avancer la preuve avant l’explication.',
  'Réécrire le hook en 6 à 8 mots maximum.',
  'Ajouter une relance claire autour de 0:06.',
  'Remplacer le CTA final par une question simple.',
  'Republier une V2 plus courte et plus tendue.',
  'Comparer la rétention de la V1 et de la V2.',
];

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
  return 'Analyse IA';
}

function getSubScores(result: DetailResult | null) {
  const subScores = result?.coachAnalysis?.subScores;
  const hook = clampScore(subScores?.hook ?? result?.hook?.score);
  const retention = clampScore(subScores?.retention ?? result?.retention?.score);
  const rhythm = clampScore(result?.editing?.score);
  const clarity = clampScore(subScores?.clarity);
  const proof = clampScore(subScores?.tension ?? subScores?.rewatchPotential);
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
      time: cleanText(item.time) ?? '0:00',
      title: cleanText(item.label) ?? 'Moment clé',
      diagnostic: cleanText(item.insight) ?? cleanText(relatedProblem?.explanation) ?? 'Le viewer comprend le thème, mais pas encore pourquoi rester.',
      correction: cleanText(relatedProblem?.action) ?? correctionForMoment(item.type),
      severity: item.severity ?? relatedProblem?.severity ?? 'important',
    };
  });

  if (moments.length > 0) return moments.slice(0, 5);

  const problemMoments = problems.slice(0, 5).map((problem): AnalysisMoment => ({
    time: cleanText(problem.timecode) ?? '0:00',
    title: cleanText(problem.title) ?? 'Point de friction',
    diagnostic: cleanText(problem.explanation) ?? 'La vidéo perd de la tension avant le moment important.',
    correction: cleanText(problem.action) ?? 'Transforme ce passage en preuve ou coupe-le.',
    severity: problem.severity ?? 'important',
  }));

  if (problemMoments.length > 0) return problemMoments;

  return [
    {
      time: '0:00',
      title: 'Hook trop explicatif',
      diagnostic: 'Tu présentes le contexte avant de donner une raison de rester.',
      correction: 'Ouvre avec le résultat ou la tension principale.',
      severity: 'critique',
    },
    {
      time: '0:04',
      title: 'Payoff trop tardif',
      diagnostic: 'Le viewer comprend le sujet, mais pas encore pourquoi regarder.',
      correction: 'Avance la preuve avant l’explication.',
      severity: 'critique',
    },
    {
      time: '0:07',
      title: 'Séquence plate',
      diagnostic: 'La vidéo répète l’idée au lieu de l’avancer.',
      correction: 'Coupe ou transforme ce passage en preuve.',
      severity: 'important',
    },
    {
      time: '0:11',
      title: 'CTA faible',
      diagnostic: 'Le CTA demande une action sans créer de curiosité.',
      correction: 'Formule une question ou une promesse claire.',
      severity: 'important',
    },
  ];
}

function correctionForMoment(type: string): string {
  if (type === 'hook') return 'Ouvre avec la tension principale, pas avec le contexte.';
  if (type === 'drop') return 'Avance la preuve avant la perte d’attention.';
  if (type === 'cta') return 'Pose une question simple ou demande un mot-clé.';
  if (type === 'rewatch') return 'Place le payoff plus tôt et garde une boucle ouverte.';
  return 'Transforme ce moment en décision de montage claire.';
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
      problem: cleanText(hookProblem?.explanation) ?? firstText(result?.hook?.weaknesses?.[0], result?.hook?.analysis) ?? 'Le hook annonce le sujet, mais pas l’enjeu.',
      correction: cleanText(hookProblem?.action) ?? 'Ouvre avec la tension principale.',
    },
    {
      label: 'Rythme',
      score: scores.rhythm,
      problem: cleanText(rhythmProblem?.explanation) ?? firstText(result?.editing?.weaknesses?.[0], result?.editing?.analysis) ?? 'La vidéo ralentit avant le moment important.',
      correction: cleanText(rhythmProblem?.action) ?? 'Coupe l’intro et ajoute une relance visuelle.',
    },
    {
      label: 'Clarté',
      score: scores.clarity,
      problem: cleanText(clarityProblem?.explanation) ?? 'Le viewer comprend le thème, mais pas pourquoi rester.',
      correction: cleanText(clarityProblem?.action) ?? 'Annonce le bénéfice concret avant le contexte.',
    },
    {
      label: 'Preuve',
      score: scores.proof,
      problem: cleanText(proofProblem?.explanation) ?? 'La preuve arrive après la perte d’attention.',
      correction: cleanText(proofProblem?.action) ?? 'Montre l’élément qui prouve ton point avant d’expliquer.',
    },
    {
      label: 'CTA',
      score: scores.cta,
      problem: cleanText(ctaProblem?.explanation) ?? 'Ton CTA demande une action sans créer de raison.',
      correction: cleanText(ctaProblem?.action) ?? 'Formule une question claire liée à la curiosité créée.',
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

  return [
    {
      label: 'À couper',
      decision: cleanText(structuredCut?.recommendation)
        ?? cleanText(cuts?.reason)
        ?? 'Les secondes qui posent le contexte sans créer d’enjeu.',
    },
    {
      label: 'À avancer',
      decision: cleanText(structuredAdvance?.recommendation)
        ?? cleanText(retentionFix?.fix)
        ?? 'La preuve ou le bénéfice doit arriver avant l’explication.',
    },
    {
      label: 'À garder',
      decision: cleanText(structuredKeep?.recommendation)
        ?? firstText(result?.hook?.strengths?.[0], result?.editing?.strengths?.[0])
        ?? 'Le passage où tu montres le résultat concret.',
    },
    {
      label: 'À réécrire',
      decision: cleanText(hookProblem?.action)
        ?? cleanText(ctaProblem?.action)
        ?? 'Le hook et le CTA doivent donner une vraie raison d’agir.',
    },
    {
      label: 'À republier',
      decision: cleanText(result?.repostVersion?.shortVersion)
        ?? cleanText(result?.coachAnalysis?.repostEngine.bestOpportunity?.action)
        ?? 'Une version plus courte, ouverte sur le résultat, avec une relance à mi-vidéo.',
    },
  ];
}

function structuredStepToV2(step: ReconstructionSequence): RecommendedV2Step {
  return {
    title: cleanText(step.title) ?? titleForMove(step.move, step.type),
    detail: cleanText(step.recommendation) ?? cleanText(step.retentionGoal) ?? 'Rends cette étape plus directe et plus tendue.',
    timing: `${step.start} → ${step.end}`,
  };
}

function legacyStepToV2(step: NonNullable<AnalysisResult['reconstructionIA']>['optimizedStructure'][number]): RecommendedV2Step {
  return {
    title: titleForMove(step.move, step.type),
    detail: cleanText(step.recommendation) ?? cleanText(step.goal) ?? 'Rends cette étape plus directe et plus tendue.',
    timing: `${step.start} → ${step.end}`,
  };
}

function repostStepToV2(step: string, index: number): RecommendedV2Step {
  const [maybeTiming, ...rest] = step.split(':');
  return {
    title: defaultV2Steps[index]?.title ?? `Étape ${index + 1}`,
    detail: cleanText(rest.join(':')) ?? cleanText(step) ?? defaultV2Steps[index]?.detail ?? 'Raccourcis ce passage et garde la tension.',
    timing: rest.length > 0 ? maybeTiming.trim() : defaultV2Steps[index]?.timing ?? `${index + 1}`,
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

const defaultV2Steps: RecommendedV2Step[] = [
  {
    title: 'Ouvre avec le résultat',
    detail: 'Commence par le bénéfice ou le problème fort, pas par le contexte.',
    timing: '0:00',
  },
  {
    title: 'Donne la preuve rapidement',
    detail: 'Montre l’élément qui prouve ton point avant d’expliquer.',
    timing: '0:02',
  },
  {
    title: 'Coupe l’intro',
    detail: 'Supprime les secondes où tu installes le sujet sans tension.',
    timing: '0:03',
  },
  {
    title: 'Ajoute une relance',
    detail: 'À mi-vidéo, ajoute une phrase qui relance la curiosité.',
    timing: '0:06',
  },
  {
    title: 'Termine avec un CTA clair',
    detail: 'Demande une action liée à la curiosité créée par la vidéo.',
    timing: 'fin',
  },
];

function buildRecommendedV2(result: DetailResult | null): RecommendedV2Step[] {
  const structured = result?.structuredReconstructionIA as ReconstructionPlan | undefined;
  const structuredSteps = structured?.optimizedStructure?.map(structuredStepToV2) ?? [];
  const legacySteps = result?.reconstructionIA?.optimizedStructure?.map(legacyStepToV2) ?? [];
  const repostSteps = result?.repostVersion?.structure?.map(repostStepToV2) ?? [];
  const steps = [...structuredSteps, ...legacySteps, ...repostSteps];

  if (steps.length >= 5) return steps.slice(0, 5);

  const merged = [...steps];
  for (const fallback of defaultV2Steps) {
    if (merged.length >= 5) break;
    if (!merged.some((step) => step.title === fallback.title)) merged.push(fallback);
  }
  return merged.slice(0, 5);
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
    ...FALLBACK_HOOKS,
  ]).slice(0, 5);

  return hooks.map((hook, index) => ({
    hook,
    why: hook === result?.repostVersion?.hook
      ? 'C’est le hook le plus proche de la V2 recommandée.'
      : index === 0
        ? 'Ce hook met la tension avant le contexte.'
        : 'Il donne une raison de rester avant d’expliquer le sujet.',
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
  ) ?? 'Commente “V2” si tu veux que je te montre la version corrigée.';

  return {
    main,
    why: firstText(
      structuredCtas[0]?.why,
      legacyCtas[0]?.why,
      'Ce CTA fonctionne parce qu’il transforme la curiosité en action simple.',
    ) ?? 'Ce CTA fonctionne parce qu’il transforme la curiosité en action simple.',
    directVariant: firstText(result?.coachAnalysis?.optimizedCtas?.[1], structuredCtas[1]?.cta) ?? 'Commente “V2” et je te donne la version courte.',
    curiosityVariant: firstText(result?.coachAnalysis?.optimizedCtas?.[2], structuredCtas[2]?.cta) ?? 'Tu avais repéré ce détail avant la fin ?',
  };
}

function buildRepostPlan(result: DetailResult | null): string[] {
  const actionPlan = cleanTexts(result?.actionPlan);
  const problemActions = cleanTexts(result?.coachAnalysis?.detectedProblems?.map((item) => item.action));
  const improvements = cleanTexts(result?.improvements?.map((item) => item.tip));
  return uniqueStrings([...actionPlan, ...problemActions, ...improvements, ...FALLBACK_REPOST_PLAN]).slice(0, 7);
}

function normalizeAnalysis(row: AnalysisDetailRow): AnalysisDetailData {
  const result = row.result;
  const transparency = classifyAnalysisTransparency(result);
  const score = clampScore(result?.viralityScore);
  const transparentScoreExplanation = transparency.warning ?? scoreExplanation(score);
  const title = getVideoTitle(result, row);
  const verdict = firstText(
    result?.coachAnalysis?.verdict,
    result?.analyzerMeta?.verdictShort,
    result?.finalVerdict,
    'À republier avec une structure plus directe.',
  ) ?? 'À republier avec une structure plus directe.';

  const hooks = buildHooks(result);
  const primaryHook = hooks[0]?.hook ?? FALLBACK_HOOKS[0];

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
    objective: firstText(result?.analyzerMeta?.objectiveLabel, result?.analyzerMeta?.objective, 'Repost') ?? 'Repost',
    niche: firstText(result?.analyzerMeta?.nicheLabel, result?.coachAnalysis?.patternLabel, result?.detectedVideoMeta?.authorUsername, 'TikTok') ?? 'TikTok',
    sourceLabel: getSourceLabel(result),
    keyMoments: buildKeyMoments(result),
    diagnostics: buildDiagnostics(result),
    editingDecisions: buildEditingDecisions(result),
    recommendedV2: buildRecommendedV2(result),
    hooks,
    cta: buildCta(result),
    repostPlan: buildRepostPlan(result),
    prepareHref: `#v2-recommandee`,
    hooksHref: `/dashboard/hooks?objective=repost&analysisId=${encodeURIComponent(row.id)}&trendHook=${encodeURIComponent(primaryHook)}&trendTitle=${encodeURIComponent(verdict)}`,
    rawResult: result,
  };
}

export async function getAnalysisDetailData(id: string): Promise<AnalysisDetailLoadResult> {
  const session = await getSession();
  if (!session) return { status: 'unauthenticated', data: null };

  const { data, error } = await supabase
    .from('analyses')
    .select('id, user_id, video_url, result, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return { status: 'not_found', data: null };

  const row = data as unknown as AnalysisDetailRow;
  if (row.user_id !== session.userId) return { status: 'forbidden', data: null };

  return {
    status: 'ok',
    data: normalizeAnalysis(row),
  };
}
