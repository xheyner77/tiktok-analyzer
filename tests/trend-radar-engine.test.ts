import { describe, expect, it } from 'vitest';
import { trendRadarEngine, type TrendOpportunity } from '@/lib/trend-radar-engine';
import type { AnalysisRow } from '@/lib/analyses';
import type { AnalysisResult } from '@/lib/types';
import type { TikTokDashboardState } from '@/lib/tiktok-accounts';

function result(): AnalysisResult {
  return {
    viralityScore: 67,
    hook: { score: 54, rating: 'Moyen', analysis: 'Promesse trop tardive.', strengths: ['Sujet clair'], weaknesses: ['Promesse trop tardive'] },
    editing: { score: 70, rating: 'Bon', analysis: 'Rythme correct.', strengths: [], weaknesses: [] },
    retention: { score: 58, rating: 'Moyen', analysis: 'Payoff tardif.', strengths: [], weaknesses: ['Drop avant preuve'] },
    improvements: [{ priority: 'haute', tip: 'Avancer la preuve.' }],
    coachAnalysis: {
      videoPattern: 'facecam_tiktok',
      patternLabel: 'Business',
      subScores: { hook: 54, retention: 58, clarity: 66, tension: 60, cta: 50, repostPotential: 84, engagementPotential: 62, rewatchPotential: 68 },
      weightedScore: 67,
      verdict: 'Bon sujet à retravailler',
      coachSummary: 'Le sujet est bon mais le hook arrive trop tard.',
      detectedProblems: [{ id: 'slow_hook', severity: 'critique', title: 'Promesse trop tardive', explanation: 'Le contexte arrive avant la tension.', impact: 'Drop probable.', action: 'Ouvrir sur la preuve.' }],
      criticalErrors: [],
      benchmarks: [],
      hookVariants: ["J'ai compris ça trop tard."],
      optimizedCtas: ['A ou B ?'],
      priorityActions: { critical: [], important: [], optimization: [] },
      repostEngine: { recommended: true, estimatedGain: 18, improvementProbability: 76, priorityChanges: ['Avancer la preuve'], scoreBefore: 67, scoreAfter: 84, repostPotentialCeiling: 88 },
    },
  };
}

const tiktok: TikTokDashboardState = {
  accounts: [],
  active: 0,
  limit: 1,
  limitLabel: '1',
  remaining: 1,
  canConnectMore: true,
  totalVideos: 0,
};

describe('trend-radar-engine', () => {
  it('labels fallback opportunities as non-real demo data', () => {
    const radar = trendRadarEngine({ analyses: [], tiktok, plan: 'free' });
    expect(radar.hasPersonalData).toBe(false);
    expect(radar.opportunities).toHaveLength(3);
    expect(radar.opportunities.every((item) => item.source === 'fallback_demo')).toBe(true);
    expect(radar.opportunities.every((item) => item.isRealData === false)).toBe(true);
  });

  it('builds creator-data opportunities from saved analyses', () => {
    const analyses: AnalysisRow[] = [{ id: 'a', user_id: 'u', video_url: 'https://tiktok.com/a', created_at: new Date().toISOString(), result: result() }];
    const radar = trendRadarEngine({ analyses, tiktok, plan: 'pro' });
    expect(radar.hasPersonalData).toBe(true);
    expect(radar.opportunities[0].source).toBe('creator_data');
    expect(radar.opportunities[0].isRealData).toBe(true);
    expect(radar.opportunities[0].evidence.join(' ')).toContain('analyse');
  });

  it('uses tiktok_sync source only when synced videos exist', () => {
    const analyses: AnalysisRow[] = [{ id: 'a', user_id: 'u', video_url: 'https://tiktok.com/a', created_at: new Date().toISOString(), result: result() }];
    const radar = trendRadarEngine({ analyses, tiktok: { ...tiktok, active: 1, totalVideos: 4 }, plan: 'pro' });
    const repost = radar.opportunities.find((item): item is TrendOpportunity => item.type === 'repost');
    expect(repost?.source).toBe('tiktok_sync');
    expect(repost?.evidence.join(' ')).toContain('4 vidéo');
  });

  it('keeps free radar limited without making it useless', () => {
    const analyses: AnalysisRow[] = [{ id: 'a', user_id: 'u', video_url: 'https://tiktok.com/a', created_at: new Date().toISOString(), result: result() }];
    const radar = trendRadarEngine({ analyses, tiktok, plan: 'free' });
    expect(radar.opportunities.length).toBeLessThanOrEqual(3);
    expect(radar.opportunities[0].hookExample).toBeTruthy();
  });
});
