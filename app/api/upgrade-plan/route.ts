import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

function getStripe(): Stripe {
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

/**
 * Vérifie côté serveur que le Checkout Session est payé et appartient à l’utilisateur.
 * **Ne modifie pas le plan en base** : seul le webhook `checkout.session.completed` (signé Stripe) applique pro/elite.
 */
export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const { plan, sessionId } = await request.json() as { plan?: string; sessionId?: string };

    if (plan !== 'pro' && plan !== 'elite') {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    if (!sessionId) {
      console.error('[upgrade-plan] sessionId missing — user:', session.userId);
      return NextResponse.json({ error: 'Session de paiement requise.' }, { status: 400 });
    }

    const stripe = getStripe();
    let checkoutSession: Stripe.Checkout.Session;

    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upgrade-plan] Stripe retrieve failed:', msg);
      return NextResponse.json({ error: 'Session Stripe introuvable.' }, { status: 400 });
    }

    if (checkoutSession.mode !== 'subscription') {
      console.error('[upgrade-plan] Session is not subscription mode:', checkoutSession.id);
      return NextResponse.json({ error: 'Session invalide (pas un abonnement).' }, { status: 400 });
    }

    if (checkoutSession.payment_status !== 'paid') {
      console.error('[upgrade-plan] Payment not confirmed:', sessionId);
      return NextResponse.json({ error: 'Paiement non confirmé.' }, { status: 402 });
    }

    if (checkoutSession.metadata?.userId !== session.userId) {
      console.error('[upgrade-plan] userId mismatch');
      return NextResponse.json({ error: 'Session invalide.' }, { status: 403 });
    }

    if (checkoutSession.metadata?.plan !== plan) {
      console.error('[upgrade-plan] Plan metadata mismatch');
      return NextResponse.json({ error: 'Plan incohérent.' }, { status: 400 });
    }

    // Lecture de la méthode de paiement réellement utilisée (carte, paypal, etc.)
    const pmTypes = (checkoutSession as unknown as { payment_method_types?: string[] }).payment_method_types ?? [];
    const usedPayPal = pmTypes.includes('paypal');

    console.log('[upgrade-plan] Checkout session verified (webhook-only DB)', {
      userId: session.userId,
      sessionId: checkoutSession.id,
      plan,
      payment_status: checkoutSession.payment_status,
      payment_method_types: pmTypes,
      paypal_used: usedPayPal,
      // Le plan en base est accordé uniquement par le webhook checkout.session.completed
      note: 'DB update via webhook only — cette route vérifie sans écrire',
    });

    return NextResponse.json({
      success: true,
      plan,
      syncedByWebhookOnly: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upgrade-plan] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
