import { getEffectivePlan, getUserById } from './auth';
import { supabase } from './supabase';
import { protectTikTokToken, revealTikTokToken } from './tiktok-crypto';
import { canConnectTikTokAccount, formatTikTokAccountLimit, getTikTokAccountLimitForPlan } from './tiktok-account-limits';
import type { TikTokTokenResponse, TikTokUserInfoBasic } from './tiktok-oauth';
import {
  getConfiguredTikTokEnvironment,
  getTikTokCapabilities,
  type TikTokCapabilities,
  type TikTokEnvironment,
} from './tiktok/capabilities';
import { parseTikTokScopes } from './tiktok/scopes';

export interface TikTokAccountSafe {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
  scopes: string[];
  connectedAt: string;
  lastSyncAt: string | null;
  status: string;
  syncStatus: string | null;
  syncError: string | null;
  canSyncVideos: boolean;
  environment: TikTokEnvironment;
  capabilities: TikTokCapabilities;
  needsReconnect: boolean;
}

export interface TikTokDashboardAccount extends TikTokAccountSafe {
  videosCount: number;
  latestVideoAt: string | null;
}

export interface TikTokDashboardState {
  accounts: TikTokDashboardAccount[];
  active: number;
  limit: number | null;
  limitLabel: string;
  remaining: number | null;
  canConnectMore: boolean;
  totalVideos: number;
}

export interface TikTokAccountPrivate extends TikTokAccountSafe {
  userId: string;
  openId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
}

export function hasVideoListScope(scopes: string[]): boolean {
  return scopes.includes('video.list') || scopes.includes('video.list.basic');
}

type TikTokAccountRow = {
  id: string;
  user_id: string;
  tiktok_open_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  scopes: unknown;
  connected_at: string;
  last_sync_at: string | null;
  status: string | null;
  sync_status?: string | null;
  sync_error?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  refresh_expires_at?: string | null;
  environment?: string | null;
};

function toSafeAccount(row: TikTokAccountRow): TikTokAccountSafe {
  const scopes = parseTikTokScopes(row.scopes);
  const capabilities = getTikTokCapabilities({
    scopes,
    environment: row.environment,
    refreshTokenExpiresAt: row.refresh_expires_at ?? null,
  });
  return {
    id: row.id,
    displayName: row.display_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    username: row.username ?? null,
    scopes,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at ?? null,
    status: row.status ?? 'active',
    syncStatus: row.sync_status ?? null,
    syncError: row.sync_error ?? null,
    canSyncVideos: hasVideoListScope(scopes),
    environment: capabilities.environment,
    capabilities,
    needsReconnect: capabilities.needsReconnect,
  };
}

function toPrivateAccount(row: TikTokAccountRow): TikTokAccountPrivate {
  const safe = toSafeAccount(row);
  return {
    ...safe,
    userId: row.user_id,
    openId: row.tiktok_open_id,
    accessToken: revealTikTokToken(row.access_token),
    refreshToken: revealTikTokToken(row.refresh_token),
    expiresAt: row.expires_at ?? null,
    refreshExpiresAt: row.refresh_expires_at ?? null,
  };
}

export async function listTikTokAccountsForUser(userId: string): Promise<TikTokAccountSafe[]> {
  const { data, error } = await supabase
    .from('tiktok_accounts')
    .select('id,user_id,tiktok_open_id,display_name,avatar_url,username,scopes,connected_at,last_sync_at,status,sync_status,sync_error,environment,refresh_expires_at')
    .eq('user_id', userId)
    .order('connected_at', { ascending: false });

  if (error) {
    console.warn('[tiktok-accounts] list failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => toSafeAccount(row as TikTokAccountRow));
}

export async function getTikTokDashboardState(userId: string, plan: string): Promise<TikTokDashboardState> {
  const accounts = await listTikTokAccountsForUser(userId);
  const accountsWithVideos = await Promise.all(accounts.map(async (account) => {
    const { count, error } = await supabase
      .from('tiktok_videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tiktok_account_id', account.id);

    if (error) {
      console.warn('[tiktok-accounts] video count failed:', error.message);
    }

    const { data: latest } = await supabase
      .from('tiktok_videos')
      .select('create_time,synced_at')
      .eq('user_id', userId)
      .eq('tiktok_account_id', account.id)
      .order('create_time', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    return {
      ...account,
      videosCount: count ?? 0,
      latestVideoAt: (latest?.create_time as string | null | undefined) ?? (latest?.synced_at as string | null | undefined) ?? null,
    };
  }));

  const limit = getTikTokAccountLimitForPlan(plan);
  const active = accountsWithVideos.filter((account) => account.status === 'active').length;
  const finiteLimit = Number.isFinite(limit) ? limit : null;
  const remaining = finiteLimit === null ? null : Math.max(0, finiteLimit - active);

  return {
    accounts: accountsWithVideos,
    active,
    limit: finiteLimit,
    limitLabel: formatTikTokAccountLimit(limit),
    remaining,
    canConnectMore: finiteLimit === null || active < finiteLimit,
    totalVideos: accountsWithVideos.reduce((sum, account) => sum + account.videosCount, 0),
  };
}

export async function getTikTokAccountForUser(userId: string, accountId: string): Promise<TikTokAccountPrivate | null> {
  const { data, error } = await supabase
    .from('tiktok_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return toPrivateAccount(data as TikTokAccountRow);
}

export async function listActiveTikTokPrivateAccountsForUser(userId: string): Promise<TikTokAccountPrivate[]> {
  const { data, error } = await supabase
    .from('tiktok_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.warn('[tiktok-accounts] private list failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => toPrivateAccount(row as TikTokAccountRow));
}

export async function upsertTikTokAccountForUser(params: {
  userId: string;
  profile: TikTokUserInfoBasic;
  tokens: TikTokTokenResponse;
}) {
  const user = await getUserById(params.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  const eligibility = await canConnectTikTokAccount(params.userId, plan, {
    excludingOpenId: params.profile.open_id,
  });

  if (!eligibility.allowed) {
    return {
      ok: false as const,
      code: 'limit_reached',
      message: `Limite TikTok atteinte pour ton plan (${formatTikTokAccountLimit(eligibility.limit)} compte${eligibility.limit > 1 ? 's' : ''}).`,
      limit: eligibility.limit,
      current: eligibility.current,
    };
  }

  const scopes = parseTikTokScopes(params.tokens.scope);
  const expiresAt = new Date(Date.now() + Math.max(60, params.tokens.expires_in) * 1000).toISOString();
  const refreshExpiresAt = params.tokens.refresh_expires_in
    ? new Date(Date.now() + Math.max(60, params.tokens.refresh_expires_in) * 1000).toISOString()
    : null;
  let accessToken: string | null;
  let refreshToken: string | null;

  try {
    accessToken = protectTikTokToken(params.tokens.access_token);
    refreshToken = protectTikTokToken(params.tokens.refresh_token);
  } catch (error) {
    return {
      ok: false as const,
      code: 'token_encryption_failed',
      message: error instanceof Error ? error.message : 'TikTok token encryption failed.',
    };
  }

  const row = {
    user_id: params.userId,
    tiktok_open_id: params.profile.open_id,
    tiktok_union_id: params.profile.union_id ?? null,
    display_name: params.profile.display_name ?? null,
    avatar_url: params.profile.avatar_url ?? null,
    username: null,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    scopes,
    environment: getConfiguredTikTokEnvironment(),
    connected_at: new Date().toISOString(),
    last_sync_at: null,
    sync_status: 'connected',
    sync_error: null,
    status: 'active',
  };

  const { data, error } = await supabase
    .from('tiktok_accounts')
    .upsert(row, { onConflict: 'user_id,tiktok_open_id' })
    .select('id')
    .single();

  if (error) {
    return { ok: false as const, code: 'db_error', message: error.message };
  }

  await supabase
    .from('users')
    .update({
      tiktok_open_id: params.profile.open_id,
      tiktok_union_id: params.profile.union_id ?? null,
      tiktok_display_name: params.profile.display_name ?? null,
      tiktok_avatar_url: params.profile.avatar_url ?? null,
      // Legacy columns stay for compatibility but must not contain raw OAuth tokens.
      tiktok_access_token: null,
      tiktok_refresh_token: null,
      tiktok_token_expires_at: null,
      tiktok_connected_at: new Date().toISOString(),
    })
    .eq('id', params.userId);

  return { ok: true as const, accountId: data.id as string, scopes };
}

export async function disconnectTikTokAccount(userId: string, accountId: string) {
  const { error } = await supabase
    .from('tiktok_accounts')
    .update({ status: 'revoked', access_token: '', refresh_token: null })
    .eq('id', accountId)
    .eq('user_id', userId);

  return { ok: !error, error: error?.message };
}

export async function updateTikTokAccountTokens(params: {
  userId: string;
  accountId: string;
  tokens: TikTokTokenResponse;
}) {
  let accessToken: string | null;
  let refreshToken: string | null;

  try {
    accessToken = protectTikTokToken(params.tokens.access_token);
    refreshToken = protectTikTokToken(params.tokens.refresh_token);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'TikTok token encryption failed.',
    };
  }

  const expiresAt = new Date(Date.now() + Math.max(60, params.tokens.expires_in) * 1000).toISOString();
  const refreshExpiresAt = params.tokens.refresh_expires_in
    ? new Date(Date.now() + Math.max(60, params.tokens.refresh_expires_in) * 1000).toISOString()
    : null;
  const update: Record<string, unknown> = {
    access_token: accessToken,
    expires_at: expiresAt,
    status: 'active',
    sync_error: null,
  };

  if (refreshToken) update.refresh_token = refreshToken;
  if (refreshExpiresAt) update.refresh_expires_at = refreshExpiresAt;
  if (params.tokens.scope) update.scopes = parseTikTokScopes(params.tokens.scope);

  const { error } = await supabase
    .from('tiktok_accounts')
    .update(update)
    .eq('id', params.accountId)
    .eq('user_id', params.userId);

  return { ok: !error, error: error?.message, expiresAt };
}

export async function getTikTokAccountLimitSummary(userId: string, plan: string) {
  return getTikTokDashboardState(userId, plan);
}
