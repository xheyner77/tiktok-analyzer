import type { TrendActionIdea, TrendCluster, TrendOverview, TrendSourceStatus } from '@/lib/trends/types';
import { formatRelativeTime } from '@/lib/trends/formatters';

export function buildMarketSummary(clusters: TrendCluster[], sourceStatus: TrendSourceStatus): string {
  if (sourceStatus.status === 'not_configured') {
    return 'Source non connectee : ajoute Apify pour transformer le radar en detection reelle.';
  }
  if (clusters.length === 0) {
    return 'Aucun signal exploitable dans le cache. Lance un scan pour collecter des videos publiques.';
  }
  const top = clusters[0];
  const postNowCount = clusters.filter((cluster) => cluster.recommendation.verdict === 'post_now').length;
  const saturatedCount = clusters.filter((cluster) => cluster.recommendation.verdict === 'avoid' || cluster.recommendation.verdict === 'twist_it').length;
  return `${top.title} domine le scan avec ${top.sampleSize} videos publiques. ${postNowCount} signal${postNowCount > 1 ? 's' : ''} exploitable${postNowCount > 1 ? 's' : ''}, ${saturatedCount} pattern${saturatedCount > 1 ? 's' : ''} a detourner ou eviter.`;
}

export function buildPlan24h(clusters: TrendCluster[]): TrendActionIdea[] {
  return clusters
    .filter((cluster) => ['post_now', 'good_potential', 'twist_it'].includes(cluster.recommendation.verdict))
    .slice(0, 3)
    .map((cluster) => ({
      clusterId: cluster.id,
      title: cluster.title,
      hook: cluster.recommendation.recommendedHook,
      format: cluster.recommendation.recommendedFormat,
      duration: cluster.recommendation.recommendedFormat.includes('Carrousel') ? '5 slides' : '18-28 sec',
      cta: 'Sauvegarde avant ton prochain post.',
      objective: cluster.recommendation.verdict === 'twist_it' ? 'Detailler sans copier' : 'Publier avant saturation',
      effort: cluster.patternKey === 'mini_case_study' ? 'medium' : 'low',
    }));
}

export function buildTrendOverview(params: {
  clusters: TrendCluster[];
  sourceStatus: TrendSourceStatus;
  totalRawItems: number;
  tiktokConnected: boolean;
}): TrendOverview {
  const sorted = params.clusters.slice().sort((a, b) => b.scores.finalScore - a.scores.finalScore);
  const lastScanAt = params.sourceStatus.lastScanAt;
  return {
    lastScanAt,
    sourceStatus: params.sourceStatus,
    totalRawItems: params.totalRawItems,
    totalClusters: params.clusters.length,
    totalCreators: new Set(params.clusters.flatMap((cluster) => cluster.evidenceItems.map((item) => item.authorUsername).filter(Boolean))).size,
    topOpportunity: sorted.find((cluster) => cluster.recommendation.verdict === 'post_now') ?? sorted[0] ?? null,
    twistTrend: sorted.find((cluster) => cluster.recommendation.verdict === 'twist_it') ?? null,
    avoidTrend: sorted.find((cluster) => cluster.recommendation.verdict === 'avoid') ?? null,
    marketSummary: buildMarketSummary(sorted, params.sourceStatus),
    freshnessLabel: formatRelativeTime(lastScanAt),
    scanConfidence: sorted.length > 0 ? Math.round(sorted.reduce((sum, cluster) => sum + cluster.scores.confidenceScore, 0) / sorted.length) : 0,
    clusters: sorted.slice(0, 10),
    plan24h: buildPlan24h(sorted),
    tiktokConnected: params.tiktokConnected,
  };
}
