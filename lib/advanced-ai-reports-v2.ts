import type { AdvancedReports } from './advanced-reports-engine';
import type { ContentCluster } from './content-cluster-system';
import type { CreatorEvolutionTracking } from './creator-evolution-tracking';

export interface AdvancedAIReportsV2 {
  weeklyRecap: string;
  topHooks: string[];
  repostSuccess: string[];
  audiencePatterns: string[];
  performanceClusters: string[];
  creatorEvolution: string;
  formats: ['dashboard', 'future_export', 'share_cards'];
}

export function advancedAIReportsV2(reports: AdvancedReports, clusters: ContentCluster[], evolution: CreatorEvolutionTracking): AdvancedAIReportsV2 {
  return {
    weeklyRecap: reports.weeklyPerformance,
    topHooks: reports.topHooks,
    repostSuccess: reports.bestReposts,
    audiencePatterns: reports.watchtimeInsights,
    performanceClusters: clusters.map((cluster) => `${cluster.label}: ${cluster.avgScore}/100`),
    creatorEvolution: evolution.summary,
    formats: ['dashboard', 'future_export', 'share_cards'],
  };
}
