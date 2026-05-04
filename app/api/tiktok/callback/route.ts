import { NextRequest, NextResponse } from 'next/server';
import { getSession, COOKIE_OPTIONS } from '@/lib/session';
import {
  TIKTOK_OAUTH_STATE_COOKIE,
  exchangeTikTokAuthorizationCode,
  fetchTikTokUserInfoBasic,
  getTikTokOAuthSecrets,
} from '@/lib/tiktok-oauth';
import { supabase } from '@/lib/supabase';

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

  const redirectUri = new URL('/api/tiktok/callback', request.nextUrl.origin).href;

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

  const { data: other } = await supabase
    .from('users')
    .select('id')
    .eq('tiktok_open_id', profile.open_id)
    .neq('id', session.userId)
    .maybeSingle();

  if (other?.id) {
    const r = redirectDashboard(request, { tiktok: 'in_use' });
    return clearState(r);
  }

  const expiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in) * 1000).toISOString();

  const { error: upErr } = await supabase
    .from('users')
    .update({
      tiktok_open_id: profile.open_id,
      tiktok_union_id: profile.union_id ?? null,
      tiktok_display_name: profile.display_name ?? null,
      tiktok_avatar_url: profile.avatar_url ?? null,
      tiktok_access_token: tokens.access_token,
      tiktok_refresh_token: tokens.refresh_token ?? null,
      tiktok_token_expires_at: expiresAt,
      tiktok_connected_at: new Date().toISOString(),
    })
    .eq('id', session.userId);

  if (upErr) {
    console.error('[tiktok/callback] DB update:', upErr);
    const r = redirectDashboard(request, { tiktok: 'db' });
    return clearState(r);
  }

  const r = redirectDashboard(request, { tiktok: 'connected' });
  return clearState(r);
}
