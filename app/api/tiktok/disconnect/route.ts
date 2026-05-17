import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTikTokOAuthSecrets, revokeTikTokAccess } from '@/lib/tiktok-oauth';
import { supabase } from '@/lib/supabase';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const { data: row, error: readErr } = await supabase
    .from('users')
    .select('tiktok_access_token')
    .eq('id', session.userId)
    .maybeSingle();

  if (readErr) {
    console.error('[tiktok/disconnect] read:', readErr);
    return NextResponse.json({ error: 'Lecture profil impossible.' }, { status: 500 });
  }

  const token = typeof row?.tiktok_access_token === 'string' ? row.tiktok_access_token : null;
  const secrets = getTikTokOAuthSecrets();
  if (token && secrets) {
    await revokeTikTokAccess(token, secrets);
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
