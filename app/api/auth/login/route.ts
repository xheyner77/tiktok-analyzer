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
        { error: error?.message ?? 'Email ou mot de passe incorrect.' },
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
