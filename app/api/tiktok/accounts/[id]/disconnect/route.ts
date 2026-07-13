import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation } from '@/lib/api-route-security';
import { getSession } from '@/lib/session';
import { disconnectTikTokAccount, getTikTokAccountForUser } from '@/lib/tiktok-accounts';
import {
  getTikTokOAuthSecrets,
  revokeTikTokAccess,
  TikTokRevokeError,
} from '@/lib/tiktok-oauth';

function revocationFailure(error: unknown) {
  const reason = error instanceof TikTokRevokeError ? error.reason : 'network';
  const status = reason === 'timeout' ? 504 : 502;
  console.warn('[tiktok/account-disconnect] provider_revocation_failed', {
    reason,
    providerStatus: error instanceof TikTokRevokeError ? error.status : null,
  });
  return NextResponse.json({
    error: 'TikTok n’a pas confirmé la déconnexion. Le compte reste connecté dans Viralynz.',
    code: 'TIKTOK_REVOCATION_FAILED',
  }, { status });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const crossSiteResponse = rejectCrossSiteMutation(request);
  if (crossSiteResponse) return crossSiteResponse;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const { id } = await params;
  const account = await getTikTokAccountForUser(session.userId, id);
  if (!account) {
    return NextResponse.json({ error: 'Compte TikTok introuvable.' }, { status: 404 });
  }

  if (account.accessToken) {
    const secrets = getTikTokOAuthSecrets();
    if (!secrets) {
      return NextResponse.json({
        error: 'La configuration TikTok ne permet pas de confirmer la déconnexion.',
        code: 'TIKTOK_CONFIG_UNAVAILABLE',
      }, { status: 503 });
    }
    try {
      await revokeTikTokAccess(account.accessToken, secrets);
    } catch (error) {
      return revocationFailure(error);
    }
  } else if (account.status !== 'revoked') {
    return NextResponse.json({
      error: 'Le jeton TikTok est indisponible. La déconnexion n’a pas été simulée.',
      code: 'TIKTOK_TOKEN_UNAVAILABLE',
    }, { status: 503 });
  }

  const result = await disconnectTikTokAccount(session.userId, id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Déconnexion impossible pour le moment.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
