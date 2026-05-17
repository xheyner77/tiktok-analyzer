import type { AICoachAdvice } from './ai-content-coach-engine';
import type { VideoDecision } from './video-decision-engine';
import type { TrendIntelligence } from './trend-intelligence-engine';

export interface AIDailyFeedItem {
  id: string;
  title: string;
  body: string;
  type: 'opportunity' | 'insight' | 'warning' | 'trend' | 'experiment';
}

export function aiDailyFeedEngine(coach: AICoachAdvice[], decisions: VideoDecision[], trends: TrendIntelligence): AIDailyFeedItem[] {
  const firstDecision = decisions[0];
  return [
    {
      id: 'feed_repost',
      title: firstDecision?.decision === 'repost_immediat' ? 'Cette video merite un repost' : 'Prochaine action video',
      body: firstDecision?.reason ?? 'Analyse une video pour activer les opportunites.',
      type: 'opportunity',
    },
    ...coach.slice(0, 3).map((item) => ({ id: `feed_${item.id}`, title: item.title, body: item.advice, type: item.level === 'warning' ? 'warning' as const : 'insight' as const })),
    ...trends.nicheOpportunities.slice(0, 2).map((trend, index) => ({ id: `feed_trend_${index}`, title: 'Trend suggestion', body: trend, type: 'trend' as const })),
  ];
}
