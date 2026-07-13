/** Cookie HS256 historique. Il n'est jamais lu comme une session valide. */
export const LEGACY_SESSION_COOKIE_NAME = 'tiktok_auth';

/** Cookies de session Supabase, volontairement distincts du cookie historique. */
export const ACCESS_TOKEN_COOKIE_NAME = 'viralynz_auth_access';
export const REFRESH_TOKEN_COOKIE_NAME = 'viralynz_auth_refresh';

/**
 * Durée de conservation navigateur uniquement. La validité réelle reste pilotée
 * par Supabase (expiration du JWT, rotation et révocation du refresh token).
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
