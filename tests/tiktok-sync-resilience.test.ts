import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
  updateTokens: vi.fn(),
  updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        mocks.updates.push({ table, values });
        const builder = {
          eq: vi.fn(),
          select: vi.fn(),
          maybeSingle: vi.fn(async () => ({ data: { id: 'account-1' }, error: null })),
        };
        builder.eq.mockReturnValue(builder);
        builder.select.mockReturnValue(builder);
        return builder;
      },
      insert: (values: Record<string, unknown>) => {
        mocks.inserts.push({ table, values });
        return {
          select: () => ({
            single: async () => ({ data: { id: 'sync-run-1' }, error: null }),
          }),
        };
      },
    }),
  },
}));

vi.mock('@/lib/tiktok-accounts', () => ({
  getTikTokAccountForUser: mocks.getAccount,
  updateTikTokAccountTokens: mocks.updateTokens,
}));

import type { TikTokAccountPrivate } from '@/lib/tiktok-accounts';
import { syncTikTokAccountProfile, syncTikTokAccountVideos } from '@/lib/tiktok-sync';
import { getTikTokCapabilities } from '@/lib/tiktok/capabilities';

const TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
];
const TRANSIENT_MESSAGE =
  'Le renouvellement TikTok est temporairement indisponible. Réessaie dans un instant.';

function createAccount(options: { accessExpired?: boolean } = {}): TikTokAccountPrivate {
  const refreshExpiresAt = new Date(Date.now() + 86_400_000).toISOString();
  const capabilities = getTikTokCapabilities({
    scopes: TIKTOK_SCOPES,
    environment: 'production',
    refreshTokenExpiresAt: refreshExpiresAt,
  });

  return {
    id: 'account-1',
    userId: 'user-1',
    openId: 'open-id-1',
    displayName: 'Créatrice test',
    avatarUrl: null,
    username: null,
    scopes: TIKTOK_SCOPES,
    connectedAt: new Date().toISOString(),
    lastSyncAt: null,
    status: 'active',
    syncStatus: null,
    syncError: null,
    canSyncVideos: true,
    environment: 'production',
    capabilities,
    needsReconnect: false,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() + (options.accessExpired ? -60_000 : 86_400_000)).toISOString(),
    refreshExpiresAt,
  };
}

function latestAccountUpdate(): Record<string, unknown> | undefined {
  return [...mocks.updates].reverse().find((entry) => entry.table === 'tiktok_accounts')?.values;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.splice(0);
  mocks.inserts.splice(0);
  vi.stubEnv('TIKTOK_CLIENT_KEY', 'client-key-test');
  vi.stubEnv('TIKTOK_CLIENT_SECRET', 'client-secret-test');
  mocks.getAccount.mockResolvedValue(createAccount({ accessExpired: true }));
  mocks.updateTokens.mockResolvedValue({ ok: true, expiresAt: new Date().toISOString() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('refresh TikTok résilient', () => {
  it.each([
    ['HTTP 429', 429, JSON.stringify({ error_description: 'provider secret 429' })],
    ['HTTP 503', 503, JSON.stringify({ error_description: 'provider secret 503' })],
    ['payload malformé', 200, '<html>provider secret malformed</html>'],
  ])('conserve la connexion active sur %s', async (_label, status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    })));

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      reason: 'refresh_unavailable',
      needsReconnect: false,
      error: TRANSIENT_MESSAGE,
    });
    expect(latestAccountUpdate()).toEqual({
      sync_status: 'failed',
      sync_error: TRANSIENT_MESSAGE,
    });
    expect(JSON.stringify(result)).not.toContain('provider secret');
  });

  it('conserve la connexion active sur une panne réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider network secret')));

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      reason: 'refresh_unavailable',
      needsReconnect: false,
      error: TRANSIENT_MESSAGE,
    });
    expect(latestAccountUpdate()).not.toHaveProperty('status');
    expect(JSON.stringify(result)).not.toContain('provider network secret');
  });

  it('conserve la connexion active sur un timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string | URL | Request, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('provider timeout secret');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      })
    )));

    const pendingResult = syncTikTokAccountProfile('user-1', 'account-1');
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await pendingResult;

    expect(result).toMatchObject({
      ok: false,
      reason: 'refresh_unavailable',
      needsReconnect: false,
      error: TRANSIENT_MESSAGE,
    });
    expect(latestAccountUpdate()).not.toHaveProperty('status');
    expect(JSON.stringify(result)).not.toContain('provider timeout secret');
  });

  it.each([
    ['HTTP 400', 400, JSON.stringify({ error_description: 'provider invalid secret' })],
    ['HTTP 401', 401, JSON.stringify({ error_description: 'provider invalid secret' })],
    ['invalid_grant explicite', 200, JSON.stringify({ error: 'invalid_grant', error_description: 'provider invalid secret' })],
  ])('demande une reconnexion uniquement pour %s', async (_label, status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    })));

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      reason: 'refresh_invalid',
      needsReconnect: true,
      error: 'Reconnecte TikTok pour renouveler les permissions.',
    });
    expect(latestAccountUpdate()).toEqual({
      sync_status: 'expired',
      sync_error: 'Reconnecte TikTok pour renouveler les permissions.',
      status: 'expired',
    });
    expect(JSON.stringify(result)).not.toContain('provider invalid secret');
  });
});

describe('échecs de synchronisation sans déconnexion', () => {
  it('conserve le compte actif si la synchronisation du profil échoue', async () => {
    mocks.getAccount.mockResolvedValue(createAccount());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'temporarily_unavailable', message: 'provider profile secret' },
    }), { status: 503, headers: { 'content-type': 'application/json' } })));

    const result = await syncTikTokAccountProfile('user-1', 'account-1');

    expect(result).toMatchObject({ ok: false, status: 'failed', needsReconnect: false });
    expect(latestAccountUpdate()).toMatchObject({ sync_status: 'failed' });
    expect(latestAccountUpdate()).not.toHaveProperty('status');
    expect(JSON.stringify(result)).not.toContain('provider profile secret');
  });

  it('conserve le compte actif si la synchronisation vidéo échoue', async () => {
    mocks.getAccount.mockResolvedValue(createAccount());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider video secret')));

    const result = await syncTikTokAccountVideos('user-1', 'account-1');

    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      videosFound: 0,
      needsReconnect: false,
    });
    expect(latestAccountUpdate()).toMatchObject({ sync_status: 'failed' });
    expect(latestAccountUpdate()).not.toHaveProperty('status');
    expect(mocks.inserts).toContainEqual({
      table: 'tiktok_sync_runs',
      values: { user_id: 'user-1', tiktok_account_id: 'account-1', status: 'running' },
    });
    expect(JSON.stringify(result)).not.toContain('provider video secret');
  });
});
