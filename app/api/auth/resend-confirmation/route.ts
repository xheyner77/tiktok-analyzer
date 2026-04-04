import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuth } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Converts raw Supabase Auth error messages into user-friendly French strings.
 */
function translateResendError(message: string): string {
  const msg = message.toLowerCase();

  if (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('email rate limit exceeded') ||
    msg.includes('too many requests')
  ) {
    return 'Trop d\'emails envoyés récemment. Veuillez patienter quelques minutes avant de renvoyer.';
  }

  if (msg.includes('user not found') || msg.includes('no user')) {
    return 'Aucun compte trouvé avec cette adresse email.';
  }

  if (msg.includes('already confirmed') || msg.includes('email already confirmed')) {
    return 'Cet email a déjà été confirmé. Vous pouvez vous connecter directement.';
  }

  if (msg.includes('network') || msg.includes('fetch failed')) {
    return 'Erreur de connexion. Vérifiez votre connexion et réessayez.';
  }

  return 'Impossible d\'envoyer l\'email de confirmation. Veuillez réessayer dans quelques instants.';
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 });
    }

    const siteUrl = getSiteUrl(request.headers.get('origin'));
    const emailRedirectTo = `${siteUrl}/auth/callback`;

    console.log('[resend-confirmation] emailRedirectTo:', emailRedirectTo, '— email:', email);

    const { error } = await supabaseAuth.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      console.error('[resend-confirmation] Supabase error:', error.message);
      return NextResponse.json({ error: translateResendError(error.message) }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[resend-confirmation] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
