import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/lib/tiktok-accounts', () => ({
  getTikTokAccountForUser: vi.fn(),
  updateTikTokAccountTokens: vi.fn(),
}));

import {
  fetchTikTokVideos,
  hasCompleteTikTokVideoMetrics,
  normalizeTikTokVideo,
  upsertTikTokVideos,
} from '@/lib/tiktok-sync';

function videoListResponse(params: {
  videos: Array<Record<string, unknown>>;
  cursor?: number;
  hasMore: boolean;
}) {
  return new Response(JSON.stringify({
    data: {
      videos: params.videos,
      cursor: params.cursor,
      has_more: params.hasMore,
    },
    error: { code: 'ok', message: '' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pagination video/list TikTok', () => {
  it('transmet le cursor tant que has_more est vrai', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(videoListResponse({
        videos: [{ id: 'video-1', view_count: 100, like_count: 10, comment_count: 2, share_count: 1 }],
        cursor: 1_720_000_000_000,
        hasMore: true,
      }))
      .mockResolvedValueOnce(videoListResponse({
        videos: [{ id: 'video-2', view_count: 200, like_count: 20, comment_count: 4, share_count: 2 }],
        hasMore: false,
      }));
    vi.stubGlobal('fetch', fetchMock);

    const videos = await fetchTikTokVideos('access-token');

    expect(videos.map((video) => video.id)).toEqual(['video-1', 'video-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ max_count: 20 });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      max_count: 20,
      cursor: 1_720_000_000_000,
    });
  });

  it('accepte zéro comme premier cursor sans le confondre avec une répétition', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(videoListResponse({
        videos: [{ id: 'video-1' }],
        cursor: 0,
        hasMore: true,
      }))
      .mockResolvedValueOnce(videoListResponse({
        videos: [{ id: 'video-2' }],
        hasMore: false,
      }));
    vi.stubGlobal('fetch', fetchMock);

    const videos = await fetchTikTokVideos('access-token');

    expect(videos.map((video) => video.id)).toEqual(['video-1', 'video-2']);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      max_count: 20,
      cursor: 0,
    });
  });

  it('arrête la pagination si TikTok répète ensuite le même cursor', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(videoListResponse({ videos: [{ id: 'video-1' }], cursor: 0, hasMore: true }))
      .mockResolvedValueOnce(videoListResponse({ videos: [{ id: 'video-2' }], cursor: 0, hasMore: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchTikTokVideos('access-token')).rejects.toThrow('curseur absent ou répété');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('interrompt video/list après 12 secondes sans lancer de fallback réseau', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      })
    ));
    vi.stubGlobal('fetch', fetchMock);

    const expectation = expect(fetchTikTokVideos('access-token')).rejects.toMatchObject({
      reason: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(12_000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('métriques TikTok absentes', () => {
  it('ne transforme pas une réponse sans métriques en faux zéros', () => {
    const video = normalizeTikTokVideo({ id: 'video-basic', title: 'Vidéo publique' });

    expect(video).not.toHaveProperty('view_count');
    expect(video).not.toHaveProperty('like_count');
    expect(video).not.toHaveProperty('comment_count');
    expect(video).not.toHaveProperty('share_count');
    expect(video).not.toHaveProperty('engagement_rate');
    expect(hasCompleteTikTokVideoMetrics(video)).toBe(false);
  });

  it('conserve les vrais zéros explicitement renvoyés par TikTok', () => {
    const video = normalizeTikTokVideo({
      id: 'video-zero',
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
    });

    expect(video.view_count).toBe(0);
    expect(video.engagement_rate).toBe(0);
    expect(hasCompleteTikTokVideoMetrics(video)).toBe(true);
  });

  it('n’écrase pas la base avec une vidéo dont les métriques manquent', async () => {
    const complete = normalizeTikTokVideo({
      id: 'video-complete',
      view_count: 100,
      like_count: 10,
      comment_count: 2,
      share_count: 1,
    });
    const incomplete = normalizeTikTokVideo({ id: 'video-incomplete', title: 'Sans métriques' });

    const result = await upsertTikTokVideos({
      userId: 'user-1',
      accountId: 'account-1',
      videos: [complete, incomplete],
    });

    expect(result).toEqual({ inserted: 1, skippedWithoutMetrics: 1 });
    const rows = mocks.upsert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tiktok_video_id).toBe('video-complete');
    expect(rows[0]?.view_count).toBe(100);
    expect(rows.some((row) => row.tiktok_video_id === 'video-incomplete')).toBe(false);
  });
});
