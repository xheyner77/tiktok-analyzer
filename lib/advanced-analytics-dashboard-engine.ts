import type { ContentCluster } from './content-cluster-system';
import type { HookLibraryItem } from './hook-library-engine';
import type { AdvancedAnalytics } from './advanced-analytics-engine';
import type { CreatorEvolutionTracking } from './creator-evolution-tracking';

export interface AdvancedAnalyticsDashboard {
  contentClusters: ContentCluster[];
  hookPerformance: Array<{ hook: string; score: number }>;
  ctaPerformance: number;
  repostSuccess: number;
  retentionPatterns: string[];
  pacingPatterns: string[];
  formatPerformance: Array<{ format: string; score: number }>;
  creatorEvolution: CreatorEvolutionTracking;
}

export function advancedAnalyticsDashboardEngine(
  clusters: ContentCluster[],
  hooks: HookLibraryItem[],
  analytics: AdvancedAnalytics,
  evolution: CreatorEvolutionTracking
): AdvancedAnalyticsDashboard {
  return {
    contentClusters: clusters,
    hookPerformance: hooks.slice(0, 8).map((hook) => ({ hook: hook.hook, score: hook.score })),
    ctaPerformance: analytics.ctaSuccessTracking,
    repostSuccess: analytics.repostSuccessTracking,
    retentionPatterns: analytics.comparisons,
    pacingPatterns: ['Opening court', 'Pattern interrupt', 'Preuve avant contexte'],
    formatPerformance: clusters.map((cluster) => ({ format: cluster.label, score: cluster.avgScore })),
    creatorEvolution: evolution,
  };
}
