import { NextRequest, NextResponse } from 'next/server';
import { supabaseAuth } from '@/lib/supabase';
import { getSiteUrl } from '@/lib/site-url';

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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[resend-confirmation] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
