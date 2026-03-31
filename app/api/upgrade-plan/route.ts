import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { plan, sessionId } = await request.json() as { plan?: string; sessionId?: string };

    if (plan !== 'pro' && plan !== 'elite') {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    // ── Verify payment with Stripe (tamper-proof) ──────────────────────────
    if (sessionId) {
      let checkoutSession: Stripe.Checkout.Session;

      try {
        checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[upgrade-plan] Stripe session retrieve failed:', msg);
        return NextResponse.json({ error: 'Session Stripe introuvable.' }, { status: 400 });
      }

      // Payment must be confirmed
      if (checkoutSession.payment_status !== 'paid') {
        console.error('[upgrade-plan] Payment not confirmed for session:', sessionId);
        return NextResponse.json({ error: 'Paiement non confirmé.' }, { status: 402 });
      }

      // Session must belong to this user
      if (checkoutSession.metadata?.userId !== session.userId) {
        console.error('[upgrade-plan] userId mismatch — session:', checkoutSession.metadata?.userId, 'auth:', session.userId);
        return NextResponse.json({ error: 'Session invalide.' }, { status: 403 });
      }

      // Plan in Stripe metadata must match the requested plan
      if (checkoutSession.metadata?.plan !== plan) {
        console.error('[upgrade-plan] Plan mismatch — stripe:', checkoutSession.metadata?.plan, 'requested:', plan);
        return NextResponse.json({ error: 'Plan incohérent.' }, { status: 400 });
      }
    }

    // ── Upgrade plan + reset monthly counters ─────────────────────────────
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('users')
      .update({
        plan,
        analyses_count: 0,
        hooks_count:    0,
        last_reset_at:  now,
      })
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
