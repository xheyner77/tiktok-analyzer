import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listActiveTikTokPrivateAccountsForUser } from '@/lib/tiktok-accounts';
import { syncTikTokAccountVideos } from '@/lib/tiktok-sync';
import { getTikTokCapabilities } from '@/lib/tiktok/capabilities';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const [account] = await listActiveTikTokPrivateAccountsForUser(session.userId);
  if (!account) {
    return NextResponse.json({ ok: false, reason: 'not_connected' }, { status: 404 });
  }

  const capabilities = getTikTokCapabilities({
    scopes: account.scopes,
    environment: account.environment,
    refreshTokenExpiresAt: account.refreshExpiresAt,
  });

  if (!capabilities.hasVideoList) {
    return NextResponse.json({
      ok: false,
      reason: 'missing_scope',
      missingScopes: ['video.list'],
      needsReconnect: true,
    }, { status: 409 });
  }

  const result = await syncTikTokAccountVideos(session.userId, account.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
