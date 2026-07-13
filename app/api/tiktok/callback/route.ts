import { after, NextRequest, NextResponse } from 'next/server';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import {
  TIKTOK_OAUTH_RETURN_TO_COOKIE,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_USER_INFO_BASIC_FIELDS,
  exchangeTikTokAuthorizationCode,
  fetchTikTokUserInfoBasic,
  getTikTokOAuthSecrets,
  getTikTokRedirectUri,
  revokeTikTokAccess,
  type TikTokOAuthSecrets,
  TikTokApiRequestError,
  TikTokRevokeError,
  TikTokUserInfoFetchError,
  verifyTikTokOAuthState,
} from '@/lib/tiktok-oauth';
import { hasVideoListScope, upsertTikTokAccountForUser } from '@/lib/tiktok-accounts';
import { syncTikTokAccountProfile } from '@/lib/tiktok-sync';

export const maxDuration = 60;

async function revokeUnstoredTikTokGrant(params: {
  accessToken: string;
  secrets: TikTokOAuthSecrets;
  cleanupContext: 'profile_fetch_failed' | 'account_save_failed';
}) {
  try {
    await revokeTikTokAccess(params.accessToken, params.secrets);
    console.info('[tiktok/callback] unstored_grant_revoked', {
      cleanupContext: params.cleanupContext,
    });
  } catch (error) {
    console.warn('[tiktok/callback] unstored_grant_revocation_failed', {
      cleanupContext: params.cleanupContext,
      reason: error instanceof TikTokRevokeError ? error.reason : 'unknown',
      providerStatus: error instanceof TikTokRevokeError ? error.status : null,
    });
  }
}

function redirectDashboard(request: NextRequest, query: Record<string, string>) {
  const u = new URL('/dashboard', request.url);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return NextResponse.redirect(u);
}

function redirectAfterTikTok(request: NextRequest, query: Record<string, string>) {
  const returnTo = request.cookies.get(TIKTOK_OAUTH_RETURN_TO_COOKIE)?.value;
  if (returnTo === '/review/tiktok-demo') {
    const u = new URL(returnTo, request.url);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    return NextResponse.redirect(u);
  }

  return redirectDashboard(request, query);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  const clearState = (res: NextResponse) => {
    res.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    res.cookies.set(TIKTOK_OAUTH_RETURN_TO_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  if (!session) {
    const r = redirectAfterTikTok(request, { tiktok: 'session' });
    return clearState(r);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE)?.value;
  console.info('[tiktok/callback] received', {
    step: 'callback_received',
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasCookieState: Boolean(cookieState),
  });

  if (!state || !cookieState) {
    const r = redirectAfterTikTok(request, { tiktok: 'state' });
    return clearState(r);
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    const r = redirectAfterTikTok(request, { tiktok: 'config' });
    return clearState(r);
  }

  if (!verifyTikTokOAuthState({
    state,
    cookieValue: cookieState,
    userId: session.userId,
    clientSecret: secrets.clientSecret,
  })) {
    const r = redirectAfterTikTok(request, { tiktok: 'state' });
    return clearState(r);
  }

  const err = request.nextUrl.searchParams.get('error');
  const errDesc = request.nextUrl.searchParams.get('error_description');
  if (err) {
    const safeErrorCode = /^[A-Za-z0-9_.-]{1,64}$/.test(err) ? err : 'unknown_error';
    console.warn('[tiktok/callback] OAuth error', {
      code: safeErrorCode,
      hasDescription: Boolean(errDesc),
    });
    const r = redirectAfterTikTok(request, { tiktok: 'denied' });
    return clearState(r);
  }

  if (!code) {
    const r = redirectAfterTikTok(request, { tiktok: 'state' });
    return clearState(r);
  }

  const redirectUri = getTikTokRedirectUri(request.headers.get('origin'));

  let tokens: Awaited<ReturnType<typeof exchangeTikTokAuthorizationCode>>;
  try {
    tokens = await exchangeTikTokAuthorizationCode(code, redirectUri, secrets);
    console.info('[tiktok/callback] token exchange', {
      step: 'token_exchange',
      tokenExchangeStatus: 'ok',
      hasAccessToken: Boolean(tokens.access_token),
      grantedScopes: tokens.scope ?? null,
    });
  } catch (e) {
    console.error('[tiktok/callback] token exchange:', {
      step: 'token_exchange',
      tokenExchangeStatus: 'error',
      errorType: e instanceof TikTokApiRequestError ? e.reason : e instanceof Error ? e.name : 'unknown_error',
    });
    const r = redirectAfterTikTok(request, { tiktok: 'token' });
    return clearState(r);
  }

  let profile: Awaited<ReturnType<typeof fetchTikTokUserInfoBasic>>;
  try {
    profile = await fetchTikTokUserInfoBasic(tokens.access_token);
    console.info('[tiktok/callback] user info', {
      step: 'profile_fetch',
      profileFetchStatus: 'ok',
      fields: TIKTOK_USER_INFO_BASIC_FIELDS,
      hasOpenId: Boolean(profile.open_id),
      hasDisplayName: Boolean(profile.display_name),
      hasAvatarUrl: Boolean(profile.avatar_url),
    });
  } catch (e) {
    await revokeUnstoredTikTokGrant({
      accessToken: tokens.access_token,
      secrets,
      cleanupContext: 'profile_fetch_failed',
    });
    console.error('[tiktok/callback] user info:', {
      step: 'profile_fetch',
      profileFetchStatus: 'error',
      fields: TIKTOK_USER_INFO_BASIC_FIELDS,
      profileErrorCode: e instanceof TikTokUserInfoFetchError ? e.code : null,
      profileFetchStatusCode: e instanceof TikTokUserInfoFetchError ? e.status : null,
      profileErrorType: e instanceof Error ? e.name : 'unknown_error',
    });
    const r = redirectAfterTikTok(request, { tiktok: 'profile' });
    return clearState(r);
  }

  const saved = await upsertTikTokAccountForUser({ userId: session.userId, profile, tokens });
  if (!saved.ok) {
    await revokeUnstoredTikTokGrant({
      accessToken: tokens.access_token,
      secrets,
      cleanupContext: 'account_save_failed',
    });
    console.error('[tiktok/callback] account save failed', { code: saved.code });
    const r = redirectAfterTikTok(request, { tiktok: saved.code === 'limit_reached' ? 'limit' : 'db' });
    return clearState(r);
  }

  const canSyncVideos = hasVideoListScope(saved.scopes);
  console.info('[tiktok/callback] account save', {
    step: 'account_save',
    accountSaveStatus: 'ok',
    accountIdPresent: Boolean(saved.accountId),
    scopes: saved.scopes,
    canSyncVideos,
  });

  after(async () => {
    try {
      const profileSyncResult = await syncTikTokAccountProfile(session.userId, saved.accountId);
      console.info('[tiktok/callback] post-connect profile sync', {
        step: 'post_connect_profile_sync',
        ok: profileSyncResult.ok,
        status: profileSyncResult.status,
        error: profileSyncResult.ok ? null : 'profile_sync_incomplete',
      });
    } catch (error) {
      console.warn('[tiktok/callback] post-connect profile sync failed', {
        step: 'post_connect_profile_sync',
        errorType: error instanceof Error ? error.name : 'unknown_error',
      });
    }
  });

  console.info('[tiktok/callback] post-connect video sync', {
    step: 'post_connect_video_sync',
    attempted: false,
    reason: canSyncVideos ? 'deferred_to_explicit_sync' : 'missing_video_list_scope',
    scopes: saved.scopes,
  });

  const r = redirectAfterTikTok(request, { tiktok: 'connected' });
  return clearState(r);
}
