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

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { plan: 'free', analyses_count: 0 },
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
    console.log('[signup] Auth success — user id:', userId ?? 'null (email confirmation pending)');

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
        return NextResponse.json(
          { error: `Compte créé mais profil non sauvegardé : ${dbError.message}` },
          { status: 500 }
        );
      }

      console.log('[signup] public.users row created for:', userId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[signup] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
