import type { TrendDetectionItem } from './trend-detection-engine';
import type { ContentCluster } from './content-cluster-system';

export interface TrendIntelligence {
  trendingHooks: string[];
  trendingFormats: string[];
  trendingPacing: string[];
  trendingCtas: string[];
  nicheOpportunities: string[];
}

export function trendIntelligenceEngine(trends: TrendDetectionItem[], clusters: ContentCluster[]): TrendIntelligence {
  return {
    trendingHooks: trends.filter((trend) => trend.type === 'hook').map((trend) => trend.title),
    trendingFormats: [...trends.filter((trend) => trend.type === 'format').map((trend) => trend.title), ...clusters.slice(0, 2).map((cluster) => cluster.label)],
    trendingPacing: ['Preuve avant 0:05', 'Opening court', 'Rupture visuelle rapide'],
    trendingCtas: ['Question binaire', 'Mot-cle commentaire', 'Demande de choix A/B'],
    nicheOpportunities: clusters.map((cluster) => `${cluster.label}: renforcer les angles avec watchtime ${cluster.watchtimeSignal}/100.`).slice(0, 4),
  };
}
