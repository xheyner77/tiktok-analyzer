import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuth, supabase } from '@/lib/supabase';
import { getAuthEmailCallbackUrl } from '@/lib/site-url';

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
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis.' },
        { status: 400 }
      );
    }

    const emailRedirectTo = getAuthEmailCallbackUrl(request.headers.get('origin'));
    console.log('[signup] emailRedirectTo:', emailRedirectTo);

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { plan: 'free', analyses_count: 0 },
        emailRedirectTo,
      },
    });

    if (error) {
      console.error('[signup] Supabase error:', {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      const { message, code } = translateAuthError(error.message);
      return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status: 400 });
    }

    const userId = data.user?.id;

    // data.session is null when Supabase requires email confirmation.
    const needsEmailConfirmation = !!data.user && !data.session;

    console.log('[signup] Auth success — user id:', userId ?? 'null', '| needs confirmation:', needsEmailConfirmation);

    // Upsert profile row (ignoreDuplicates so a re-signup never crashes)
    if (userId) {
      const { error: dbError } = await supabase
        .from('users')
        .upsert(
          { id: userId, email, plan: 'free', analyses_count: 0, hooks_count: 0 },
          { onConflict: 'id', ignoreDuplicates: true }
        );

      if (dbError) {
        console.error('[signup] public.users upsert error:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
        });
      } else {
        console.log('[signup] public.users row created for:', userId);
      }
    }

    return NextResponse.json({ success: true, needsEmailConfirmation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[signup] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
