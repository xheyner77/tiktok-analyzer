/**
 * Resolves the canonical public URL of this app.
 *
 * Priority order (highest → lowest):
 *  1. NEXT_PUBLIC_SITE_URL  — explicitly set in Vercel env vars for production
 *  2. VERCEL_URL            — auto-injected by Vercel for preview deployments
 *  3. origin header         — request origin sent by the browser
 *  4. localhost:3000        — local development fallback
 *
 * IMPORTANT: The returned URL must be added to Supabase Dashboard →
 * Authentication → URL Configuration → Redirect URLs so that Supabase
 * allows email confirmation links to redirect there.
 *
 * @param originHeader  The value of `request.headers.get('origin')` — optional.
 */
export function getSiteUrl(originHeader?: string | null): string {
  // 1. Explicit production URL (highest priority — set this in Vercel)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''); // strip trailing slash
  }

  // 2. Vercel auto-injected URL for preview deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Request origin header (reliable for POST requests from browsers)
  if (originHeader) {
    return originHeader;
  }

  // 4. Local development fallback
  return 'http://localhost:3000';
}
