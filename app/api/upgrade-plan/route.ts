import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// MVP: called client-side after Stripe redirects back with ?success=true.
// The chosen plan was stored in localStorage before the Stripe redirect.
// NOTE: for production, replace with a Stripe webhook for tamper-proof upgrades.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { plan } = await request.json() as { plan?: string };

    if (plan !== 'pro' && plan !== 'elite') {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({ plan, analyses_count: 0 })
      .eq('id', session.userId);

    if (error) {
      console.error('[upgrade-plan] DB error:', error.message);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du plan.' }, { status: 500 });
    }

    console.log(`[upgrade-plan] ✓ Plan → ${plan} for user ${session.userId}`);
    return NextResponse.json({ success: true, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upgrade-plan] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
