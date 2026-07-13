import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const cookieValues = new Map<string, string>();
  const cookieSet = vi.fn((name: string, value: string, options?: { maxAge?: number }) => {
    if (options?.maxAge === 0) cookieValues.delete(name);
    else cookieValues.set(name, value);
  });

  return {
    cookieValues,
    cookieSet,
    getSupabaseAuth: vi.fn(),
    refreshFetch: vi.fn(),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
    ensureUserProfile: vi.fn(),
    getUserById: vi.fn(),
    getEffectivePlan: vi.fn(),
    listTikTokAccountsForUser: vi.fn(),
    upsert: vi.fn(),
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: mocks.cookieSet,
  })),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAuth: mocks.getSupabaseAuth,
  supabase: {
    from: vi.fn(() => ({ upsert: mocks.upsert })),
  },
}));

vi.mock('@/lib/auth', () => ({
  ensureUserProfile: mocks.ensureUserProfile,
  getUserById: mocks.getUserById,
  getEffectivePlan: mocks.getEffectivePlan,
}));

vi.mock('@/lib/tiktok-accounts', () => ({
  listTikTokAccountsForUser: mocks.listTikTokAccountsForUser,
}));

vi.mock('@/lib/site-url', () => ({
  getAuthEmailCallbackUrl: () => 'https://www.viralynz.com/auth/callback',
}));

import {
  ACCESS_TOKEN_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  clearSessionCookies,
  getSession,
  getSessionVerification,
  setSessionCookies,
} from '@/lib/session';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as authMeGet } from '@/app/api/auth/me/route';
import { POST as signupPost } from '@/app/api/auth/signup/route';
import { middleware } from '@/middleware';

function authClient() {
  return {
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      setSession: mocks.setSession,
      signOut: mocks.signOut,
    },
  };
}

function jsonRequest(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`https://www.viralynz.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.viralynz.com',
    },
    body: JSON.stringify(body),
  });
}

function jwtWithExpiry(expirySeconds: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ exp: expirySeconds })}.signature`;
}

beforeEach(() => {
  mocks.cookieValues.clear();
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-test-key');

  const client = authClient();
  mocks.getSupabaseAuth.mockReturnValue(client);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.refreshFetch.mockResolvedValue(new Response(
    JSON.stringify({ error: 'invalid_grant' }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', mocks.refreshFetch);
  mocks.setSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.listTikTokAccountsForUser.mockResolvedValue([]);
  mocks.getEffectivePlan.mockReturnValue('free');
});

describe('session Supabase vérifiée côté serveur', () => {
  it('rejette sans appel distant le JWT applicatif historique', async () => {
    mocks.cookieValues.set(LEGACY_SESSION_COOKIE_NAME, 'ancien.jwt.autonome');

    await expect(getSession()).resolves.toBeNull();
    expect(mocks.getSupabaseAuth).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('utilise getUser distant avec le jeton d’accès courant', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-valid');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-valid');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user_1', email: 'createur@example.com' } },
      error: null,
    });

    await expect(getSession()).resolves.toEqual({
      userId: 'user_1',
      email: 'createur@example.com',
    });
    expect(mocks.getUser).toHaveBeenCalledWith('access-valid');
  });

  it('refuse immédiatement une session expirée ou révoquée par Supabase', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-expired');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-revoked');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'Invalid JWT', status: 401 },
    });

    await expect(getSession()).resolves.toBeNull();
  });

  it('distingue un 401 réel d’une indisponibilité du fournisseur', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-invalid');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-invalid');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'Invalid JWT', status: 401 },
    });

    await expect(getSessionVerification()).resolves.toEqual({ status: 'invalid' });

    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Service unavailable', status: 503 },
    });

    await expect(getSessionVerification()).resolves.toEqual({ status: 'unavailable' });
    expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('access-invalid');
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('refresh-invalid');
  });

  it('classe session_not_found en 400 comme une session invalide', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-signed-out');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-signed-out');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        name: 'AuthSessionMissingError',
        message: 'Session from session_id claim in JWT does not exist',
        status: 400,
        code: 'session_not_found',
      },
    });

    await expect(getSessionVerification()).resolves.toEqual({ status: 'invalid' });
  });

  it('classe user_not_found en 403 comme une session révoquée après suppression du compte', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-deleted-user');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-deleted-user');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        name: 'AuthApiError',
        message: 'User from sub claim in JWT does not exist',
        status: 403,
        code: 'user_not_found',
      },
    });

    await expect(getSessionVerification()).resolves.toEqual({ status: 'invalid' });
  });

  it.each([429, 503])(
    'conserve la session quand getUser est temporairement indisponible (%s)',
    async (status) => {
      mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-temporary-error');
      mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-temporary-error');
      mocks.getUser.mockResolvedValue({
        data: { user: null },
        error: {
          name: 'AuthRetryableFetchError',
          message: 'Auth temporarily unavailable',
          status,
        },
      });

      await expect(getSessionVerification()).resolves.toEqual({ status: 'unavailable' });
      expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('access-temporary-error');
      expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('refresh-temporary-error');
    },
  );

  it('classe une erreur réseau levée comme indisponible sans altérer les cookies', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-network');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-network');
    mocks.getUser.mockRejectedValue(new TypeError('fetch failed'));

    await expect(getSessionVerification()).resolves.toEqual({ status: 'unavailable' });
    expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('access-network');
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('refresh-network');
  });

  it('remplace toute ancienne valeur avec des cookies HttpOnly Lax', async () => {
    mocks.cookieValues.set(LEGACY_SESSION_COOKIE_NAME, 'fixed-legacy-token');
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'fixed-access-token');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'fixed-refresh-token');

    await setSessionCookies({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    expect(mocks.cookieValues.has(LEGACY_SESSION_COOKIE_NAME)).toBe(false);
    expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('new-access');
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('new-refresh');
    const accessWrite = mocks.cookieSet.mock.calls.findLast(
      ([name]) => name === ACCESS_TOKEN_COOKIE_NAME,
    );
    expect(accessWrite?.[2]).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('efface les deux tokens et le cookie historique', async () => {
    mocks.cookieValues.set(LEGACY_SESSION_COOKIE_NAME, 'legacy');
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh');

    await clearSessionCookies();

    expect(mocks.cookieValues.size).toBe(0);
  });
});

describe('routes Auth', () => {
  it('fait tourner la paire de cookies après un login réussi', async () => {
    mocks.cookieValues.set(LEGACY_SESSION_COOKIE_NAME, 'fixed-session');
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user_login', email: 'login@example.com' },
        session: { access_token: 'login-access', refresh_token: 'login-refresh' },
      },
      error: null,
    });
    mocks.ensureUserProfile.mockResolvedValue({ id: 'user_login' });

    const response = await loginPost(jsonRequest('/api/auth/login', {
      email: 'login@example.com',
      password: 'MotDePasse123',
    }));

    expect(response.status).toBe(200);
    expect(mocks.cookieValues.has(LEGACY_SESSION_COOKIE_NAME)).toBe(false);
    expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('login-access');
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('login-refresh');
  });

  it('crée aussi les cookies quand signup retourne directement une session', async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: 'user_signup', email: 'signup@example.com' },
        session: { access_token: 'signup-access', refresh_token: 'signup-refresh' },
      },
      error: null,
    });

    const response = await signupPost(jsonRequest('/api/auth/signup', {
      email: 'signup@example.com',
      password: 'MotDePasse123',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      needsEmailConfirmation: false,
    });
    expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('signup-access');
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('signup-refresh');
  });

  it('révoque globalement la session au logout puis efface les cookies', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'logout-access');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'logout-refresh');
    mocks.setSession.mockResolvedValue({
      data: {
        session: { access_token: 'logout-access', refresh_token: 'logout-refresh' },
        user: { id: 'user_logout' },
      },
      error: null,
    });

    const response = await logoutPost(jsonRequest('/api/auth/logout', {}));

    expect(response.status).toBe(200);
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'logout-access',
      refresh_token: 'logout-refresh',
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(mocks.cookieValues.size).toBe(0);
  });

  it('efface localement les cookies même si la session est déjà invalidée', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'invalid-access');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'invalid-refresh');
    mocks.setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', message: 'Invalid Refresh Token', status: 400 },
    });

    const response = await logoutPost(jsonRequest('/api/auth/logout', {}));

    expect(response.status).toBe(200);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.cookieValues.size).toBe(0);
  });

  it('retourne 503 sans déconnecter quand Supabase Auth est indisponible', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-provider-down');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-provider-down');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Service unavailable', status: 503 },
    });

    const response = await authMeGet();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Session temporairement indisponible. Réessaie dans un instant.',
      code: 'AUTH_UNAVAILABLE',
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.cookieValues.get(ACCESS_TOKEN_COOKIE_NAME)).toBe('access-provider-down');
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('refresh-provider-down');
    expect(mocks.ensureUserProfile).not.toHaveBeenCalled();
  });

  it('purge la session et retourne user null sur un vrai 401', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-revoked');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-revoked');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'Invalid JWT', status: 401 },
    });

    const response = await authMeGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: null });
    expect(mocks.cookieValues.has(ACCESS_TOKEN_COOKIE_NAME)).toBe(false);
    expect(mocks.cookieValues.has(REFRESH_TOKEN_COOKIE_NAME)).toBe(false);
    expect(mocks.ensureUserProfile).not.toHaveBeenCalled();
  });

  it('purge la paire rejouée quand getUser retourne session_not_found en 400', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'replayed-access');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'replayed-refresh');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        name: 'AuthSessionMissingError',
        message: 'Session from session_id claim in JWT does not exist',
        status: 400,
        code: 'session_not_found',
      },
    });

    const response = await authMeGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: null });
    expect(mocks.cookieValues.has(ACCESS_TOKEN_COOKIE_NAME)).toBe(false);
    expect(mocks.cookieValues.has(REFRESH_TOKEN_COOKIE_NAME)).toBe(false);
    expect(mocks.ensureUserProfile).not.toHaveBeenCalled();
  });

  it('purge la paire quand le compte lié au JWT a été supprimé', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'deleted-user-access');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'deleted-user-refresh');
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        name: 'AuthApiError',
        message: 'User from sub claim in JWT does not exist',
        status: 403,
        code: 'user_not_found',
      },
    });

    const response = await authMeGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: null });
    expect(mocks.cookieValues.has(ACCESS_TOKEN_COOKIE_NAME)).toBe(false);
    expect(mocks.cookieValues.has(REFRESH_TOKEN_COOKIE_NAME)).toBe(false);
    expect(mocks.ensureUserProfile).not.toHaveBeenCalled();
  });

  it('retourne 503 sans inventer Free/0 quand le profil en base est indisponible', async () => {
    mocks.cookieValues.set(ACCESS_TOKEN_COOKIE_NAME, 'access-valid');
    mocks.cookieValues.set(REFRESH_TOKEN_COOKIE_NAME, 'refresh-valid');
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user_db_down', email: 'db@example.com' } },
      error: null,
    });
    mocks.ensureUserProfile.mockResolvedValue(null);

    const response = await authMeGet();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      error: 'Données du compte temporairement indisponibles.',
      code: 'DATA_UNAVAILABLE',
    });
    expect(JSON.stringify(payload)).not.toContain('analyses_count');
    expect(JSON.stringify(payload)).not.toContain('billingPlan');
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.cookieValues.get(REFRESH_TOKEN_COOKIE_NAME)).toBe('refresh-valid');
  });
});

describe('rafraîchissement middleware', () => {
  it('laisse les routes de gestion de session piloter seules leurs cookies', async () => {
    const expiredAccess = jwtWithExpiry(Math.floor(Date.now() / 1_000) - 60);
    const request = new NextRequest('https://www.viralynz.com/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://www.viralynz.com',
        cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${expiredAccess}; ${REFRESH_TOKEN_COOKIE_NAME}=old-refresh`,
      },
      body: JSON.stringify({ email: 'login@example.com', password: 'MotDePasse123' }),
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(mocks.refreshFetch).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rafraîchit une paire expirée et transmet les tokens rotatés', async () => {
    const expiredAccess = jwtWithExpiry(Math.floor(Date.now() / 1_000) - 60);
    mocks.refreshFetch.mockResolvedValue(new Response(
      JSON.stringify({
        access_token: 'rotated-access',
        refresh_token: 'rotated-refresh',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    const request = new NextRequest('https://www.viralynz.com/dashboard', {
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${expiredAccess}; ${REFRESH_TOKEN_COOKIE_NAME}=old-refresh`,
      },
    });

    const response = await middleware(request);

    expect(mocks.refreshFetch).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refresh_token: 'old-refresh' }),
        cache: 'no-store',
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`${ACCESS_TOKEN_COOKIE_NAME}=rotated-access`);
    expect(response.headers.get('set-cookie')).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=rotated-refresh`);
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      `${ACCESS_TOKEN_COOKIE_NAME}=rotated-access`,
    );
  });

  it.each([400, 401])(
    'redirige et purge les cookies quand le refresh token est invalidé (%s)',
    async (status) => {
      const expiredAccess = jwtWithExpiry(Math.floor(Date.now() / 1_000) - 60);
      mocks.refreshFetch.mockResolvedValue(new Response(
        JSON.stringify({ error: 'invalid_grant' }),
        { status, headers: { 'content-type': 'application/json' } },
      ));
      const request = new NextRequest('https://www.viralynz.com/dashboard/settings', {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${expiredAccess}; ${REFRESH_TOKEN_COOKIE_NAME}=revoked-refresh`,
        },
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login?redirect=%2Fdashboard%2Fsettings');
      expect(response.headers.get('set-cookie')).toContain(`${ACCESS_TOKEN_COOKIE_NAME}=`);
      expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    },
  );

  it.each([429, 503])(
    'préserve la paire et laisse la route vérifier lors d’un refresh indisponible (%s)',
    async (status) => {
      const expiredAccess = jwtWithExpiry(Math.floor(Date.now() / 1_000) - 60);
      mocks.refreshFetch.mockResolvedValue(new Response(
        JSON.stringify({ error: 'temporarily_unavailable' }),
        { status, headers: { 'content-type': 'application/json' } },
      ));
      const request = new NextRequest('https://www.viralynz.com/dashboard/analyze', {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${expiredAccess}; ${REFRESH_TOKEN_COOKIE_NAME}=preserved-refresh`,
        },
      });

      const response = await middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('x-middleware-request-cookie')).toContain(
        `${REFRESH_TOKEN_COOKIE_NAME}=preserved-refresh`,
      );
    },
  );

  it.each([
    new TypeError('fetch failed'),
    new DOMException('The operation timed out', 'TimeoutError'),
  ])('préserve la paire quand le refresh échoue avant réponse (%s)', async (failure) => {
    const expiredAccess = jwtWithExpiry(Math.floor(Date.now() / 1_000) - 60);
    mocks.refreshFetch.mockRejectedValue(failure);
    const request = new NextRequest('https://www.viralynz.com/dashboard/settings', {
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${expiredAccess}; ${REFRESH_TOKEN_COOKIE_NAME}=preserved-refresh`,
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      `${ACCESS_TOKEN_COOKIE_NAME}=${expiredAccess}`,
    );
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      `${REFRESH_TOKEN_COOKIE_NAME}=preserved-refresh`,
    );
  });

  it('ne considère jamais le cookie JWT historique comme une session dashboard', async () => {
    const request = new NextRequest('https://www.viralynz.com/dashboard', {
      headers: { cookie: `${LEGACY_SESSION_COOKIE_NAME}=ancien.jwt.autonome` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?redirect=%2Fdashboard');
    expect(response.headers.get('set-cookie')).toContain(`${LEGACY_SESSION_COOKIE_NAME}=`);
  });
});
