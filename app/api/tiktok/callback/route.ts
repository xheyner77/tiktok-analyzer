import { NextRequest, NextResponse } from 'next/server';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import {
  TIKTOK_OAUTH_RETURN_TO_COOKIE,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_USER_INFO_BASIC_FIELDS,
  exchangeTikTokAuthorizationCode,
  fetchTikTokUserInfoBasic,
  getTikTokOAuthSecrets,
  getTikTokRedirectUri,
  TikTokUserInfoFetchError,
} from '@/lib/tiktok-oauth';
import { upsertTikTokAccountForUser } from '@/lib/tiktok-accounts';

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

  const err = request.nextUrl.searchParams.get('error');
  const errDesc = request.nextUrl.searchParams.get('error_description');
  if (err) {
    console.warn('[tiktok/callback] OAuth error:', err, errDesc);
    const r = redirectAfterTikTok(request, { tiktok: 'denied' });
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

  if (!code || !state || !cookieState || state !== cookieState) {
    const r = redirectAfterTikTok(request, { tiktok: 'state' });
    return clearState(r);
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    const r = redirectAfterTikTok(request, { tiktok: 'config' });
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
      scope: tokens.scope ?? null,
    });
  } catch (e) {
    console.error('[tiktok/callback] token exchange:', {
      step: 'token_exchange',
      tokenExchangeStatus: 'error',
      message: e instanceof Error ? e.message : 'unknown_error',
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
    console.error('[tiktok/callback] user info:', {
      step: 'profile_fetch',
      profileFetchStatus: 'error',
      fields: TIKTOK_USER_INFO_BASIC_FIELDS,
      profileErrorCode: e instanceof TikTokUserInfoFetchError ? e.code : null,
      profileFetchStatusCode: e instanceof TikTokUserInfoFetchError ? e.status : null,
      profileErrorMessage: e instanceof Error ? e.message : 'unknown_error',
    });
    const r = redirectAfterTikTok(request, { tiktok: 'profile' });
    return clearState(r);
  }

  const saved = await upsertTikTokAccountForUser({ userId: session.userId, profile, tokens });
  if (!saved.ok) {
    console.error('[tiktok/callback] account save:', saved);
    const r = redirectAfterTikTok(request, { tiktok: saved.code === 'limit_reached' ? 'limit' : 'db' });
    return clearState(r);
  }

  const r = redirectAfterTikTok(request, { tiktok: 'connected' });
  return clearState(r);
}
