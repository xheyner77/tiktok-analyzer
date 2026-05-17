import type { RepostPriorityInput } from './repost-priority-engine';
import type { CreatorProfile } from './creator-profile-engine';
import type { AdvancedAnalytics } from './advanced-analytics-engine';

export interface AdvancedReports {
  weeklyPerformance: string;
  topHooks: string[];
  bestReposts: string[];
  recurringErrors: string[];
  watchtimeInsights: string[];
  creatorProgression: string;
  exportReadiness: {
    pdfFuture: boolean;
    shareCards: string[];
    summaryCards: string[];
  };
}

export function advancedReportsEngine(items: RepostPriorityInput[], profile: CreatorProfile, analytics: AdvancedAnalytics): AdvancedReports {
  return {
    weeklyPerformance: items.length ? `${items.length} videos analysees. Score engagement moyen ${analytics.engagementTrend}/100.` : 'Rapport hebdo en attente de donnees.',
    topHooks: profile.bestHooks.slice(0, 5),
    bestReposts: items.filter((item) => item.result.coachAnalysis?.repostEngine.recommended).slice(0, 3).map((item) => item.result.coachAnalysis?.verdict ?? 'Repost recommande'),
    recurringErrors: profile.recurringErrors,
    watchtimeInsights: [
      `Watchtime trend: ${analytics.watchtimeTrend}/100.`,
      profile.bestRhythms[0] ?? 'Avancer le payoff avant 0:05.',
    ],
    creatorProgression: profile.memory.level,
    exportReadiness: {
      pdfFuture: true,
      shareCards: ['weekly_summary_card', 'top_hooks_card', 'repost_pipeline_card'],
      summaryCards: ['performance', 'memory', 'next_actions'],
    },
  };
}
