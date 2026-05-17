import { describe, expect, it } from 'vitest';
import {
  addRepostResult,
  buildGrowthLoopState,
  createRepostDraft,
  markRepostPublished,
  markRepostReady,
  selectHookForRepost,
} from '@/lib/growth-loop-engine';
import type { AnalysisRow } from '@/lib/analyses';
import type { TikTokDashboardState } from '@/lib/tiktok-accounts';
import type { TrendOpportunity } from '@/lib/trend-radar-engine';
import type { AnalysisResult } from '@/lib/types';

const emptyTikTok: TikTokDashboardState = {
  accounts: [],
  active: 0,
  limit: 1,
  limitLabel: '1',
  remaining: 1,
  canConnectMore: true,
  totalVideos: 0,
};

function analysis(): AnalysisRow {
  const result: AnalysisResult = {
    viralityScore: 64,
    hook: { score: 52, rating: 'Moyen', analysis: 'Hook lent.', strengths: [], weaknesses: ['Promesse trop tardive'] },
    editing: { score: 70, rating: 'Bon', analysis: 'OK.', strengths: [], weaknesses: [] },
    retention: { score: 60, rating: 'Moyen', analysis: 'Drop.', strengths: [], weaknesses: ['Payoff tardif'] },
    improvements: [{ priority: 'haute', tip: 'Avancer la preuve.' }],
    repostVersion: { hook: 'STOP cette erreur', structure: ['Hook', 'Preuve'], onScreenText: ['Erreur'], cta: 'A ou B ?', angle: 'Direct' },
  };
  return { id: 'video_1', user_id: 'user_1', video_url: 'https://tiktok.com/@x/video/1', created_at: new Date().toISOString(), result };
}

const trend: TrendOpportunity = {
  id: 'trend_1',
  title: 'Hook erreur personnelle',
  type: 'hook',
  source: 'creator_data',
  momentum: 'up',
  opportunityScore: 88,
  fitScore: 82,
  confidence: 'moyenne',
  nicheFit: ['Business'],
  whyItWorks: 'Tension immédiate.',
  howToUse: 'Ouvrir sur une erreur vécue.',
  hookExample: "J'ai compris ça trop tard.",
  onScreenTextExample: 'Erreur 30 jours',
  repostAction: 'Tester sur une vidéo business.',
  risk: 'Preuve nécessaire.',
  evidence: ['Analyse Viralynz'],
  signalsUsed: ['analyses_saved'],
  isRealData: true,
};

describe('growth-loop-engine', () => {
  it('returns connect TikTok as next best action without data', () => {
    const state = buildGrowthLoopState({ analyses: [], tiktok: emptyTikTok, trends: [], hooksGenerated: 0 });
    expect(state.nextBestAction.id).toBe('connect_tiktok');
    expect(state.hasFakeAnalytics).toBe(false);
  });

  it('prioritizes a weak analyzed video into a hook task', () => {
    const state = buildGrowthLoopState({ analyses: [analysis()], tiktok: { ...emptyTikTok, active: 1, canConnectMore: false }, trends: [] });
    expect(state.nextBestAction.relatedVideoId).toBe('video_1');
    expect(state.nextBestAction.actionLabel).toContain('Hook');
    expect(state.repostTasks[0].status).toBe('repost_plan_ready');
  });

  it('can use a trend as an action source', () => {
    const state = buildGrowthLoopState({ analyses: [], tiktok: { ...emptyTikTok, active: 1, canConnectMore: false }, trends: [trend] });
    expect(state.opportunities.map((item) => item.source)).toContain('trend_radar');
    expect(state.trendTasks[0].trendId).toBe('trend_1');
  });

  it('tracks repost workflow transitions and manual results', () => {
    const draft = createRepostDraft('video_1');
    const selected = selectHookForRepost(draft, 'STOP cette erreur');
    const ready = markRepostReady(selected);
    const published = markRepostPublished(ready, 'https://tiktok.com/@x/video/2');
    const recorded = addRepostResult(published, { source: 'manual', views: 1000, likes: 100, comments: 12, shares: 4 });
    expect(recorded.status).toBe('result_recorded');
    expect(recorded.result?.source).toBe('manual');
  });
});
