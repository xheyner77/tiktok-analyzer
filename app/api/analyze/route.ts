import { NextRequest, NextResponse } from 'next/server';
import { AnalysisResult, Rating, Improvement, AnalysisSection } from '@/lib/types';
import { getSession } from '@/lib/session';
import {
  getUserById,
  incrementReconstructionsCount,
  checkAndResetMonthly,
  canGenerateReconstruction,
  reserveAnalysisQuota,
  refundAnalysisQuota,
  PLAN_LIMITS,
  RECONSTRUCTION_LIMITS,
  getEffectivePlan,
  type UserProfile,
} from '@/lib/auth';
import { getRecentAnalysesForMemory, saveAnalysis } from '@/lib/analyses';
import { enrichAnalysisResult, type AnalysisEngineContext } from '@/lib/analysis-engine';
import { analyzeWithOpenAI, analyzeWithOpenAIVision } from '@/lib/openai';
import { normalizeTikTokUrl, isTikTokVideoUrl } from '@/lib/tiktok-url';
import { VISION_MAX_FRAMES } from '@/lib/vision-config';
import { fetchTikTokPublicStatsV2 } from '@/lib/tiktok';
import { supabase } from '@/lib/supabase';
import { buildVideoIntelligenceResult, extractOnScreenTextFromFrames } from '@/lib/video-intelligence';
import { buildAnalysisContext, estimateAnalysisCost, regenerateWeakSections, scoreAnalysisQuality, validateAnalysisOutput } from '@/lib/analysis-quality';
import { OPENAI_CHAT_MODEL } from '@/lib/openai-models';
import { listTikTokAccountsForUser } from '@/lib/tiktok-accounts';
import type { VideoIntelligenceResult } from '@/lib/types';
import { buildVideoAnalysisSnapshot, getCreatorMemoryForAnalysis, persistAnalysisSnapshotAndMemory } from '@/lib/creator-memory-store';
import { getCreatorMemoryLimit } from '@/lib/plan-limits';
import { buildReconstructionIA as buildReconstructionIAOutput } from '@/lib/ai-reconstruction-engine';
import { buildStructuredReconstruction } from '@/lib/reconstruction/engine';

/** Vision + reprises 429 : plusieurs appels OpenAI (plafond plan Vercel). */
export const maxDuration = 60;

interface ObservedMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

function sanitizeShortString(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/[<>]/g, '').trim();
  return clean ? clean.slice(0, max) : undefined;
}

function getAudienceDisplay(body: Record<string, unknown>): string {
  return sanitizeShortString(body.nicheLabel, 80) ?? 'ton audience';
}

type ReconstructionPlan = 'free' | 'creator' | 'pro' | 'scale';

function getMonthlyResetAt(user?: { stripe_subscription_id?: string | null; subscription_current_period_end?: string | null; last_reset_at?: string | null }): string {
  if (user?.stripe_subscription_id && user.subscription_current_period_end) {
    return new Date(user.subscription_current_period_end).toISOString();
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)).toISOString();
}

function getReconstructionQuota(
  plan: ReconstructionPlan,
  used: number,
  user?: { stripe_subscription_id?: string | null; subscription_current_period_end?: string | null; last_reset_at?: string | null }
) {
  const limit = RECONSTRUCTION_LIMITS[plan] ?? 0;
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - used) : Number.POSITIVE_INFINITY;
  return {
    used,
    limit,
    remaining,
    resetAt: getMonthlyResetAt(user),
  };
}

function withReconstructionAccess(
  result: AnalysisResult,
  status: NonNullable<AnalysisResult['reconstructionAccess']>['status'],
  plan: ReconstructionPlan,
  used: number,
  user?: { stripe_subscription_id?: string | null; subscription_current_period_end?: string | null; last_reset_at?: string | null },
  message?: string
) {
  result.reconstructionAccess = {
    status,
    plan,
    quota: getReconstructionQuota(plan, used, user),
    message,
  };
  return result;
}

function enrichScaleReconstruction(reconstruction: NonNullable<AnalysisResult['reconstructionIA']>): NonNullable<AnalysisResult['reconstructionIA']> {
  const base = reconstruction.optimizedStructure;
  const now = reconstruction.createdAt ?? new Date().toISOString();
  return {
    ...reconstruction,
    createdAt: now,
    planUsed: 'scale',
    scaleVariants: [
      {
        name: 'Structure preuve avant contexte',
        optimizedStructure: base,
        predictedScore: reconstruction.predictedImprovements.retentionPotential,
        bestFor: 'Rendre la valeur evidente avant la premiere explication.',
      },
      {
        name: 'Structure commentaire first',
        optimizedStructure: base.map((step) => step.type === 'CTA' ? { ...step, goal: 'Declencher une reponse simple', move: 'move_cta' } : step),
        predictedScore: Math.min(96, reconstruction.predictedImprovements.engagementPotential + 6),
        bestFor: 'Maximiser commentaires et signaux conversationnels.',
      },
      {
        name: 'Structure watch time courte',
        optimizedStructure: base.map((step) => step.move === 'cut' ? { ...step, expectedImpact: 'Version plus courte pour reduire la friction avant payoff.' } : step),
        predictedScore: Math.min(96, reconstruction.predictedImprovements.watchTimePotential + 4),
        bestFor: 'Tester une version plus dense sans changer la promesse.',
      },
    ],
    structureComparison: [
      { label: 'Version restructurée principale', score: reconstruction.predictedImprovements.retentionPotential, tradeoff: 'Meilleur equilibre retention / clarté.' },
      { label: 'Version hook agressif', score: Math.min(96, reconstruction.predictedImprovements.commentPotential + 3), tradeoff: 'Plus de tension, plus polarisante.' },
      { label: 'Version preuve rapide', score: Math.min(96, reconstruction.predictedImprovements.watchTimePotential + 2), tradeoff: 'Plus claire, moins narrative.' },
    ],
    abHooks: reconstruction.alternativeHooks.slice(0, 3).map((item, index) => ({
      variant: (['A', 'B', 'C'] as const)[index],
      hook: item.hook,
      hypothesis: item.bestFor,
    })),
    multiVersions: [
      { label: 'Version A', focus: 'Retention', recommendedOrder: reconstruction.recommendedOrder },
      { label: 'Version B', focus: 'Commentaires', recommendedOrder: [...reconstruction.recommendedOrder].reverse().slice(0, reconstruction.recommendedOrder.length) },
      { label: 'Version C', focus: 'Preuve rapide', recommendedOrder: reconstruction.recommendedOrder.filter(Boolean) },
    ],
  };
}

function finalizeReconstructionForPlan(
  reconstruction: NonNullable<AnalysisResult['reconstructionIA']>,
  plan: 'pro' | 'scale'
): NonNullable<AnalysisResult['reconstructionIA']> {
  const createdAt = new Date().toISOString();
  const aiReasoning = [
    reconstruction.whyThisStructureWorks.retentionLogic,
    reconstruction.whyThisStructureWorks.viewerPsychology,
    reconstruction.whyThisStructureWorks.changeJustification,
  ].filter(Boolean);
  const base = { ...reconstruction, optimizedCTAs: reconstruction.ctaRecommendations, createdAt, planUsed: plan, aiReasoning };
  return plan === 'scale' ? enrichScaleReconstruction(base) : base;
}

function buildRepostVersionFromBody(body: Record<string, unknown>): AnalysisResult['repostVersion'] {
  const objective = sanitizeShortString(body.objective, 40);
  const audienceLabel = getAudienceDisplay(body);
  const hooks: Record<string, string> = {
    views: 'Le viewer ne voit pas assez vite pourquoi rester.',
    hook: "Tes 3 premières secondes expliquent avant de créer une tension.",
    retention: 'Le milieu de la vidéo manque probablement de rupture claire.',
    comments: 'La question arrive trop tard ou reste trop générale.',
    clicks: "Ton CTA demande une action sans bénéfice assez visible.",
    repost: 'Reconstruis cette vidéo avec la preuve avant le contexte.',
  };

  return {
    hook: hooks[objective ?? ''] ?? "Le problème arrive avant la valeur: corrige ça d'abord.",
    structure: [
      '0-3 sec : problème direct + tension visible',
      '3-8 sec : preuve, exemple ou contraste concret',
      '8-18 sec : explication courte avec 2 cuts minimum',
      '18-25 sec : solution claire adaptée au format détecté',
      '25-30 sec : CTA commentaire simple et spécifique',
    ],
    onScreenText: [
      `Erreur fréquente pour ${audienceLabel}`,
      'Le vrai problème arrive avant la valeur',
      'À couper / reformuler avant remontage',
    ],
    cta: 'Commente "PLAN" si tu veux la version à recopier.',
    angle: `Reconstruire avec un angle plus frontal : partir de l'erreur la plus douloureuse pour ${audienceLabel}, puis montrer la correction en moins de 20 secondes.`,
  };
}

function buildActionPlan(): string[] {
  return [
    "Couper l'intro inutile et démarrer sur la tension principale.",
    'Ajouter une phrase choc dès la première seconde.',
    "Mettre le bénéfice dans le texte à l'écran.",
    'Ajouter une rupture visuelle autour de 5 secondes.',
    'Finir avec une question simple qui appelle un commentaire.',
  ];
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getFirstProblem(result: AnalysisResult, fallback: string) {
  return result.coachAnalysis?.detectedProblems?.[0]?.explanation
    ?? result.hook?.weaknesses?.[0]
    ?? result.retention?.weaknesses?.[0]
    ?? fallback;
}

function getDropRange(result: AnalysisResult) {
  const segment = result.coachAnalysis?.videoSegments?.find((item) => item.dropRisk >= 55);
  if (segment?.range) return segment.range;
  const marker = result.coachAnalysis?.timeline?.find((item) => item.severity === 'critique' || item.label.toLowerCase().includes('drop'));
  return marker?.time ?? '0:03-0:06';
}

function buildSpecificHooks(result: AnalysisResult, audienceLabel: string, formatLabel: string) {
  const weak = result.hook?.weaknesses?.[0] ?? 'le bénéfice arrive trop tard';
  const payoff = result.coachAnalysis?.repostEngine?.bestOpportunity?.title ?? 'le résultat final';
  return [
    {
      hook: `Le problème n’est pas ton idée, c’est l’ordre de tes 3 premières secondes.`,
      why: `Répond directement à la faiblesse détectée : ${weak}.`,
      bestFor: `${formatLabel} où le contexte arrive avant la tension.`,
    },
    {
      hook: `Regarde d’abord le résultat, je t’explique l’erreur après.`,
      why: `Déplace ${payoff.toLowerCase()} avant l’explication pour réduire la perte early viewers.`,
      bestFor: `Audience ${audienceLabel} qui scrolle si la preuve n’est pas visible immédiatement.`,
    },
    {
      hook: `Tu perds des viewers ici parce que la preuve arrive trop tard.`,
      why: `Transforme le diagnostic en tension visible et annonce une correction concrète.`,
      bestFor: 'Vidéos éducatives, business, preuve sociale ou avant/après.',
    },
  ];
}

function buildReconstructionIA(
  result: AnalysisResult,
  body: Record<string, unknown>,
  context?: AnalysisEngineContext
): NonNullable<AnalysisResult['reconstructionIA']> {
  const durationInput = context?.durationSec ?? Number(body.durationSec);
  const duration = Math.max(12, Math.min(60, Math.round(Number.isFinite(durationInput) ? durationInput : 18)));
  const audienceLabel = sanitizeShortString(body.nicheLabel, 80) ?? context?.nicheLabel ?? 'ton audience';
  const formatLabel = result.coachAnalysis?.patternLabel ?? result.coachAnalysis?.detectedVideoFormat?.primary ?? 'format TikTok';
  const hookScore = result.coachAnalysis?.subScores?.hook ?? result.hook.score;
  const ctaScore = result.coachAnalysis?.subScores?.cta ?? Math.max(35, result.viralityScore - 12);
  const dropRange = getDropRange(result);
  const firstProblem = getFirstProblem(result, 'La vidéo explique avant de créer une raison de rester.');
  const rhythmProblem = result.editing?.weaknesses?.[0] ?? 'Le flux visuel manque de nouvelle information au milieu.';
  const retentionProblem = result.retention?.weaknesses?.[0] ?? `La rétention décroche probablement autour de ${dropRange}.`;
  const payoffEnd = Math.min(duration, 5);
  const correctionEnd = Math.min(duration, 12);
  const ctaStart = Math.max(10, Math.min(duration - 4, correctionEnd));

  const optimizedStructure: NonNullable<AnalysisResult['reconstructionIA']>['optimizedStructure'] = [
    {
      start: '0:00',
      end: '0:02',
      type: 'HOOK',
      goal: 'Capturer attention immédiate',
      recommendation: hookScore < 65
        ? 'Remplacer l’introduction actuelle par le résultat ou la tension principale dès la première seconde.'
        : 'Conserver la promesse, mais la formuler en une phrase plus courte et plus visuelle.',
      expectedImpact: 'Réduction de la perte des viewers durant les 3 premières secondes.',
      sourceIssue: firstProblem,
      move: 'rewrite',
    },
    {
      start: '0:02',
      end: formatTime(payoffEnd),
      type: 'PROOF',
      goal: 'Prouver avant d’expliquer',
      recommendation: `Avancer la preuve, le résultat ou le contraste avant ${formatTime(payoffEnd)} au lieu de garder le contexte en ouverture.`,
      expectedImpact: 'Le viewer comprend plus vite pourquoi rester.',
      sourceIssue: retentionProblem,
      move: 'advance',
    },
    {
      start: formatTime(payoffEnd),
      end: formatTime(Math.min(duration, payoffEnd + 3)),
      type: 'ERROR',
      goal: 'Nommer le blocage',
      recommendation: `Supprimer la portion qui répète le contexte et formuler l’erreur en une seule phrase liée à ${audienceLabel}.`,
      expectedImpact: 'Moins de densité verbale, plus de tension narrative.',
      sourceIssue: result.hook?.weaknesses?.[1] ?? firstProblem,
      move: 'cut',
    },
    {
      start: formatTime(Math.min(duration, payoffEnd + 3)),
      end: formatTime(correctionEnd),
      type: 'PATTERN_INTERRUPT',
      goal: 'Relancer l’attention au moment faible',
      recommendation: `Ajouter un cut visuel ou texte écran exactement autour de ${dropRange}, car cette zone ralentit le flux sans nouvelle information forte.`,
      expectedImpact: 'Restaure une raison de regarder après le premier bloc de valeur.',
      sourceIssue: rhythmProblem,
      move: 'insert',
    },
    {
      start: formatTime(ctaStart),
      end: formatTime(duration),
      type: 'CTA',
      goal: 'Transformer l’attention en action',
      recommendation: ctaScore < 65
        ? 'Déplacer le CTA avant la fin molle et poser une question courte liée au bénéfice principal.'
        : 'Garder le CTA, mais le rendre plus spécifique avec un mot-clé commentaire.',
      expectedImpact: 'Simulation IA : meilleure probabilité de commentaire et de rewatch.',
      sourceIssue: result.improvements?.find((item) => item.tip.toLowerCase().includes('cta'))?.tip ?? 'Le CTA actuel arrive trop tard ou reste trop général.',
      move: 'move_cta',
    },
  ];

  const predictedBase = Math.max(50, result.viralityScore);
  return {
    optimizedStructure,
    alternativeHooks: buildSpecificHooks(result, audienceLabel, formatLabel),
    ctaRecommendations: [
      {
        cta: 'Commente “STRUCTURE” si tu veux que je te montre l’ordre exact.',
        why: 'Demande une action simple et relie le commentaire au bénéfice promis.',
      },
      {
        cta: 'Tu veux la version courte ou la version détaillée ?',
        why: 'Question binaire qui baisse l’effort de réponse.',
      },
    ],
    retentionFixes: [
      {
        timeRange: dropRange,
        problem: `${dropRange} ralentit le flux : ${retentionProblem}`,
        fix: 'Insérer une relance visuelle ou déplacer le payoff juste avant cette zone.',
        expectedImpact: 'Simulation IA : meilleure tenue après le premier décrochage.',
      },
      {
        timeRange: '0:00-0:03',
        problem: firstProblem,
        fix: 'Raccourcir l’intro et ouvrir sur une preuve visible.',
        expectedImpact: 'Plus de clarté avant que le viewer décide de scroller.',
      },
    ],
    cutsRecommended: [
      {
        timeRange: '0:00-0:02',
        reason: 'Si cette zone contient une salutation ou du contexte, elle retarde la tension.',
        replacement: 'Démarrer sur résultat, preuve ou contradiction.',
      },
      {
        timeRange: dropRange,
        reason: `Cette zone est liée au drop détecté : ${rhythmProblem}`,
        replacement: 'Cut, zoom léger, texte écran ou objection courte.',
      },
    ],
    patternInterrupts: [
      {
        at: dropRange.split('-')[0] ?? '0:04',
        instruction: 'Ajouter une rupture visuelle synchronisée avec le mot important.',
        reason: 'Empêche le segment explicatif de devenir plat.',
      },
      {
        at: formatTime(ctaStart),
        instruction: 'Afficher le mot-clé du CTA à l’écran avant la dernière phrase.',
        reason: 'Le viewer voit l’action avant de quitter.',
      },
    ],
    recommendedOrder: optimizedStructure.map((step) => `${step.type} ${step.start}-${step.end}`),
    whyThisStructureWorks: {
      retentionLogic: `Le résultat est déplacé au début pour réduire la perte des viewers avant ${dropRange}.`,
      viewerPsychology: `L’audience ${audienceLabel} reçoit d’abord une preuve, puis seulement ensuite l’explication. Cela crée une boucle ouverte plus crédible.`,
      changeJustification: `La reconstruction répond aux signaux détectés : ${firstProblem} ${rhythmProblem}`,
    },
    predictedImprovements: {
      retentionPotential: Math.min(96, predictedBase + 16),
      watchTimePotential: Math.min(96, (result.retention?.score ?? predictedBase) + 18),
      engagementPotential: Math.min(94, ctaScore + 14),
      commentPotential: Math.min(92, ctaScore + 18),
      label: 'Simulation IA, pas une garantie de performance.',
    },
  };
}

function getAnalysisEngineContext(
  body: Record<string, unknown>,
  extra?: { durationSec?: number; caption?: string; transcript?: string; previousAnalyses?: AnalysisResult[]; videoIntelligence?: VideoIntelligenceResult }
): AnalysisEngineContext {
  return {
    objective: sanitizeShortString(body.objective, 40),
    objectiveLabel: sanitizeShortString(body.objectiveLabel, 80),
    niche: sanitizeShortString(body.niche, 40),
    nicheLabel: sanitizeShortString(body.nicheLabel, 80),
    fileName: sanitizeShortString(body.fileName, 120),
    durationSec: extra?.durationSec,
    caption: extra?.caption,
    transcript: extra?.transcript,
    videoIntelligence: extra?.videoIntelligence,
    previousAnalyses: extra?.previousAnalyses,
  };
}

function attachAnalyzerOutputs(
  body: Record<string, unknown>,
  result: AnalysisResult,
  context?: AnalysisEngineContext,
  reconstructionOptions?: {
    plan: ReconstructionPlan;
    canGenerate: boolean;
    used: number;
    user?: { stripe_subscription_id?: string | null; subscription_current_period_end?: string | null; last_reset_at?: string | null };
  }
): AnalysisResult {
  const enriched = enrichAnalysisResult(result, context ?? getAnalysisEngineContext(body));
  enriched.repostVersion = enriched.repostVersion ?? buildRepostVersionFromBody(body);
  const reconPlan = reconstructionOptions?.plan ?? 'free';
  const reconUsed = reconstructionOptions?.used ?? 0;
  if (reconstructionOptions?.canGenerate && (reconPlan === 'pro' || reconPlan === 'scale')) {
    enriched.reconstructionIA = finalizeReconstructionForPlan(
      enriched.reconstructionIA ?? buildReconstructionIAOutput(enriched, body, context ?? getAnalysisEngineContext(body)),
      reconPlan
    );
    enriched.structuredReconstructionIA = buildStructuredReconstruction({
      result: enriched,
      repost: (enriched.repostVersion ?? buildRepostVersionFromBody(body))!,
      body,
    });
    withReconstructionAccess(enriched, 'available', reconPlan, reconUsed, reconstructionOptions.user);
  } else {
    enriched.reconstructionIA = undefined;
    const limit = RECONSTRUCTION_LIMITS[reconPlan] ?? 0;
    const status = limit > 0 && reconUsed >= limit ? 'quota_exceeded' : 'locked';
    const message = status === 'quota_exceeded'
      ? 'Tu as utilisé toutes tes reconstructions IA ce mois-ci.'
      : 'La Reconstruction IA est disponible avec Pro et Scale.';
    withReconstructionAccess(enriched, status, reconPlan, reconUsed, reconstructionOptions?.user, message);
  }
  enriched.actionPlan = enriched.actionPlan?.length ? enriched.actionPlan : buildActionPlan();
  return enriched;
}

function getAnalyzerMetaFromBody(body: Record<string, unknown>, result: AnalysisResult): AnalysisResult['analyzerMeta'] | undefined {
  const objective = sanitizeShortString(body.objective, 40);
  const objectiveLabel = sanitizeShortString(body.objectiveLabel, 80);
  const niche = sanitizeShortString(body.niche, 40);
  const nicheLabel = sanitizeShortString(body.nicheLabel, 80);
  const fileName = sanitizeShortString(body.fileName, 120);
  const fileSizeMb = typeof body.fileSizeMb === 'number' && Number.isFinite(body.fileSizeMb)
    ? Math.max(0, Math.round(body.fileSizeMb * 10) / 10)
    : undefined;
  if (!objective && !objectiveLabel && !niche && !nicheLabel && !fileName) return undefined;

  return {
    objective,
    objectiveLabel,
    niche,
    nicheLabel,
    fileName,
    fileSizeMb,
    status: 'completed',
    verdictShort: result.finalVerdict?.split('.')[0]?.slice(0, 140),
    recommendations: (result.improvements ?? []).slice(0, 4).map((item) => item.tip.slice(0, 220)),
  };
}

function applyAnalysisTransparency(
  result: AnalysisResult,
  options: {
    mode: 'vision' | 'metadata' | 'fallback' | 'demo';
    confidenceScore: number;
    observedData?: string[];
    aiHypotheses?: string[];
    simulations?: string[];
    previews?: string[];
    warning?: string;
  }
) {
  const modeLabels = {
    vision: 'Analyse vision',
    metadata: 'Analyse metadata',
    fallback: 'Analyse degradee',
    demo: 'Preview demo',
  } as const;
  const existingWarnings = result.analyzerMeta?.validationWarnings ?? [];
  const validationWarnings = options.warning
    ? Array.from(new Set([...existingWarnings, options.warning]))
    : existingWarnings;

  result.analyzerMeta = {
    ...result.analyzerMeta,
    analysisMode: options.mode,
    analysisModeLabel: modeLabels[options.mode],
    isFallback: options.mode === 'fallback' || options.mode === 'demo',
    analysisConfidence: {
      score: Math.max(0, Math.min(100, Math.round(options.confidenceScore))),
      level: options.confidenceScore >= 75 ? 'elevee' : options.confidenceScore >= 50 ? 'moyenne' : 'faible',
      reasons: validationWarnings.slice(0, 3),
    },
    signalDisclosure: {
      observedData: options.observedData ?? [],
      aiHypotheses: options.aiHypotheses ?? [],
      simulations: options.simulations ?? [],
      previews: options.previews ?? [],
    },
    validationWarnings,
  };
}

function applyQualityGate(result: AnalysisResult, analysisContext: ReturnType<typeof buildAnalysisContext>) {
  let validated = validateAnalysisOutput(result, analysisContext);
  let report = scoreAnalysisQuality(validated, analysisContext);
  let regeneratedSections: string[] = [];
  let modelUsed = 'none';
  let escalationTriggered = false;
  let estimatedAdditionalCostUsd = 0;

  if (report.needsRegeneration) {
    const regen = regenerateWeakSections(validated, analysisContext, report, {
      enableEscalation: process.env.ENABLE_QUALITY_ESCALATION === 'true',
      escalationModel: process.env.QUALITY_ESCALATION_MODEL,
      baseModel: OPENAI_CHAT_MODEL,
    });
    validated = validateAnalysisOutput(regen.result, analysisContext);
    regeneratedSections = regen.regeneratedSections;
    modelUsed = regen.modelUsed;
    escalationTriggered = regen.escalationTriggered;
    estimatedAdditionalCostUsd = regen.estimatedAdditionalCostUsd;
    report = scoreAnalysisQuality(validated, analysisContext);
  }

  console.info('[analysis-quality] gate', {
    qualityScore: report.qualityScore,
    issues: report.issues.map((issue) => `${issue.section}:${issue.message}`).slice(0, 8),
    regeneratedSections,
    modelUsed,
    escalationTriggered,
    estimatedAdditionalCostUsd,
  });

  validated.analyzerMeta = {
    ...validated.analyzerMeta,
    quality: {
      qualityScore: report.qualityScore,
      issues: report.issues.map((issue) => `${issue.section}: ${issue.message}`).slice(0, 8),
      regeneratedSections,
      modelUsed,
      escalationTriggered,
      estimatedAdditionalCostUsd,
    },
  };
  return validated;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getRating(score: number): Rating {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Moyen';
  return 'Faible';
}

// rating is not stored in the profile — it is computed dynamically in buildMockResult
type MockSection = Omit<AnalysisSection, 'rating'>;

interface MockProfile {
  viralityScore: number;
  hook: MockSection;
  editing: MockSection;
  retention: MockSection;
  improvements: { priority: 'haute' | 'moyenne' | 'basse'; tip: string }[];
  strategy: string;
  viralTips: string[];
}

const profiles: MockProfile[] = [
  // ── Profil A — Haute performance (~83%) ─────────────────────────────────
  {
    viralityScore: 83,
    hook: {
      score: 86,
      analysis:
        "Ton hook montre un signal de structure fort. Le pattern interrupt visuel à 00:01 combiné à la question directe au viewer peut aider à stopper le scroll. Point à tester : tu arrives au vrai sujet à 00:04 — c'est 1,5 seconde de trop pour une ouverture très directe.",
      strengths: [
        "Coupure brutale à 00:01 qui stoppe physiquement le scroll",
        "Question posée directement au viewer dans les 2 premières secondes",
        "Expression de choc ou visuel fort dès la première frame",
      ],
      weaknesses: [
        "Le sujet réel arrive à 00:04 — ramène-le à 00:02 maximum pour éviter le drop-off précoce",
        "Aucun sous-titre dans les 2 premières secondes : -30% de rétention sur audience mobile sans son",
      ],
    },
    editing: {
      score: 81,
      analysis:
        "Rythme solide — tes cuts sont en moyenne à 2,4s, dans la zone optimale TikTok (2-3s). Problème identifié : le plan entre 00:08 et 00:13 est statique sur 5 secondes, c'est exactement là que ta courbe de rétention chute. Découpe-le en 2 plans ou insère un zoom progressif à 110% sur ce segment.",
      strengths: [
        "Rythme de coupe à 2,4s de moyenne — dans la zone de performance optimale",
        "Cuts synchronisés sur les temps forts musicaux",
        "Aucune transition décorative inutile qui alourdit le flux",
      ],
      weaknesses: [
        "Plan statique de 5s entre 00:08-00:13 — c'est ton point de drop-off principal",
        "Volume musique de fond trop élevé : la voix doit dominer à 70% du mix audio",
      ],
    },
    retention: {
      score: 79,
      analysis:
        "Bonne courbe de rétention jusqu'à la mi-vidéo. La structure 'promesse → build-up → révélation' fonctionne. Mais ta fin est trop douce : les viewers regardent jusqu'à ~00:27 puis quittent sans action. Il te manque un twist ou une déclaration choc dans les 3 dernières secondes pour provoquer le commentaire.",
      strengths: [
        "Micro-hook toutes les 6-7s qui reset l'attention — structure correcte",
        "Taux de complétion estimé à 65-70% — hypothèse IA à confirmer avec les données TikTok",
        "Promesse du hook tenue jusqu'à la fin sans trahison du viewer",
      ],
      weaknesses: [
        "Creux de rétention détecté à mi-vidéo — insère une stat choc ou un changement de plan brutal",
        "CTA final trop mou ('n'hésite pas à...') — ça ne déclenche aucune action mesurable",
      ],
    },
    improvements: [
      {
        priority: 'haute',
        tip: "Ajoute des sous-titres animés sur les 3 premières secondes UNIQUEMENT — une part importante de l'audience découvre sans son sur mobile. C'est une zone à améliorer sans retourner la vidéo.",
      },
      {
        priority: 'haute',
        tip: "Découpe le plan statique à 00:08 : ajoute un zoom à 110% + son 'whoosh'. Ce seul changement peut récupérer 10-15 points de taux de complétion.",
      },
      {
        priority: 'moyenne',
        tip: "Remplace ton CTA final par : 'Commente [MOT CLÉ] si t'as vécu ça.' Les commentaires sont un signal d'engagement utile à tester.",
      },
      {
        priority: 'moyenne',
        tip: "Insère un texte overlay rouge type '⚠️ Ce que personne ne dit' en overlay à 00:01 — capture les viewers sans son dès la première seconde.",
      },
      {
        priority: 'basse',
        tip: "Teste une version raccourcie à 18s en coupant après la révélation principale — les vidéos <20s ont un taux de complétion 40% plus élevé selon les benchmarks creators.",
      },
      {
        priority: 'moyenne',
        tip: "Lance une série de 3 à 5 épisodes en partant du sujet de cette vidéo. Les séries augmentent le taux de retour sur ton profil de 60% et signalent à l'algorithme que tu es un créateur à pousser dans la durée.",
      },
      {
        priority: 'moyenne',
        tip: "Engage chaque commentaire dans les 30 premières minutes après publication. Ce signal d'activité est le deuxième levier le plus puissant après le taux de complétion pour déclencher la distribution élargie.",
      },
      {
        priority: 'basse',
        tip: "Crée une version 'derrière les coulisses' de cette vidéo — comment tu l'as construite, quel était ton objectif. Les vidéos making-of sur du contenu performant génèrent en moyenne 40% de l'engagement de la vidéo originale.",
      },
    ],
    strategy: "Ton contenu montre des signaux solides, mais ces hypothèses doivent être confirmées avec tes données TikTok. Pour tester la croissance, publie 4 à 5 fois par semaine si ton rythme de production le permet. Format recommandé : mix 60% vidéos éducatives, 30% behind-the-scenes et 10% trends à adapter à ta niche. Cible les créneaux 7h-9h et 18h-21h en semaine comme tests de publication. Sur les 30 prochains jours, lance une série de 5 épisodes sur ton sujet phare avec un teaser en première vidéo. Engage chaque commentaire dans les 30 premières minutes après publication pour renforcer les signaux d'activité.",
    viralTips: [
      "Signal détecté fréquent : un 'pattern interrupt' visuel dans la première seconde, par exemple cut brutal, zoom ou changement de fond soudain.",
      "Les créateurs qui dépassent 1M de vues systématiquement terminent toujours avec une question ouverte ou une affirmation polémique. Jamais un 'merci d'avoir regardé' — ça tue l'engagement.",
      "Le taux de repartage est 3× plus élevé sur les vidéos qui contiennent une stat contre-intuitive dans les 5 premières secondes. Le cerveau humain partage ce qui le surprend.",
      "Les hooks qui convertissent le plus commencent par la CONCLUSION, pas par l'introduction. Montre le résultat en premier, construis le mystère autour de comment tu y es arrivé.",
    ],
  },

  // ── Profil B — Performance moyenne (~55%) ───────────────────────────────
  {
    viralityScore: 55,
    hook: {
      score: 57,
      analysis:
        "Ton hook explique avant de donner une raison de rester. Tu commences avec une introduction générique — 'Aujourd'hui je vais vous parler de...' — et le viewer peut quitter avant la première preuve. Le sujet est exploitable, mais la porte d'entrée doit être reconstruite.",
      strengths: [
        "Le sujet traité montre un potentiel de rétention estimé dans sa niche",
        "Qualité audio correcte — la voix est claire et audible",
      ],
      weaknesses: [
        "Première phrase générique — supprime entièrement les 2 premières secondes",
        "Aucune image choc, zoom brutal ou coupure franche dans les 3 premières secondes",
        "Ton plat et monocorde sans urgence — parle comme si tu racontais ça à 23h à un ami",
        "Zéro texte overlay : -45% de rétention sur l'audience sans son",
      ],
    },
    editing: {
      score: 53,
      analysis:
        "Ton montage est calqué sur un format YouTube ou LinkedIn, pas TikTok. Tes plans durent en moyenne 5-6 secondes — c'est 2x trop long. Au-delà de 4s sans changement visuel, l'algorithme enregistre un signal de désengagement et réduit ta distribution. Résultat : tu parles à de moins en moins de personnes à chaque seconde.",
      strengths: [
        "Stabilité et cadrage corrects — aucun problème technique bloquant",
        "Son propre sans écho ni bruit parasite",
      ],
      weaknesses: [
        "Plans à 5-6s de moyenne — objectif : 2-3s max, surtout dans les 10 premières secondes",
        "Zéro zoom, zéro effet de vitesse — le visuel est mort entre les coupes",
        "Musique de fond absente : sans ambiance sonore, la vidéo paraît froide et décroche l'audience",
      ],
    },
    retention: {
      score: 50,
      analysis:
        "Tu perds 50% de ton audience avant la mi-vidéo. Cause : après le hook raté, tu déroules ton contenu à plat sans jamais replanter un clou de curiosité. Le viewer sait où tu vas dès les 5 premières secondes — il n'a aucune raison de rester.",
      strengths: [
        "Le contenu a une valeur informative réelle si le viewer reste jusqu'au bout",
        "Durée de 30-45s adaptée — ni trop courte ni trop longue",
      ],
      weaknesses: [
        "Drop-off à 50% estimé avant la mi-vidéo — aucun micro-hook intermédiaire pour retenir",
        "Structure plate : même rythme, même ton, même énergie du début à la fin",
        "Fin abrupte sans CTA ni question posée au viewer — aucune action déclenchée",
      ],
    },
    improvements: [
      {
        priority: 'haute',
        tip: "Supprime tes 2 premières secondes. Commence directement par la stat la plus choquante ou la conclusion — laisse le viewer se demander 'comment il en est arrivé là ?' Exemple : 'J'ai multiplié mon audience par 10 en faisant l'inverse de tout le monde.'",
      },
      {
        priority: 'haute',
        tip: "Coupe chaque plan à 3s max dans les 10 premières secondes. Passe de 2 cuts à 6 cuts minimum — c'est non-négociable pour rester dans la zone de distribution optimale.",
      },
      {
        priority: 'haute',
        tip: "Insère un micro-hook toutes les 7s : une question brutale ('et le pire c'est que...'), une stat choc ('92% des créateurs ratent ça'), ou un changement d'angle inattendu.",
      },
      {
        priority: 'moyenne',
        tip: "Ajoute une musique en tendance à -18dB en fond — teste plusieurs sons adaptés à ta niche au lieu de chercher une promesse de distribution.",
      },
      {
        priority: 'basse',
        tip: "Termine par 'Suite en partie 2 👇' — les séries augmentent le retour sur profil de 60% et forcent l'algorithme à te recommander à la même audience.",
      },
      {
        priority: 'haute',
        tip: "Refais intégralement les 3 premières secondes : supprime toute intro et commence directement par la stat ou l'affirmation la plus choquante. Ce seul changement peut multiplier ton taux de rétention à 3 secondes par 2.",
      },
      {
        priority: 'moyenne',
        tip: "Teste la même vidéo avec 3 hooks différents en republiant à 48h d'intervalle. Le hook qui performe le mieux devient ton template pour les 30 prochaines vidéos.",
      },
      {
        priority: 'basse',
        tip: "Publie uniquement entre 18h et 21h du mardi au jeudi — les créateurs dans ta niche qui respectent ces créneaux ont un reach initial 35% supérieur à ceux qui publient de manière aléatoire.",
      },
    ],
    strategy: "Priorité absolue sur les 30 prochains jours : refondre ton approche des 3 premières secondes. Publie 3 fois par semaine minimum — la régularité construit le momentum algorithmique. Mix idéal : 50% vidéos éducatives courtes (15-25s), 30% réactions à des trends et 20% vidéos backstage. Cible les créneaux 19h-21h du mardi au jeudi pour maximiser la portée initiale. Commence chaque vidéo par ta conclusion ou ton résultat — montre la fin en premier, explique après. Sur les 7 prochains jours, reprends tes 3 meilleures vidéos et refais uniquement les 5 premières secondes avec un hook choc. En 30 jours avec ce format, tu peux atteindre un taux de complétion de 55%+ et sortir de la zone de distribution limitée.",
    viralTips: [
      "Hypothèse IA : dans cette catégorie, 8 à 12 cuts dans les 15 premières secondes peuvent rendre le rythme plus lisible.",
      "Les sons en tendance sont un signal audio à tester, sans garantie de distribution.",
      "Les sous-titres animés augmentent le taux de complétion de 28% en moyenne — 85% de l'audience mobile regarde sans son lors de la première découverte.",
      "Les créateurs qui passent de 0 à 100K abonnés en moins de 6 mois publient quasi exclusivement entre 18h et 21h du mardi au jeudi et répondent à chaque commentaire dans l'heure.",
    ],
  },

  // ── Profil C — Faible performance (~29%) ────────────────────────────────
  {
    viralityScore: 29,
    hook: {
      score: 27,
      analysis:
        "Cette vidéo risque de perdre l'attention très tôt. Il n'y a aucun signal visuel ou auditif fort dans les 3 premières secondes. Ta première frame est statique et vide — c'est une zone à améliorer avant de conclure sur la distribution réelle.",
      strengths: [
        "Le sujet traité peut devenir exploitable s'il est entièrement reconstruit",
      ],
      weaknesses: [
        "Première frame sans élément choc — le pouce ne s'arrête pas, il n'y a aucune friction",
        "Zéro pattern interrupt : pas de son fort, pas de mouvement, pas de texte dans les 3 premières secondes",
        "Première phrase prévisible et générique — à remplacer intégralement par une déclaration choc",
        "Aucun sous-titre, aucun overlay — vidéo silencieuse invisible pour 85% de l'audience",
        "Expression faciale neutre ou absente dès le départ — l'émotion attire l'humain",
      ],
    },
    editing: {
      score: 30,
      analysis:
        "Le montage est la cause directe d'un taux de complétion estimé sous les 20%. Tes plans durent entre 6 et 12 secondes — c'est un format reportage TV, pas TikTok. Au-delà de 4s sans coupe, le cerveau du viewer enregistre 'contenu lent' et le pouce bouge automatiquement. Ce montage est à refaire intégralement.",
      strengths: [
        "L'image est stable — base technique suffisante pour tout reconstruire dessus",
      ],
      weaknesses: [
        "Plans de 6 à 12s — cible zéro plan au-delà de 3s dans les 15 premières secondes",
        "Aucune dynamique visuelle : pas un seul zoom, ralenti, accéléré ou changement de plan impactant",
        "Pas de musique de fond : l'absence d'ambiance sonore peut rendre la vidéo moins dynamique",
        "Éclairage plat ou insuffisant — une lumière plus stable peut améliorer la qualité perçue à contenu égal",
      ],
    },
    retention: {
      score: 24,
      analysis:
        "Taux de complétion estimé inférieur à 20% — tu perds l'audience dans les 3-4 premières secondes. C'est catastrophique : TikTok utilise le taux de complétion comme signal #1 de distribution. En dessous de 30%, la vidéo n'est quasiment pas diffusée hors de tes abonnés existants. Elle est algorithmiquement morte.",
      strengths: [
        "Le contenu, entièrement restructuré, pourrait atteindre 60-70% de complétion",
      ],
      weaknesses: [
        "Taux de complétion estimé <20% — hypothèse IA de risque élevé sur la rétention",
        "Aucun teasing ni promesse dans le hook qui forcerait le viewer à rester",
        "Structure plate sans tension : le viewer devine la fin dès la 3ème seconde",
        "Pas de CTA, pas de question posée, pas de moment de récompense en fin de vidéo",
      ],
    },
    improvements: [
      {
        priority: 'haute',
        tip: "Refais entièrement les 3 premières secondes. Commence par montrer le résultat final ou l'élément le plus choquant en PREMIER. Le viewer doit se demander 'comment il en est arrivé là ?' dès la 1ère seconde — pas à la 10ème.",
      },
      {
        priority: 'haute',
        tip: "Raccourcis à 15-22 secondes maximum. Au-delà, ton taux de complétion ne peut pas atteindre le seuil de distribution (30%+). Chaque seconde en trop est une pénalité algorithmique.",
      },
      {
        priority: 'haute',
        tip: "Remplace ta première phrase par une déclaration choc en 5 mots max. Exemples : 'J'ai perdu 3 ans à faire ça.' / 'Personne ne te dira jamais ça.' / 'J'ai failli tout arrêter.' Zéro intro, zéro bonjour.",
      },
      {
        priority: 'haute',
        tip: "Ajoute une musique adaptée à -15dB + des sous-titres animés sur chaque phrase parlée. C'est une zone à améliorer pour les viewers qui découvrent sans son.",
      },
      {
        priority: 'moyenne',
        tip: "Filme face à une fenêtre ou avec une ring light à 30€. La qualité visuelle perçue peut influencer la confiance et le follow intent.",
      },
      {
        priority: 'haute',
        tip: "Supprime intégralement les 3 premières secondes actuelles et remplace par une seule phrase choc en 5 mots max : 'J'ai failli tout perdre' / 'Personne ne te dit ça' / 'J'ai eu tort pendant 2 ans'. Aucun bonjour, aucune intro.",
      },
      {
        priority: 'haute',
        tip: "Raccourcis cette vidéo à 15-20 secondes maximum en ne gardant que le point le plus percutant. C'est une simulation non mesurée par TikTok pour améliorer le potentiel de rétention.",
      },
      {
        priority: 'moyenne',
        tip: "Ajoute une musique en tendance en fond à -15dB. C'est un signal audio à tester, pas un levier garanti de distribution.",
      },
    ],
    strategy: "Cette vidéo nécessite une refonte forte, mais certains signaux peuvent être retravaillés. Plan d'action sur 30 jours : les 7 premiers jours, regarde 20 vidéos de ta niche et décortique leur structure (hook, rythme, fin). Semaines 2-3 : remonte un format ultra-court (15s max) avec uniquement la partie la plus impactante de tes vidéos existantes. Semaine 4 : lance un nouveau format avec un hook choc dès la première seconde. Publie régulièrement pour obtenir assez de données de test. Cible le créneau 19h-21h en début de semaine comme hypothèse de publication. Objectif de test : améliorer le taux de complétion estimé, sans garantie de distribution.",
    viralTips: [
      "Hypothèse IA : un élément de curiosité non résolu dès le début peut donner au viewer une raison de rester.",
      "Simulation non mesurée par TikTok : 15-22 secondes peut être une durée testable pour renforcer la complétion.",
      "Une ring light peut améliorer la qualité visuelle perçue — c'est un signal de crédibilité instantané que le viewer évalue très vite.",
      "Les créateurs qui explosent utilisent un 'hook en 3 temps' : déclaration choc → élément visuellement fort → question implicite au viewer dans les 3 premières secondes.",
    ],
  },
];

function buildMockResult(url: string, plan: string = 'free'): AnalysisResult {
  const hash = simpleHash(url);
  const profile = profiles[hash % profiles.length];
  const variation = (hash % 11) - 5;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  const result: AnalysisResult = {
    viralityScore: clamp(profile.viralityScore + variation),
    structureScore: clamp(profile.viralityScore + variation),
    hook: {
      ...profile.hook,
      score: clamp(profile.hook.score + variation),
      rating: getRating(clamp(profile.hook.score + variation)),
    },
    editing: {
      ...profile.editing,
      score: clamp(profile.editing.score + variation),
      rating: getRating(clamp(profile.editing.score + variation)),
    },
    retention: {
      ...profile.retention,
      score: clamp(profile.retention.score + variation),
      rating: getRating(clamp(profile.retention.score + variation)),
    },
    improvements: profile.improvements.map((item): Improvement => ({
      priority: item.priority,
      tip: item.tip,
    })),
  };

  if (plan === 'scale') {
    result.strategy = profile.strategy;
    result.viralTips = profile.viralTips;
  }

  return result;
}

function sanitizeMetrics(input: unknown): ObservedMetrics | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const src = input as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const views = num(src.views);
  const likes = num(src.likes);
  const comments = num(src.comments);
  const shares = num(src.shares);
  if (!views && !likes && !comments && !shares) return undefined;
  return { views, likes, comments, shares };
}

function computeObservedPerformance(metrics?: ObservedMetrics): { score: number; label: string; estimated: boolean } | null {
  if (!metrics || !metrics.views || metrics.views <= 0) return null;
  const views = metrics.views;
  const likes = metrics.likes ?? 0;
  const comments = metrics.comments ?? 0;
  const shares = metrics.shares ?? 0;
  const estimated = likes === 0 && comments === 0 && shares === 0;

  const weightedEngagement = likes + comments * 2 + shares * 3;
  const er = (weightedEngagement / Math.max(views, 1)) * 100;

  let score = 0;
  if (views >= 1_000_000) score += 45;
  else if (views >= 500_000) score += 38;
  else if (views >= 100_000) score += 30;
  else if (views >= 30_000) score += 22;
  else if (views >= 10_000) score += 15;
  else score += 8;

  if (er >= 15) score += 45;
  else if (er >= 10) score += 36;
  else if (er >= 6) score += 28;
  else if (er >= 3) score += 18;
  else score += 10;

  if (comments >= 1000) score += 6;
  if (shares >= 1000) score += 6;

  const capped = Math.max(1, Math.min(100, Math.round(score)));

  // Forte portée absolue = signal de distribution réel, même si le taux d’engagement % est modeste (gros comptes, scroll passif).
  let reachFloor = 1;
  if (views >= 1_000_000) reachFloor = 62;
  else if (views >= 500_000) reachFloor = 58;
  else if (views >= 200_000) reachFloor = 54;
  else if (views >= 100_000) reachFloor = 50;
  else if (views >= 50_000) reachFloor = 44;
  else if (views >= 10_000) reachFloor = 36;

  const merged = Math.max(capped, reachFloor);
  const label =
    merged >= 80 ? (estimated ? 'Très forte performance estimée (basée sur les vues)' : 'Très forte performance observée') :
    merged >= 60 ? (estimated ? 'Bonne traction estimée (basée sur les vues)' : 'Bonne traction réelle') :
    merged >= 40 ? (estimated ? 'Performance estimée correcte' : 'Performance correcte') :
    (estimated ? 'Performance estimée encore limitée' : 'Performance encore limitée');
  return { score: merged, label, estimated };
}

function clipText(text: string, max: number): string {
  const t = text.trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Synthèse comparative ancrée dans les faiblesses déjà présentes (mock / secours si l’IA omet des champs). */
function deriveContextualComparative(
  result: AnalysisResult,
  metrics?: ObservedMetrics,
  caption?: string,
  author?: string
): { comparativeInsight: string; comparativePriority: string } {
  const structure = result.structureScore ?? result.viralityScore ?? 0;
  const hs = result.hook?.score ?? 0;
  const es = result.editing?.score ?? 0;
  const rs = result.retention?.score ?? 0;
  const hookW = clipText(result.hook?.weaknesses?.[0] ?? '', 220);
  const editW = clipText(result.editing?.weaknesses?.[0] ?? '', 220);
  const retW = clipText(result.retention?.weaknesses?.[0] ?? '', 220);
  const vw = metrics?.views;
  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  let comparativeInsight: string;
  if (vw && vw > 0) {
    comparativeInsight =
      `Les stats publiques indiquent environ ${fmt(vw)} vues : la portée existe. ` +
      `Avec un score structure à ${structure}/100, l’écart se lit surtout sur le trio hook (${hs}) / montage (${es}) / rétention (${rs}). `;
    if (author) comparativeInsight += `Compte : @${author}. `;
    if (caption?.trim()) {
      comparativeInsight += `Légende détectée : « ${clipText(caption.trim(), 140)} » — aligne l’ouverture visuelle sur cette promesse dès la 1re seconde.`;
    } else {
      comparativeInsight += hookW
        ? `Point faible principal (hook) : ${hookW}`
        : `Priorise le hook : c’est le levier qui explique le plus l’écart avec la portée.`;
    }
  } else {
    comparativeInsight =
      `Score structure ${structure}/100 (hook ${hs}, montage ${es}, rétention ${rs}). ` +
      (hookW
        ? `Le diagnostic le plus coûteux côté hook : ${hookW}`
        : `Renforce la clarté du hook dans les premières secondes pour éviter la sortie précoce.`);
  }

  const comparativePriority =
    (editW && retW
      ? `En priorité : montage — ${editW} Ensuite : rétention / fin — ${retW}`
      : `Enchaîne : resserre le hook (score ${hs}), puis le rythme de montage (${es}) et la fin (${rs}).`).trim();

  return { comparativeInsight: comparativeInsight.trim(), comparativePriority };
}

function buildFinalVerdict(structure: number, observed: { score: number; label: string } | null): string {
  if (!observed) {
    if (structure >= 75) return 'Structure solide, fort potentiel de diffusion.';
    if (structure >= 55) return 'Structure correcte, optimisations possibles pour accélérer la traction.';
    return 'Structure fragile, une refonte du hook et du rythme est recommandée.';
  }

  if (structure < 45 && observed.score >= 75) {
    return 'Structure moyenne, mais forte performance réelle: la vidéo a surperformé malgré plusieurs faiblesses.';
  }
  if (structure < 60 && observed.score >= 60) {
    return 'Bonne traction réelle, encore optimisable côté structure pour stabiliser les prochaines performances.';
  }
  if (structure >= 70 && observed.score >= 70) {
    return 'Structure solide et performance observée forte: combo crédible et durable.';
  }
  if (structure >= 70 && observed.score < 55) {
    return 'Structure de qualité, mais traction réelle en dessous du potentiel: retravailler packaging/timing.';
  }
  if (structure < 50 && observed.score < 50) {
    return 'Structure faible et performance observée limitée: prioriser hook, montage et rétention.';
  }
  if (structure < 55 && observed.score >= 50) {
    return 'Portée réelle solide malgré une structure perfectible: la vidéo a trouvé son audience; optimise le format pour stabiliser les prochaines performances.';
  }
  return 'Vidéo qui montre des signaux positifs, avec des marges d’optimisation ciblées.';
}

function computeCredibleFinalScore(
  structureScore: number,
  observed: { score: number } | null,
  metrics?: ObservedMetrics
): number {
  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
  if (!observed) return clamp(structureScore);

  // Keep structure dominant, but ensure real traction is reflected in final score.
  const blended = structureScore * 0.65 + observed.score * 0.35;
  let minFloor = 1;

  if (observed.score >= 85) minFloor = 58;
  else if (observed.score >= 75) minFloor = 52;
  else if (observed.score >= 65) minFloor = 46;
  else if (observed.score >= 55) minFloor = 40;
  else if (observed.score >= 50) minFloor = 36;

  const views = metrics?.views ?? 0;
  if (views >= 500_000) minFloor = Math.max(minFloor, 50);
  else if (views >= 200_000) minFloor = Math.max(minFloor, 48);
  else if (views >= 100_000) minFloor = Math.max(minFloor, 44);

  return clamp(Math.max(blended, minFloor));
}

function normalizeVisionFrames(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const s = item.trim();
    if (!s) continue;
    if (s.length > 350_000) return null;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
    out.push(s);
    if (out.length >= VISION_MAX_FRAMES) break;
  }
  return out.length >= 3 ? out : null;
}

function finalizeAnalyzeResult(
  result: AnalysisResult,
  structureScore: number,
  observed: ReturnType<typeof computeObservedPerformance>,
  observedMetrics: ObservedMetrics | undefined,
  detected: Awaited<ReturnType<typeof fetchTikTokPublicStatsV2>>,
  detectedSource: 'cache' | 'live_page' | 'live_oembed' | 'manual' | 'none',
  options?: { uploadDurationSec?: number }
): void {
  const credibleFinalScore = computeCredibleFinalScore(structureScore, observed, observedMetrics);
  result.structureScore = structureScore;
  result.viralityScore = credibleFinalScore;
  result.observedPerformanceScore = observed?.score;
  result.observedPerformanceLabel = observed?.label;
  result.observedPerformanceEstimated = observed?.estimated;
  result.observedMetrics = observedMetrics;
  if (detected) {
    result.detectedVideoMeta = {
      favorites: detected.favorites,
      durationSec: detected.durationSec ?? options?.uploadDurationSec,
      authorUsername: detected.authorUsername,
      publishedAt: detected.publishedAt,
      caption: detected.caption,
    };
  } else if (options?.uploadDurationSec) {
    result.detectedVideoMeta = { durationSec: options.uploadDurationSec };
  } else {
    result.detectedVideoMeta = undefined;
  }
  const viewsHigh = (observedMetrics?.views ?? 0) >= 150_000;
  result.overperformanceDetected =
    !!observed &&
    structureScore <= 55 &&
    (observed.score >= 70 || (viewsHigh && observed.score >= 50));
  result.observedStatsSource = detectedSource;
  result.unavailableObservedStats = ['views', 'likes', 'comments', 'shares'].filter((k) => {
    const m = observedMetrics as Record<string, unknown> | undefined;
    return !m || !m[k];
  });
  result.finalVerdict = buildFinalVerdict(structureScore, observed);

  if (!result.comparativeInsight?.trim() || !result.comparativePriority?.trim()) {
    const derived = deriveContextualComparative(
      result,
      observedMetrics,
      detected?.caption,
      detected?.authorUsername
    );
    if (!result.comparativeInsight?.trim()) result.comparativeInsight = derived.comparativeInsight;
    if (!result.comparativePriority?.trim()) result.comparativePriority = derived.comparativePriority;
  }
}

/** Réponse vision : le gratuit ne reçoit pas les champs avancés / stratégie complète (évite fuite + incite au Pro). */
function sanitizeVisionResultForPlan(result: AnalysisResult, plan: string): AnalysisResult {
  if (plan !== 'free') return result;
  const next: AnalysisResult = {
    ...result,
    strategy: undefined,
    viralTips: undefined,
  };
  if (next.improvements && next.improvements.length > 5) {
    next.improvements = next.improvements.slice(0, 5);
  }
  return next;
}

async function hasActiveTikTokAccount(userId: string): Promise<boolean> {
  const accounts = await listTikTokAccountsForUser(userId);
  return accounts.some((account) => account.status === 'active');
}

async function postVisionAnalyze(
  body: Record<string, unknown>,
  frames: string[]
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Connecte-toi pour analyser une vidéo importée.', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  let dbUser = session ? await getUserById(session.userId) : null;
  if (session && !dbUser) {
    await supabase
      .from('users')
      .upsert(
        { id: session.userId, email: session.email, plan: 'free', analyses_count: 0, hooks_count: 0, reconstructions_count: 0 },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    dbUser = {
      id: session.userId,
      email: session.email,
      plan: 'free' as const,
      analyses_count: 0,
      hooks_count: 0,
      reconstructions_count: 0,
      last_reset_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: null,
      subscription_current_period_end: null,
      subscription_cancel_at_period_end: false,
      tiktok_open_id: null,
      tiktok_display_name: null,
      tiktok_avatar_url: null,
      tiktok_connected_at: null,
    };
  }
  if (dbUser) {
    dbUser = await checkAndResetMonthly(dbUser);
  }
  if (false && session && !(await hasActiveTikTokAccount(session!.userId))) {
    return NextResponse.json(
      {
        error: 'Connecte ton compte TikTok pour débloquer l’analyse Viralynz.',
        code: 'TIKTOK_OPTIONAL_DISABLED',
      },
      { status: 403 }
    );
  }

  const effective = dbUser ? getEffectivePlan(dbUser) : 'free';
  const limit = PLAN_LIMITS[effective] ?? PLAN_LIMITS.free;
  const reservedQuota = dbUser ? await reserveAnalysisQuota(dbUser) : null;
  if (dbUser && !reservedQuota?.allowed) {
    const isFreeLifetime = effective === 'free' && !dbUser.stripe_subscription_id;
    return NextResponse.json(
      {
        error: isFreeLifetime
          ? `Tes ${limit} analyses gratuites sont épuisées. Passe à un plan payant pour continuer.`
          : 'Limite d\'analyses atteinte pour cette période. Attend le renouvellement ou passe à un plan supérieur.',
        type: 'analysis',
        plan: effective,
        used: reservedQuota?.used ?? dbUser.analyses_count,
        limit,
      },
      { status: 429 }
    );
  }
  if (dbUser && reservedQuota) {
    dbUser = { ...dbUser, analyses_count: reservedQuota.used };
    console.info('[analyze] quota_reserved', {
      userId: dbUser.id,
      plan: effective,
      used: reservedQuota.used,
      limit: reservedQuota.limit,
      source: 'vision_upload',
    });
  }

  try {
  const plan = effective;
  const reconstructionAllowed = dbUser ? canGenerateReconstruction(dbUser) : false;
  const reconstructionUsed = dbUser?.reconstructions_count ?? 0;
  const creatorMemory = session ? await getCreatorMemoryForAnalysis(session.userId, plan) : null;
  const hasOpenAI =
    !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here';

  const durationSec =
    typeof body.durationSec === 'number' && Number.isFinite(body.durationSec) && body.durationSec > 0
      ? Math.min(600, body.durationSec)
      : undefined;
  const fileName =
    typeof body.fileName === 'string' ? body.fileName.replace(/[<>]/g, '').slice(0, 120) : undefined;
  const transcript =
    typeof body.transcript === 'string' && body.transcript.trim().length > 10
      ? body.transcript.trim().slice(0, 4000)   // cap to avoid exceeding context window
      : undefined;

  let tiktokUrl = '';
  const rawTiktok = typeof body.tiktokUrl === 'string' ? body.tiktokUrl.trim() : '';
  if (rawTiktok) {
    const n = normalizeTikTokUrl(rawTiktok);
    if (isTikTokVideoUrl(n)) tiktokUrl = n;
  }

  // tiktokUrl is optional — stats will simply be absent if not provided.

  let detected: Awaited<ReturnType<typeof fetchTikTokPublicStatsV2>> = null;
  let detectedSource: 'cache' | 'live_page' | 'live_oembed' | 'manual' | 'none' = 'none';

  if (tiktokUrl) {
  try {
    const { data: cached, error: cacheReadErr } = await supabase
      .from('tiktok_stats_cache')
      .select('stats_json, fetched_at')
      .eq('video_url', tiktokUrl)
      .maybeSingle();
    if (cacheReadErr) {
      console.warn('[analyze/vision] tiktok_stats_cache read error:', cacheReadErr.message);
    } else if (cached?.stats_json && cached?.fetched_at) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (ageMs < 6 * 60 * 60 * 1000) {
        detected = cached.stats_json as Awaited<ReturnType<typeof fetchTikTokPublicStatsV2>>;
        detectedSource = 'cache';
      }
    }
  } catch (err) {
    console.warn('[analyze/vision] tiktok_stats_cache read threw:', err instanceof Error ? err.message : err);
  }
  if (!detected) {
    detected = await fetchTikTokPublicStatsV2(tiktokUrl);
    if (detected?.source === 'page_json') detectedSource = 'live_page';
    else if (detected?.source === 'oembed') detectedSource = 'live_oembed';
    if (detected) {
      try {
        const { error: cacheWriteErr } = await supabase
          .from('tiktok_stats_cache')
          .upsert(
            { video_url: tiktokUrl, stats_json: detected, fetched_at: new Date().toISOString() },
            { onConflict: 'video_url', ignoreDuplicates: false }
          );
        if (cacheWriteErr) {
          console.warn('[analyze/vision] tiktok_stats_cache write error:', cacheWriteErr.message);
        }
      } catch (err) {
        console.warn('[analyze/vision] tiktok_stats_cache write threw:', err instanceof Error ? err.message : err);
      }
    }
  }
  } // end if (tiktokUrl)

  const detectedObserved: ObservedMetrics | undefined = detected
    ? {
        views: detected.views,
        likes: detected.likes,
        comments: detected.comments,
        shares: detected.shares,
      }
    : undefined;

  const fileSizeMb = typeof body.fileSizeMb === 'number' && Number.isFinite(body.fileSizeMb)
    ? Math.max(0, Math.round(body.fileSizeMb * 10) / 10)
    : undefined;
  const onScreenText = await extractOnScreenTextFromFrames(frames);
  const videoIntelligence = buildVideoIntelligenceResult({
    frames,
    durationSec,
    transcript,
    transcriptSource: transcript ? 'whisper' : 'none',
    onScreenText,
    fileName,
    fileSizeMb,
    mimeType: sanitizeShortString(body.mimeType, 80),
  });
  console.info('[video-intelligence] upload summary', {
    durationSec,
    frameCount: videoIntelligence.metadata.frameCount,
    transcriptAvailable: videoIntelligence.transcript.available,
    confidence: videoIntelligence.confidence.level,
    signalsUsed: videoIntelligence.confidence.signalsUsed,
    limitationsCount: videoIntelligence.limitations.length,
  });
  const baseAnalysisContext = buildAnalysisContext({
    videoIntelligence,
    objective: sanitizeShortString(body.objective, 40),
    objectiveLabel: sanitizeShortString(body.objectiveLabel, 80),
    fileName,
    observedMetrics: detectedObserved,
  });
  const analysisContext = creatorMemory
    ? {
        ...baseAnalysisContext,
        promptContext: `${baseAnalysisContext.promptContext}\n\n${creatorMemory.promptContext}`,
      }
    : baseAnalysisContext;
  const costEstimate = estimateAnalysisCost({
    model: OPENAI_CHAT_MODEL,
    framesForOcr: Math.min(frames.length, 5),
    framesForReasoning: Math.min(frames.length, 8),
    transcriptChars: videoIntelligence.transcript.text?.length ?? 0,
    ocrChars: videoIntelligence.onScreenText.text.join(' ').length,
    promptChars: analysisContext.promptContext.length,
    outputTokens: plan === 'scale' ? 2400 : 1700,
    whisperMinutes: videoIntelligence.transcript.available && durationSec ? Math.max(0.1, durationSec / 60) : 0,
  });
  console.info('[analysis-cost] estimate', costEstimate);

  let result: AnalysisResult;
  let analysisMode: 'vision' | 'fallback' = 'vision';
  let analysisWarning: string | undefined;
  if (hasOpenAI) {
    try {
      result = await analyzeWithOpenAIVision(frames, plan, detectedObserved, {
        durationSec,
        tiktokUrl: tiktokUrl || undefined,
        fileName,
        transcript,
        analysisContext,
      });
    } catch (e) {
      console.warn('[analyze] vision OpenAI failed, falling back to local analysis:', e instanceof Error ? e.message : e);
      result = buildMockResult(`upload:${fileName || 'video'}`, plan);
      analysisMode = 'fallback';
      analysisWarning = 'Analyse vision indisponible : diagnostic degrade base sur signaux locaux et hypotheses.';
      result.comparativeInsight = 'Analyse vision complète indisponible sur cette tentative : Viralynz utilise les signaux extraits localement pour produire un diagnostic prudent.';
      result.comparativePriority = 'Relance l’analyse si tu veux une lecture vision plus précise, mais tu peux déjà corriger le hook et le rythme avec le plan ci-dessous.';
    }
  } else {
    console.warn('[analyze] vision OpenAI disabled, using local video-intelligence fallback');
    result = buildMockResult(`upload:${fileName || 'video'}`, plan);
    analysisMode = 'fallback';
    analysisWarning = 'Analyse vision serveur non configuree : diagnostic degrade base sur signaux locaux et hypotheses.';
    result.comparativeInsight = 'Analyse vision serveur non configurée : diagnostic basé sur metadata, frames échantillonnées, transcript éventuel et heuristiques Viralynz.';
    result.comparativePriority = 'Priorité : utiliser un hook lisible sans son et avancer la preuve avant 0:05.';
  }

  result = sanitizeVisionResultForPlan(result, plan);
  result.analysisSource = 'vision_upload';

  const structureScore = result.structureScore ?? result.viralityScore;
  const observed = computeObservedPerformance(detectedObserved);
  finalizeAnalyzeResult(
    result,
    structureScore,
    observed,
    detectedObserved,
    detected,
    detectedSource,
    durationSec ? { uploadDurationSec: durationSec } : undefined
  );
  const previousAnalyses = session ? await getRecentAnalysesForMemory(session.userId, getCreatorMemoryLimit(plan)) : [];
  result = attachAnalyzerOutputs(body, result, getAnalysisEngineContext(body, {
    durationSec,
    caption: detected?.caption,
    transcript: videoIntelligence.transcript.text ?? transcript,
    videoIntelligence,
    previousAnalyses,
  }), {
    plan,
    canGenerate: reconstructionAllowed,
    used: reconstructionUsed,
    user: dbUser ?? undefined,
  });
  result = applyQualityGate(result, analysisContext);

  const analyzerMeta = getAnalyzerMetaFromBody(body, result);
  result.analyzerMeta = {
    ...result.analyzerMeta,
    ...analyzerMeta,
    costEstimate: {
      model: costEstimate.model,
      estimatedUsd: costEstimate.estimatedUsd,
      estimatedInputTokens: costEstimate.estimatedInputTokens,
      estimatedOutputTokens: costEstimate.estimatedOutputTokens,
    },
  };
  applyAnalysisTransparency(result, {
    mode: analysisMode,
    confidenceScore: analysisMode === 'vision' ? videoIntelligence.confidence.score : Math.min(55, videoIntelligence.confidence.score),
    observedData: [
      `${videoIntelligence.metadata.frameCount} frames echantillonnees`,
      ...(videoIntelligence.transcript.available ? ['Transcription audio disponible'] : []),
      ...(videoIntelligence.onScreenText.available ? ['Texte ecran detecte'] : []),
      ...(detectedObserved ? ['Metrics TikTok detectees'] : []),
    ],
    aiHypotheses: ['Diagnostic hook', 'Risque de retention', 'Priorites de remontage'],
    simulations: ['Score de diagnostic', 'Potentiel apres correction'],
    previews: analysisMode === 'fallback' ? ['Recommandations prudentes en mode degrade'] : [],
    warning: analysisWarning,
  });

  const persistUrl = tiktokUrl || `upload:${fileName || 'video'}-${Date.now()}`;

  if (session) {
    const analysisId = await saveAnalysis(session.userId, persistUrl, result);
    const snapshot = buildVideoAnalysisSnapshot({
      userId: session.userId,
      plan,
      videoId: analysisId ?? persistUrl,
      result,
      duration: durationSec,
      transcript: videoIntelligence.transcript.text ?? transcript,
      creatorMemoryUsed: creatorMemory?.summary,
    });
    await Promise.all([
      ...(result.reconstructionIA ? [incrementReconstructionsCount(session.userId)] : []),
      persistAnalysisSnapshotAndMemory({
        userId: session.userId,
        plan,
        analysisId,
        videoUrl: persistUrl,
        result,
        snapshot,
      }),
    ]);
  }

  console.info(`[analyze] ${analysisMode === 'fallback' ? 'fallback_returned' : 'analysis_completed'}`, {
    userId: session?.userId ?? null,
    plan,
    source: 'vision_upload',
    mode: result.analyzerMeta?.analysisMode ?? analysisMode,
  });
  return NextResponse.json(result);
  } catch (err) {
    if (session && reservedQuota?.allowed) {
      const refundReason = 'technical_error_after_quota_reservation';
      const refunded = await refundAnalysisQuota(session.userId);
      console.info('[analyze] quota_refunded', {
        userId: session.userId,
        source: 'vision_upload',
        refunded,
        refund_reason: refundReason,
      });
    }
    console.error('[analyze/vision] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Analyse interrompue pour une raison technique. Si un quota avait ete reserve, il a ete restaure.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let refundableQuotaUserId: string | null = null;
  let quotaRefundedOrCompleted = false;
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
    }
    const visionFrames = normalizeVisionFrames(body.frames);
    if (visionFrames) {
      return await postVisionAnalyze(body, visionFrames);
    }
    if (Array.isArray(body.frames)) {
      return NextResponse.json(
        { error: 'Frames vidéo invalides ou insuffisantes. Réessaie avec une vidéo MP4 lisible.' },
        { status: 400 }
      );
    }

    const rawUrl = body?.url;
    const manualObservedMetrics = sanitizeMetrics(body?.observedMetrics);

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
    }

    const url = normalizeTikTokUrl(rawUrl.trim());
    if (!isTikTokVideoUrl(url)) {
      return NextResponse.json(
        {
          error:
            'URL invalide. Liens TikTok acceptés : vm.tiktok.com, vt.tiktok.com, ou URL avec /video/ ou /t/.',
        },
        { status: 400 }
      );
    }

    // ── Auth & limit check ────────────────────────────────────────────────────
    const session = await getSession();
    let dbUser: UserProfile | null = null;

    if (!session) {
      return NextResponse.json(
        { error: 'Connecte-toi pour analyser une URL TikTok.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    dbUser = await getUserById(session.userId);

    // Profile row missing (signup DB insert may have failed) — create it now
    if (!dbUser) {
      await supabase
        .from('users')
        .upsert(
          { id: session.userId, email: session.email, plan: 'free', analyses_count: 0, hooks_count: 0, reconstructions_count: 0 },
          { onConflict: 'id', ignoreDuplicates: true }
        );
      dbUser = {
        id: session.userId,
        email: session.email,
        plan: 'free' as const,
        analyses_count: 0,
        hooks_count: 0,
        reconstructions_count: 0,
        last_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: null,
        subscription_current_period_end: null,
        subscription_cancel_at_period_end: false,
        tiktok_open_id: null,
        tiktok_display_name: null,
        tiktok_avatar_url: null,
        tiktok_connected_at: null,
      };
      console.log('[analyze] profile row created on-the-fly for:', session.userId);
    }

    // Reset monthly counters if we've crossed a calendar-month boundary
    dbUser = await checkAndResetMonthly(dbUser);

    if (false && !(await hasActiveTikTokAccount(session!.userId))) {
      return NextResponse.json(
        { error: 'Connexion TikTok optionnelle indisponible sur cette analyse.', code: 'TIKTOK_OPTIONAL_DISABLED' },
        { status: 403 }
      );
    }

    const effectivePlan = getEffectivePlan(dbUser);
    const limit = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS.free;
    const reservedQuota = await reserveAnalysisQuota(dbUser);

    console.log('[analyze] limit check —', {
      plan: effectivePlan,
      storedPlan: dbUser.plan,
      count: dbUser.analyses_count,
      limit,
      allowed: reservedQuota.allowed,
    });

    if (!reservedQuota.allowed) {
      const isFreeLifetime = effectivePlan === 'free' && !dbUser.stripe_subscription_id;
      return NextResponse.json(
        {
          error: isFreeLifetime
            ? `Tes ${limit} analyses gratuites sont épuisées. Passe à un plan payant pour continuer.`
            : 'Limite d\'analyses atteinte pour cette période. Attend le renouvellement ou passe à un plan supérieur.',
          type:  'analysis',
          plan:  effectivePlan,
          used:  reservedQuota.used,
          limit,
        },
        { status: 429 }
      );
    }
    dbUser = { ...dbUser, analyses_count: reservedQuota.used };
    refundableQuotaUserId = session.userId;
    console.info('[analyze] quota_reserved', {
      userId: session.userId,
      plan: effectivePlan,
      used: reservedQuota.used,
      limit: reservedQuota.limit,
      source: 'url',
    });

    // ── Fetch real public TikTok stats (cache + live + fallback) ───────────
    let detected: Awaited<ReturnType<typeof fetchTikTokPublicStatsV2>> = null;
    let detectedSource: 'cache' | 'live_page' | 'live_oembed' | 'manual' | 'none' = 'none';

    // 1) Try DB cache first (TTL = 6 hours)
    try {
      const { data: cached, error: cacheReadErr } = await supabase
        .from('tiktok_stats_cache')
        .select('stats_json, fetched_at')
        .eq('video_url', url)
        .maybeSingle();
      if (cacheReadErr) {
        console.warn('[analyze] tiktok_stats_cache read error:', cacheReadErr.message);
      } else if (cached?.stats_json && cached?.fetched_at) {
        const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
        if (ageMs < 6 * 60 * 60 * 1000) {
          detected = cached.stats_json as Awaited<ReturnType<typeof fetchTikTokPublicStatsV2>>;
          detectedSource = 'cache';
        }
      }
    } catch (err) {
      console.warn('[analyze] tiktok_stats_cache read threw:', err instanceof Error ? err.message : err);
    }

    // 2) If no valid cache, fetch live and write cache
    if (!detected) {
      detected = await fetchTikTokPublicStatsV2(url);
      if (detected?.source === 'page_json') detectedSource = 'live_page';
      else if (detected?.source === 'oembed') detectedSource = 'live_oembed';

      if (detected) {
        try {
          const { error: cacheWriteErr } = await supabase
            .from('tiktok_stats_cache')
            .upsert(
              { video_url: url, stats_json: detected, fetched_at: new Date().toISOString() },
              { onConflict: 'video_url', ignoreDuplicates: false }
            );
          if (cacheWriteErr) {
            console.warn('[analyze] tiktok_stats_cache write error:', cacheWriteErr.message);
          }
        } catch (err) {
          console.warn('[analyze] tiktok_stats_cache write threw:', err instanceof Error ? err.message : err);
        }
      }
    }
    const detectedObserved: ObservedMetrics | undefined = detected
      ? {
          views: detected.views,
          likes: detected.likes,
          comments: detected.comments,
          shares: detected.shares,
        }
      : undefined;

    // Priority: detected stats from TikTok URL. Fill missing fields with manual inputs.
    const observedMetrics: ObservedMetrics | undefined =
      detectedObserved || manualObservedMetrics
        ? {
            views: detectedObserved?.views ?? manualObservedMetrics?.views,
            likes: detectedObserved?.likes ?? manualObservedMetrics?.likes,
            comments: detectedObserved?.comments ?? manualObservedMetrics?.comments,
            shares: detectedObserved?.shares ?? manualObservedMetrics?.shares,
          }
        : undefined;

    if (!detectedObserved && manualObservedMetrics) {
      detectedSource = 'manual';
    }

    // ── Analysis ─────────────────────────────────────────────────────────────
    const plan = dbUser ? getEffectivePlan(dbUser) : 'free';
    const reconstructionAllowed = dbUser ? canGenerateReconstruction(dbUser) : false;
    const reconstructionUsed = dbUser?.reconstructions_count ?? 0;
    const creatorMemory = session ? await getCreatorMemoryForAnalysis(session.userId, plan) : null;
    const useOpenAI =
      plan !== 'free' &&
      !!process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'sk-your-key-here';

    let result: AnalysisResult;
    let analysisMode: 'metadata' | 'fallback' | 'demo' = useOpenAI ? 'metadata' : 'demo';
    let analysisWarning: string | undefined = useOpenAI
      ? undefined
      : 'Preview demo : diagnostic base sur URL, metadata disponibles et hypotheses, sans lecture vision complete.';

    if (useOpenAI) {
      try {
        result = await analyzeWithOpenAI(url, plan === 'scale' ? 'scale' : 'pro', observedMetrics, detected
          ? {
              caption: detected.caption,
              authorUsername: detected.authorUsername,
              durationSec: detected.durationSec,
              memoryPrompt: creatorMemory?.promptContext,
            }
          : creatorMemory ? { memoryPrompt: creatorMemory.promptContext } : undefined);
        console.log(`[analyze] OpenAI (${plan}) — viralityScore:`, result.viralityScore);
      } catch (aiErr) {
        console.error('[analyze] OpenAI failed, falling back to mock:', aiErr);
        result = buildMockResult(url, plan);
        analysisMode = 'fallback';
        analysisWarning = 'Analyse IA indisponible : diagnostic degrade base sur metadata et hypotheses.';
      }
    } else {
      // Free plan or no API key — deterministic mock
      await new Promise((resolve) => setTimeout(resolve, 1800 + Math.random() * 1200));
      result = buildMockResult(url, plan);
    }

    result.analysisSource = 'url';
    const structureScore = result.structureScore ?? result.viralityScore;
    const observed = computeObservedPerformance(observedMetrics);
    finalizeAnalyzeResult(result, structureScore, observed, observedMetrics, detected, detectedSource, undefined);
    const videoIntelligence = buildVideoIntelligenceResult({
      durationSec: detected?.durationSec,
      transcript: detected?.caption,
      transcriptSource: detected?.caption ? 'provided' : 'none',
      fileName: url,
      mimeType: 'text/tiktok-url',
    });
    const baseAnalysisContext = buildAnalysisContext({
      videoIntelligence,
      objective: sanitizeShortString(body.objective, 40),
      objectiveLabel: sanitizeShortString(body.objectiveLabel, 80),
      fileName: url,
      observedMetrics,
    });
    const analysisContext = creatorMemory
      ? {
          ...baseAnalysisContext,
          promptContext: `${baseAnalysisContext.promptContext}\n\n${creatorMemory.promptContext}`,
        }
      : baseAnalysisContext;
    const costEstimate = estimateAnalysisCost({
      model: OPENAI_CHAT_MODEL,
      framesForOcr: 0,
      framesForReasoning: 0,
      transcriptChars: videoIntelligence.transcript.text?.length ?? 0,
      promptChars: analysisContext.promptContext.length,
      outputTokens: plan === 'scale' ? 2200 : 1500,
    });
    console.info('[analysis-cost] url estimate', costEstimate);
    const previousAnalyses = session ? await getRecentAnalysesForMemory(session.userId, getCreatorMemoryLimit(plan)) : [];
    result = attachAnalyzerOutputs(body, result, getAnalysisEngineContext(body, {
      durationSec: detected?.durationSec,
      caption: detected?.caption,
      transcript: videoIntelligence.transcript.text,
      videoIntelligence,
      previousAnalyses,
    }), {
      plan,
      canGenerate: reconstructionAllowed,
      used: reconstructionUsed,
      user: dbUser ?? undefined,
    });
    result = applyQualityGate(result, analysisContext);
    result.analyzerMeta = {
      ...result.analyzerMeta,
      costEstimate: {
        model: costEstimate.model,
        estimatedUsd: costEstimate.estimatedUsd,
        estimatedInputTokens: costEstimate.estimatedInputTokens,
        estimatedOutputTokens: costEstimate.estimatedOutputTokens,
      },
    };

    // ── Persist for authenticated users ──────────────────────────────────────
    applyAnalysisTransparency(result, {
      mode: analysisMode,
      confidenceScore: analysisMode === 'metadata' ? 62 : 45,
      observedData: [
        ...(detectedObserved ? ['Metrics TikTok detectees'] : []),
        ...(detected?.caption ? ['Caption TikTok disponible'] : []),
        detectedSource !== 'none' ? `Source stats: ${detectedSource}` : 'URL TikTok fournie',
      ],
      aiHypotheses: ['Diagnostic hook', 'Risque de retention', 'Priorites de remontage'],
      simulations: ['Score de diagnostic', 'Potentiel apres correction'],
      previews: analysisMode === 'demo' ? ['Exemple de sortie pour plan gratuit ou API indisponible'] : [],
      warning: analysisWarning,
    });

    if (session && dbUser) {
      const analysisId = await saveAnalysis(session.userId, url, result);
      const snapshot = buildVideoAnalysisSnapshot({
        userId: session.userId,
        plan,
        videoId: analysisId ?? url,
        result,
        duration: detected?.durationSec,
        transcript: videoIntelligence.transcript.text,
        creatorMemoryUsed: creatorMemory?.summary,
      });
      await Promise.all([
        ...(result.reconstructionIA ? [incrementReconstructionsCount(session.userId)] : []),
        persistAnalysisSnapshotAndMemory({
          userId: session.userId,
          plan,
          analysisId,
          videoUrl: url,
          result,
          snapshot,
        }),
      ]);
    }

    quotaRefundedOrCompleted = true;
    console.info(`[analyze] ${analysisMode === 'fallback' || analysisMode === 'demo' ? 'fallback_returned' : 'analysis_completed'}`, {
      userId: session.userId,
      plan,
      source: 'url',
      mode: result.analyzerMeta?.analysisMode ?? analysisMode,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (refundableQuotaUserId && !quotaRefundedOrCompleted) {
      const refundReason = 'technical_error_after_quota_reservation';
      const refunded = await refundAnalysisQuota(refundableQuotaUserId);
      console.info('[analyze] quota_refunded', {
        userId: refundableQuotaUserId,
        source: 'url',
        refunded,
        refund_reason: refundReason,
      });
      quotaRefundedOrCompleted = true;
    }
    console.error('[analyze/POST] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erreur serveur. Si un quota avait ete reserve, il a ete restaure.' }, { status: 500 });
  }
}
