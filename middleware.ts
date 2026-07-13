import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/session-constants';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  path: '/',
};

const EXPIRED_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 0,
};

const SESSION_MANAGEMENT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/signup',
]);

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

interface SupabaseRefreshPayload {
  access_token?: unknown;
  refresh_token?: unknown;
}

type SupabaseRefreshResult =
  | { status: 'refreshed'; tokens: RefreshedTokens }
  | { status: 'invalid' }
  | { status: 'unavailable'; httpStatus?: number };

interface MiddlewareSessionState {
  hasTokenPair: boolean;
  clearLegacy: boolean;
  clearSession: boolean;
  refreshedTokens?: RefreshedTokens;
}

function getJwtExpiryMs(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1_000
      : null;
  } catch {
    return null;
  }
}

function needsRefresh(accessToken: string): boolean {
  const expiresAt = getJwtExpiryMs(accessToken);
  return expiresAt === null || expiresAt <= Date.now() + 60_000;
}

async function refreshSupabaseSession(
  supabaseUrl: string,
  supabaseAnonKey: string,
  refreshToken: string,
): Promise<SupabaseRefreshResult> {
  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      return { status: 'invalid' };
    }

    return { status: 'unavailable', httpStatus: response.status };
  }

  const payload = await response.json() as SupabaseRefreshPayload;
  if (
    typeof payload.access_token !== 'string'
    || payload.access_token.length === 0
    || typeof payload.refresh_token !== 'string'
    || payload.refresh_token.length === 0
  ) {
    return { status: 'unavailable', httpStatus: response.status };
  }

  return {
    status: 'refreshed',
    tokens: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
    },
  };
}

async function updateRequestSession(request: NextRequest): Promise<MiddlewareSessionState> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
  const clearLegacy = request.cookies.has(LEGACY_SESSION_COOKIE_NAME);

  if (accessToken && refreshToken && !needsRefresh(accessToken)) {
    if (clearLegacy) request.cookies.delete(LEGACY_SESSION_COOKIE_NAME);
    return { hasTokenPair: true, clearLegacy, clearSession: false };
  }

  if (refreshToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[middleware/auth] refresh_unavailable', {
        reason: 'configuration_missing',
      });
      return {
        hasTokenPair: Boolean(accessToken && refreshToken),
        clearLegacy,
        clearSession: false,
      };
    }

    try {
      // Appel Auth direct compatible Edge : aucun client global ni état partagé.
      const refreshResult = await refreshSupabaseSession(
        supabaseUrl,
        supabaseAnonKey,
        refreshToken,
      );

      if (refreshResult.status === 'refreshed') {
        const { tokens: refreshedTokens } = refreshResult;
        request.cookies.set(ACCESS_TOKEN_COOKIE_NAME, refreshedTokens.accessToken);
        request.cookies.set(REFRESH_TOKEN_COOKIE_NAME, refreshedTokens.refreshToken);
        request.cookies.delete(LEGACY_SESSION_COOKIE_NAME);
        return {
          hasTokenPair: true,
          clearLegacy,
          clearSession: false,
          refreshedTokens,
        };
      }

      if (refreshResult.status === 'unavailable') {
        console.error('[middleware/auth] refresh_unavailable', {
          status: refreshResult.httpStatus ?? null,
        });
        return {
          hasTokenPair: Boolean(accessToken && refreshToken),
          clearLegacy,
          clearSession: false,
        };
      }
    } catch (error) {
      console.error('[middleware/auth] refresh_unavailable', {
        name: error instanceof Error ? error.name : 'UnknownError',
      });
      return {
        hasTokenPair: Boolean(accessToken && refreshToken),
        clearLegacy,
        clearSession: false,
      };
    }
  }

  if (accessToken) request.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
  if (refreshToken) request.cookies.delete(REFRESH_TOKEN_COOKIE_NAME);
  if (clearLegacy) request.cookies.delete(LEGACY_SESSION_COOKIE_NAME);

  return {
    hasTokenPair: false,
    clearLegacy,
    clearSession: Boolean(accessToken || refreshToken),
  };
}

function applySessionState(response: NextResponse, state: MiddlewareSessionState): NextResponse {
  if (state.clearLegacy) {
    response.cookies.set(LEGACY_SESSION_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  }

  if (state.refreshedTokens) {
    response.cookies.set(
      ACCESS_TOKEN_COOKIE_NAME,
      state.refreshedTokens.accessToken,
      SESSION_COOKIE_OPTIONS,
    );
    response.cookies.set(
      REFRESH_TOKEN_COOKIE_NAME,
      state.refreshedTokens.refreshToken,
      SESSION_COOKIE_OPTIONS,
    );
  } else if (state.clearSession) {
    response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
    response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  }

  if (state.refreshedTokens || state.clearLegacy || state.clearSession) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

    if (isMutation) {
      const fetchSite = request.headers.get('sec-fetch-site');
      const origin = request.headers.get('origin');
      const isCrossSite = fetchSite === 'cross-site'
        || (origin !== null && origin !== request.nextUrl.origin);

      if (isCrossSite) {
        return NextResponse.json(
          { error: 'Requête non autorisée.' },
          {
            status: 403,
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
          },
        );
      }
    }
  }

  if (pathname === '/analyses') {
    const dashboardUrl = new URL('/dashboard/analyze', request.url);
    dashboardUrl.search = search;
    return NextResponse.redirect(dashboardUrl);
  }

  const legacyDashboardRoutes: Record<string, string> = {
    '/dashboard-v2': '/dashboard',
    '/analyzer': '/dashboard/analyze',
    '/hook-generator': '/dashboard/hooks',
    '/hooks': '/dashboard/hooks',
    '/hook-rewrite': '/dashboard/rewrite',
    '/rewrite': '/dashboard/rewrite',
    '/share': '/dashboard/share',
    '/share-cards': '/dashboard/share',
    '/radar-tendances': '/dashboard/radar',
    '/settings': '/dashboard/settings',
    '/billing': '/dashboard/billing',
  };

  const legacyRoute = Object.entries(legacyDashboardRoutes).find(
    ([legacyPath]) => pathname === legacyPath || pathname.startsWith(`${legacyPath}/`),
  );

  if (legacyRoute) {
    const [legacyPath, targetPath] = legacyRoute;
    const suffix = pathname.slice(legacyPath.length);
    const dashboardUrl = new URL(`${targetPath}${suffix}`, request.url);
    dashboardUrl.search = search;
    return NextResponse.redirect(dashboardUrl);
  }

  // Ces routes remplacent ou révoquent elles-mêmes la session. Ne jamais leur
  // ajouter une rotation concurrente qui pourrait écraser leurs Set-Cookie.
  if (SESSION_MANAGEMENT_PATHS.has(pathname)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    return response;
  }

  const sessionState = await updateRequestSession(request);

  // Le middleware vérifie seulement la présence/expiration locale de la paire.
  // Les routes et Server Components sensibles appellent ensuite getUser() via getSession().
  if (pathname.startsWith('/dashboard') && !sessionState.hasTokenPair) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
    return applySessionState(NextResponse.redirect(loginUrl), sessionState);
  }

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
  }
  return applySessionState(response, sessionState);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
