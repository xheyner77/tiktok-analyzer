import { cookies } from 'next/headers';
import { supabase } from './supabase';
import type { SessionPayload } from './auth';

export const COOKIE_NAME = 'tiktok_auth';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
};

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      // "invalid JWT" / "token is expired" are normal when the 1h Supabase token
      // expires while the 7-day cookie is still alive. Not a critical error.
      console.error('[getSession] Supabase auth error:', error.message, '| code:', error.status);
      return null;
    }

    if (!user) {
      console.error('[getSession] No user returned for token.');
      return null;
    }

    return { userId: user.id, email: user.email ?? '' };
  } catch (err) {
    console.error('[getSession] Unexpected error:', err);
    return null;
  }
}
