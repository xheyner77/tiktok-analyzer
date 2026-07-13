import { type NextRequest } from 'next/server';
import { getSupabaseAuth } from '@/lib/supabase';
import { clearSessionCookies, getSessionTokens } from '@/lib/session';
import { privateJson, rejectCrossSiteMutation } from '@/lib/api-route-security';

export async function POST(request: NextRequest) {
  const rejected = rejectCrossSiteMutation(request);
  if (rejected) return rejected;

  try {
    const tokens = await getSessionTokens();
    if (tokens) {
      const auth = getSupabaseAuth();
      const { error: sessionError } = await auth.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (!sessionError) {
        const { error: signOutError } = await auth.auth.signOut({ scope: 'global' });
        if (signOutError) {
          console.error('[logout] global_revocation_failed', {
            name: signOutError.name,
            status: signOutError.status,
            code: signOutError.code,
          });
        }
      } else {
        console.warn('[logout] session_already_invalid', {
          name: sessionError.name,
          status: sessionError.status,
          code: sessionError.code,
        });
      }
    }
  } catch (error) {
    // La déconnexion locale reste prioritaire même si Supabase est indisponible.
    console.error('[logout] provider_request_failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  await clearSessionCookies();
  return privateJson({ success: true });
}
