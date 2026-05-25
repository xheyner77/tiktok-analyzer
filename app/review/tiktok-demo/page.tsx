import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import ReviewTikTokDemoClient, { type ReviewTikTokDemoData } from './ReviewTikTokDemoClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Démo d’intégration TikTok | Viralynz',
  description: 'Page de review TikTok pour démontrer le flux OAuth Viralynz en lecture seule.',
};

type TikTokAccountRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  scopes: string[] | string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  status: string | null;
};

type TikTokVideoRow = {
  id: string;
  tiktok_video_id: string;
  title: string | null;
  caption: string | null;
  cover_url: string | null;
  share_url: string | null;
  create_time: string | null;
  view_count: number | string | null;
  like_count: number | string | null;
  comment_count: number | string | null;
  share_count: number | string | null;
};

function parseScopes(raw: TikTokAccountRow['scopes']): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') return raw.split(/[,\s]+/).filter(Boolean);
  return [];
}

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function getTikTokReviewData(): Promise<ReviewTikTokDemoData> {
  const session = await getSession();
  const base: ReviewTikTokDemoData = {
    isAuthenticated: Boolean(session),
    sessionEmail: session?.email ?? null,
    account: null,
    stats: {
      followers: null,
      following: null,
      totalLikes: null,
      videoCount: null,
    },
    videos: [],
  };

  if (!session) return base;

  const { data: accountRow, error: accountError } = await supabase
    .from('tiktok_accounts')
    .select('id,display_name,avatar_url,username,scopes,connected_at,last_sync_at,status')
    .eq('user_id', session.userId)
    .eq('status', 'active')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accountError) {
    console.warn('[review/tiktok-demo] TikTok account read failed:', accountError.message);
    return base;
  }

  const account = accountRow as TikTokAccountRow | null;
  if (!account) return base;

  const { data: videoRows, error: videosError } = await supabase
    .from('tiktok_videos')
    .select('id,tiktok_video_id,title,caption,cover_url,share_url,create_time,view_count,like_count,comment_count,share_count')
    .eq('user_id', session.userId)
    .eq('tiktok_account_id', account.id)
    .order('create_time', { ascending: false, nullsFirst: false })
    .limit(20);

  if (videosError) {
    console.warn('[review/tiktok-demo] TikTok videos read failed:', videosError.message);
  }

  const username = account.username?.trim() || null;

  return {
    ...base,
    account: {
      id: account.id,
      displayName: account.display_name?.trim() || null,
      avatarUrl: account.avatar_url?.trim() || null,
      username,
      profileLink: username ? `https://www.tiktok.com/@${username}` : null,
      bio: null,
      verified: null,
      connectedAt: account.connected_at,
      lastSyncAt: account.last_sync_at,
      scopes: parseScopes(account.scopes),
    },
    videos: ((videoRows ?? []) as TikTokVideoRow[]).map((video) => ({
      id: video.id,
      tiktokVideoId: video.tiktok_video_id,
      title: video.title?.trim() || video.caption?.trim() || null,
      coverUrl: video.cover_url?.trim() || null,
      shareUrl: video.share_url?.trim() || null,
      publishedAt: video.create_time,
      views: toNumber(video.view_count),
      likes: toNumber(video.like_count),
      comments: toNumber(video.comment_count),
      shares: toNumber(video.share_count),
    })),
  };
}

export default async function TikTokReviewDemoPage() {
  const data = await getTikTokReviewData();
  return <ReviewTikTokDemoClient data={data} />;
}
