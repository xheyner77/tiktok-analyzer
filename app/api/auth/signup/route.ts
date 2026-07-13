import { NextRequest } from 'next/server';
import { getSupabaseAuth, supabase } from '@/lib/supabase';
import { getAuthEmailCallbackUrl } from '@/lib/site-url';
import { privateJson, readJsonObject, rejectCrossSiteMutation } from '@/lib/api-route-security';
import { setSessionCookies } from '@/lib/session';

/**
 * Converts raw Supabase Auth error messages into user-friendly French strings.
 * Returns both a translated message and an optional code for frontend handling.
 */
function translateAuthError(message: string): { message: string; code?: string } {
  const msg = message.toLowerCase();

  if (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('email rate limit exceeded') ||
    msg.includes('too many requests')
  ) {
    return {
      message: 'Trop de tentatives d\'inscription. Veuillez patienter quelques minutes avant de réessayer.',
      code: 'RATE_LIMIT',
    };
  }

  if (msg.includes('user already registered') || msg.includes('already registered') || msg.includes('already been registered')) {
    return {
      message: 'Un compte existe déjà avec cette adresse email.',
      code: 'ALREADY_REGISTERED',
    };
  }

  if (msg.includes('invalid email') || msg.includes('invalid_email') || msg.includes('unable to validate email')) {
    return { message: 'Adresse email invalide. Vérifiez le format.' };
  }

  if (msg.includes('password should be') || msg.includes('password is too short') || msg.includes('weak_password')) {
    return { message: 'Le mot de passe est trop faible. Utilisez au moins 8 caractères avec des lettres et des chiffres.' };
  }

  if (msg.includes('signup_disabled') || msg.includes('signups not allowed') || msg.includes('signup is disabled')) {
    return { message: 'Les inscriptions sont temporairement désactivées. Réessayez plus tard.' };
  }

  if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('econnrefused')) {
    return { message: 'Erreur de connexion. Vérifiez votre connexion et réessayez.' };
  }

  return { message: 'Une erreur est survenue lors de la création du compte. Veuillez réessayer.' };
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
      return privateJson({ error: 'Identifiants invalides.' }, { status: 400 });
    }

    const emailRedirectTo = getAuthEmailCallbackUrl(request.headers.get('origin'));

    const auth = getSupabaseAuth();
    const { data, error } = await auth.auth.signUp({
      email,
      password,
      options: {
        data: { plan: 'free', analyses_count: 0, reconstructions_count: 0 },
        emailRedirectTo,
      },
    });

    if (error) {
      console.error('[signup] provider_request_failed', {
        status: error.status,
        name: error.name,
        code: error.code,
      });
      const { message, code } = translateAuthError(error.message);
      if (code === 'ALREADY_REGISTERED') {
        // Keep the public response indistinguishable from a new signup so the
        // endpoint cannot be used to enumerate registered addresses.
        return privateJson({ success: true, needsEmailConfirmation: true });
      }
      return privateJson({ error: message, ...(code ? { code } : {}) }, { status: 400 });
    }

    const userId = data.user?.id;

    // data.session is null when Supabase requires email confirmation.
    const needsEmailConfirmation = !!data.user && !data.session;

    // Upsert profile row (ignoreDuplicates so a re-signup never crashes)
    if (userId) {
      const { error: dbError } = await supabase
        .from('users')
        .upsert(
          { id: userId, email, plan: 'free', analyses_count: 0, hooks_count: 0, reconstructions_count: 0 },
          { onConflict: 'id', ignoreDuplicates: true }
        );

      if (dbError) {
        console.error('[signup] profile_upsert_failed', { code: dbError.code });
      }
    }

    if (data.session) {
      await setSessionCookies({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });
    }

    return privateJson({ success: true, needsEmailConfirmation });
  } catch (error) {
    console.error('[signup] request_failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return privateJson(
      { error: 'Impossible de créer le compte pour le moment. Réessaie plus tard.' },
      { status: 500 },
    );
  }
}
