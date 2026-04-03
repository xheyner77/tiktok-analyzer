import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import { getSiteUrl } from '@/lib/site-url';
import {
  assertStripePriceIsMonthlySubscription,
  getStripePriceId,
  isSubscriptionStatusAllowingAccess,
  PLAN_RANK,
} from '@/lib/stripe-billing';
import {
  blockTestStripePublishableInProduction,
  blockTestStripeSecretInProduction,
} from '@/lib/stripe-prod-guard';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

function getStripe(): Stripe {
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;
  const pkBlock = blockTestStripePublishableInProduction();
  if (pkBlock) return pkBlock;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body as { plan?: string };

    if (plan !== 'pro' && plan !== 'elite') {
      return NextResponse.json({ error: 'Plan invalide. Valeurs acceptées : pro, elite.' }, { status: 400 });
    }

    const userProfile = await getUserById(session.userId);
    const currentPlan = userProfile?.plan ?? 'free';
    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const targetRank = PLAN_RANK[plan] ?? 0;

    if (currentRank >= targetRank) {
      const isSamePlan = currentRank === targetRank;
      return NextResponse.json(
        {
          error: isSamePlan
            ? `Tu es déjà sur le plan ${plan === 'pro' ? 'Pro' : 'Elite'}.`
            : `Tu es déjà sur le plan Elite, qui est supérieur au plan Pro.`,
          code: isSamePlan ? 'ALREADY_ON_PLAN' : 'PLAN_DOWNGRADE_BLOCKED',
        },
        { status: 400 }
      );
    }

    const hasActiveStripeSub =
      !!userProfile?.stripe_subscription_id &&
      isSubscriptionStatusAllowingAccess(userProfile.subscription_status);

    if (hasActiveStripeSub) {
      if (plan === 'elite' && currentPlan === 'pro') {
        return NextResponse.json(
          {
            error:
              'Tu as déjà un abonnement Pro actif. Utilise la mise à niveau Elite (même abonnement, prorata Stripe).',
            code: 'PRO_TO_ELITE_USE_UPGRADE',
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: 'Tu as déjà un abonnement Stripe actif. Gère-le depuis le dashboard ou contacte le support.',
          code: 'ALREADY_SUBSCRIBED',
        },
        { status: 400 }
      );
    }

    const baseUrl = getSiteUrl(request.headers.get('origin'));
    const stripe = getStripe();
    const priceId = getStripePriceId(plan);

    const priceCheck = await assertStripePriceIsMonthlySubscription(stripe, priceId);
    if (!priceCheck.ok) {
      console.error('[checkout] Price invalide pour abonnement:', priceCheck.code, priceId, priceCheck.message);
      return NextResponse.json(
        { error: priceCheck.message, code: priceCheck.code },
        { status: 400 }
      );
    }

    // Ne pas passer `payment_method_types` : Stripe Checkout affiche automatiquement
    // toutes les méthodes actives dans le Dashboard (carte, PayPal, etc.)
    // Forcer uniquement `['card']` empêcherait PayPal d'apparaître.
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: session.userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: session.userId,
          plan,
        },
      },
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      // Stripe Checkout : lien « Ajouter un code promotionnel » (codes actifs dans Dashboard → Produits → Codes promo)
      allow_promotion_codes: true,
    };

    if (userProfile?.stripe_customer_id) {
      params.customer = userProfile.stripe_customer_id;
    } else {
      params.customer_email = session.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(params);

    console.log('[checkout] Session créée (mode subscription, renouvellement mensuel)', {
      sessionId: checkoutSession.id,
      mode: checkoutSession.mode,
      priceId,
      userId: session.userId,
      plan,
      allow_promotion_codes: true,
      customer: params.customer ?? '(nouveau via customer_email)',
      // payment_method_types absent → Stripe Checkout choisit automatiquement (carte + PayPal actifs)
      payment_method_config: 'automatic (carte + PayPal si actif dans Dashboard)',
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[checkout] Error:', message);
    return NextResponse.json(
      { error: message.includes('STRIPE_PRICE') ? message : 'Erreur lors de la création du paiement.' },
      { status: 500 }
    );
  }
}
