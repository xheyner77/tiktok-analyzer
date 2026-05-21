import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

/**
 * Legacy endpoint conservé pour compatibilité.
 * Lifetime n'est plus une mise à niveau d'abonnement : c'est un Checkout `payment`
 * via /api/checkout avec plan=scale.
 */
export async function POST() {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
    return NextResponse.json(
      { error: 'Lifetime est un paiement unique. Utilise le checkout Lifetime.', code: 'LIFETIME_CHECKOUT_REQUIRED' },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upgrade-subscription]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
