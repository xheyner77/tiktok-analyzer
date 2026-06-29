import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listActiveTikTokPrivateAccountsForUser } from '@/lib/tiktok-accounts';
import { syncTikTokAccountProfile } from '@/lib/tiktok-sync';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const [account] = await listActiveTikTokPrivateAccountsForUser(session.userId);
  if (!account) {
    return NextResponse.json({ ok: false, reason: 'not_connected' }, { status: 404 });
  }

  const result = await syncTikTokAccountProfile(session.userId, account.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
