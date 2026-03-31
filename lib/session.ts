import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { SessionPayload } from './auth';

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
 * Throws early if JWT_SECRET is missing so the issue is caught at startup.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET env var is missing or too short (must be ≥ 32 chars). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed HS256 JWT containing { userId, email }, valid for 7 days.
 * Store this value in the session cookie instead of the Supabase access token.
 */
export async function createSessionToken(userId: string, email: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * Reads and verifies the session cookie.
 * Returns the payload { userId, email } or null if missing / invalid / expired.
 * Verification is FULLY LOCAL — no Supabase API call, no 1-hour expiry issue.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;

    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    const userId = payload.userId as string | undefined;
    const email  = payload.email  as string | undefined;

    if (!userId || !email) {
      console.error('[getSession] JWT payload missing userId or email');
      return null;
    }

    return { userId, email };
  } catch (err) {
    // JWTExpired, JWTInvalid, etc. — treat as "not logged in"
    const message = err instanceof Error ? err.message : String(err);
    // Only log unexpected errors; expired tokens are normal
    if (!message.includes('expired') && !message.includes('invalid')) {
      console.error('[getSession] JWT verification error:', message);
    }
    return null;
  }
}
