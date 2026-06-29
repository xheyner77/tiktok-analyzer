import { supabase } from './supabase';
import { getTikTokAccountForUser, updateTikTokAccountTokens } from './tiktok-accounts';
import { getTikTokOAuthSecrets, refreshTikTokAccessToken, fetchTikTokUserInfo } from './tiktok-oauth';
import type { TikTokAccountPrivate } from './tiktok-accounts';
import { getTikTokCapabilities } from './tiktok/capabilities';

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
  raw?: Record<string, unknown>;
}

export interface NormalizedTikTokVideo {
  tiktok_video_id: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  cover_image_url: string | null;
  cover_url: string | null;
  share_url: string | null;
  duration: number | null;
  create_time: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  engagement_rate: number;
  raw: Record<string, unknown>;
}

const VIDEO_LIST_FIELDS = [
  'id',
  'create_time',
  'cover_image_url',
  'share_url',
  'video_description',
  'duration',
  'height',
  'width',
  'title',
  'embed_link',
  'like_count',
  'comment_count',
  'share_count',
  'view_count',
];

const BASIC_VIDEO_LIST_FIELDS = [
  'id',
  'create_time',
  'cover_image_url',
  'share_url',
  'video_description',
  'duration',
  'title',
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur TikTok inconnue.';
}

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + 60_000;
}

function isRefreshExpired(refreshExpiresAt: string | null): boolean {
  if (!refreshExpiresAt) return false;
  const expiresAtMs = new Date(refreshExpiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
}

async function updateAccountSyncState(
  accountId: string,
  status: string,
  error: string | null = null,
  synced = false
) {
  const update: Record<string, unknown> = {
    sync_status: status,
    sync_error: error,
    status: status === 'expired' ? 'expired' : status === 'failed' ? 'error' : 'active',
  };
  if (synced) update.last_sync_at = new Date().toISOString();

  await supabase
    .from('tiktok_accounts')
    .update(update)
    .eq('id', accountId);
}

async function getUsableAccessToken(userId: string, account: TikTokAccountPrivate) {
  if (!account.accessToken) {
    return { ok: false as const, reason: 'missing_token', message: 'Token TikTok indisponible.' };
  }

  if (isRefreshExpired(account.refreshExpiresAt)) {
    await updateAccountSyncState(account.id, 'expired', 'Refresh token TikTok expiré.');
    return { ok: false as const, reason: 'refresh_expired', message: 'Reconnecte TikTok pour renouveler les permissions.' };
  }

  if (!isTokenExpired(account.expiresAt)) {
    return { ok: true as const, accessToken: account.accessToken };
  }

  if (!account.refreshToken) {
    await updateAccountSyncState(account.id, 'expired', 'Refresh token TikTok absent.');
    return { ok: false as const, reason: 'missing_refresh_token', message: 'Reconnecte TikTok pour renouveler les permissions.' };
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    return { ok: false as const, reason: 'config', message: 'Configuration TikTok incomplète.' };
  }

  try {
    const tokens = await refreshTikTokAccessToken(account.refreshToken, secrets);
    const saved = await updateTikTokAccountTokens({ userId, accountId: account.id, tokens });
    if (!saved.ok) {
      return { ok: false as const, reason: 'token_save_failed', message: saved.error ?? 'Sauvegarde token impossible.' };
    }

    console.info('[tiktok-sync] token refreshed', {
      accountIdPresent: Boolean(account.id),
      scope: tokens.scope ?? null,
    });
    return { ok: true as const, accessToken: tokens.access_token };
  } catch (error) {
    const message = errorMessage(error);
    await updateAccountSyncState(account.id, 'expired', message);
    return { ok: false as const, reason: 'refresh_failed', message };
  }
}

async function fetchTikTokVideosWithFields(accessToken: string, fields: string[]): Promise<TikTokApiVideo[]> {
  const url = `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields.join(','))}`;
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
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Réponse TikTok video/list invalide (${res.status}).`);
  }

  const error = json.error as { code?: unknown; message?: unknown } | undefined;
  if (!res.ok || (typeof error?.code === 'string' && error.code !== 'ok')) {
    throw new Error(String(error?.message ?? json.error_description ?? `TikTok video/list HTTP ${res.status}`));
  }

  const data = json.data as { videos?: unknown } | undefined;
  return Array.isArray(data?.videos)
    ? data.videos.map((video) => ({ ...(video as Record<string, unknown>), raw: video as Record<string, unknown> } as TikTokApiVideo))
    : [];
}

export async function fetchTikTokVideos(accessToken: string): Promise<TikTokApiVideo[]> {
  try {
    return await fetchTikTokVideosWithFields(accessToken, VIDEO_LIST_FIELDS);
  } catch (error) {
    console.warn('[tiktok-sync] video list full fields failed', { error: errorMessage(error) });
    return fetchTikTokVideosWithFields(accessToken, BASIC_VIDEO_LIST_FIELDS);
  }
}

export function normalizeTikTokVideo(video: TikTokApiVideo): NormalizedTikTokVideo {
  const views = Math.max(0, Number(video.view_count ?? 0));
  const likes = Math.max(0, Number(video.like_count ?? 0));
  const comments = Math.max(0, Number(video.comment_count ?? 0));
  const shares = Math.max(0, Number(video.share_count ?? 0));
  const engagement = views > 0 ? (likes + comments + shares) / views : 0;
  const description = video.video_description || null;

  return {
    tiktok_video_id: String(video.id),
    title: video.title || description || null,
    description,
    caption: description || video.title || null,
    cover_image_url: video.cover_image_url || null,
    cover_url: video.cover_image_url || null,
    share_url: video.share_url || null,
    duration: typeof video.duration === 'number' ? video.duration : null,
    create_time: typeof video.create_time === 'number' ? new Date(video.create_time * 1000).toISOString() : null,
    view_count: views,
    like_count: likes,
    comment_count: comments,
    share_count: shares,
    engagement_rate: Number(engagement.toFixed(6)),
    raw: video.raw ?? {},
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
    fetched_at: now,
  }));

  const { error } = await supabase
    .from('tiktok_videos')
    .upsert(rows, { onConflict: 'user_id,tiktok_video_id' });

  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

export async function syncTikTokAccountProfile(userId: string, accountId: string) {
  const account = await getTikTokAccountForUser(userId, accountId);
  if (!account) {
    return { ok: false as const, status: 'failed', error: 'Compte TikTok introuvable.' };
  }

  const capabilities = getTikTokCapabilities({
    scopes: account.scopes,
    environment: account.environment,
    refreshTokenExpiresAt: account.refreshExpiresAt,
  });
  if (!capabilities.hasBasicProfile) {
    return {
      ok: false as const,
      status: 'skipped',
      reason: 'missing_scope',
      missingScopes: ['user.info.basic'],
      needsReconnect: true,
    };
  }

  const token = await getUsableAccessToken(userId, account);
  if (!token.ok) {
    return { ok: false as const, status: 'failed', error: token.message, needsReconnect: true };
  }

  const fields = ['open_id', 'union_id', 'avatar_url', 'display_name'];
  if (capabilities.hasProfile) fields.push('bio_description', 'profile_deep_link', 'is_verified');
  if (capabilities.hasUserStats) fields.push('follower_count', 'following_count', 'likes_count', 'video_count');

  try {
    const profile = await fetchTikTokUserInfo(token.accessToken, fields);
    const now = new Date().toISOString();

    await supabase
      .from('tiktok_accounts')
      .update({
        tiktok_union_id: profile.union_id ?? null,
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        last_sync_at: now,
        sync_status: 'profile_success',
        sync_error: null,
        status: 'active',
      })
      .eq('id', accountId)
      .eq('user_id', userId);

    await supabase
      .from('tiktok_profile_stats')
      .upsert({
        user_id: userId,
        tiktok_account_id: accountId,
        follower_count: profile.follower_count ?? null,
        following_count: profile.following_count ?? null,
        likes_count: profile.likes_count ?? null,
        video_count: profile.video_count ?? null,
        bio_description: profile.bio_description ?? null,
        profile_deep_link: profile.profile_deep_link ?? null,
        is_verified: profile.is_verified ?? null,
        fetched_at: now,
        raw: profile,
      }, { onConflict: 'user_id,tiktok_account_id' });

    console.info('[tiktok-sync] profile success', {
      accountIdPresent: Boolean(accountId),
      fields,
      capabilities,
    });
    return { ok: true as const, status: 'success', profile };
  } catch (error) {
    const message = errorMessage(error);
    await updateAccountSyncState(accountId, 'failed', message);
    console.warn('[tiktok-sync] profile failed', { accountIdPresent: Boolean(accountId), error: message });
    return { ok: false as const, status: 'failed', error: message };
  }
}

export async function syncTikTokAccountVideos(userId: string, accountId: string) {
  console.info('[tiktok-sync] start', {
    userIdPresent: Boolean(userId),
    accountIdPresent: Boolean(accountId),
  });

  const account = await getTikTokAccountForUser(userId, accountId);
  if (!account) {
    console.warn('[tiktok-sync] account missing', { accountIdPresent: Boolean(accountId) });
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

  const capabilities = getTikTokCapabilities({
    scopes: account.scopes,
    environment: account.environment,
    refreshTokenExpiresAt: account.refreshExpiresAt,
  });
  if (!capabilities.hasVideoList) {
    const message = 'Reconnecte TikTok pour autoriser la liste des vidéos.';
    await completeRun('skipped', 0, message);
    await updateAccountSyncState(accountId, 'skipped', message);
    console.info('[tiktok-sync] skipped', {
      accountIdPresent: Boolean(account.id),
      scopes: account.scopes,
      missingScope: 'video.list',
    });
    return {
      ok: false as const,
      status: 'skipped',
      videosFound: 0,
      error: message,
      reason: 'missing_scope',
      missingScopes: ['video.list'],
      needsReconnect: true,
    };
  }

  const token = await getUsableAccessToken(userId, account);
  if (!token.ok) {
    await completeRun('failed', 0, token.message);
    return { ok: false as const, status: 'failed', videosFound: 0, error: token.message, needsReconnect: true };
  }

  try {
    console.info('[tiktok-sync] video list request', {
      accountIdPresent: Boolean(account.id),
      endpoint: 'video/list',
      hasAccessToken: true,
    });
    const apiVideos = await fetchTikTokVideos(token.accessToken);
    const videos = apiVideos.map(normalizeTikTokVideo).filter((video) => video.tiktok_video_id);
    await upsertTikTokVideos({ userId, accountId, videos });
    await updateAccountSyncState(accountId, 'videos_success', null, true);
    await completeRun('success', videos.length);
    console.info('[tiktok-sync] success', {
      accountIdPresent: Boolean(account.id),
      videosFound: videos.length,
      videosSaved: videos.length,
    });
    return { ok: true as const, status: 'success', videosFound: videos.length };
  } catch (error) {
    const message = errorMessage(error);
    await completeRun('failed', 0, message);
    await updateAccountSyncState(accountId, 'failed', message);
    console.warn('[tiktok-sync] failed', {
      accountIdPresent: Boolean(account.id),
      videosFound: 0,
      error: message,
    });
    return { ok: false as const, status: 'failed', videosFound: 0, error: message };
  }
}
