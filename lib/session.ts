import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { SessionPayload } from './auth';
import { supabase } from './supabase';

export const COOKIE_NAME = 'tiktok_auth';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
};

/**
 * Returns the HMAC secret used to sign and verify session JWTs.
 * Returns null if JWT_SECRET is not configured (instead of throwing),
 * so legacy Supabase token fallback can still work.
 */
function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed HS256 JWT containing { userId, email }, valid for 7 days.
 * Store this value in the session cookie instead of the Supabase access token.
 */
export async function createSessionToken(userId: string, email: string): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error(
      'JWT_SECRET env var is missing or too short (must be ≥ 32 chars). ' +
      'Add it in Vercel Dashboard → Settings → Environment Variables.'
    );
  }
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * Reads and verifies the session cookie.
 *
 * Strategy (two attempts for backward compatibility):
 *  1. Try to verify as our custom HS256 JWT (new sessions, 7-day expiry).
 *  2. If that fails, fall back to validating as a Supabase access token
 *     (old sessions created before the JWT migration).
 *
 * Returns { userId, email } or null if not authenticated.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;

    // ── Attempt 1: custom HS256 JWT (new sessions) ────────────────────────────
    const secret = getJwtSecret();
    if (secret) {
      try {
        const { payload } = await jwtVerify(token, secret);
        const userId = payload.userId as string | undefined;
        const email  = payload.email  as string | undefined;
        if (userId && email) {
          return { userId, email };
        }
      } catch {
        // Not our JWT — fall through to legacy check
      }
    }

    // ── Attempt 2: legacy Supabase access token (old sessions) ───────────────
    // Handles cookies created before the JWT migration.
    // These expire after Supabase's 1-hour window, so users will be prompted
    // to re-login naturally after that.
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      console.log('[getSession] Legacy Supabase token accepted for user:', user.id);
      return { userId: user.id, email: user.email ?? '' };
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      !message.includes('expired') &&
      !message.includes('invalid') &&
      !message.includes('Dynamic server usage')
    ) {
      console.error('[getSession] Unexpected error:', message);
    }
    return null;
  }
}
