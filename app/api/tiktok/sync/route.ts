import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listActiveTikTokPrivateAccountsForUser } from '@/lib/tiktok-accounts';
import { syncTikTokAccountProfile, syncTikTokAccountVideos } from '@/lib/tiktok-sync';
import { getTikTokCapabilities } from '@/lib/tiktok/capabilities';

type SyncError = {
  step: 'profile' | 'videos';
  message: string;
};

function resultError(result: unknown): string | null {
  if (typeof result !== 'object' || result === null || !('error' in result)) return null;
  const error = (result as { error?: unknown }).error;
  return typeof error === 'string' ? error : null;
}

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
  const errors: SyncError[] = [];
  const profile = await syncTikTokAccountProfile(session.userId, account.id);
  const profileError = resultError(profile);
  if (profileError) errors.push({ step: 'profile', message: profileError });

  let videosSynced = false;
  let videosCount = 0;
  if (capabilities.hasVideoList) {
    const videos = await syncTikTokAccountVideos(session.userId, account.id);
    videosSynced = videos.ok;
    videosCount = videos.videosFound;
    const videoError = resultError(videos);
    if (videoError) errors.push({ step: 'videos', message: videoError });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    profileSynced: profile.ok,
    videosSynced,
    videosCount,
    capabilities,
    errors,
  });
}
