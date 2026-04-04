import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAuth } from '@/lib/supabase';
import { COOKIE_NAME, COOKIE_OPTIONS, createSessionToken } from '@/lib/session';

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

  if (msg.includes('user not found') || msg.includes('no user found')) {
    return 'Aucun compte trouvé avec cette adresse email.';
  }

  if (msg.includes('network') || msg.includes('fetch failed')) {
    return 'Erreur de connexion. Vérifiez votre connexion et réessayez.';
  }

  return 'Email ou mot de passe incorrect.';
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.error('[login] Supabase error:', {
        message: error?.message,
        status: error?.status,
        name: error?.name,
      });

      // Translate the "email not confirmed" error to a user-friendly message
      // with a dedicated code so the frontend can offer the resend button.
      if (error?.message && isEmailNotConfirmedError(error.message)) {
        return NextResponse.json(
          {
            error: 'Ton email n\'a pas encore été confirmé. Vérifie ta boîte mail (et tes spams) ou renvoie le lien de confirmation.',
            code: 'EMAIL_NOT_CONFIRMED',
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: translateLoginError(error?.message ?? '') },
        { status: 401 }
      );
    }

    // Create a custom JWT (signed with JWT_SECRET, valid 7 days) instead of
    // storing the Supabase access token (which expires after only 1 hour).
    const sessionToken = await createSessionToken(data.user.id, data.user.email ?? email);
    cookies().set(COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    console.log('[login] Success — user id:', data.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[login] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
