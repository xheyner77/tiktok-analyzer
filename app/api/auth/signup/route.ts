import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuth, supabase } from '@/lib/supabase';

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

    // Build the absolute redirect URL from the incoming request origin
    // so it works on every deployment (localhost, preview, production).
    const origin = request.headers.get('origin') ??
      (process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : 'http://localhost:3000');
    const emailRedirectTo = `${origin}/auth/callback`;

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
    // data.user is non-null but data.user.email_confirmed_at is null.
    const needsEmailConfirmation = !!data.user && !data.session;

    console.log('[signup] Auth success — user id:', userId ?? 'null', '| needs confirmation:', needsEmailConfirmation);

    // Insert profile row in public.users (upsert so a duplicate id never crashes)
    if (userId) {
      const { error: dbError } = await supabase
        .from('users')
        .upsert(
          { id: userId, email, plan: 'free', analyses_count: 0 },
          { onConflict: 'id', ignoreDuplicates: true }
        );

      if (dbError) {
        console.error('[signup] public.users insert error:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint,
        });
        // Don't block the response — the auth user was created successfully.
        // The profile will be created on first login.
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
