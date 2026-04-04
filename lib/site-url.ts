/**
 * URL publique canonique en production (emails Supabase, Stripe, etc.).
 * Utilisée si NEXT_PUBLIC_SITE_URL n’est pas défini et que le déploiement
 * est la prod Vercel — évite d’embarquer *.vercel.app dans les liens email.
 */
export const CANONICAL_PRODUCTION_SITE_URL = 'https://www.viralynz.com';

/**
 * Resolves the canonical public URL of this app.
 *
 * Priority order (highest → lowest):
 *  1. NEXT_PUBLIC_SITE_URL  — explicitly set in Vercel env (recommended: https://www.viralynz.com)
 *  2. Production on Vercel   — CANONICAL_PRODUCTION_SITE_URL (never *.vercel.app in emails)
 *  3. VERCEL_URL            — preview / dev deployments on Vercel
 *  4. origin header         — request origin from the browser
 *  5. localhost:3000        — local development fallback
 *
 * Add these to Supabase → Authentication → URL Configuration → Redirect URLs:
 *   - https://www.viralynz.com/auth/callback
 *   - https://www.viralynz.com/reset-password
 *   - http://localhost:3000/auth/callback
 *   - http://localhost:3000/reset-password
 *
 * @param originHeader  The value of `request.headers.get('origin')` — optional.
 */
export function getSiteUrl(originHeader?: string | null): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  if (process.env.VERCEL_ENV === 'production') {
    return CANONICAL_PRODUCTION_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (originHeader) {
    return originHeader;
  }

  return 'http://localhost:3000';
}

/** URL complète pour les emails de confirmation d’inscription (signUp, resend type signup). */
export function getAuthEmailCallbackUrl(originHeader?: string | null): string {
  return `${getSiteUrl(originHeader)}/auth/callback`;
}

/** URL complète pour les emails de réinitialisation de mot de passe (resetPasswordForEmail). */
export function getPasswordResetRedirectUrl(originHeader?: string | null): string {
  return `${getSiteUrl(originHeader)}/reset-password`;
}
