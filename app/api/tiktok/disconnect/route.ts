import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation } from '@/lib/api-route-security';
import { getSession } from '@/lib/session';
import {
  getTikTokOAuthSecrets,
  revokeTikTokAccess,
  TikTokRevokeError,
} from '@/lib/tiktok-oauth';
import { supabase } from '@/lib/supabase';
import {
  disconnectTikTokAccount,
  listDisconnectableTikTokPrivateAccountsForUser,
} from '@/lib/tiktok-accounts';
import { revealTikTokToken } from '@/lib/tiktok-crypto';

function revocationFailure(error: unknown, disconnectedAccounts = 0) {
  const reason = error instanceof TikTokRevokeError ? error.reason : 'network';
  const status = reason === 'timeout' ? 504 : 502;
  console.warn('[tiktok/disconnect] provider_revocation_failed', {
    reason,
    providerStatus: error instanceof TikTokRevokeError ? error.status : null,
  });
  return NextResponse.json({
    error: disconnectedAccounts > 0
      ? `${disconnectedAccounts} compte${disconnectedAccounts > 1 ? 's ont' : ' a'} été déconnecté${disconnectedAccounts > 1 ? 's' : ''}. TikTok n’a pas confirmé les autres.`
      : 'TikTok n’a pas confirmé la déconnexion. Aucun jeton local n’a été supprimé.',
    code: disconnectedAccounts > 0
      ? 'TIKTOK_PARTIAL_REVOCATION_FAILED'
      : 'TIKTOK_REVOCATION_FAILED',
    disconnectedAccounts,
  }, { status });
}

export async function POST(request: NextRequest) {
  const crossSiteResponse = rejectCrossSiteMutation(request);
  if (crossSiteResponse) return crossSiteResponse;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  let accounts: Awaited<ReturnType<typeof listDisconnectableTikTokPrivateAccountsForUser>>;
  try {
    accounts = await listDisconnectableTikTokPrivateAccountsForUser(session.userId, { throwOnError: true });
  } catch {
    return NextResponse.json({ error: 'Lecture des comptes TikTok impossible.' }, { status: 500 });
  }

  const { data: legacyUser, error: legacyReadError } = await supabase
    .from('users')
    .select('tiktok_access_token')
    .eq('id', session.userId)
    .maybeSingle();
  if (legacyReadError) {
    console.error('[tiktok/disconnect] legacy_token_read_failed', { code: legacyReadError.code });
    return NextResponse.json({ error: 'Lecture de la connexion TikTok impossible.' }, { status: 500 });
  }

  const missingAccountToken = accounts.some((account) => !account.accessToken);
  const legacyStoredToken = typeof legacyUser?.tiktok_access_token === 'string'
    ? legacyUser.tiktok_access_token
    : null;
  const legacyAccessToken = revealTikTokToken(legacyStoredToken);
  if (missingAccountToken || (legacyStoredToken && !legacyAccessToken)) {
    return NextResponse.json({
      error: 'Le jeton TikTok est indisponible. La déconnexion n’a pas été simulée.',
      code: 'TIKTOK_TOKEN_UNAVAILABLE',
    }, { status: 503 });
  }

  const accessTokens = new Set<string>();
  for (const account of accounts) {
    if (account.accessToken) accessTokens.add(account.accessToken);
  }
  if (legacyAccessToken) accessTokens.add(legacyAccessToken);

  const secrets = getTikTokOAuthSecrets();
  if (accessTokens.size > 0 && !secrets) {
    return NextResponse.json({
      error: 'La configuration TikTok ne permet pas de confirmer la déconnexion.',
      code: 'TIKTOK_CONFIG_UNAVAILABLE',
    }, { status: 503 });
  }

  if (secrets) {
    const tokens = [...accessTokens];
    const revocations = await Promise.allSettled(
      tokens.map((token) => revokeTikTokAccess(token, secrets))
    );
    const failedTokenIndexes = revocations
      .map((result, index) => result.status === 'rejected' ? index : -1)
      .filter((index) => index >= 0);
    if (failedTokenIndexes.length > 0) {
      const failedTokens = new Set(failedTokenIndexes.map((index) => tokens[index]));
      const confirmedAccounts = accounts.filter(
        (account) => account.accessToken && !failedTokens.has(account.accessToken)
      );
      const localCleanups = await Promise.all(
        confirmedAccounts.map((account) => disconnectTikTokAccount(session.userId, account.id))
      );
      if (localCleanups.some((result) => !result.ok)) {
        return NextResponse.json({
          error: 'TikTok a révoqué certains accès, mais leur nettoyage local est incomplet.',
          code: 'TIKTOK_LOCAL_CLEANUP_FAILED',
        }, { status: 500 });
      }

      const failedResults = failedTokenIndexes
        .map((index) => revocations[index])
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      const representativeFailure = failedResults.find(
        (result) => result.reason instanceof TikTokRevokeError && result.reason.reason === 'timeout'
      ) ?? failedResults[0];
      return revocationFailure(representativeFailure?.reason, confirmedAccounts.length);
    }
  }

  const { error: accountErr } = await supabase
    .from('tiktok_accounts')
    .update({
      status: 'revoked',
      access_token: '',
      refresh_token: null,
      expires_at: null,
      refresh_expires_at: null,
      sync_status: 'revoked',
      sync_error: null,
    })
    .eq('user_id', session.userId)
    .neq('status', 'revoked');

  if (accountErr) {
    console.error('[tiktok/disconnect] account update:', accountErr);
    return NextResponse.json({ error: 'Mise à jour des comptes TikTok impossible.' }, { status: 500 });
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

  return NextResponse.json({ ok: true });
}
