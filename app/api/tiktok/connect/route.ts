import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import { canConnectTikTokAccount } from '@/lib/tiktok-account-limits';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import {
  TIKTOK_LOGIN_SCOPES,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_OAUTH_RETURN_TO_COOKIE,
  TIKTOK_REVIEW_SCOPES,
  buildTikTokAuthorizeUrl,
  getTikTokOAuthSecrets,
  getTikTokRedirectUri,
  logTikTokOAuthConfig,
} from '@/lib/tiktok-oauth';

function getSafeReturnTo(request: NextRequest): string | null {
  const requested = request.nextUrl.searchParams.get('return_to');
  if (requested === '/review/tiktok-demo') return requested;
  return null;
}

function redirectConnectFailure(request: NextRequest, query: Record<string, string>) {
  const returnTo = getSafeReturnTo(request);
  const target = new URL(returnTo ?? '/dashboard', request.url);
  for (const [key, value] of Object.entries(query)) target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

function shouldUseSandboxReviewScopes(request: NextRequest) {
  if (request.nextUrl.searchParams.get('review') === '1') return true;
  if (process.env.TIKTOK_SCOPES?.trim() || process.env.TIKTOK_OAUTH_SCOPES?.trim()) return false;
  const configuredEnvironment = (
    process.env.TIKTOK_ENV
    ?? process.env.NEXT_PUBLIC_TIKTOK_ENV
    ?? process.env.TIKTOK_APP_MODE
    ?? ''
  ).trim().toLowerCase();
  if (configuredEnvironment === 'sandbox') return true;
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development';
}

function isReconnectRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get('mode') === 'reconnect'
    || request.nextUrl.searchParams.get('reconnect') === '1';
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', getSafeReturnTo(request) ?? '/dashboard');
    return NextResponse.redirect(login);
  }

  const secrets = getTikTokOAuthSecrets();
  if (!secrets) {
    return redirectConnectFailure(request, { tiktok: 'config' });
  }

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  if (!isReconnectRequest(request)) {
    const eligibility = await canConnectTikTokAccount(session.userId, plan);
    if (!eligibility.allowed) {
      return redirectConnectFailure(request, {
        tiktok: eligibility.reason === 'count_failed' ? 'setup' : 'limit',
      });
    }
  }

  const redirectUri = getTikTokRedirectUri(request.headers.get('origin'));
  const scopes = shouldUseSandboxReviewScopes(request) ? TIKTOK_REVIEW_SCOPES : TIKTOK_LOGIN_SCOPES;
  logTikTokOAuthConfig({ clientKey: secrets.clientKey, redirectUri, scopes });
  const state = randomBytes(24).toString('hex');
  const authorizeUrl = buildTikTokAuthorizeUrl({
    clientKey: secrets.clientKey,
    redirectUri,
    state,
    scopes,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
    ...COOKIE_OPTIONS,
    maxAge: 600,
  });
  const returnTo = getSafeReturnTo(request);
  if (returnTo) {
    res.cookies.set(TIKTOK_OAUTH_RETURN_TO_COOKIE, returnTo, {
      ...COOKIE_OPTIONS,
      maxAge: 600,
    });
  }
  return res;
}
