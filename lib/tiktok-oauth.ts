/**
 * TikTok Login Kit (OAuth 2.0) — flux web.
 * @see https://developers.tiktok.com/doc/login-kit-web/
 */

import { CANONICAL_PRODUCTION_SITE_URL, getSiteUrl } from './site-url';

export const TIKTOK_OAUTH_STATE_COOKIE = 'tiktok_oauth_state';
export const TIKTOK_OAUTH_RETURN_TO_COOKIE = 'tiktok_oauth_return_to';

/** Scope minimal : profil de base. Add video.list in env only after TikTok approval. */
export const TIKTOK_LOGIN_SCOPES = process.env.TIKTOK_OAUTH_SCOPES?.trim() || 'user.info.basic';
export const TIKTOK_REVIEW_SCOPES = 'user.info.basic,user.info.profile,user.info.stats,video.list';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
export const TIKTOK_USER_INFO_BASIC_FIELDS = ['open_id', 'union_id', 'avatar_url', 'display_name'] as const;

export interface TikTokOAuthSecrets {
  clientKey: string;
  clientSecret: string;
}

export function getTikTokOAuthSecrets(): TikTokOAuthSecrets | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) return null;
  return { clientKey, clientSecret };
}

export function getTikTokRedirectUri(originHeader?: string | null): string {
  const siteUrl =
    process.env.VERCEL_ENV === 'production'
      ? CANONICAL_PRODUCTION_SITE_URL
      : getSiteUrl(originHeader);
  return `${siteUrl}/api/tiktok/callback`;
}

export function logTikTokOAuthConfig(params: { clientKey: string; redirectUri: string; scopes?: string }) {
  console.info('[tiktok/connect] OAuth config', {
    hasClientKey: params.clientKey.length > 0,
    clientKeyLength: params.clientKey.length,
    clientKeyPrefix: params.clientKey.slice(0, 4),
    redirectUri: params.redirectUri,
    scopes: params.scopes ?? TIKTOK_LOGIN_SCOPES,
  });
}

export function buildTikTokAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
  clientKey: string;
  scopes?: string;
}): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set('client_key', params.clientKey);
  u.searchParams.set('scope', params.scopes ?? TIKTOK_LOGIN_SCOPES);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('state', params.state);
  u.searchParams.set('disable_auto_auth', '0');
  return u.toString();
}

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeTikTokAuthorizationCode(
  code: string,
  redirectUri: string,
  secrets: TikTokOAuthSecrets
): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: secrets.clientKey,
    client_secret: secrets.clientSecret,
    code: code.trim(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Réponse TikTok invalide (${res.status})`);
  }

  if (!res.ok) {
    const msg =
      typeof json.message === 'string'
        ? json.message
        : typeof json.error_description === 'string'
          ? json.error_description
          : typeof json.error === 'string'
            ? json.error
            : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = json as Record<string, unknown>;
  const access_token = String(data.access_token ?? '');
  if (!access_token) {
    const msg =
      typeof data.error_description === 'string'
        ? data.error_description
        : typeof data.error === 'string'
          ? data.error
          : 'Réponse token TikTok sans access_token.';
    throw new Error(msg);
  }
  const open_id = String(data.open_id ?? '');
  if (!open_id) {
    throw new Error('Réponse OAuth TikTok incomplète (open_id manquant).');
  }

  return {
    access_token,
    open_id,
    expires_in: Number(data.expires_in) || 86400,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    refresh_expires_in:
      typeof data.refresh_expires_in === 'number' ? data.refresh_expires_in : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    token_type: typeof data.token_type === 'string' ? data.token_type : undefined,
  };
}

export async function refreshTikTokAccessToken(
  refreshToken: string,
  secrets: TikTokOAuthSecrets
): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: secrets.clientKey,
    client_secret: secrets.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  const raw = await res.text();
  const json = JSON.parse(raw) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.error_description ?? json.error ?? `HTTP ${res.status}`));
  }

  const access_token = String(json.access_token ?? '');
  if (!access_token) throw new Error('Réponse refresh TikTok sans access_token.');

  return {
    access_token,
    open_id: String(json.open_id ?? ''),
    expires_in: Number(json.expires_in) || 86400,
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : refreshToken,
    refresh_expires_in: typeof json.refresh_expires_in === 'number' ? json.refresh_expires_in : undefined,
    scope: typeof json.scope === 'string' ? json.scope : undefined,
    token_type: typeof json.token_type === 'string' ? json.token_type : undefined,
  };
}

export interface TikTokUserInfoBasic {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
}

export class TikTokUserInfoFetchError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'TikTokUserInfoFetchError';
    this.status = status;
    this.code = code;
  }
}

export async function fetchTikTokUserInfoBasic(accessToken: string): Promise<TikTokUserInfoBasic> {
  const fields = TIKTOK_USER_INFO_BASIC_FIELDS.join(',');
  const url = `${USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const raw = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new TikTokUserInfoFetchError(`Réponse user/info TikTok invalide (${res.status})`, res.status);
  }

  const err = json.error as Record<string, unknown> | undefined;
  const errorCode = typeof err?.code === 'string' ? err.code : null;
  const errorMessage = typeof err?.message === 'string' ? err.message : null;
  if (!res.ok || (errorCode && errorCode !== 'ok')) {
    throw new TikTokUserInfoFetchError(errorMessage || `HTTP ${res.status}`, res.status, errorCode);
  }

  const data = json.data as Record<string, unknown> | undefined;
  const user = data?.user as Record<string, unknown> | undefined;
  if (!user || typeof user.open_id !== 'string') {
    throw new TikTokUserInfoFetchError('Profil TikTok introuvable dans la réponse API.', res.status, errorCode);
  }

  return {
    open_id: user.open_id,
    union_id: typeof user.union_id === 'string' ? user.union_id : undefined,
    avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : undefined,
    display_name: typeof user.display_name === 'string' ? user.display_name : undefined,
  };
}

export async function revokeTikTokAccess(accessToken: string, secrets: TikTokOAuthSecrets): Promise<void> {
  const body = new URLSearchParams({
    client_key: secrets.clientKey,
    client_secret: secrets.clientSecret,
    token: accessToken,
  });
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  }).catch(() => {});
}
