import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTikTokOAuthSecrets, revokeTikTokAccess } from '@/lib/tiktok-oauth';
import { supabase } from '@/lib/supabase';
import { listActiveTikTokPrivateAccountsForUser } from '@/lib/tiktok-accounts';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const accounts = await listActiveTikTokPrivateAccountsForUser(session.userId);
  const secrets = getTikTokOAuthSecrets();
  if (secrets) {
    await Promise.all(
      accounts
        .map((account) => account.accessToken)
        .filter((token): token is string => Boolean(token))
        .map((token) => revokeTikTokAccess(token, secrets))
    );
  }

  const { error: upErr } = await supabase
    .from('users')
    .update({
      tiktok_open_id: null,
      tiktok_union_id: null,
      tiktok_display_name: null,
      tiktok_avatar_url: null,
      tiktok_access_token: null,
      tiktok_refresh_token: null,
      tiktok_token_expires_at: null,
      tiktok_connected_at: null,
    })
    .eq('id', session.userId);

  if (upErr) {
    console.error('[tiktok/disconnect] update:', upErr);
    return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 });
  }

  const { error: accountErr } = await supabase
    .from('tiktok_accounts')
    .update({ status: 'revoked', access_token: '', refresh_token: null })
    .eq('user_id', session.userId)
    .eq('status', 'active');

  if (accountErr) {
    console.error('[tiktok/disconnect] account update:', accountErr);
  }

  return NextResponse.json({ ok: true });
}
