import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  buildTikTokAuthorizeUrl,
  getTikTokOAuthSecrets,
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

  const redirectUri = new URL('/api/tiktok/callback', request.nextUrl.origin).href;
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
