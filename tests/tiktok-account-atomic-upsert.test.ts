import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getUserById: vi.fn(),
  getEffectivePlan: vi.fn(),
  canConnect: vi.fn(),
  getLimit: vi.fn(),
  protectToken: vi.fn((value: string | null | undefined) => value ? `enc:${value}` : null),
  isProtectedToken: vi.fn(() => true),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserById: mocks.getUserById,
  getEffectivePlan: mocks.getEffectivePlan,
}));

vi.mock('@/lib/tiktok-account-limits', () => ({
  canConnectTikTokAccount: mocks.canConnect,
  formatTikTokAccountLimit: (limit: number) => Number.isFinite(limit) ? String(limit) : 'illimite',
  getTikTokAccountLimitForPlan: mocks.getLimit,
}));

vi.mock('@/lib/tiktok-crypto', () => ({
  isProtectedTikTokToken: mocks.isProtectedToken,
  protectTikTokToken: mocks.protectToken,
  revealTikTokToken: (value: string | null | undefined) => value ?? null,
}));

vi.mock('@/lib/tiktok/capabilities', () => ({
  getConfiguredTikTokEnvironment: () => 'production',
  getTikTokCapabilities: () => ({
    environment: 'production',
    needsReconnect: false,
  }),
}));

vi.mock('@/lib/tiktok/scopes', () => ({
  parseTikTokScopes: (value: unknown) => typeof value === 'string'
    ? value.split(',').map((scope) => scope.trim()).filter(Boolean)
    : [],
}));

import {
  getTikTokAccountForUser,
  updateTikTokAccountTokens,
  upsertTikTokAccountForUser,
} from '@/lib/tiktok-accounts';

const profile = {
  open_id: 'open-user-1',
  union_id: 'union-user-1',
  display_name: 'Compte test',
  avatar_url: 'https://example.test/avatar.png',
};

const tokens = {
  access_token: 'access-secret',
  refresh_token: 'refresh-secret',
  expires_in: 86_400,
  refresh_expires_in: 2_592_000,
  scope: 'user.info.basic,video.list',
  open_id: 'open-user-1',
};

function createQueries(tokenUpdateData: unknown = { id: 'account-atomic' }) {
  const accountsQuery = {
    upsert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => ({ data: { id: 'account-fallback' }, error: null })),
    maybeSingle: vi.fn(async () => ({ data: tokenUpdateData, error: null })),
  };
  accountsQuery.upsert.mockReturnValue(accountsQuery);
  accountsQuery.update.mockReturnValue(accountsQuery);
  accountsQuery.select.mockReturnValue(accountsQuery);
  accountsQuery.eq.mockReturnValue(accountsQuery);

  const usersQuery = {
    update: vi.fn(),
    eq: vi.fn(async () => ({ data: null, error: null })),
  };
  usersQuery.update.mockReturnValue(usersQuery);

  mocks.from.mockImplementation((table: string) => {
    if (table === 'tiktok_accounts') return accountsQuery;
    if (table === 'users') return usersQuery;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { accountsQuery, usersQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({ id: 'user-1', plan: 'starter' });
  mocks.getEffectivePlan.mockReturnValue('starter');
  mocks.getLimit.mockReturnValue(1);
  mocks.canConnect.mockResolvedValue({ allowed: true, limit: 1, current: 0, remaining: 1 });
  mocks.isProtectedToken.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({
    data: [{ account_id: 'account-atomic', allowed: true, current_count: 1, limit_value: 1 }],
    error: null,
  });
});

describe('upsert TikTok atomique', () => {
  it('confie le controle de limite et l upsert chiffre a une seule RPC', async () => {
    const { accountsQuery, usersQuery } = createQueries();

    const result = await upsertTikTokAccountForUser({ userId: 'user-1', profile, tokens });

    expect(result).toMatchObject({ ok: true, accountId: 'account-atomic' });
    expect(mocks.rpc).toHaveBeenCalledWith('upsert_tiktok_account_with_limit', expect.objectContaining({
      p_user_id: 'user-1',
      p_account_limit: 1,
      p_tiktok_open_id: 'open-user-1',
      p_access_token: 'enc:access-secret',
      p_refresh_token: 'enc:refresh-secret',
      p_scopes: ['user.info.basic', 'video.list'],
    }));
    expect(accountsQuery.upsert).not.toHaveBeenCalled();
    expect(usersQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      tiktok_access_token: null,
      tiktok_refresh_token: null,
    }));
  });

  it('retourne la limite sans effectuer un second write applicatif', async () => {
    const { accountsQuery, usersQuery } = createQueries();
    mocks.rpc.mockResolvedValue({
      data: [{ account_id: null, allowed: false, current_count: 1, limit_value: 1 }],
      error: null,
    });

    const result = await upsertTikTokAccountForUser({ userId: 'user-1', profile, tokens });

    expect(result).toMatchObject({ ok: false, code: 'limit_reached', limit: 1, current: 1 });
    expect(accountsQuery.upsert).not.toHaveBeenCalled();
    expect(usersQuery.update).not.toHaveBeenCalled();
  });

  it('utilise le fallback temporaire uniquement quand PostgREST confirme la RPC absente', async () => {
    const { accountsQuery } = createQueries();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });

    const result = await upsertTikTokAccountForUser({ userId: 'user-1', profile, tokens });

    expect(result).toMatchObject({ ok: true, accountId: 'account-fallback' });
    expect(mocks.canConnect).toHaveBeenCalledWith('user-1', 'starter', {
      excludingOpenId: 'open-user-1',
    });
    expect(accountsQuery.upsert).toHaveBeenCalledOnce();
  });

  it('echoue ferme sur toute autre erreur RPC', async () => {
    const { accountsQuery, usersQuery } = createQueries();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });

    const result = await upsertTikTokAccountForUser({ userId: 'user-1', profile, tokens });

    expect(result).toMatchObject({ ok: false, code: 'db_error' });
    expect(mocks.canConnect).not.toHaveBeenCalled();
    expect(accountsQuery.upsert).not.toHaveBeenCalled();
    expect(usersQuery.update).not.toHaveBeenCalled();
  });

  it('transmet null a la RPC quand une limite illimitee est configuree', async () => {
    createQueries();
    mocks.getLimit.mockReturnValue(Number.POSITIVE_INFINITY);

    await upsertTikTokAccountForUser({ userId: 'user-1', profile, tokens });

    expect(mocks.rpc).toHaveBeenCalledWith(
      'upsert_tiktok_account_with_limit',
      expect.objectContaining({ p_account_limit: null }),
    );
  });
});

describe('CAS du refresh token TikTok', () => {
  it('ne reactive jamais un compte revoque pendant un refresh concurrent', async () => {
    const { accountsQuery } = createQueries(null);

    const result = await updateTikTokAccountTokens({
      userId: 'user-1',
      accountId: 'account-1',
      tokens,
    });

    expect(result).toMatchObject({ ok: false, error: 'ACCOUNT_INACTIVE' });
    expect(accountsQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(accountsQuery.select).toHaveBeenCalledWith('id');
    expect(accountsQuery.update).toHaveBeenCalledWith(expect.not.objectContaining({
      status: 'active',
    }));
  });
});

describe('CAS du rechiffrement des anciens tokens TikTok', () => {
  it('ne reecrit pas un token devenu stale pendant une deconnexion concurrente', async () => {
    const { accountsQuery } = createQueries();
    const legacyRow = {
      id: 'account-legacy',
      user_id: 'user-1',
      tiktok_open_id: 'open-user-1',
      display_name: 'Compte test',
      avatar_url: null,
      username: null,
      scopes: [],
      connected_at: '2026-07-13T10:00:00.000Z',
      last_sync_at: null,
      status: 'active',
      sync_status: 'connected',
      sync_error: null,
      access_token: 'legacy-access-secret',
      refresh_token: 'legacy-refresh-secret',
      expires_at: '2026-07-14T10:00:00.000Z',
      refresh_expires_at: '2026-08-13T10:00:00.000Z',
      environment: 'production',
      updated_at: '2026-07-13T10:00:00.000Z',
    };
    mocks.isProtectedToken.mockReturnValue(false);
    accountsQuery.maybeSingle
      .mockResolvedValueOnce({ data: legacyRow, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await getTikTokAccountForUser('user-1', 'account-legacy');

    expect(result?.id).toBe('account-legacy');
    expect(accountsQuery.update).toHaveBeenCalledWith({
      access_token: 'enc:legacy-access-secret',
      refresh_token: 'enc:legacy-refresh-secret',
    });
    expect(accountsQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(accountsQuery.eq).toHaveBeenCalledWith(
      'updated_at',
      '2026-07-13T10:00:00.000Z',
    );
    expect(accountsQuery.select).toHaveBeenCalledWith('id');
    expect(accountsQuery.select).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('updated_at'),
    );
    expect(accountsQuery.maybeSingle).toHaveBeenCalledTimes(2);
    expect(accountsQuery.eq).not.toHaveBeenCalledWith(
      'access_token',
      'legacy-access-secret',
    );
    expect(accountsQuery.eq).not.toHaveBeenCalledWith(
      'refresh_token',
      'legacy-refresh-secret',
    );
  });

  it('ne tente jamais de rechiffrer une ligne deja revoquee', async () => {
    const { accountsQuery } = createQueries();
    mocks.isProtectedToken.mockReturnValue(false);
    accountsQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'account-revoked',
        user_id: 'user-1',
        tiktok_open_id: 'open-user-1',
        display_name: null,
        avatar_url: null,
        username: null,
        scopes: [],
        connected_at: '2026-07-13T10:00:00.000Z',
        last_sync_at: null,
        status: 'revoked',
        access_token: 'legacy-access-secret',
        refresh_token: null,
        expires_at: null,
        refresh_expires_at: null,
        environment: 'production',
        updated_at: '2026-07-13T10:00:00.000Z',
      },
      error: null,
    });

    await getTikTokAccountForUser('user-1', 'account-revoked');

    expect(accountsQuery.update).not.toHaveBeenCalled();
    expect(accountsQuery.maybeSingle).toHaveBeenCalledOnce();
  });
});
