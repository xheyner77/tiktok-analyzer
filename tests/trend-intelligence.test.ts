import { describe, expect, it } from 'vitest';
import type { NormalizedTrendSignal, RawTrendItem, TrendClusterScoringInput } from '@/lib/trends/types';
import { clusterTrendSignals } from '@/lib/trends/cluster';
import { isTrendDemoMode } from '@/lib/trends/config';
import { normalizeTrendItem } from '@/lib/trends/normalize';
import { mapApifyItem } from '@/lib/trends/providers/apify-provider';
import { buildTrendOverview } from '@/lib/trends/recommendations';
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

describe('trend intelligence Apify mapping', () => {
  it('maps variable Apify fields defensively', () => {
    const mapped = mapApifyItem(
      {
        awemeId: '735',
        desc: 'Si tes videos bloquent a 300 vues, regarde ca #business',
        webVideoUrl: 'https://www.tiktok.com/@creator/video/735',
        stats: { playCount: 42000, diggCount: 3500, commentCount: 180, shareCount: 620 },
        authorMeta: { uniqueId: 'creator', followerCount: 12000 },
        musicMeta: { musicName: 'Original sound' },
      },
      { country: 'FR', language: 'fr', query: 'hook viral', sourceType: 'search' },
    );

    expect(mapped.item?.providerItemId).toBe('735');
    expect(mapped.item?.metrics.views).toBe(42000);
    expect(mapped.item?.hashtags).toContain('business');
    expect(mapped.item?.authorUsername).toBe('creator');
    expect(mapped.ignoredReason).toBeUndefined();
  });

  it('returns a clear ignore reason for unusable rows', () => {
    const mapped = mapApifyItem({}, { country: 'FR', language: 'fr', query: 'hook viral', sourceType: 'search' });
    expect(mapped.item).toBeNull();
    expect(mapped.ignoredReason).toBe('missing_provider_item_id');
  });
});

describe('trend intelligence clustering', () => {
  it('groups before_after signals into a cluster with evidence', () => {
    const clusters = clusterTrendSignals([signal(1), signal(2), signal(3), signal(4), signal(5)]);
    expect(clusters[0].patternKey).toBe('before_after');
    expect(clusters[0].sampleSize).toBe(5);
    expect(clusters[0].evidenceItems[0].sourceUrl).toContain('tiktok.com');
    expect(clusters[0].evidenceSummary.medianViews).toBeGreaterThan(0);
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

  it('prevents post_now when confidence is below 55', () => {
    const scores = {
      opportunityScore: 90,
      velocityScore: 90,
      accelerationScore: 85,
      engagementScore: 80,
      shareabilityScore: 80,
      noveltyScore: 82,
      saturationScore: 30,
      riskScore: 20,
      confidenceScore: 54,
      creatorFitScore: 80,
      freshnessScore: 90,
      sampleQualityScore: 45,
      finalScore: 82,
    };
    const stage = calculateTrendStage(scores, 12);
    expect(calculateTrendVerdict(scores, stage, 12, 48)).toBe('watch');
  });

  it('does not promote clusters without valid metrics as top post_now', () => {
    const zeroSignals = [1, 2, 3, 4, 5].map((index) =>
      signal(index, {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagementRate: 0,
        shareRate: 0,
        commentRate: 0,
        viewVelocity: 0,
      }),
    );
    const [cluster] = clusterTrendSignals(zeroSignals);
    const overview = buildTrendOverview({
      clusters: [cluster],
      totalRawItems: zeroSignals.length,
      tiktokConnected: false,
      sourceStatus: {
        status: 'connected',
        label: 'Donnees reelles',
        detail: 'Test',
        provider: 'apify',
        lastScanAt: new Date().toISOString(),
        totalRawItems: zeroSignals.length,
        totalClusters: 1,
        isDemoMode: false,
        canScan: true,
      },
    });

    expect(overview.topOpportunity?.recommendation.verdict).not.toBe('post_now');
  });
});

describe('trend intelligence config', () => {
  it('does not enable demo mode without an explicit public flag', () => {
    const previous = process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE;
    expect(isTrendDemoMode()).toBe(false);
    process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE = 'false';
    expect(isTrendDemoMode()).toBe(false);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE;
    else process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE = previous;
  });
});
