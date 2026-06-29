import { describe, expect, it } from 'vitest';
import {
  REQUIRED_TIKTOK_SCOPES,
  formatTikTokScopesForOAuth,
  normalizeTikTokScopeString,
  parseTikTokScopes,
} from '@/lib/tiktok/scopes';
import { getTikTokCapabilities } from '@/lib/tiktok/capabilities';
import { calculateTikTokDashboardMetrics } from '@/lib/tiktok/dashboard-metrics';

describe('TikTok scopes', () => {
  it('normalizes comma and space separated scopes without duplicates', () => {
    expect(parseTikTokScopes('user.info.basic user.info.stats,video.list user.info.basic')).toEqual([
      'user.info.basic',
      'user.info.stats',
      'video.list',
    ]);
  });

  it('formats OAuth scopes with TikTok comma syntax', () => {
    expect(formatTikTokScopesForOAuth(REQUIRED_TIKTOK_SCOPES)).toBe(
      'user.info.basic,user.info.profile,user.info.stats,video.list'
    );
    expect(normalizeTikTokScopeString('user.info.basic video.list')).toBe('user.info.basic,video.list');
  });
});

describe('TikTok capabilities', () => {
  it('detects missing permissions and reconnect need', () => {
    const capabilities = getTikTokCapabilities({
      scopes: ['user.info.basic'],
      environment: 'production',
    });

    expect(capabilities.hasBasicProfile).toBe(true);
    expect(capabilities.hasUserStats).toBe(false);
    expect(capabilities.hasVideoList).toBe(false);
    expect(capabilities.canFetchWatchTime).toBe(false);
    expect(capabilities.needsReconnect).toBe(true);
    expect(capabilities.missingScopes).toEqual(['user.info.profile', 'user.info.stats', 'video.list']);
  });

  it('marks full Display API permissions as usable without watch time', () => {
    const capabilities = getTikTokCapabilities({
      scopes: REQUIRED_TIKTOK_SCOPES,
      environment: 'production',
    });

    expect(capabilities.canFetchProfileStats).toBe(true);
    expect(capabilities.canFetchVideos).toBe(true);
    expect(capabilities.canFetchVideoMetrics).toBe(true);
    expect(capabilities.canFetchWatchTime).toBe(false);
    expect(capabilities.needsReconnect).toBe(false);
  });
});

describe('TikTok dashboard metrics', () => {
  it('calculates real totals from synced TikTok videos', () => {
    const metrics = calculateTikTokDashboardMetrics({
      videos: [
        {
          id: 'v1',
          title: 'Hook 1',
          description: null,
          create_time: '2026-05-30T12:00:00.000Z',
          view_count: 1000,
          like_count: 100,
          comment_count: 20,
          share_count: 30,
          cover_image_url: null,
          cover_url: null,
        },
      ],
      profileStats: { follower_count: 500, likes_count: 900, video_count: 1 },
    });

    expect(metrics.totalViews).toBe(1000);
    expect(metrics.totalEngagements).toBe(150);
    expect(metrics.engagementRate).toBe(15);
    expect(metrics.followers).toBe(500);
    expect(metrics.totalLikes).toBe(900);
    expect(metrics.averageWatchTime).toBeNull();
  });

  it('keeps empty metrics neutral when TikTok has no video data', () => {
    const metrics = calculateTikTokDashboardMetrics({ videos: [] });

    expect(metrics.totalViews).toBeNull();
    expect(metrics.engagementRate).toBeNull();
    expect(metrics.averageWatchTime).toBeNull();
    expect(metrics.topVideos).toEqual([]);
  });
});
