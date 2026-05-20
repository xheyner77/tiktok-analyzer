import type {
  NormalizedTrendSignal,
  TrendCluster,
  TrendRecommendation,
  TrendScores,
  TrendStage,
  TrendVerdict,
} from '@/lib/trends/types';
import { clamp, hoursBetween, percentileRank, roundScore } from '@/lib/trends/formatters';

export interface TrendClusterScoringInput {
  signals: NormalizedTrendSignal[];
  allSignals: NormalizedTrendSignal[];
  firstSeenAt: string;
  lastSeenAt: string;
  nicheMatch?: number;
  previousSampleSize?: number;
}

function average(values: number[]): number {
  const clean = values.filter(Number.isFinite);
  if (clean.length === 0) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function duplicationRatio(signals: NormalizedTrendSignal[]): number {
  if (signals.length <= 1) return 0;
  const hooks = signals.map((signal) => signal.hookText.toLowerCase().slice(0, 42));
  return 1 - new Set(hooks).size / signals.length;
}

function creatorCount(signals: NormalizedTrendSignal[]): number {
  return new Set(signals.map((signal) => signal.authorKey).filter(Boolean)).size;
}

export function calculateTrendScores(input: TrendClusterScoringInput): TrendScores {
  const sampleSize = input.signals.length;
  const uniqueCreators = creatorCount(input.signals);
  const allVelocity = input.allSignals.map((signal) => signal.viewVelocity);
  const allEngagement = input.allSignals.map((signal) => signal.engagementRate);
  const allShare = input.allSignals.map((signal) => signal.shareRate);

  const avgVelocity = average(input.signals.map((signal) => signal.viewVelocity));
  const avgEngagement = average(input.signals.map((signal) => signal.engagementRate));
  const avgShare = average(input.signals.map((signal) => signal.shareRate));
  const firstSeenAge = hoursBetween(input.firstSeenAt);
  const lastSeenAge = hoursBetween(input.lastSeenAt);
  const duplicateRatio = duplicationRatio(input.signals);

  const velocityScore = percentileRank(allVelocity, avgVelocity);
  const engagementScore = percentileRank(allEngagement, avgEngagement);
  const shareabilityScore = percentileRank(allShare, avgShare);
  const freshnessScore = clamp(100 - lastSeenAge * 2.4);
  const noveltyScore = clamp(95 - Math.max(0, firstSeenAge - 12) * 0.42 - duplicateRatio * 32 - Math.max(0, sampleSize - 45) * 0.45);
  const sampleQualityScore = clamp(sampleSize * 7 + uniqueCreators * 5 - duplicateRatio * 20);

  const historicalAcceleration =
    typeof input.previousSampleSize === 'number' && input.previousSampleSize > 0
      ? ((sampleSize - input.previousSampleSize) / input.previousSampleSize) * 100
      : freshnessScore * 0.34 + velocityScore * 0.44 + Math.min(sampleSize, 30) * 0.7;
  const accelerationScore = clamp(historicalAcceleration);

  const saturationScore = clamp(
    sampleSize * 1.35 +
      uniqueCreators * 1.65 +
      duplicateRatio * 38 +
      Math.max(0, 55 - velocityScore) * 0.38 +
      Math.max(0, 35 - engagementScore) * 0.22,
  );

  const confidenceScore = clamp(
    sampleSize * 5.8 +
      uniqueCreators * 6.4 +
      freshnessScore * 0.18 +
      Math.min(100, input.signals.filter((signal) => signal.sourceUrl).length * 12) -
      duplicateRatio * 18,
  );

  const riskScore = clamp(
    saturationScore * 0.52 +
      Math.max(0, 55 - confidenceScore) * 0.62 +
      Math.max(0, 5 - sampleSize) * 8 +
      duplicateRatio * 22,
  );

  const creatorFitScore = clamp((input.nicheMatch ?? 62) + Math.min(18, sampleSize * 0.7));

  const opportunityScore = clamp(
    velocityScore * 0.22 +
      accelerationScore * 0.18 +
      engagementScore * 0.14 +
      shareabilityScore * 0.12 +
      noveltyScore * 0.12 +
      creatorFitScore * 0.1 +
      freshnessScore * 0.08 -
      saturationScore * 0.14 -
      riskScore * 0.1,
  );

  let finalScore = opportunityScore * (0.64 + confidenceScore / 280);
  if (confidenceScore < 50) finalScore = Math.min(finalScore, 69);
  if (saturationScore > 85) finalScore = Math.min(finalScore, 59);
  if (sampleSize < 5) finalScore = Math.min(finalScore, 62);

  return {
    opportunityScore: roundScore(opportunityScore),
    velocityScore: roundScore(velocityScore),
    accelerationScore: roundScore(accelerationScore),
    engagementScore: roundScore(engagementScore),
    shareabilityScore: roundScore(shareabilityScore),
    noveltyScore: roundScore(noveltyScore),
    saturationScore: roundScore(saturationScore),
    riskScore: roundScore(riskScore),
    confidenceScore: roundScore(confidenceScore),
    creatorFitScore: roundScore(creatorFitScore),
    freshnessScore: roundScore(freshnessScore),
    sampleQualityScore: roundScore(sampleQualityScore),
    finalScore: roundScore(finalScore),
  };
}

export function calculateTrendStage(scores: TrendScores, sampleSize: number): TrendStage {
  if (scores.riskScore >= 72 && scores.velocityScore >= 68) return 'unstable';
  if (scores.velocityScore <= 35 && scores.saturationScore >= 68 && scores.freshnessScore < 55) return 'declining';
  if (scores.saturationScore >= 86 && scores.noveltyScore <= 48) return 'saturated';
  if (scores.saturationScore >= 72 && scores.velocityScore >= 52) return 'peak';
  if (scores.noveltyScore >= 68 && scores.velocityScore >= 66 && scores.saturationScore <= 62) return 'early_signal';
  if (scores.velocityScore >= 62 && sampleSize >= 5 && scores.saturationScore < 76) return 'growth';
  return scores.confidenceScore < 55 ? 'unstable' : 'growth';
}

export function calculateTrendVerdict(scores: TrendScores, stage: TrendStage, sampleSize: number, estimatedWindowHours: number): TrendVerdict {
  if (scores.saturationScore > 85 || scores.riskScore > 80 || scores.finalScore < 40) return 'avoid';
  if (sampleSize < 5 || scores.confidenceScore < 55) return 'watch';
  if ((stage === 'peak' || stage === 'saturated') && scores.saturationScore >= 70) return 'twist_it';
  if (scores.finalScore >= 80 && scores.confidenceScore >= 60 && scores.saturationScore < 60 && estimatedWindowHours <= 72) return 'post_now';
  if (scores.finalScore >= 65 && scores.confidenceScore >= 55 && scores.saturationScore < 75) return 'good_potential';
  return 'watch';
}

export function estimateWindowHours(scores: TrendScores, stage: TrendStage): number {
  if (stage === 'saturated' || stage === 'declining') return 0;
  const base = stage === 'early_signal' ? 72 : stage === 'growth' ? 48 : stage === 'peak' ? 24 : 36;
  return Math.max(8, Math.round(base - scores.saturationScore * 0.32 + scores.noveltyScore * 0.12));
}

export function buildRecommendation(cluster: Omit<TrendCluster, 'recommendation'>, scores: TrendScores): TrendRecommendation {
  const stage = calculateTrendStage(scores, cluster.sampleSize);
  const estimatedWindowHours = estimateWindowHours(scores, stage);
  const verdict = calculateTrendVerdict(scores, stage, cluster.sampleSize, estimatedWindowHours);
  const firstHook = cluster.evidenceItems[0]?.hookText || 'Ouvre avec la preuve avant le contexte.';

  const decisionLabel: Record<TrendVerdict, string> = {
    post_now: 'A poster maintenant',
    good_potential: 'Bon potentiel',
    watch: 'A surveiller',
    twist_it: 'A detourner',
    avoid: 'A eviter',
  };

  return {
    verdict,
    stage,
    decisionLabel: decisionLabel[verdict],
    shortReason:
      verdict === 'post_now'
        ? `Momentum confirme sur ${cluster.sampleSize} videos, saturation encore controlee.`
        : verdict === 'twist_it'
          ? 'Volume fort, mais le pattern commence a etre trop reconnaissable.'
          : verdict === 'avoid'
            ? 'Saturation dangereuse ou risque trop eleve pour copier le format.'
            : verdict === 'watch'
              ? 'Signal interessant, mais la preuve reste trop courte.'
              : 'Bon ratio momentum / saturation, a tester avec un angle specifique.',
    recommendedHook: firstHook,
    recommendedAngle: buildRecommendedAngle(cluster.patternKey, cluster.niche),
    recommendedFormat: buildRecommendedFormat(cluster.patternKey),
    estimatedWindowHours,
    actionNow: buildActionNow(verdict, cluster.title),
    avoidReason: verdict === 'avoid' ? 'Trop de copies pour peu de preuve additionnelle.' : undefined,
    twistSuggestion: verdict === 'twist_it' ? 'Garde la mecanique, change la promesse et ajoute une preuve chiffree.' : undefined,
  };
}

function buildRecommendedAngle(patternKey: string, niche: string): string {
  if (patternKey === 'before_after') return `Montre le contraste avant/apres dans la niche ${niche}, avec une preuve visible des la premiere seconde.`;
  if (patternKey === 'flop_analysis') return 'Demonte une video faible, puis montre la version repostee plus tendue.';
  if (patternKey === 'mistake_hook') return 'Isole une erreur precise que ton audience fait encore dans les deux premieres secondes.';
  if (patternKey === 'mini_case_study') return 'Raconte un resultat concret en supprimant tout le contexte inutile.';
  return 'Adapte le pattern a une situation precise, mesurable, impossible a confondre avec un conseil generique.';
}

function buildRecommendedFormat(patternKey: string): string {
  if (patternKey === 'carousel_explainer') return 'Carrousel 5 slides, payoff en slide 2';
  if (patternKey === 'before_after') return 'Facecam courte 18-25 sec ou montage split-screen';
  if (patternKey === 'mini_case_study') return 'Video 25 sec avec preuve a l ecran';
  if (patternKey === 'flop_analysis') return 'Audit rapide 30 sec, avant/apres du hook';
  return 'Video verticale 18-28 sec, texte a l ecran des la premiere frame';
}

function buildActionNow(verdict: TrendVerdict, title: string): string {
  if (verdict === 'post_now') return `Produis une V1 aujourd'hui sur "${title}" avant que la fenetre se referme.`;
  if (verdict === 'twist_it') return `Ne copie pas "${title}" : detourne le hook avec une preuve plus specifique.`;
  if (verdict === 'avoid') return `Ignore "${title}" ou transforme-le en contre-angle.`;
  if (verdict === 'watch') return `Surveille "${title}" jusqu'au prochain scan.`;
  return `Teste "${title}" avec une promesse nichee et un payoff rapide.`;
}
