import type { RetentionSystemsV2 } from './retention-systems-v2';
import type { AIDailyFeedItem } from './ai-daily-feed-engine';

export interface DailyRetentionSystems {
  opportunities: string[];
  reminders: string[];
  aiAlerts: string[];
  trendUpdates: string[];
  repostPriorities: string[];
  creatorInsights: string[];
  strategyRecommendations: string[];
}

export function dailyRetentionSystems(retention: RetentionSystemsV2, feed: AIDailyFeedItem[]): DailyRetentionSystems {
  return {
    opportunities: feed.filter((item) => item.type === 'opportunity').map((item) => item.body),
    reminders: retention.repostReminders,
    aiAlerts: retention.aiAlerts,
    trendUpdates: retention.trendAlerts,
    repostPriorities: retention.repostReminders,
    creatorInsights: retention.creatorInsights,
    strategyRecommendations: feed.filter((item) => item.type === 'insight').map((item) => item.body),
  };
}
