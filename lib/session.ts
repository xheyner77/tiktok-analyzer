import { cookies } from 'next/headers';
import type { SessionPayload } from './auth';
import { getSupabaseAuth } from './supabase';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from './session-constants';

export {
  ACCESS_TOKEN_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from './session-constants';

export interface SupabaseSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type SessionVerificationResult =
  | { status: 'authenticated'; session: SessionPayload }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

interface SessionTokenState {
  accessToken: string | null;
  refreshToken: string | null;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  path: '/',
};

// Compatibilité des cookies OAuth TikTok existants ; leur maxAge est toujours
// remplacé par 600 secondes dans les routes concernées.
export const COOKIE_OPTIONS = SESSION_COOKIE_OPTIONS;

const EXPIRED_COOKIE_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 0,
};

/** Lit uniquement les nouveaux cookies Supabase. Le JWT applicatif historique est ignoré. */
async function getSessionTokenState(): Promise<SessionTokenState> {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value ?? null,
  };
}

export async function getSessionTokens(): Promise<SupabaseSessionTokens | null> {
  const { accessToken, refreshToken } = await getSessionTokenState();

  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/**
 * Remplace intégralement la session après authentification. L'effacement préalable
 * empêche qu'un ancien refresh token ou le cookie JWT historique soit conservé.
 */
export async function setSessionCookies(tokens: SupabaseSessionTokens): Promise<void> {
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new TypeError('Supabase n’a pas retourné une session complète.');
  }

  const cookieStore = await cookies();
  cookieStore.set(LEGACY_SESSION_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  cookieStore.set(ACCESS_TOKEN_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_TOKEN_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  cookieStore.set(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, SESSION_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, SESSION_COOKIE_OPTIONS);
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LEGACY_SESSION_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  cookieStore.set(ACCESS_TOKEN_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_TOKEN_COOKIE_NAME, '', EXPIRED_COOKIE_OPTIONS);
}

/**
 * Vérifie chaque requête auprès de Supabase Auth. Aucun claim local ni ancien JWT
 * autonome n'est utilisé pour autoriser l'accès aux données de l'utilisateur.
 */
export async function getSessionVerification(): Promise<SessionVerificationResult> {
  try {
    const { accessToken, refreshToken } = await getSessionTokenState();
    if (!accessToken && !refreshToken) return { status: 'missing' };
    if (!accessToken || !refreshToken) return { status: 'invalid' };

    const auth = getSupabaseAuth();
    const { data: { user }, error } = await auth.auth.getUser(accessToken);

    if (error) {
      if (
        error.status === 400
        || error.status === 401
        || error.code === 'session_not_found'
        || error.code === 'user_not_found'
      ) {
        return { status: 'invalid' };
      }

      console.error('[getSession] verification_unavailable', {
        name: error.name,
        status: error.status,
      });
      return { status: 'unavailable' };
    }

    if (!user) return { status: 'invalid' };

    return {
      status: 'authenticated',
      session: {
        userId: user.id,
        email: user.email ?? '',
      },
    };
  } catch (error) {
    console.error('[getSession] verification_unavailable', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return { status: 'unavailable' };
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const result = await getSessionVerification();
  return result.status === 'authenticated' ? result.session : null;
}
