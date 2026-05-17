import type { ProductNotification } from './notification-alert-engine';
import type { TrendDetectionItem } from './trend-detection-engine';

export interface DailyUseMechanics {
  returningReasons: string[];
  recommendedHooks: string[];
  aiAlerts: ProductNotification[];
  patternDetections: string[];
  repostReminders: string[];
  trendSuggestions: string[];
}

export function dailyUseMechanics(notifications: ProductNotification[], trends: TrendDetectionItem[], hooks: string[]): DailyUseMechanics {
  return {
    returningReasons: ['Nouvelles opportunites', 'Insight quotidien', 'Hook recommande', 'Rappel repost', 'Trend suggestion'],
    recommendedHooks: hooks.slice(0, 4),
    aiAlerts: notifications,
    patternDetections: trends.map((trend) => trend.title),
    repostReminders: notifications.filter((notification) => notification.type === 'repost_reminder').map((notification) => notification.body),
    trendSuggestions: trends.map((trend) => `${trend.title} (${trend.velocity}/100 velocity)`),
  };
}
