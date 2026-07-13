import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  class MockTikTokUserInfoFetchError extends Error {
    status = 502;
    code = 'profile_error';
  }

  class MockTikTokApiRequestError extends Error {
    reason: 'timeout' | 'network' = 'network';
  }

  class MockTikTokRevokeError extends Error {
    reason: 'timeout' | 'network' | 'provider' = 'network';
    status: number | null = null;
  }

  return {
    MockTikTokUserInfoFetchError,
    MockTikTokApiRequestError,
    MockTikTokRevokeError,
    getSession: vi.fn(),
    getSecrets: vi.fn(),
    verifyState: vi.fn(),
    exchangeCode: vi.fn(),
    fetchProfile: vi.fn(),
    revoke: vi.fn(),
    upsertAccount: vi.fn(),
    hasVideoListScope: vi.fn(),
    scheduleAfter: vi.fn(),
    afterCallbacks: [] as Array<() => void | Promise<void>>,
    syncProfile: vi.fn(),
    syncVideos: vi.fn(),
  };
});

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mocks.scheduleAfter };
});

vi.mock('@/lib/session', () => ({
  getSession: mocks.getSession,
  COOKIE_OPTIONS: { httpOnly: true, sameSite: 'lax', secure: true, path: '/' },
}));

vi.mock('@/lib/tiktok-oauth', () => ({
  TIKTOK_OAUTH_RETURN_TO_COOKIE: 'tiktok_oauth_return_to',
  TIKTOK_OAUTH_STATE_COOKIE: 'tiktok_oauth_state',
  TIKTOK_USER_INFO_BASIC_FIELDS: ['open_id', 'display_name'],
  exchangeTikTokAuthorizationCode: mocks.exchangeCode,
  fetchTikTokUserInfoBasic: mocks.fetchProfile,
  getTikTokOAuthSecrets: mocks.getSecrets,
  getTikTokRedirectUri: () => 'https://www.viralynz.com/api/tiktok/callback',
  revokeTikTokAccess: mocks.revoke,
  verifyTikTokOAuthState: mocks.verifyState,
  TikTokApiRequestError: mocks.MockTikTokApiRequestError,
  TikTokRevokeError: mocks.MockTikTokRevokeError,
  TikTokUserInfoFetchError: mocks.MockTikTokUserInfoFetchError,
}));

vi.mock('@/lib/tiktok-accounts', () => ({
  hasVideoListScope: mocks.hasVideoListScope,
  upsertTikTokAccountForUser: mocks.upsertAccount,
}));

vi.mock('@/lib/tiktok-sync', () => ({
  syncTikTokAccountProfile: mocks.syncProfile,
  syncTikTokAccountVideos: mocks.syncVideos,
}));

import { GET as tiktokCallback } from '@/app/api/tiktok/callback/route';

const secrets = { clientKey: 'client-key', clientSecret: 'client-secret' };
const tokens = {
  access_token: 'unstored-access-token',
  open_id: 'open-id',
  expires_in: 86_400,
  scope: 'user.info.basic,video.list',
};

function callbackRequest() {
  return new NextRequest(
    'https://www.viralynz.com/api/tiktok/callback?code=oauth-code&state=signed-state',
    { headers: { cookie: 'tiktok_oauth_state=state-cookie' } }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.splice(0);
  mocks.scheduleAfter.mockImplementation((callback: () => void | Promise<void>) => {
    mocks.afterCallbacks.push(callback);
  });
  mocks.getSession.mockResolvedValue({ userId: 'user-1', email: 'createur@example.com' });
  mocks.getSecrets.mockReturnValue(secrets);
  mocks.verifyState.mockReturnValue(true);
  mocks.exchangeCode.mockResolvedValue(tokens);
  mocks.fetchProfile.mockResolvedValue({ open_id: 'open-id', display_name: 'Créateur' });
  mocks.revoke.mockResolvedValue(undefined);
  mocks.upsertAccount.mockResolvedValue({ ok: true, accountId: 'account-1', scopes: ['video.list'] });
  mocks.hasVideoListScope.mockReturnValue(true);
  mocks.syncProfile.mockResolvedValue({ ok: true, status: 'success' });
  mocks.syncVideos.mockResolvedValue({ ok: true, status: 'success', videosFound: 0 });
});

describe('nettoyage du grant OAuth TikTok non stocké', () => {
  it('révoque le grant si la lecture du profil échoue', async () => {
    mocks.fetchProfile.mockRejectedValue(new mocks.MockTikTokUserInfoFetchError('Profil indisponible.'));

    const response = await tiktokCallback(callbackRequest());

    expect(response.headers.get('location')).toContain('tiktok=profile');
    expect(mocks.revoke).toHaveBeenCalledWith('unstored-access-token', secrets);
    expect(mocks.upsertAccount).not.toHaveBeenCalled();
  });

  it('révoque le grant si son enregistrement local échoue', async () => {
    mocks.upsertAccount.mockResolvedValue({ ok: false, code: 'db_error' });

    const response = await tiktokCallback(callbackRequest());

    expect(response.headers.get('location')).toContain('tiktok=db');
    expect(mocks.revoke).toHaveBeenCalledWith('unstored-access-token', secrets);
  });

  it('reste en échec propre même si le nettoyage best-effort échoue', async () => {
    mocks.fetchProfile.mockRejectedValue(new mocks.MockTikTokUserInfoFetchError('Profil indisponible.'));
    mocks.revoke.mockRejectedValue(new mocks.MockTikTokRevokeError('Révocation indisponible.'));

    const response = await tiktokCallback(callbackRequest());

    expect(response.headers.get('location')).toContain('tiktok=profile');
    expect(mocks.revoke).toHaveBeenCalledOnce();
  });
});

describe('bootstrap post-connexion non bloquant', () => {
  it('redirige après le stockage puis limite le travail différé au profil', async () => {
    const response = await tiktokCallback(callbackRequest());

    expect(response.headers.get('location')).toContain('tiktok=connected');
    expect(mocks.scheduleAfter).toHaveBeenCalledOnce();
    expect(mocks.syncProfile).not.toHaveBeenCalled();
    expect(mocks.syncVideos).not.toHaveBeenCalled();

    await mocks.afterCallbacks[0]?.();

    expect(mocks.syncProfile).toHaveBeenCalledWith('user-1', 'account-1');
    expect(mocks.syncVideos).not.toHaveBeenCalled();
  });
});
