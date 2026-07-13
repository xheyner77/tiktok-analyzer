import { NextRequest } from 'next/server';
import { getSupabaseAuth } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/auth';
import { setSessionCookies } from '@/lib/session';
import { privateJson, readJsonObject, rejectCrossSiteMutation } from '@/lib/api-route-security';

// Supabase error messages that indicate the email hasn't been confirmed yet.
const EMAIL_NOT_CONFIRMED_MSGS = [
  'email not confirmed',
  'email address not confirmed',
];

function isEmailNotConfirmedError(message: string): boolean {
  return EMAIL_NOT_CONFIRMED_MSGS.some((m) =>
    message.toLowerCase().includes(m)
  );
}

/**
 * Converts raw Supabase Auth error messages into user-friendly French strings.
 */
function translateLoginError(message: string): string {
  const msg = message.toLowerCase();

  if (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('over_request_rate_limit')
  ) {
    return 'Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.';
  }

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Email ou mot de passe incorrect.';
  }

  if (msg.includes('network') || msg.includes('fetch failed')) {
    return 'Erreur de connexion. Vérifiez votre connexion et réessayez.';
  }

  return 'Email ou mot de passe incorrect.';
}

export async function POST(request: NextRequest) {
  try {
    const rejected = rejectCrossSiteMutation(request);
    if (rejected) return rejected;

    const body = await readJsonObject(request);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return privateJson(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
      );
    }

    if (email.length > 254 || password.length > 128) {
      return privateJson({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const auth = getSupabaseAuth();
    const { data, error } = await auth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      const providerUnavailable = !error || (typeof error.status === 'number' && error.status >= 500);
      const log = providerUnavailable ? console.error : console.warn;
      log(providerUnavailable ? '[login] provider_request_failed' : '[login] authentication_rejected', {
        status: error?.status,
        name: error?.name,
        code: error?.code,
      });

      // Translate the "email not confirmed" error to a user-friendly message
      // with a dedicated code so the frontend can offer the resend button.
      if (error?.message && isEmailNotConfirmedError(error.message)) {
        return privateJson(
          {
            error: 'Ton email n\'a pas encore été confirmé. Vérifie ta boîte mail (et tes spams) ou renvoie le lien de confirmation.',
            code: 'EMAIL_NOT_CONFIRMED',
          },
          { status: 401 }
        );
      }

      return privateJson(
        { error: translateLoginError(error?.message ?? '') },
        { status: 401 }
      );
    }

    const profile = await ensureUserProfile({ userId: data.user.id, email: data.user.email ?? email });
    if (!profile) {
      console.error('[login] profile_unavailable');
      return privateJson(
        { error: 'Connexion temporairement indisponible. Réessaie dans un instant.' },
        { status: 503 },
      );
    }

    // Rotation complète après authentification : aucune valeur de session fournie
    // avant le login ne survit, ce qui empêche la fixation de session.
    await setSessionCookies({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });

    return privateJson({ success: true });
  } catch (error) {
    console.error('[login] request_failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return privateJson({ error: 'Connexion temporairement indisponible.' }, { status: 500 });
  }
}
