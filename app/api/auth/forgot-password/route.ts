import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuth } from '@/lib/supabase';
import { getPasswordResetRedirectUrl } from '@/lib/site-url';

function translateForgotPasswordError(message: string): string {
  const msg = message.toLowerCase();
  if (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests')
  ) {
    return 'Trop de demandes. Réessaie dans quelques minutes.';
  }
  if (msg.includes('invalid email')) {
    return 'Adresse email invalide.';
  }
  return 'Impossible d\'envoyer l\'email. Réessaie plus tard.';
}

/**
 * Envoie l’email de réinitialisation Supabase. Le lien pointe vers
 * getPasswordResetRedirectUrl() (ex. https://www.viralynz.com/reset-password).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 });
    }

    const redirectTo = getPasswordResetRedirectUrl(request.headers.get('origin'));
    console.log('[forgot-password] redirectTo:', redirectTo, '— email:', email);

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('[forgot-password] Supabase error:', error.message);
      return NextResponse.json({ error: translateForgotPasswordError(error.message) }, { status: 400 });
    }

    // Même si l’email n’existe pas, Supabase renvoie souvent success (anti-énumération).
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[forgot-password] Unexpected error:', message);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
