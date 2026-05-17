import type { DailyUseMechanics } from './daily-use-mechanics';
import type { TrendIntelligence } from './trend-intelligence-engine';

export interface RetentionSystemsV2 {
  dailyOpportunities: string[];
  repostReminders: string[];
  aiAlerts: string[];
  hookOpportunities: string[];
  trendAlerts: string[];
  creatorInsights: string[];
}

export function retentionSystemsV2(daily: DailyUseMechanics, trends: TrendIntelligence): RetentionSystemsV2 {
  return {
    dailyOpportunities: daily.returningReasons,
    repostReminders: daily.repostReminders,
    aiAlerts: daily.aiAlerts.map((alert) => alert.title),
    hookOpportunities: daily.recommendedHooks,
    trendAlerts: trends.nicheOpportunities,
    creatorInsights: daily.patternDetections,
  };
}
