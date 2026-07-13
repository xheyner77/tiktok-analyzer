import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import { getSiteUrl } from '@/lib/site-url';
import {
  assertStripePriceIsMonthlySubscription,
  assertStripePriceIsOneTimePayment,
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
import {
  privateJson,
  readJsonObject,
  rejectCrossSiteMutation,
} from '@/lib/api-route-security';

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

function isCheckoutPlan(plan: string | undefined): plan is PaidStripePlan {
  return plan === 'starter' || plan === 'creator' || plan === 'pro' || plan === 'lifetime' || plan === 'scale';
}

const CHECKOUT_IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

function checkoutIdempotencyKey(input: {
  userId: string;
  plan: string;
  interval: string;
}): string {
  const window = Math.floor(Date.now() / CHECKOUT_IDEMPOTENCY_WINDOW_MS);
  return `viralynz-checkout:${input.userId}:${input.plan}:${input.interval}:${window}`;
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) {
    return privateJson({ error: 'Le service de facturation est indisponible.' }, { status: 503 });
  }
  const pkBlock = blockTestStripePublishableInProduction();
  if (pkBlock) {
    return privateJson({ error: 'Le service de facturation est indisponible.' }, { status: 503 });
  }

  try {
    const session = await getSession();

    if (!session) {
      return privateJson({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await readJsonObject(request);
    if (!body) {
      return privateJson({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    const plan = typeof body.plan === 'string' ? body.plan : undefined;
    const interval = body.interval === undefined ? 'month' : body.interval;

    if (!isCheckoutPlan(plan)) {
      return privateJson({ error: 'Plan invalide.' }, { status: 400 });
    }
    if (interval !== 'month' && interval !== 'year') {
      return privateJson({ error: 'Intervalle invalide.' }, { status: 400 });
    }

    const normalizedPlan = normalizePlan(plan);
    if (normalizedPlan === 'starter' && interval === 'year') {
      return privateJson({ error: 'Le plan Starter est disponible uniquement en mensuel.' }, { status: 400 });
    }
    if (normalizedPlan === 'lifetime' && interval !== 'month') {
      return privateJson({ error: 'Le plan Lifetime est un paiement unique.' }, { status: 400 });
    }

    const userProfile = await getUserById(session.userId);
    if (!userProfile) {
      return privateJson({ error: 'Compte utilisateur introuvable.' }, { status: 404 });
    }
    const hasActiveStripeSub =
      Boolean(userProfile.stripe_subscription_id) &&
      isSubscriptionStatusAllowingAccess(userProfile.subscription_status);
    const currentPlan = getEffectivePlan(userProfile);

    if (isLifetimePlan(currentPlan)) {
      return privateJson(
        { error: 'Tu es deja sur le plan Lifetime.', code: 'ALREADY_ON_PLAN' },
        { status: 400 }
      );
    }

    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const targetRank = PLAN_RANK[normalizedPlan] ?? 0;

    if (currentRank >= targetRank) {
      const isSamePlan = currentRank === targetRank;
      return privateJson(
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
      return privateJson(
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
      : await assertStripePriceIsMonthlySubscription(stripe, priceId, interval);

    if (!priceCheck.ok) {
      console.error('[checkout] Configuration de prix Stripe invalide.', { code: priceCheck.code });
      return privateJson(
        { error: 'Le paiement est temporairement indisponible.', code: 'BILLING_CONFIGURATION_ERROR' },
        { status: 503 },
      );
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: checkoutMode,
      client_reference_id: session.userId,
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
    } else {
      params.payment_intent_data = {
        metadata: {
          userId: session.userId,
          plan: normalizedPlan,
          interval,
        },
      };
    }

    if (userProfile.stripe_customer_id) {
      params.customer = userProfile.stripe_customer_id;
    } else {
      params.customer_email = session.email;
      if (checkoutMode === 'payment') {
        // Checkout payment mode no longer creates a Customer by default.
        // Lifetime fulfillment requires a stable Customer id so the webhook
        // can bind the purchase to exactly one Viralynz account.
        params.customer_creation = 'always';
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create(params, {
      // A double click, a second tab or a network retry within the same short
      // window must resolve to the same Stripe Checkout Session.
      idempotencyKey: checkoutIdempotencyKey({
        userId: session.userId,
        plan: normalizedPlan,
        interval,
      }),
    });

    if (!checkoutSession.url) {
      console.error('[checkout] Stripe n’a retourné aucune URL de paiement.');
      return privateJson({ error: 'Le paiement est temporairement indisponible.' }, { status: 502 });
    }

    console.log('[checkout] Session de paiement créée.', {
      mode: checkoutSession.mode,
      plan: normalizedPlan,
      interval,
    });

    return privateJson({ url: checkoutSession.url });
  } catch (error) {
    const unavailable = error instanceof Error && /manquant|missing/i.test(error.message);
    console.error('[checkout] Erreur de paiement.', {
      kind: error instanceof Error ? error.name : 'unknown',
      configurationUnavailable: unavailable,
    });
    return privateJson(
      { error: 'Le paiement est temporairement indisponible.' },
      { status: unavailable ? 503 : 502 },
    );
  }
}
