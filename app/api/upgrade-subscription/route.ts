import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import {
  assertStripePriceIsMonthlySubscription,
  getStripePriceId,
  isSubscriptionStatusAllowingAccess,
} from '@/lib/stripe-billing';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

function getStripe(): Stripe {
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

/**
 * Pro → Elite : met à jour **Stripe** uniquement. Le plan en base est mis à jour par
 * `customer.subscription.updated` (webhook signé).
 */
export async function POST() {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user?.stripe_subscription_id || !isSubscriptionStatusAllowingAccess(user.subscription_status)) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif à mettre à niveau.', code: 'NO_ACTIVE_SUBSCRIPTION' },
        { status: 400 }
      );
    }

    if (user.plan !== 'pro') {
      return NextResponse.json(
        { error: 'La mise à niveau Elite est réservée aux comptes Pro.', code: 'NOT_PRO' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    const item = sub.items.data[0];
    if (!item?.id) {
      return NextResponse.json({ error: 'Abonnement Stripe invalide (aucun item).' }, { status: 500 });
    }

    const elitePriceId = getStripePriceId('elite');
    const eliteCheck = await assertStripePriceIsMonthlySubscription(stripe, elitePriceId);
    if (!eliteCheck.ok) {
      console.error('[upgrade-subscription] Price Elite invalide:', eliteCheck.code);
      return NextResponse.json({ error: eliteCheck.message, code: eliteCheck.code }, { status: 400 });
    }
    if (item.price.id === elitePriceId) {
      return NextResponse.json({ error: 'Tu es déjà sur le plan Elite.', code: 'ALREADY_ELITE' }, { status: 400 });
    }

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: elitePriceId }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...sub.metadata,
        userId: session.userId,
        plan: 'elite',
      },
    });

    console.log('[upgrade-subscription] Stripe subscription updated → Elite; DB via webhook user', session.userId);
    return NextResponse.json({ success: true, pendingWebhook: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upgrade-subscription]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
