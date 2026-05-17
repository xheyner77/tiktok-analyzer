import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import { canConnectTikTokAccount } from '@/lib/tiktok-account-limits';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  buildTikTokAuthorizeUrl,
  getTikTokOAuthSecrets,
  getTikTokRedirectUri,
  logTikTokOAuthConfig,
} from '@/lib/tiktok-oauth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', '/dashboard');
    return NextResponse.redirect(login);
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    const dash = new URL('/dashboard', request.url);
    dash.searchParams.set('tiktok', 'config');
    return NextResponse.redirect(dash);
  }

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  const eligibility = await canConnectTikTokAccount(session.userId, plan);
  if (!eligibility.allowed) {
    const dash = new URL('/dashboard', request.url);
    dash.searchParams.set('tiktok', eligibility.reason === 'count_failed' ? 'setup' : 'limit');
    return NextResponse.redirect(dash);
  }

  const redirectUri = getTikTokRedirectUri(request.headers.get('origin'));
  logTikTokOAuthConfig({ clientKey: secrets.clientKey, redirectUri });
  const state = randomBytes(24).toString('hex');
  const authorizeUrl = buildTikTokAuthorizeUrl({
    clientKey: secrets.clientKey,
    redirectUri,
    state,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
    ...COOKIE_OPTIONS,
    maxAge: 600,
  });
  return res;
}
