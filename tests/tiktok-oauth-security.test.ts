import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTikTokOAuthState,
  exchangeTikTokAuthorizationCode,
  refreshTikTokAccessToken,
  revokeTikTokAccess,
  TikTokTokenRefreshError,
  verifyTikTokOAuthState,
} from '@/lib/tiktok-oauth';

const secrets = {
  clientKey: 'client-key-test',
  clientSecret: 'client-secret-test',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('état OAuth TikTok lié à la session', () => {
  it('valide uniquement le même utilisateur et le même état signé', () => {
    const oauthState = createTikTokOAuthState('user-1', secrets.clientSecret);

    expect(oauthState.state).not.toContain('user-1');
    expect(verifyTikTokOAuthState({
      state: oauthState.state,
      cookieValue: oauthState.cookieValue,
      userId: 'user-1',
      clientSecret: secrets.clientSecret,
    })).toBe(true);

    expect(verifyTikTokOAuthState({
      state: oauthState.state,
      cookieValue: oauthState.cookieValue,
      userId: 'user-2',
      clientSecret: secrets.clientSecret,
    })).toBe(false);
  });

  it('rejette un état ou un cookie altéré', () => {
    const oauthState = createTikTokOAuthState('user-1', secrets.clientSecret);
    const lastCharacter = oauthState.state.at(-1);
    const tamperedState = `${oauthState.state.slice(0, -1)}${lastCharacter === 'a' ? 'b' : 'a'}`;

    expect(verifyTikTokOAuthState({
      state: tamperedState,
      cookieValue: oauthState.cookieValue,
      userId: 'user-1',
      clientSecret: secrets.clientSecret,
    })).toBe(false);
    expect(verifyTikTokOAuthState({
      state: oauthState.state,
      cookieValue: `${oauthState.cookieValue}a`,
      userId: 'user-1',
      clientSecret: secrets.clientSecret,
    })).toBe(false);
  });
});

describe('révocation TikTok vérifiée', () => {
  it('accepte uniquement une réponse HTTP réussie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeTikTokAccess('access-token', secrets)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('remonte un refus non-2xx du fournisseur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'invalid_request' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )));

    await expect(revokeTikTokAccess('access-token', secrets)).rejects.toMatchObject({
      reason: 'provider',
      status: 400,
    });
  });

  it('refuse un payload TikTok en erreur même avec un HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'invalid_request', message: 'invalid token' },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await expect(revokeTikTokAccess('access-token', secrets)).rejects.toMatchObject({
      reason: 'provider',
      status: 200,
    });
  });

  it('interrompt une révocation qui dépasse le délai', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string | URL | Request, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      })
    )));

    await expect(revokeTikTokAccess('access-token', secrets, { timeoutMs: 5 })).rejects.toMatchObject({
      reason: 'timeout',
      status: null,
    });
  });
});

describe('erreurs de jeton TikTok sans fuite du payload fournisseur', () => {
  it('rejette un HTTP 200 sans access_token avec une erreur temporaire neutre', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'contenu fournisseur à ne pas exposer',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await expect(exchangeTikTokAuthorizationCode(
      'oauth-code',
      'https://www.viralynz.com/api/tiktok/callback',
      secrets
    )).rejects.toThrow('Réponse token TikTok sans access_token.');

    const refreshError = await refreshTikTokAccessToken('refresh-token', secrets).catch((error: unknown) => error);
    expect(refreshError).toBeInstanceOf(TikTokTokenRefreshError);
    if (!(refreshError instanceof TikTokTokenRefreshError)) throw new Error('Erreur typée attendue.');
    expect(refreshError).toMatchObject({
      reason: 'invalid_refresh',
      retryable: false,
      status: 200,
    });
    expect(refreshError.message).not.toContain('contenu fournisseur');
  });

  it.each([
    ['limitation 429', 429, JSON.stringify({ error_description: 'secret rate limit' }), 'rate_limited'],
    ['indisponibilité 503', 503, JSON.stringify({ error_description: 'secret upstream' }), 'provider_unavailable'],
    ['payload 200 malformé', 200, '<html>secret payload</html>', 'invalid_response'],
  ])('classe %s comme temporaire sans exposer le payload', async (_label, status, body, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    })));

    const refreshError = await refreshTikTokAccessToken('refresh-token', secrets).catch((error: unknown) => error);
    expect(refreshError).toBeInstanceOf(TikTokTokenRefreshError);
    if (!(refreshError instanceof TikTokTokenRefreshError)) throw new Error('Erreur typée attendue.');
    expect(refreshError).toMatchObject({ reason, retryable: true, status });
    expect(refreshError.message).not.toContain('secret');
  });

  it.each([400, 401])('classe HTTP %i comme refresh invalide permanent', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'provider-private-code',
      error_description: 'provider-private-message',
    }), { status, headers: { 'content-type': 'application/json' } })));

    const refreshError = await refreshTikTokAccessToken('refresh-token', secrets).catch((error: unknown) => error);
    expect(refreshError).toBeInstanceOf(TikTokTokenRefreshError);
    if (!(refreshError instanceof TikTokTokenRefreshError)) throw new Error('Erreur typée attendue.');
    expect(refreshError).toMatchObject({
      reason: 'invalid_refresh',
      retryable: false,
      status,
    });
    expect(refreshError.message).not.toContain('provider-private');
  });
});
