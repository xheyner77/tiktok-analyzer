import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAuth } from '@/lib/supabase';
import { COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/session';

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
      return NextResponse.json(
        { error: error?.message ?? 'Email ou mot de passe incorrect.' },
        { status: 401 }
      );
    }

    // Store the Supabase access_token in a secure HTTP-only cookie
    cookies().set(COOKIE_NAME, data.session.access_token, COOKIE_OPTIONS);

    console.log('[login] Success — user id:', data.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[login] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
