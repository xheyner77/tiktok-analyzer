import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  class MockTikTokRevokeError extends Error {
    reason: 'timeout' | 'network' | 'provider';
    status: number | null;

    constructor(reason: 'timeout' | 'network' | 'provider', status: number | null = null) {
      super('Révocation refusée.');
      this.reason = reason;
      this.status = status;
    }
  }

  return {
    MockTikTokRevokeError,
    getSession: vi.fn(),
    getSecrets: vi.fn(),
    revoke: vi.fn(),
    getAccount: vi.fn(),
    listDisconnectable: vi.fn(),
    disconnectAccount: vi.fn(),
    revealToken: vi.fn(),
    from: vi.fn(),
    legacyRead: vi.fn(),
    usersUpdate: vi.fn(),
    usersUpdateEq: vi.fn(),
    accountsUpdate: vi.fn(),
    accountsUpdateEq: vi.fn(),
    accountsUpdateNeq: vi.fn(),
  };
});

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/tiktok-oauth', () => ({
  getTikTokOAuthSecrets: mocks.getSecrets,
  revokeTikTokAccess: mocks.revoke,
  TikTokRevokeError: mocks.MockTikTokRevokeError,
}));
vi.mock('@/lib/tiktok-accounts', () => ({
  getTikTokAccountForUser: mocks.getAccount,
  listDisconnectableTikTokPrivateAccountsForUser: mocks.listDisconnectable,
  disconnectTikTokAccount: mocks.disconnectAccount,
}));
vi.mock('@/lib/tiktok-crypto', () => ({ revealTikTokToken: mocks.revealToken }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from } }));

import { DELETE as disconnectOneAccount } from '@/app/api/tiktok/accounts/[id]/disconnect/route';
import { POST as disconnectAllAccounts } from '@/app/api/tiktok/disconnect/route';

const account = {
  id: 'account-1',
  userId: 'user-1',
  accessToken: 'access-token',
  status: 'active',
};

function globalDisconnectRequest(headers?: HeadersInit) {
  return new NextRequest('https://www.viralynz.com/api/tiktok/disconnect', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ userId: 'user-1', email: 'createur@example.com' });
  mocks.getSecrets.mockReturnValue({ clientKey: 'client-key', clientSecret: 'client-secret' });
  mocks.revoke.mockResolvedValue(undefined);
  mocks.getAccount.mockResolvedValue(account);
  mocks.listDisconnectable.mockResolvedValue([account]);
  mocks.disconnectAccount.mockResolvedValue({ ok: true });
  mocks.revealToken.mockImplementation((value: string | null) => value);
  mocks.legacyRead.mockResolvedValue({ data: { tiktok_access_token: null }, error: null });
  mocks.usersUpdateEq.mockResolvedValue({ error: null });
  mocks.usersUpdate.mockReturnValue({ eq: mocks.usersUpdateEq });
  mocks.accountsUpdateNeq.mockResolvedValue({ error: null });
  mocks.accountsUpdateEq.mockReturnValue({ neq: mocks.accountsUpdateNeq });
  mocks.accountsUpdate.mockReturnValue({ eq: mocks.accountsUpdateEq });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.legacyRead })),
        })),
        update: mocks.usersUpdate,
      };
    }
    if (table === 'tiktok_accounts') return { update: mocks.accountsUpdate };
    throw new Error(`Table inattendue : ${table}`);
  });
});

describe('déconnexion d’un compte TikTok', () => {
  it('ne supprime pas le jeton local si TikTok refuse la révocation', async () => {
    mocks.revoke.mockRejectedValue(new mocks.MockTikTokRevokeError('provider', 400));

    const response = await disconnectOneAccount(
      new NextRequest('https://www.viralynz.com/api/tiktok/accounts/account-1/disconnect', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'account-1' }) }
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: 'TIKTOK_REVOCATION_FAILED' });
    expect(mocks.disconnectAccount).not.toHaveBeenCalled();
  });

  it('nettoie le compte local seulement après confirmation TikTok', async () => {
    const response = await disconnectOneAccount(
      new NextRequest('https://www.viralynz.com/api/tiktok/accounts/account-1/disconnect', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'account-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith('access-token', {
      clientKey: 'client-key',
      clientSecret: 'client-secret',
    });
    expect(mocks.disconnectAccount).toHaveBeenCalledWith('user-1', 'account-1');
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.disconnectAccount.mock.invocationCallOrder[0]
    );
  });
});

describe('déconnexion globale TikTok', () => {
  it('conserve toutes les données locales si une révocation fournisseur échoue', async () => {
    mocks.revoke.mockRejectedValue(new mocks.MockTikTokRevokeError('timeout'));

    const response = await disconnectAllAccounts(globalDisconnectRequest());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ code: 'TIKTOK_REVOCATION_FAILED' });
    expect(mocks.accountsUpdate).not.toHaveBeenCalled();
    expect(mocks.usersUpdate).not.toHaveBeenCalled();
  });

  it('révoque puis nettoie les comptes et les colonnes historiques', async () => {
    const response = await disconnectAllAccounts(globalDisconnectRequest());

    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledOnce();
    expect(mocks.accountsUpdate).toHaveBeenCalledOnce();
    expect(mocks.usersUpdate).toHaveBeenCalledOnce();
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.accountsUpdate.mock.invocationCallOrder[0]
    );
    expect(mocks.accountsUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.usersUpdate.mock.invocationCallOrder[0]
    );
  });

  it('nettoie les comptes confirmés et laisse les autres retentables en cas d’échec partiel', async () => {
    const secondAccount = {
      ...account,
      id: 'account-2',
      accessToken: 'failed-access-token',
    };
    mocks.listDisconnectable.mockResolvedValue([account, secondAccount]);
    mocks.revoke.mockImplementation(async (token: string) => {
      if (token === 'failed-access-token') {
        throw new mocks.MockTikTokRevokeError('provider', 400);
      }
    });

    const response = await disconnectAllAccounts(globalDisconnectRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: 'TIKTOK_PARTIAL_REVOCATION_FAILED',
      disconnectedAccounts: 1,
    });
    expect(mocks.disconnectAccount).toHaveBeenCalledOnce();
    expect(mocks.disconnectAccount).toHaveBeenCalledWith('user-1', 'account-1');
    expect(mocks.accountsUpdate).not.toHaveBeenCalled();
    expect(mocks.usersUpdate).not.toHaveBeenCalled();
  });

  it('refuse une mutation navigateur cross-site avant de lire la session', async () => {
    const response = await disconnectAllAccounts(globalDisconnectRequest({
      origin: 'https://site-malveillant.example',
      'sec-fetch-site': 'cross-site',
    }));

    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});
