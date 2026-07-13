import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbResult = {
  data?: { id: string } | null;
  error: { code: string; message: string } | null;
};

const mocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
  fetchProfile: vi.fn(),
  updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
  upserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
  updateResults: new Map<string, DbResult[]>(),
  upsertResults: new Map<string, DbResult[]>(),
}));

function nextResult(results: Map<string, DbResult[]>, table: string): DbResult {
  const result = results.get(table)?.shift();
  if (!result) return { data: { id: 'account-1' }, error: null };
  if (result.data === undefined) {
    return { ...result, data: result.error ? null : { id: 'account-1' } };
  }
  return result;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        mocks.updates.push({ table, values });
        const builder = {
          eq: vi.fn(),
          select: vi.fn(),
          maybeSingle: vi.fn(async () => nextResult(mocks.updateResults, table)),
          then: (
            resolve: (value: DbResult) => unknown,
            reject?: (reason: unknown) => unknown
          ) => Promise.resolve(nextResult(mocks.updateResults, table)).then(resolve, reject),
        };
        builder.eq.mockReturnValue(builder);
        builder.select.mockReturnValue(builder);
        return builder;
      },
      upsert: async (values: Record<string, unknown>) => {
        mocks.upserts.push({ table, values });
        return nextResult(mocks.upsertResults, table);
      },
    }),
  },
}));

vi.mock('@/lib/tiktok-accounts', () => ({
  getTikTokAccountForUser: mocks.getAccount,
  updateTikTokAccountTokens: vi.fn(),
}));

vi.mock('@/lib/tiktok-oauth', () => {
  class MockTikTokApiRequestError extends Error {}
  class MockTikTokTokenRefreshError extends Error {
    retryable = false;
  }

  return {
    fetchTikTokApiResponse: vi.fn(),
    fetchTikTokUserInfo: mocks.fetchProfile,
    getTikTokOAuthSecrets: vi.fn(),
    refreshTikTokAccessToken: vi.fn(),
    TikTokApiRequestError: MockTikTokApiRequestError,
    TikTokTokenRefreshError: MockTikTokTokenRefreshError,
  };
});

import type { TikTokAccountPrivate } from '@/lib/tiktok-accounts';
import { syncTikTokAccountProfile } from '@/lib/tiktok-sync';
import { getTikTokCapabilities } from '@/lib/tiktok/capabilities';

function createAccount(): TikTokAccountPrivate {
  const scopes = ['user.info.basic', 'user.info.profile', 'user.info.stats'];
  const refreshExpiresAt = new Date(Date.now() + 86_400_000).toISOString();

  return {
    id: 'account-1',
    userId: 'user-1',
    openId: 'open-id-1',
    displayName: 'Créatrice test',
    avatarUrl: null,
    username: null,
    scopes,
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
    status: 'active',
    syncStatus: 'connected',
    syncError: null,
    canSyncVideos: false,
    environment: 'production',
    capabilities: getTikTokCapabilities({
      scopes,
      environment: 'production',
      refreshTokenExpiresAt: refreshExpiresAt,
    }),
    needsReconnect: false,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    refreshExpiresAt,
  };
}

const profile = {
  open_id: 'open-id-1',
  union_id: 'union-id-1',
  display_name: 'Créatrice test',
  avatar_url: 'https://example.com/avatar.jpg',
  follower_count: 120,
  following_count: 40,
  likes_count: 1_400,
  video_count: 12,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.splice(0);
  mocks.upserts.splice(0);
  mocks.updateResults.clear();
  mocks.upsertResults.clear();
  mocks.getAccount.mockResolvedValue(createAccount());
  mocks.fetchProfile.mockResolvedValue(profile);
});

describe('intégrité des écritures du profil TikTok', () => {
  it('ignore un compte révoqué sans le réactiver pendant le travail différé', async () => {
    mocks.getAccount.mockResolvedValue({
      ...createAccount(),
      status: 'revoked',
      accessToken: null,
      refreshToken: null,
    });

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'skipped',
      reason: 'inactive_account',
      needsReconnect: false,
    });
    expect(mocks.fetchProfile).not.toHaveBeenCalled();
    expect(mocks.updates).toHaveLength(0);
    expect(mocks.upserts).toHaveLength(0);
  });

  it('renvoie failed si le compte ne peut pas être mis à jour', async () => {
    mocks.updateResults.set('tiktok_accounts', [
      { error: { code: 'PGRST500', message: 'internal account write detail' } },
      { error: null },
    ]);

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      reason: 'account_write_failed',
      needsReconnect: false,
    });
    expect(mocks.upserts).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain('internal account write detail');
  });

  it('arrête les stats si une révocation gagne la course avant le write profil', async () => {
    mocks.updateResults.set('tiktok_accounts', [
      { data: null, error: null },
    ]);

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'skipped',
      reason: 'account_inactive',
      needsReconnect: false,
    });
    expect(mocks.upserts).toHaveLength(0);
  });

  it('renvoie partial si les statistiques ne peuvent pas être enregistrées', async () => {
    mocks.upsertResults.set('tiktok_profile_stats', [
      { error: { code: '23505', message: 'internal stats write detail' } },
    ]);

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'partial',
      reason: 'profile_stats_write_failed',
      needsReconnect: false,
    });
    expect(mocks.updates).toContainEqual({
      table: 'tiktok_accounts',
      values: expect.objectContaining({ sync_status: 'profile_partial' }),
    });
    expect(JSON.stringify(result)).not.toContain('internal stats write detail');
  });

  it('renvoie partial si l’état final du compte ne peut pas être confirmé', async () => {
    mocks.updateResults.set('tiktok_accounts', [
      { error: null },
      { error: { code: 'PGRST500', message: 'internal final state detail' } },
    ]);

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'partial',
      reason: 'profile_state_write_failed',
      needsReconnect: false,
    });
    expect(JSON.stringify(result)).not.toContain('internal final state detail');
  });

  it('ne confirme pas le sync si le compte devient inactif avant le write final', async () => {
    mocks.updateResults.set('tiktok_accounts', [
      { error: null },
      { data: null, error: null },
    ]);

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'partial',
      reason: 'profile_state_write_failed',
      needsReconnect: false,
    });
  });

  it('ne renvoie success qu’après confirmation de toutes les écritures', async () => {
    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({ ok: true, status: 'success', profile });
    expect(mocks.upserts).toContainEqual({
      table: 'tiktok_profile_stats',
      values: expect.objectContaining({
        user_id: 'user-1',
        tiktok_account_id: 'account-1',
        follower_count: 120,
      }),
    });
    expect(mocks.updates).toContainEqual({
      table: 'tiktok_accounts',
      values: expect.objectContaining({
        sync_status: 'profile_success',
        sync_error: null,
      }),
    });
  });
});
