/**
 * TikTok Login Kit (OAuth 2.0) — flux web.
 * @see https://developers.tiktok.com/doc/login-kit-web/
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { CANONICAL_PRODUCTION_SITE_URL, getSiteUrl } from './site-url';
import {
  REQUIRED_TIKTOK_SCOPES,
  formatTikTokScopesForOAuth,
  normalizeTikTokScopeString,
  parseTikTokScopes,
} from './tiktok/scopes';

export const TIKTOK_OAUTH_STATE_COOKIE = 'tiktok_oauth_state';
export const TIKTOK_OAUTH_RETURN_TO_COOKIE = 'tiktok_oauth_return_to';

export const TIKTOK_LOGIN_SCOPES = formatTikTokScopesForOAuth(
  process.env.TIKTOK_SCOPES ?? process.env.TIKTOK_OAUTH_SCOPES ?? REQUIRED_TIKTOK_SCOPES
);
export const TIKTOK_REVIEW_SCOPES = formatTikTokScopesForOAuth(REQUIRED_TIKTOK_SCOPES);

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const DEFAULT_TIKTOK_API_TIMEOUT_MS = 12_000;
export const TIKTOK_USER_INFO_BASIC_FIELDS = ['open_id', 'union_id', 'avatar_url', 'display_name'] as const;

export interface TikTokOAuthSecrets {
  clientKey: string;
  clientSecret: string;
}

type TikTokOAuthStateCookie = {
  version: 1;
  userId: string;
  state: string;
};

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signTikTokOAuthState(userId: string, nonce: string, clientSecret: string): string {
  return createHmac('sha256', clientSecret)
    .update(`${userId}:${nonce}`, 'utf8')
    .digest('base64url');
}

export function createTikTokOAuthState(userId: string, clientSecret: string): {
  state: string;
  cookieValue: string;
} {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || !clientSecret) {
    throw new Error('Impossible de sécuriser la connexion TikTok.');
  }

  const nonce = randomBytes(24).toString('base64url');
  const signature = signTikTokOAuthState(normalizedUserId, nonce, clientSecret);
  const state = `${nonce}.${signature}`;
  const cookiePayload: TikTokOAuthStateCookie = {
    version: 1,
    userId: normalizedUserId,
    state,
  };

  return {
    state,
    cookieValue: Buffer.from(JSON.stringify(cookiePayload), 'utf8').toString('base64url'),
  };
}

export function verifyTikTokOAuthState(params: {
  state: string;
  cookieValue: string;
  userId: string;
  clientSecret: string;
}): boolean {
  if (!params.state || !params.cookieValue || !params.userId || !params.clientSecret) return false;
  if (params.cookieValue.length > 2_048) return false;

  let payload: TikTokOAuthStateCookie;
  try {
    payload = JSON.parse(
      Buffer.from(params.cookieValue, 'base64url').toString('utf8')
    ) as TikTokOAuthStateCookie;
  } catch {
    return false;
  }

  if (
    payload.version !== 1
    || typeof payload.userId !== 'string'
    || typeof payload.state !== 'string'
    || !constantTimeStringEqual(payload.userId, params.userId.trim())
    || !constantTimeStringEqual(payload.state, params.state)
  ) {
    return false;
  }

  const stateParts = params.state.split('.');
  if (stateParts.length !== 2) return false;
  const [nonce, signature] = stateParts;
  if (!/^[A-Za-z0-9_-]{32}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;

  const expectedSignature = signTikTokOAuthState(payload.userId, nonce, params.clientSecret);
  return constantTimeStringEqual(signature, expectedSignature);
}

export class TikTokApiRequestError extends Error {
  reason: 'timeout' | 'network';
  operation: string;

  constructor(message: string, reason: 'timeout' | 'network', operation: string) {
    super(message);
    this.name = 'TikTokApiRequestError';
    this.reason = reason;
    this.operation = operation;
  }
}

export async function fetchTikTokApiResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  options: { operation: string; timeoutMs?: number }
): Promise<{ response: Response; raw: string }> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIKTOK_API_TIMEOUT_MS);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const raw = await response.text();
    return { response, raw };
  } catch {
    if (controller.signal.aborted) {
      throw new TikTokApiRequestError(
        `TikTok n’a pas répondu à temps pendant ${options.operation}.`,
        'timeout',
        options.operation
      );
    }
    throw new TikTokApiRequestError(
      `TikTok est temporairement injoignable pendant ${options.operation}.`,
      'network',
      options.operation
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function getTikTokOAuthSecrets(): TikTokOAuthSecrets | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) return null;
  return { clientKey, clientSecret };
}

export function getTikTokRedirectUri(originHeader?: string | null): string {
  const explicitRedirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();
  if (explicitRedirectUri) return explicitRedirectUri;

  const siteUrl =
    process.env.VERCEL_ENV === 'production'
      ? CANONICAL_PRODUCTION_SITE_URL
      : getSiteUrl(originHeader);
  return `${siteUrl}/api/tiktok/callback`;
}

export function logTikTokOAuthConfig(params: { clientKey: string; redirectUri: string; scopes?: string }) {
  const requestedScopes = parseTikTokScopes(params.scopes ?? TIKTOK_LOGIN_SCOPES);
  console.info('[TikTok OAuth] requested scopes', requestedScopes);
  console.info('[tiktok/connect] OAuth config', {
    hasClientKey: params.clientKey.length > 0,
    clientKeyLength: params.clientKey.length,
    redirectUri: params.redirectUri,
    scopes: normalizeTikTokScopeString(requestedScopes),
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
  u.searchParams.set('scope', formatTikTokScopesForOAuth(params.scopes ?? TIKTOK_LOGIN_SCOPES));
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

export type TikTokTokenRefreshErrorReason =
  | 'invalid_refresh'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'provider_rejected';

export class TikTokTokenRefreshError extends Error {
  readonly reason: TikTokTokenRefreshErrorReason;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(params: {
    message: string;
    reason: TikTokTokenRefreshErrorReason;
    retryable: boolean;
    status?: number | null;
  }) {
    super(params.message);
    this.name = 'TikTokTokenRefreshError';
    this.reason = params.reason;
    this.retryable = params.retryable;
    this.status = params.status ?? null;
  }
}

function readTikTokOAuthErrorCode(payload: Record<string, unknown>): string | null {
  const nestedError = payload.error && typeof payload.error === 'object' && !Array.isArray(payload.error)
    ? payload.error as Record<string, unknown>
    : null;
  const candidates = [
    typeof payload.error === 'string' ? payload.error : null,
    payload.error_code,
    payload.code,
    nestedError?.code,
    nestedError?.error,
    nestedError?.error_code,
    nestedError?.type,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }
  return null;
}

function isInvalidTikTokRefreshCode(code: string | null): boolean {
  if (!code) return false;
  if ([
    'invalid_grant',
    'invalid_token',
    'invalid_refresh',
    'invalid_refresh_token',
    'refresh_token_invalid',
    'refresh_token_expired',
    'refresh_token_revoked',
  ].includes(code)) {
    return true;
  }

  return code.includes('refresh') && /(invalid|expired|revoked)/.test(code);
}

function createTikTokRefreshError(params: {
  reason: TikTokTokenRefreshErrorReason;
  status: number;
}): TikTokTokenRefreshError {
  const permanent = params.reason === 'invalid_refresh';
  return new TikTokTokenRefreshError({
    message: permanent
      ? 'La connexion TikTok doit être renouvelée.'
      : 'Le renouvellement TikTok est temporairement indisponible. Réessaie dans un instant.',
    reason: params.reason,
    retryable: !permanent,
    status: params.status,
  });
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

  const { response: res, raw } = await fetchTikTokApiResponse(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
    cache: 'no-store',
  }, {
    operation: 'l’échange du code OAuth',
  });
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Réponse TikTok invalide (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`Échange OAuth TikTok refusé (HTTP ${res.status}).`);
  }

  const data = json as Record<string, unknown>;
  const access_token = String(data.access_token ?? '');
  if (!access_token) {
    throw new Error('Réponse token TikTok sans access_token.');
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

  const { response: res, raw } = await fetchTikTokApiResponse(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
    cache: 'no-store',
  }, {
    operation: 'le renouvellement du jeton OAuth',
  });

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const reason: TikTokTokenRefreshErrorReason = res.status === 400 || res.status === 401
      ? 'invalid_refresh'
      : res.status === 429
        ? 'rate_limited'
        : res.status >= 500
          ? 'provider_unavailable'
          : 'invalid_response';
    throw createTikTokRefreshError({ reason, status: res.status });
  }

  const providerErrorCode = readTikTokOAuthErrorCode(json);
  if (res.status === 400 || res.status === 401 || isInvalidTikTokRefreshCode(providerErrorCode)) {
    throw createTikTokRefreshError({ reason: 'invalid_refresh', status: res.status });
  }
  if (res.status === 429) {
    throw createTikTokRefreshError({ reason: 'rate_limited', status: res.status });
  }
  if (res.status >= 500) {
    throw createTikTokRefreshError({ reason: 'provider_unavailable', status: res.status });
  }
  if (!res.ok) {
    throw createTikTokRefreshError({ reason: 'provider_rejected', status: res.status });
  }

  const access_token = String(json.access_token ?? '');
  if (!access_token) {
    throw createTikTokRefreshError({ reason: 'invalid_response', status: res.status });
  }

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

export interface TikTokUserInfo extends TikTokUserInfoBasic {
  bio_description?: string;
  profile_deep_link?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
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
  return fetchTikTokUserInfo(accessToken, TIKTOK_USER_INFO_BASIC_FIELDS);
}

export async function fetchTikTokUserInfo(
  accessToken: string,
  requestedFields: readonly string[]
): Promise<TikTokUserInfo> {
  const fields = requestedFields.join(',');
  const url = `${USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
  const { response: res, raw } = await fetchTikTokApiResponse(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  }, {
    operation: 'la lecture du profil',
  });
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new TikTokUserInfoFetchError(`Réponse user/info TikTok invalide (${res.status})`, res.status);
  }

  const err = json.error as Record<string, unknown> | undefined;
  const errorCode = typeof err?.code === 'string' ? err.code : null;
  if (!res.ok || (errorCode && errorCode !== 'ok')) {
    throw new TikTokUserInfoFetchError(
      `Lecture du profil TikTok refusée (HTTP ${res.status}).`,
      res.status,
      errorCode
    );
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
    bio_description: typeof user.bio_description === 'string' ? user.bio_description : undefined,
    profile_deep_link: typeof user.profile_deep_link === 'string' ? user.profile_deep_link : undefined,
    is_verified: typeof user.is_verified === 'boolean' ? user.is_verified : undefined,
    follower_count: typeof user.follower_count === 'number' ? user.follower_count : undefined,
    following_count: typeof user.following_count === 'number' ? user.following_count : undefined,
    likes_count: typeof user.likes_count === 'number' ? user.likes_count : undefined,
    video_count: typeof user.video_count === 'number' ? user.video_count : undefined,
  };
}

export class TikTokRevokeError extends Error {
  reason: 'timeout' | 'network' | 'provider';
  status: number | null;

  constructor(
    message: string,
    reason: 'timeout' | 'network' | 'provider',
    status: number | null = null
  ) {
    super(message);
    this.name = 'TikTokRevokeError';
    this.reason = reason;
    this.status = status;
  }
}

export async function revokeTikTokAccess(
  accessToken: string,
  secrets: TikTokOAuthSecrets,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  const body = new URLSearchParams({
    client_key: secrets.clientKey,
    client_secret: secrets.clientSecret,
    token: accessToken,
  });
  let response: Response;
  let raw: string;
  try {
    const result = await fetchTikTokApiResponse(REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: body.toString(),
      cache: 'no-store',
    }, {
      operation: 'la révocation de l’accès',
      timeoutMs: options.timeoutMs,
    });
    response = result.response;
    raw = result.raw;
  } catch (error) {
    if (error instanceof TikTokApiRequestError && error.reason === 'timeout') {
      throw new TikTokRevokeError(
        'TikTok n’a pas confirmé la déconnexion dans le délai prévu.',
        'timeout'
      );
    }
    throw new TikTokRevokeError('TikTok est temporairement injoignable.', 'network');
  }

  if (!response.ok) {
    throw new TikTokRevokeError(
      `TikTok a refusé la révocation (HTTP ${response.status}).`,
      'provider',
      response.status
    );
  }

  const normalizedPayload = raw.trim();
  if (!normalizedPayload) return;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(normalizedPayload) as Record<string, unknown>;
  } catch {
    throw new TikTokRevokeError(
      'TikTok a renvoyé une confirmation de révocation invalide.',
      'provider',
      response.status
    );
  }

  const payloadError = payload.error;
  const errorCode = payloadError && typeof payloadError === 'object' && !Array.isArray(payloadError)
    ? (payloadError as Record<string, unknown>).code
    : null;
  const hasPayloadError = typeof payloadError === 'string'
    ? payloadError.trim().length > 0
    : typeof errorCode === 'string' && errorCode !== 'ok';
  if (hasPayloadError || typeof payload.error_description === 'string') {
    throw new TikTokRevokeError(
      'TikTok a refusé la révocation malgré une réponse HTTP réussie.',
      'provider',
      response.status
    );
  }
}
