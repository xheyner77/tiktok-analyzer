import { supabase } from './supabase';
import { getTikTokAccountForUser, hasVideoListScope } from './tiktok-accounts';

export interface TikTokApiVideo {
  id: string;
  title?: string;
  video_description?: string;
  cover_image_url?: string;
  share_url?: string;
  duration?: number;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

export interface NormalizedTikTokVideo {
  tiktok_video_id: string;
  title: string | null;
  caption: string | null;
  cover_url: string | null;
  share_url: string | null;
  duration: number | null;
  create_time: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  engagement_rate: number;
}

const VIDEO_LIST_FIELDS = [
  'id',
  'title',
  'video_description',
  'cover_image_url',
  'share_url',
  'duration',
  'create_time',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
].join(',');

export async function fetchTikTokVideos(accessToken: string): Promise<TikTokApiVideo[]> {
  const url = `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(VIDEO_LIST_FIELDS)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ max_count: 20 }),
    cache: 'no-store',
  });

  const raw = await res.text();
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Réponse TikTok video/list invalide (${res.status}).`);
  }

  if (!res.ok || json.error?.code) {
    throw new Error(json.error?.message || json.error_description || `TikTok video/list HTTP ${res.status}`);
  }

  return Array.isArray(json.data?.videos) ? json.data.videos : [];
}

export function normalizeTikTokVideo(video: TikTokApiVideo): NormalizedTikTokVideo {
  const views = Math.max(0, Number(video.view_count ?? 0));
  const likes = Math.max(0, Number(video.like_count ?? 0));
  const comments = Math.max(0, Number(video.comment_count ?? 0));
  const shares = Math.max(0, Number(video.share_count ?? 0));
  const engagement = views > 0 ? (likes + comments + shares) / views : 0;

  return {
    tiktok_video_id: String(video.id),
    title: video.title || video.video_description || null,
    caption: video.video_description || video.title || null,
    cover_url: video.cover_image_url || null,
    share_url: video.share_url || null,
    duration: typeof video.duration === 'number' ? video.duration : null,
    create_time: typeof video.create_time === 'number' ? new Date(video.create_time * 1000).toISOString() : null,
    view_count: views,
    like_count: likes,
    comment_count: comments,
    share_count: shares,
    engagement_rate: Number(engagement.toFixed(6)),
  };
}

export async function upsertTikTokVideos(params: {
  userId: string;
  accountId: string;
  videos: NormalizedTikTokVideo[];
}) {
  if (!params.videos.length) return { inserted: 0 };

  const now = new Date().toISOString();
  const rows = params.videos.map((video) => ({
    ...video,
    user_id: params.userId,
    tiktok_account_id: params.accountId,
    synced_at: now,
  }));

  const { error } = await supabase
    .from('tiktok_videos')
    .upsert(rows, { onConflict: 'tiktok_account_id,tiktok_video_id' });

  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

export async function syncTikTokAccountVideos(userId: string, accountId: string) {
  const account = await getTikTokAccountForUser(userId, accountId);
  if (!account) {
    return { ok: false as const, status: 'failed', videosFound: 0, error: 'Compte TikTok introuvable.' };
  }

  const run = await supabase
    .from('tiktok_sync_runs')
    .insert({ user_id: userId, tiktok_account_id: accountId, status: 'running' })
    .select('id')
    .single();

  const runId = run.data?.id as string | undefined;
  const completeRun = async (status: string, videosFound: number, errorMessage?: string) => {
    if (!runId) return;
    await supabase
      .from('tiktok_sync_runs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        videos_found: videosFound,
        error_message: errorMessage ?? null,
      })
      .eq('id', runId);
  };

  if (!hasVideoListScope(account.scopes)) {
    const message = 'Le scope TikTok video.list n’est pas encore accordé à cette app. Sync vidéo indisponible.';
    await completeRun('skipped', 0, message);
    return {
      ok: false as const,
      status: 'skipped',
      videosFound: 0,
      error: message,
      missingScope: 'video.list',
    };
  }

  if (!account.accessToken) {
    const message = 'Token TikTok indisponible ou impossible à déchiffrer.';
    await completeRun('failed', 0, message);
    return { ok: false as const, status: 'failed', videosFound: 0, error: message };
  }

  try {
    const apiVideos = await fetchTikTokVideos(account.accessToken);
    const videos = apiVideos.map(normalizeTikTokVideo).filter((video) => video.tiktok_video_id);
    await upsertTikTokVideos({ userId, accountId, videos });
    await supabase.from('tiktok_accounts').update({ last_sync_at: new Date().toISOString(), status: 'active' }).eq('id', accountId);
    await completeRun('success', videos.length);
    return { ok: true as const, status: 'success', videosFound: videos.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue pendant la sync TikTok.';
    await completeRun('failed', 0, message);
    await supabase.from('tiktok_accounts').update({ status: 'error' }).eq('id', accountId);
    return { ok: false as const, status: 'failed', videosFound: 0, error: message };
  }
}
