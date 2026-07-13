import { supabase } from './supabase';
import { getTikTokAccountForUser, updateTikTokAccountTokens } from './tiktok-accounts';
import {
  fetchTikTokApiResponse,
  fetchTikTokUserInfo,
  getTikTokOAuthSecrets,
  refreshTikTokAccessToken,
  TikTokApiRequestError,
  TikTokTokenRefreshError,
} from './tiktok-oauth';
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
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  engagement_rate?: number;
  raw: Record<string, unknown>;
}

type NormalizedTikTokVideoWithMetrics = NormalizedTikTokVideo & Required<Pick<
  NormalizedTikTokVideo,
  'view_count' | 'like_count' | 'comment_count' | 'share_count' | 'engagement_rate'
>>;

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

const MAX_TIKTOK_VIDEO_LIST_PAGES = 50;

class TikTokVideoPaginationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TikTokVideoPaginationError';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur TikTok inconnue.';
}

function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() ? code : null;
}

const TIKTOK_REFRESH_UNAVAILABLE_MESSAGE =
  'Le renouvellement TikTok est temporairement indisponible. Réessaie dans un instant.';
const TIKTOK_RECONNECT_MESSAGE = 'Reconnecte TikTok pour renouveler les permissions.';

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
  userId: string,
  accountId: string,
  status: string,
  error: string | null = null,
  synced = false
) {
  const update: Record<string, unknown> = {
    sync_status: status,
    sync_error: error,
  };
  if (status === 'expired') update.status = 'expired';
  if (synced) update.last_sync_at = new Date().toISOString();

  try {
    const { data, error: writeError } = await supabase
      .from('tiktok_accounts')
      .update(update)
      .eq('id', accountId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();

    if (writeError) {
      console.warn('[tiktok-sync] account sync state write failed', {
        accountIdPresent: Boolean(accountId),
        code: databaseErrorCode(writeError),
      });
      return { ok: false as const };
    }

    if (!data) {
      console.warn('[tiktok-sync] account sync state skipped for inactive account', {
        accountIdPresent: Boolean(accountId),
      });
      return { ok: false as const, reason: 'account_inactive' };
    }

    return { ok: true as const };
  } catch (writeError) {
    console.warn('[tiktok-sync] account sync state write failed', {
      accountIdPresent: Boolean(accountId),
      code: databaseErrorCode(writeError),
    });
    return { ok: false as const };
  }
}

async function getUsableAccessToken(userId: string, account: TikTokAccountPrivate) {
  if (!account.accessToken) {
    await updateAccountSyncState(userId, account.id, 'expired', 'Connexion TikTok incomplète.');
    return {
      ok: false as const,
      reason: 'missing_token',
      message: TIKTOK_RECONNECT_MESSAGE,
      needsReconnect: true,
    };
  }

  if (isRefreshExpired(account.refreshExpiresAt)) {
    await updateAccountSyncState(userId, account.id, 'expired', 'Refresh token TikTok expiré.');
    return {
      ok: false as const,
      reason: 'refresh_expired',
      message: TIKTOK_RECONNECT_MESSAGE,
      needsReconnect: true,
    };
  }

  if (!isTokenExpired(account.expiresAt)) {
    return { ok: true as const, accessToken: account.accessToken };
  }

  if (!account.refreshToken) {
    await updateAccountSyncState(userId, account.id, 'expired', 'Refresh token TikTok absent.');
    return {
      ok: false as const,
      reason: 'missing_refresh_token',
      message: TIKTOK_RECONNECT_MESSAGE,
      needsReconnect: true,
    };
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    const message = 'La synchronisation TikTok est temporairement indisponible.';
    await updateAccountSyncState(userId, account.id, 'failed', message);
    return {
      ok: false as const,
      reason: 'config',
      message,
      needsReconnect: false,
    };
  }

  try {
    const tokens = await refreshTikTokAccessToken(account.refreshToken, secrets);
    const saved = await updateTikTokAccountTokens({ userId, accountId: account.id, tokens });
    if (!saved.ok) {
      const message = 'Le renouvellement TikTok n’a pas pu être enregistré. Réessaie dans un instant.';
      await updateAccountSyncState(userId, account.id, 'failed', message);
      return {
        ok: false as const,
        reason: 'token_save_failed',
        message,
        needsReconnect: false,
      };
    }

    console.info('[tiktok-sync] token refreshed', {
      accountIdPresent: Boolean(account.id),
      scope: tokens.scope ?? null,
    });
    return { ok: true as const, accessToken: tokens.access_token };
  } catch (error) {
    const needsReconnect = error instanceof TikTokTokenRefreshError && !error.retryable;
    const message = needsReconnect ? TIKTOK_RECONNECT_MESSAGE : TIKTOK_REFRESH_UNAVAILABLE_MESSAGE;
    await updateAccountSyncState(
      userId,
      account.id,
      needsReconnect ? 'expired' : 'failed',
      message
    );
    return {
      ok: false as const,
      reason: needsReconnect ? 'refresh_invalid' : 'refresh_unavailable',
      message,
      needsReconnect,
    };
  }
}

function parseTikTokCursor(value: unknown): number | null {
  const cursor = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;
  return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : null;
}

function parseTikTokVideo(value: unknown): TikTokApiVideo | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  return { ...raw, id: raw.id.trim(), raw } as TikTokApiVideo;
}

async function fetchTikTokVideosWithFields(accessToken: string, fields: string[]): Promise<TikTokApiVideo[]> {
  const url = `https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(fields.join(','))}`;
  const videosById = new Map<string, TikTokApiVideo>();
  const seenCursors = new Set<number>();
  let cursor: number | null = null;

  for (let page = 0; page < MAX_TIKTOK_VIDEO_LIST_PAGES; page += 1) {
    const { response: res, raw } = await fetchTikTokApiResponse(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_count: 20,
        ...(cursor === null ? {} : { cursor }),
      }),
      cache: 'no-store',
    }, {
      operation: 'la synchronisation de la liste des vidéos',
    });
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Réponse TikTok video/list invalide (${res.status}).`);
    }

    const error = json.error as { code?: unknown; message?: unknown } | undefined;
    if (!res.ok || (typeof error?.code === 'string' && error.code !== 'ok')) {
      const code = typeof error?.code === 'string' ? error.code : null;
      throw new Error(
        code
          ? `TikTok video/list refusé (${code}).`
          : `TikTok video/list refusé (HTTP ${res.status}).`
      );
    }

    const data = json.data as { videos?: unknown; cursor?: unknown; has_more?: unknown } | undefined;
    if (Array.isArray(data?.videos)) {
      for (const value of data.videos) {
        const video = parseTikTokVideo(value);
        if (video) videosById.set(video.id, video);
      }
    }

    if (data?.has_more !== true) return [...videosById.values()];

    const nextCursor = parseTikTokCursor(data.cursor);
    if (nextCursor === null || seenCursors.has(nextCursor)) {
      throw new TikTokVideoPaginationError('Pagination TikTok invalide : curseur absent ou répété.');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  console.warn('[tiktok-sync] video list pagination limit reached', {
    pagesFetched: MAX_TIKTOK_VIDEO_LIST_PAGES,
    videosFound: videosById.size,
  });
  throw new TikTokVideoPaginationError(
    'La liste TikTok dépasse la fenêtre de synchronisation sécurisée. Aucun total incomplet n’a été enregistré.'
  );
}

export async function fetchTikTokVideos(accessToken: string): Promise<TikTokApiVideo[]> {
  try {
    return await fetchTikTokVideosWithFields(accessToken, VIDEO_LIST_FIELDS);
  } catch (error) {
    if (error instanceof TikTokApiRequestError || error instanceof TikTokVideoPaginationError) {
      throw error;
    }
    console.warn('[tiktok-sync] video list full fields failed', { error: errorMessage(error) });
    return fetchTikTokVideosWithFields(accessToken, BASIC_VIDEO_LIST_FIELDS);
  }
}

export function normalizeTikTokVideo(video: TikTokApiVideo): NormalizedTikTokVideo {
  const toMetric = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
  );
  const views = toMetric(video.view_count);
  const likes = toMetric(video.like_count);
  const comments = toMetric(video.comment_count);
  const shares = toMetric(video.share_count);
  const hasMetrics = views !== undefined
    && likes !== undefined
    && comments !== undefined
    && shares !== undefined;
  const engagement = hasMetrics && views > 0 ? (likes + comments + shares) / views : 0;
  const description = video.video_description || null;
  const createTime = typeof video.create_time === 'number' && Number.isFinite(video.create_time)
    ? new Date(video.create_time * 1000)
    : null;

  return {
    tiktok_video_id: String(video.id).trim(),
    title: video.title || description || null,
    description,
    caption: description || video.title || null,
    cover_image_url: video.cover_image_url || null,
    cover_url: video.cover_image_url || null,
    share_url: video.share_url || null,
    duration: typeof video.duration === 'number' && Number.isFinite(video.duration) ? video.duration : null,
    create_time: createTime && Number.isFinite(createTime.getTime()) ? createTime.toISOString() : null,
    ...(hasMetrics ? {
      view_count: views,
      like_count: likes,
      comment_count: comments,
      share_count: shares,
      engagement_rate: Number(engagement.toFixed(6)),
    } : {}),
    raw: video.raw ?? {},
  };
}

export function hasCompleteTikTokVideoMetrics(
  video: NormalizedTikTokVideo
): video is NormalizedTikTokVideoWithMetrics {
  return [
    video.view_count,
    video.like_count,
    video.comment_count,
    video.share_count,
    video.engagement_rate,
  ].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export async function upsertTikTokVideos(params: {
  userId: string;
  accountId: string;
  videos: NormalizedTikTokVideo[];
}) {
  if (!params.videos.length) return { inserted: 0, skippedWithoutMetrics: 0 };

  const videosWithMetrics = params.videos.filter(hasCompleteTikTokVideoMetrics);
  const skippedWithoutMetrics = params.videos.length - videosWithMetrics.length;
  if (!videosWithMetrics.length) return { inserted: 0, skippedWithoutMetrics };

  const now = new Date().toISOString();
  const rows = videosWithMetrics.map((video) => ({
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
  return { inserted: rows.length, skippedWithoutMetrics };
}

export async function syncTikTokAccountProfile(userId: string, accountId: string) {
  const account = await getTikTokAccountForUser(userId, accountId);
  if (!account) {
    return { ok: false as const, status: 'failed', error: 'Compte TikTok introuvable.' };
  }

  if (account.status !== 'active') {
    return {
      ok: false as const,
      status: 'skipped',
      reason: 'inactive_account',
      needsReconnect: account.status === 'expired',
    };
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
    return {
      ok: false as const,
      status: 'failed',
      error: token.message,
      reason: token.reason,
      needsReconnect: token.needsReconnect,
    };
  }

  const fields = ['open_id', 'union_id', 'avatar_url', 'display_name'];
  if (capabilities.hasProfile) fields.push('bio_description', 'profile_deep_link', 'is_verified');
  if (capabilities.hasUserStats) fields.push('follower_count', 'following_count', 'likes_count', 'video_count');

  try {
    const profile = await fetchTikTokUserInfo(token.accessToken, fields);
    const now = new Date().toISOString();

    const accountWriteMessage =
      'Le profil TikTok a été lu, mais le compte n’a pas pu être enregistré.';
    let accountWriteError: unknown = null;
    let accountWriteConfirmed = false;
    try {
      const { data, error } = await supabase
        .from('tiktok_accounts')
        .update({
          tiktok_union_id: profile.union_id ?? null,
          display_name: profile.display_name ?? null,
          avatar_url: profile.avatar_url ?? null,
        })
        .eq('id', accountId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select('id')
        .maybeSingle();
      accountWriteError = error;
      accountWriteConfirmed = Boolean(data);
    } catch (error) {
      accountWriteError = error;
    }

    if (accountWriteError || !accountWriteConfirmed) {
      if (accountWriteError) {
        await updateAccountSyncState(userId, accountId, 'failed', accountWriteMessage);
      }
      console.warn('[tiktok-sync] profile account write failed', {
        accountIdPresent: Boolean(accountId),
        code: databaseErrorCode(accountWriteError),
        inactive: !accountWriteError && !accountWriteConfirmed,
      });
      return {
        ok: false as const,
        status: accountWriteError ? 'failed' : 'skipped',
        reason: accountWriteError ? 'account_write_failed' : 'account_inactive',
        error: accountWriteError ? accountWriteMessage : 'Compte TikTok inactif.',
        needsReconnect: false,
      };
    }

    const statsWriteMessage =
      'Le profil TikTok est connecté, mais ses statistiques n’ont pas pu être enregistrées.';
    let statsWriteError: unknown = null;
    try {
      const { error } = await supabase
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
      statsWriteError = error;
    } catch (error) {
      statsWriteError = error;
    }

    if (statsWriteError) {
      await updateAccountSyncState(userId, accountId, 'profile_partial', statsWriteMessage);
      console.warn('[tiktok-sync] profile stats write failed', {
        accountIdPresent: Boolean(accountId),
        code: databaseErrorCode(statsWriteError),
      });
      return {
        ok: false as const,
        status: 'partial',
        reason: 'profile_stats_write_failed',
        error: statsWriteMessage,
        needsReconnect: false,
      };
    }

    const stateWrite = await updateAccountSyncState(
      userId,
      accountId,
      'profile_success',
      null,
      true
    );
    if (!stateWrite.ok) {
      const stateWriteMessage =
        'Le profil TikTok a été enregistré, mais la synchronisation n’a pas pu être confirmée.';
      return {
        ok: false as const,
        status: 'partial',
        reason: 'profile_state_write_failed',
        error: stateWriteMessage,
        needsReconnect: false,
      };
    }

    console.info('[tiktok-sync] profile success', {
      accountIdPresent: Boolean(accountId),
      fields,
      capabilities,
    });
    return { ok: true as const, status: 'success', profile };
  } catch (error) {
    const message = errorMessage(error);
    await updateAccountSyncState(userId, accountId, 'failed', message);
    console.warn('[tiktok-sync] profile failed', { accountIdPresent: Boolean(accountId), error: message });
    return { ok: false as const, status: 'failed', error: message, needsReconnect: false };
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
      .eq('id', runId)
      .eq('user_id', userId);
  };

  const capabilities = getTikTokCapabilities({
    scopes: account.scopes,
    environment: account.environment,
    refreshTokenExpiresAt: account.refreshExpiresAt,
  });
  if (!capabilities.hasVideoList) {
    const message = 'Reconnecte TikTok pour autoriser la liste des vidéos.';
    await completeRun('skipped', 0, message);
    await updateAccountSyncState(userId, accountId, 'skipped', message);
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
    return {
      ok: false as const,
      status: 'failed',
      videosFound: 0,
      error: token.message,
      reason: token.reason,
      needsReconnect: token.needsReconnect,
    };
  }

  try {
    console.info('[tiktok-sync] video list request', {
      accountIdPresent: Boolean(account.id),
      endpoint: 'video/list',
      hasAccessToken: true,
    });
    const apiVideos = await fetchTikTokVideos(token.accessToken);
    const videos = apiVideos.map(normalizeTikTokVideo).filter((video) => video.tiktok_video_id);
    const saved = await upsertTikTokVideos({ userId, accountId, videos });
    const metricsUnavailable = saved.skippedWithoutMetrics > 0;
    const metricsMessage = metricsUnavailable
      ? 'TikTok a renvoyé des vidéos sans toutes leurs métriques. Viralynz n’a enregistré aucun faux zéro.'
      : null;
    await updateAccountSyncState(
      userId,
      accountId,
      metricsUnavailable ? 'videos_without_metrics' : 'videos_success',
      metricsMessage,
      true
    );
    await completeRun(metricsUnavailable ? 'partial' : 'success', videos.length, metricsMessage ?? undefined);
    console.info('[tiktok-sync] success', {
      accountIdPresent: Boolean(account.id),
      videosFound: videos.length,
      videosSaved: saved.inserted,
      videosWithoutMetrics: saved.skippedWithoutMetrics,
    });
    if (metricsUnavailable) {
      return {
        ok: false as const,
        status: 'partial',
        videosFound: videos.length,
        videosSaved: saved.inserted,
        metricsUnavailable: true,
        error: metricsMessage,
      };
    }
    return {
      ok: true as const,
      status: 'success',
      videosFound: videos.length,
      videosSaved: saved.inserted,
      metricsUnavailable: false,
    };
  } catch (error) {
    const message = errorMessage(error);
    await completeRun('failed', 0, message);
    await updateAccountSyncState(userId, accountId, 'failed', message);
    console.warn('[tiktok-sync] failed', {
      accountIdPresent: Boolean(account.id),
      videosFound: 0,
      error: message,
    });
    return {
      ok: false as const,
      status: 'failed',
      videosFound: 0,
      error: message,
      needsReconnect: false,
    };
  }
}
