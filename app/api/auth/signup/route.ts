import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuth, supabase } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site-url';

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

    // Resolve the correct public URL for this deployment so that Supabase
    // embeds the right domain in the confirmation email link.
    // The URL MUST be whitelisted in Supabase Dashboard → Authentication →
    // URL Configuration → Redirect URLs, otherwise Supabase falls back to
    // its "Site URL" (which defaults to localhost in dev projects).
    const siteUrl = getSiteUrl(request.headers.get('origin'));
    const emailRedirectTo = `${siteUrl}/auth/callback`;

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
      return NextResponse.json({ error: error.message }, { status: 400 });
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
