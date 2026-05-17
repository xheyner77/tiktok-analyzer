import { NextRequest, NextResponse } from 'next/server';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  exchangeTikTokAuthorizationCode,
  fetchTikTokUserInfoBasic,
  getTikTokOAuthSecrets,
  getTikTokRedirectUri,
} from '@/lib/tiktok-oauth';
import { upsertTikTokAccountForUser } from '@/lib/tiktok-accounts';

function redirectDashboard(request: NextRequest, query: Record<string, string>) {
  const u = new URL('/dashboard', request.url);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return NextResponse.redirect(u);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  const clearState = (res: NextResponse) => {
    res.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  if (!session) {
    const r = redirectDashboard(request, { tiktok: 'session' });
    return clearState(r);
  }

  const err = request.nextUrl.searchParams.get('error');
  const errDesc = request.nextUrl.searchParams.get('error_description');
  if (err) {
    console.warn('[tiktok/callback] OAuth error:', err, errDesc);
    const r = redirectDashboard(request, { tiktok: 'denied' });
    return clearState(r);
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    const r = redirectDashboard(request, { tiktok: 'state' });
    return clearState(r);
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    const r = redirectDashboard(request, { tiktok: 'config' });
    return clearState(r);
  }

  const redirectUri = getTikTokRedirectUri(request.headers.get('origin'));

  let tokens: Awaited<ReturnType<typeof exchangeTikTokAuthorizationCode>>;
  try {
    tokens = await exchangeTikTokAuthorizationCode(code, redirectUri, secrets);
  } catch (e) {
    console.error('[tiktok/callback] token exchange:', e);
    const r = redirectDashboard(request, { tiktok: 'token' });
    return clearState(r);
  }

  let profile: Awaited<ReturnType<typeof fetchTikTokUserInfoBasic>>;
  try {
    profile = await fetchTikTokUserInfoBasic(tokens.access_token);
  } catch (e) {
    console.error('[tiktok/callback] user info:', e);
    const r = redirectDashboard(request, { tiktok: 'profile' });
    return clearState(r);
  }

  const saved = await upsertTikTokAccountForUser({ userId: session.userId, profile, tokens });
  if (!saved.ok) {
    console.error('[tiktok/callback] account save:', saved);
    const r = redirectDashboard(request, { tiktok: saved.code === 'limit_reached' ? 'limit' : 'db' });
    return clearState(r);
  }

  const r = redirectDashboard(request, { tiktok: 'connected' });
  return clearState(r);
}
