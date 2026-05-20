import { describe, expect, it } from 'vitest';
import type { NormalizedTrendSignal, RawTrendItem, TrendClusterScoringInput } from '@/lib/trends/types';
import { clusterTrendSignals } from '@/lib/trends/cluster';
import { normalizeTrendItem } from '@/lib/trends/normalize';
import { calculateTrendScores, calculateTrendStage, calculateTrendVerdict, estimateWindowHours } from '@/lib/trends/scoring';

function raw(overrides: Partial<RawTrendItem> = {}): RawTrendItem {
  return {
    id: 'raw-1',
    provider: 'demo',
    providerItemId: 'video-1',
    sourceUrl: 'https://www.tiktok.com/@demo/video/1',
    country: 'FR',
    language: 'fr',
    query: 'avant apres',
    sourceType: 'search',
    caption: "Avant / apres : j'ai coupe cette intro et les vues ont change #business",
    hashtags: ['business'],
    soundId: null,
    soundName: null,
    authorId: 'creator-1',
    authorUsername: 'demo',
    authorFollowers: 1000,
    createdAt: '2026-05-20T08:00:00.000Z',
    fetchedAt: '2026-05-20T10:00:00.000Z',
    metrics: { views: 10000, likes: 900, comments: 90, shares: 500 },
    duration: 22,
    rawPayload: {},
    ...overrides,
  };
}

function signal(index: number, overrides: Partial<NormalizedTrendSignal> = {}): NormalizedTrendSignal {
  const normalized = normalizeTrendItem(
    raw({
      id: `raw-${index}`,
      providerItemId: `video-${index}`,
      authorId: `creator-${index}`,
      createdAt: new Date(Date.UTC(2026, 4, 20, 10 - index)).toISOString(),
      metrics: { views: 8000 + index * 1200, likes: 700, comments: 80, shares: 420 },
    }),
    new Date('2026-05-20T10:00:00.000Z'),
  );
  return { ...normalized, ...overrides };
}

describe('trend intelligence normalize', () => {
  it('detects before_after and calculates engagement and velocity', () => {
    const normalized = normalizeTrendItem(raw(), new Date('2026-05-20T10:00:00.000Z'));
    expect(normalized.detectedPattern).toBe('before_after');
    expect(normalized.engagementRate).toBeCloseTo(0.149);
    expect(normalized.viewVelocity).toBe(5000);
  });
});

describe('trend intelligence clustering', () => {
  it('groups before_after signals into a cluster with evidence', () => {
    const clusters = clusterTrendSignals([signal(1), signal(2), signal(3), signal(4), signal(5)]);
    expect(clusters[0].patternKey).toBe('before_after');
    expect(clusters[0].sampleSize).toBe(5);
    expect(clusters[0].evidenceItems[0].sourceUrl).toContain('tiktok.com');
  });
});

describe('trend intelligence scoring', () => {
  it('caps final score when confidence is weak', () => {
    const signals = [signal(1)];
    const input: TrendClusterScoringInput = {
      signals,
      allSignals: signals,
      firstSeenAt: signals[0].postedAt ?? signals[0].fetchedAt,
      lastSeenAt: signals[0].fetchedAt,
    };
    const scores = calculateTrendScores(input);
    expect(scores.finalScore).toBeLessThanOrEqual(69);
    const stage = calculateTrendStage(scores, signals.length);
    const verdict = calculateTrendVerdict(scores, stage, signals.length, estimateWindowHours(scores, stage));
    expect(verdict).not.toBe('post_now');
  });

  it('returns avoid for very saturated high-risk clusters', () => {
    const scores = {
      opportunityScore: 48,
      velocityScore: 40,
      accelerationScore: 35,
      engagementScore: 30,
      shareabilityScore: 25,
      noveltyScore: 20,
      saturationScore: 92,
      riskScore: 84,
      confidenceScore: 80,
      creatorFitScore: 60,
      freshnessScore: 35,
      sampleQualityScore: 90,
      finalScore: 39,
    };
    const stage = calculateTrendStage(scores, 50);
    expect(calculateTrendVerdict(scores, stage, 50, 12)).toBe('avoid');
  });
});
