import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import { getSiteUrl } from '@/lib/site-url';
import {
  assertStripePriceIsMonthlySubscription,
  assertStripePriceIsOneTimePayment,
  type BillingInterval,
  getStripePriceId,
  getEffectivePlan,
  isSubscriptionStatusAllowingAccess,
  type PaidStripePlan,
  PLAN_RANK,
} from '@/lib/stripe-billing';
import { getPlanLabel, isLifetimePlan, normalizePlan } from '@/lib/plans';
import {
  blockTestStripePublishableInProduction,
  blockTestStripeSecretInProduction,
} from '@/lib/stripe-prod-guard';

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

function isCheckoutPlan(plan: string | undefined): plan is PaidStripePlan {
  return plan === 'starter' || plan === 'creator' || plan === 'pro' || plan === 'lifetime' || plan === 'scale';
}

export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;
  const pkBlock = blockTestStripePublishableInProduction();
  if (pkBlock) return pkBlock;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifie.' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, interval = 'month' } = body as { plan?: string; interval?: BillingInterval };

    if (!isCheckoutPlan(plan)) {
      return NextResponse.json({ error: 'Plan invalide. Valeurs acceptees : starter, pro, lifetime.' }, { status: 400 });
    }
    if (interval !== 'month' && interval !== 'year') {
      return NextResponse.json({ error: 'Intervalle invalide. Valeurs acceptees : month, year.' }, { status: 400 });
    }

    const normalizedPlan = normalizePlan(plan);
    if (normalizedPlan === 'starter' && interval === 'year') {
      return NextResponse.json({ error: 'Le plan Starter est disponible uniquement en mensuel.' }, { status: 400 });
    }
    if (normalizedPlan === 'lifetime' && interval !== 'month') {
      return NextResponse.json({ error: 'Le plan Lifetime est un paiement unique.' }, { status: 400 });
    }

    const userProfile = await getUserById(session.userId);
    const hasActiveStripeSub =
      Boolean(userProfile?.stripe_subscription_id) &&
      isSubscriptionStatusAllowingAccess(userProfile?.subscription_status);
    const currentPlan = userProfile ? getEffectivePlan(userProfile) : 'free';

    if (isLifetimePlan(currentPlan)) {
      return NextResponse.json(
        { error: 'Tu es deja sur le plan Lifetime.', code: 'ALREADY_ON_PLAN' },
        { status: 400 }
      );
    }

    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const targetRank = PLAN_RANK[normalizedPlan] ?? 0;

    if (currentRank >= targetRank) {
      const isSamePlan = currentRank === targetRank;
      return NextResponse.json(
        {
          error: isSamePlan
            ? `Tu es deja sur le plan ${getPlanLabel(plan)}.`
            : 'Tu es deja sur un plan superieur.',
          code: isSamePlan ? 'ALREADY_ON_PLAN' : 'PLAN_DOWNGRADE_BLOCKED',
        },
        { status: 400 }
      );
    }

    if (hasActiveStripeSub && normalizedPlan !== 'lifetime') {
      return NextResponse.json(
        {
          error: 'Tu as deja un abonnement Stripe actif. Gere-le depuis le dashboard ou contacte le support.',
          code: 'ALREADY_SUBSCRIBED',
        },
        { status: 400 }
      );
    }

    const baseUrl = getSiteUrl(request.headers.get('origin'));
    const stripe = getStripe();
    const priceId = getStripePriceId(plan, interval);
    const checkoutMode: Stripe.Checkout.SessionCreateParams.Mode =
      normalizedPlan === 'lifetime' ? 'payment' : 'subscription';

    const priceCheck = checkoutMode === 'payment'
      ? await assertStripePriceIsOneTimePayment(stripe, priceId)
      : await assertStripePriceIsMonthlySubscription(stripe, priceId);

    if (!priceCheck.ok) {
      console.error('[checkout] Price invalide:', priceCheck.code, priceId, priceCheck.message);
      return NextResponse.json({ error: priceCheck.message, code: priceCheck.code }, { status: 400 });
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: checkoutMode,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: session.userId,
        plan: normalizedPlan,
        interval,
      },
      success_url: `${baseUrl}/dashboard?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/billing`,
      allow_promotion_codes: true,
    };

    if (checkoutMode === 'subscription') {
      params.subscription_data = {
        metadata: {
          userId: session.userId,
          plan: normalizedPlan,
          interval,
        },
      };
    }

    if (userProfile?.stripe_customer_id) {
      params.customer = userProfile.stripe_customer_id;
    } else {
      params.customer_email = session.email;
    }

    const checkoutSession = await stripe.checkout.sessions.create(params);

    console.log('[checkout] Session creee', {
      sessionId: checkoutSession.id,
      mode: checkoutSession.mode,
      priceId,
      userId: session.userId,
      plan: normalizedPlan,
      interval,
      customer: params.customer ?? '(nouveau via customer_email)',
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[checkout] Error:', message);
    return NextResponse.json(
      { error: message.includes('STRIPE_') ? message : 'Erreur lors de la creation du paiement.' },
      { status: 500 }
    );
  }
}
