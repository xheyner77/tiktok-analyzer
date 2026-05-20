import type { TrendProviderResult } from '@/lib/trends/providers/types';
import type { RawTrendItem } from '@/lib/trends/types';
import { supabase } from '@/lib/supabase';

interface TikTokVideoRow {
  id: string;
  tiktok_video_id: string;
  title: string | null;
  caption: string | null;
  cover_url: string | null;
  share_url: string | null;
  duration: number | null;
  create_time: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  share_count: number | null;
  synced_at: string;
}

export async function fetchUserTikTokSignals(userId: string): Promise<TrendProviderResult> {
  const { data, error } = await supabase
    .from('tiktok_videos')
    .select('id,tiktok_video_id,title,caption,cover_url,share_url,duration,create_time,view_count,like_count,comment_count,share_count,synced_at')
    .eq('user_id', userId)
    .order('create_time', { ascending: false, nullsFirst: false })
    .limit(50);

  if (error) {
    return { provider: 'tiktok_display', items: [], errors: [error.message] };
  }

  const items: RawTrendItem[] = ((data ?? []) as TikTokVideoRow[]).map((row) => ({
    id: `tiktok_display:${row.id}`,
    provider: 'tiktok_display',
    providerItemId: row.tiktok_video_id,
    sourceUrl: row.share_url,
    country: 'USER',
    language: process.env.TREND_SCAN_LANGUAGE ?? 'fr',
    query: 'user_video',
    sourceType: 'user_video',
    caption: row.caption ?? row.title ?? '',
    hashtags: Array.from((row.caption ?? '').matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1].toLowerCase()),
    soundId: null,
    soundName: null,
    authorId: userId,
    authorUsername: null,
    authorFollowers: null,
    createdAt: row.create_time,
    fetchedAt: row.synced_at,
    metrics: {
      views: Number(row.view_count ?? 0),
      likes: Number(row.like_count ?? 0),
      comments: Number(row.comment_count ?? 0),
      shares: Number(row.share_count ?? 0),
    },
    duration: row.duration,
    coverUrl: row.cover_url,
    rawPayload: { source: 'tiktok_display', id: row.id },
  }));

  return { provider: 'tiktok_display', items, errors: [] };
}
