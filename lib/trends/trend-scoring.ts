import type { Trend, TrendHealth, TrendRadarPosition, TrendSeed, TrendStage, TrendTimeWindow, TrendUrgency, TrendVerdict } from './trend-types';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateOpportunityScore(trend: Pick<TrendSeed, 'velocityScore' | 'accelerationScore' | 'noveltyScore' | 'creatorFitScore' | 'volumeScore' | 'saturationScore' | 'difficultyScore' | 'riskScore'>) {
  const rawScore =
    trend.velocityScore * 0.25 +
    trend.accelerationScore * 0.2 +
    trend.noveltyScore * 0.15 +
    trend.creatorFitScore * 0.15 +
    trend.volumeScore * 0.1 -
    trend.saturationScore * 0.2 -
    trend.difficultyScore * 0.05 -
    trend.riskScore * 0.1;

  return clampScore(((rawScore + 15) / 75) * 100);
}

export function calculateUrgency(trend: Pick<TrendSeed, 'timeWindow' | 'velocityScore' | 'saturationScore' | 'riskScore'>): TrendUrgency {
  if (trend.timeWindow.estimatedHoursLeft <= 18 || trend.saturationScore >= 82) return 'critical';
  if (trend.timeWindow.estimatedHoursLeft <= 36 || (trend.velocityScore >= 78 && trend.saturationScore >= 55)) return 'high';
  if (trend.timeWindow.estimatedHoursLeft <= 72 || trend.riskScore >= 62) return 'medium';
  return 'low';
}

export function calculateTrendStage(trend: Pick<TrendSeed, 'volumeScore' | 'velocityScore' | 'accelerationScore' | 'saturationScore' | 'noveltyScore' | 'riskScore'>): TrendStage {
  if (trend.velocityScore <= 35 && trend.accelerationScore <= 35 && trend.saturationScore >= 65) return 'declining';
  if (trend.saturationScore >= 78 && trend.noveltyScore <= 45) return 'saturated';
  if (trend.riskScore >= 70 && trend.accelerationScore >= 65) return 'unstable';
  if (trend.velocityScore >= 65 && trend.accelerationScore >= 60 && trend.saturationScore <= 45 && trend.noveltyScore >= 65) return 'early_signal';
  if (trend.velocityScore >= 70 && trend.volumeScore >= 45 && trend.saturationScore <= 65) return 'growth';
  if (trend.volumeScore >= 75 && trend.saturationScore >= 60 && trend.velocityScore >= 50) return 'peak';
  return trend.saturationScore >= 70 ? 'peak' : 'growth';
}

export function calculateTrendVerdict(trend: Pick<TrendSeed, 'saturationScore' | 'riskScore' | 'timeWindow'> & { opportunityScore: number; stage: TrendStage }): TrendVerdict {
  if (trend.saturationScore > 82 || trend.riskScore > 80 || trend.opportunityScore < 40 || trend.stage === 'declining') return 'avoid';
  if ((trend.stage === 'saturated' || trend.stage === 'peak') && trend.saturationScore >= 68) return 'twist_it';
  if (trend.opportunityScore >= 80 && trend.saturationScore < 55 && trend.timeWindow.estimatedHoursLeft <= 72) return 'post_now';
  if (trend.opportunityScore >= 65 && trend.saturationScore < 70) return 'good_potential';
  return 'watch';
}

export const calculateVerdict = calculateTrendVerdict;

export function calculateRadarPosition(trend: Pick<TrendSeed, 'volumeScore' | 'velocityScore' | 'saturationScore' | 'riskScore' | 'noveltyScore'> & { opportunityScore: number; stage: TrendStage }): TrendRadarPosition {
  const baseX = trend.stage === 'early_signal'
    ? 22
    : trend.stage === 'growth'
      ? 43
      : trend.stage === 'peak'
        ? 66
        : trend.stage === 'unstable'
          ? 55 + trend.riskScore * 0.24
          : 84;

  const baseY = trend.stage === 'early_signal'
    ? 36
    : trend.stage === 'growth'
      ? 47
      : trend.stage === 'peak'
        ? 36 + trend.saturationScore * 0.22
        : trend.stage === 'unstable'
          ? 73
          : 68;

  return {
    x: clampScore(baseX + (trend.saturationScore - 50) * 0.12 - (trend.noveltyScore - 50) * 0.08),
    y: clampScore(baseY - (trend.opportunityScore - 70) * 0.14 + (trend.riskScore - 40) * 0.1),
    radius: Math.max(9, Math.min(21, Math.round(8 + trend.volumeScore * 0.08 + trend.opportunityScore * 0.045))),
  };
}

export function getRecommendedAction(trend: Pick<Trend, 'verdict' | 'timeWindow' | 'angles' | 'hooks' | 'recommendedFormats'>) {
  if (trend.verdict === 'post_now') return `Poster maintenant avec l’angle : ${trend.angles[0]}`;
  if (trend.verdict === 'good_potential') return `Préparer une version courte en ${trend.recommendedFormats[0]?.label ?? 'format court'} avant ${trend.timeWindow.label}.`;
  if (trend.verdict === 'twist_it') return `Ne pas copier. Détourner avec : ${trend.angles[0]}`;
  if (trend.verdict === 'avoid') return 'Éviter la copie directe. Utiliser seulement comme contre-exemple.';
  return `Surveiller le signal et préparer le hook : ${trend.hooks[0]}`;
}

export function getTrendHealth(trend: Pick<Trend, 'opportunityScore' | 'stage' | 'verdict' | 'saturationScore' | 'riskScore'>): TrendHealth {
  if (trend.verdict === 'avoid') {
    return { label: 'Saturation dangereuse', tone: 'dead', explanation: 'Le risque de publier une copie tardive dépasse le potentiel.' };
  }
  if (trend.verdict === 'twist_it') {
    return { label: 'À détourner, pas à copier', tone: 'risky', explanation: 'Le volume existe, mais l’angle standard fatigue déjà.' };
  }
  if (trend.opportunityScore >= 80 && trend.stage === 'early_signal') {
    return { label: 'Signal early fort', tone: 'strong', explanation: 'Momentum haut, saturation encore basse, fenêtre exploitable.' };
  }
  if (trend.opportunityScore >= 65) {
    return { label: 'Bon potentiel', tone: 'good', explanation: 'Le signal est exploitable avec un angle précis.' };
  }
  return { label: 'Signal faible, surveiller', tone: 'watch', explanation: 'La tendance demande plus de preuves avant de mobiliser un post.' };
}

export function enrichTrend(seed: TrendSeed): Trend {
  const opportunityScore = calculateOpportunityScore(seed);
  const stage = calculateTrendStage(seed);
  const verdict = calculateTrendVerdict({ ...seed, opportunityScore, stage });
  const timeWindow: TrendTimeWindow = {
    ...seed.timeWindow,
    urgency: calculateUrgency(seed),
  };

  return {
    ...seed,
    opportunityScore,
    stage,
    verdict,
    timeWindow,
    radar: calculateRadarPosition({ ...seed, opportunityScore, stage }),
  };
}
