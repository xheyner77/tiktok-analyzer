import { enrichTrend, getRecommendedAction } from './trend-scoring';
import { trendSeeds } from './trend-data';
import type { AvoidTrendRecommendation, DailyTrendIdea, NicheTrendOpportunity, Trend, TrendRadarModel, TrendRadarSummary, TrendSeed } from './trend-types';

const targetNiches = ['Business', 'Coaching', 'E-commerce', 'Fitness', 'Beauté', 'Food', 'Gaming', 'Éducation', 'Lifestyle'];

function sortByOpportunity(trends: Trend[]) {
  return [...trends].sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function buildMarketSummary(trends: Trend[]) {
  const best = sortByOpportunity(trends)[0];
  const early = trends.filter((trend) => trend.stage === 'early_signal');
  const risky = trends.filter((trend) => trend.verdict === 'avoid' || trend.verdict === 'twist_it');

  if (!best) return 'Aucun signal disponible pour le moment.';

  if (early.length >= 3) {
    return `Le marché est favorable aux formats de transformation rapide. ${best.name} et les mini diagnostics restent exploitables avant saturation.`;
  }

  if (risky.length > early.length) {
    return 'Le marché est sélectif : plusieurs formats visibles sont déjà trop copiés. Les meilleurs posts doivent détourner, pas suivre.';
  }

  return `Le meilleur signal actuel est ${best.name}. La fenêtre est courte : il faut publier avec une preuve ou un angle très précis.`;
}

function buildSummary(trends: Trend[]): TrendRadarSummary {
  const bestTrend = sortByOpportunity(trends)[0];
  const avoidCount = trends.filter((trend) => trend.verdict === 'avoid').length;
  const postNowCount = trends.filter((trend) => trend.verdict === 'post_now').length;
  const earlyCount = trends.filter((trend) => trend.stage === 'early_signal').length;
  const highRiskCount = trends.filter((trend) => trend.riskScore >= 70).length;

  return {
    bestTrendId: bestTrend?.id ?? '',
    earlyCount,
    avoidCount,
    postNowCount,
    marketMood: avoidCount >= 4 ? 'saturated' : highRiskCount >= 3 ? 'unstable' : earlyCount >= 3 ? 'favorable' : 'selective',
    marketSummary: buildMarketSummary(trends),
    lastUpdatedLabel: 'il y a 12 min',
  };
}

function buildNicheOpportunities(trends: Trend[]): NicheTrendOpportunity[] {
  return targetNiches.map((niche) => {
    const trend = sortByOpportunity(trends.filter((item) => item.recommendedNiches.includes(niche) && !item.badFitNiches.includes(niche)))[0] ?? sortByOpportunity(trends)[0];

    return {
      niche,
      trendId: trend.id,
      trendName: trend.name,
      hook: trend.hooks[0],
      format: trend.recommendedFormats[0]?.label ?? 'Vidéo courte',
      score: Math.max(0, Math.min(100, Math.round(trend.opportunityScore + trend.creatorFitScore * 0.08 - trend.difficultyScore * 0.04))),
      action: getRecommendedAction(trend),
    };
  });
}

function buildAvoidTrends(trends: Trend[]): AvoidTrendRecommendation[] {
  return trends
    .filter((trend) => trend.verdict === 'avoid' || trend.verdict === 'twist_it' || trend.saturationScore >= 70)
    .sort((a, b) => b.saturationScore + b.riskScore - (a.saturationScore + a.riskScore))
    .slice(0, 4)
    .map((trend) => ({
      trendId: trend.id,
      name: trend.name,
      verdict: trend.verdict,
      reason: trend.saturationReason,
      twist: trend.angles[0] ?? 'Détourner avec une preuve plus spécifique.',
    }));
}

function buildDailyIdeas(trends: Trend[]): DailyTrendIdea[] {
  return sortByOpportunity(trends)
    .filter((trend) => trend.verdict === 'post_now' || trend.verdict === 'good_potential')
    .slice(0, 3)
    .map((trend) => ({
      trendId: trend.id,
      trendName: trend.name,
      hook: trend.hooks[0],
      format: trend.recommendedFormats[0]?.label ?? 'Vidéo courte',
      structure: trend.actionPlan.map((step) => step.title),
      duration: trend.recommendedFormats[0]?.duration ?? '20 sec',
      effort: trend.actionPlan.some((step) => step.effort === 'high') ? 'high' : trend.actionPlan.some((step) => step.effort === 'medium') ? 'medium' : 'low',
      objective: trend.actionPlan[0]?.description ?? getRecommendedAction(trend),
      cta: trend.verdict === 'post_now' ? 'Sauvegarde avant ton prochain post.' : 'Teste cet angle sur ta prochaine V2.',
    }));
}

export function buildTrendRadarModel(seeds: TrendSeed[] = trendSeeds): TrendRadarModel {
  const trends = seeds.map(enrichTrend).sort((a, b) => b.opportunityScore - a.opportunityScore);

  return {
    trends,
    summary: buildSummary(trends),
    nicheOpportunities: buildNicheOpportunities(trends),
    avoidTrends: buildAvoidTrends(trends),
    dailyIdeas: buildDailyIdeas(trends),
  };
}
