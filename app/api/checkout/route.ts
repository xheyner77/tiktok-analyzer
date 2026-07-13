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
  planFromStripePriceId,
  type PaidStripePlan,
  PLAN_RANK,
} from '@/lib/stripe-billing';
import { getPlanLabel, isLifetimePlan } from '@/lib/plans';
import { isPaidCommercialPlan } from '@/lib/public-plans';
import {
  blockTestStripePublishableInProduction,
  blockTestStripeSecretInProduction,
} from '@/lib/stripe-prod-guard';
import {
  getStripePortalConfigurationId,
  getStripeSecretKey,
  isStripeLiveRuntime,
} from '@/lib/stripe-runtime';
import {
  createProUpgradePortalSession,
  ensureStableStripeCustomer,
  inspectStripeCheckoutState,
  resolveOpenCheckout,
  StripeCheckoutSafetyError,
} from '@/lib/stripe-checkout-safety';
import {
  privateJson,
  readJsonObject,
  rejectCrossSiteMutation,
} from '@/lib/api-route-security';

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey().value);
}

function isCheckoutPlan(plan: string | undefined): plan is PaidStripePlan {
  return isPaidCommercialPlan(plan);
}

function checkoutIdempotencyKey(input: {
  userId: string;
  generation: string;
}): string {
  return `viralynz-checkout:${input.userId}:${input.generation}`;
}

function isStripeIdempotencyConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const stripeError = error as {
    name?: unknown;
    type?: unknown;
    rawType?: unknown;
    code?: unknown;
  };
  return stripeError.name === 'StripeIdempotencyError'
    || stripeError.type === 'StripeIdempotencyError'
    || stripeError.rawType === 'idempotency_error'
    || stripeError.code === 'idempotency_key_in_use';
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
    if (interval !== 'month') {
      return privateJson({ error: 'Les offres Viralynz sont disponibles en mensuel ou en paiement unique.' }, { status: 400 });
    }
    const normalizedPlan: PaidStripePlan = plan;

    const userProfile = await getUserById(session.userId);
    if (!userProfile) {
      return privateJson({ error: 'Compte utilisateur introuvable.' }, { status: 404 });
    }
    const currentPlan = getEffectivePlan(userProfile);

    if (isLifetimePlan(currentPlan)) {
      return privateJson(
        { error: 'Tu es deja sur le plan Lifetime.', code: 'ALREADY_ON_PLAN' },
        { status: 400 }
      );
    }

    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const targetRank = PLAN_RANK[normalizedPlan] ?? 0;

    // A stored recurring reference can be stale while Stripe's webhook is in
    // flight. In that case Stripe is checked below before any new Checkout.
    if (!userProfile.stripe_subscription_id && currentRank >= targetRank) {
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

    const baseUrl = getSiteUrl(request.headers.get('origin'));
    const stripe = getStripe();
    const priceId = getStripePriceId(plan, interval);
    const checkoutMode: Stripe.Checkout.SessionCreateParams.Mode =
      normalizedPlan === 'lifetime' ? 'payment' : 'subscription';

    const priceCheck = normalizedPlan === 'lifetime'
      ? await assertStripePriceIsOneTimePayment(stripe, priceId)
      : await assertStripePriceIsMonthlySubscription(stripe, priceId, interval, normalizedPlan);

    if (!priceCheck.ok) {
      console.error('[checkout] Configuration de prix Stripe invalide.', { code: priceCheck.code });
      return privateJson(
        { error: 'Le paiement est temporairement indisponible.', code: 'BILLING_CONFIGURATION_ERROR' },
        { status: 503 },
      );
    }

    const customerId = await ensureStableStripeCustomer(stripe, {
      userId: session.userId,
      email: session.email,
      persistedCustomerId: userProfile.stripe_customer_id,
      persistedSubscriptionId: userProfile.stripe_subscription_id,
    });
    const stripeState = await inspectStripeCheckoutState(stripe, {
      customerId,
      userId: session.userId,
      persistedSubscriptionId: userProfile.stripe_subscription_id,
    });

    if (stripeState.subscriptions.length > 1) {
      return privateJson(
        {
          error: 'Plusieurs abonnements Stripe sont rattaches a ce compte. Contacte le support avant tout nouveau paiement.',
          code: 'MULTIPLE_SUBSCRIPTIONS',
        },
        { status: 409 },
      );
    }

    const activeSubscription = stripeState.subscriptions[0] ?? null;
    if (normalizedPlan === 'lifetime' && activeSubscription) {
      return privateJson(
        {
          error: 'Gere d abord ton abonnement Stripe avant de passer a Lifetime.',
          code: 'SUBSCRIPTION_ACTION_REQUIRED',
          action: 'billing_portal',
        },
        { status: 409 },
      );
    }

    if (checkoutMode === 'subscription' && activeSubscription) {
      const activePriceId = activeSubscription.items.data[0]?.price?.id ?? null;
      const activePlan = activePriceId ? planFromStripePriceId(activePriceId) : null;

      if (
        normalizedPlan === 'pro'
        && activePlan === 'starter'
        && (activeSubscription.status === 'active' || activeSubscription.status === 'trialing')
      ) {
        const portalUrl = await createProUpgradePortalSession(stripe, {
          configurationId: getStripePortalConfigurationId().value,
          customerId,
          userId: session.userId,
          subscription: activeSubscription,
          targetPriceId: priceId,
          returnUrl: `${baseUrl}/dashboard/billing?billing=updated`,
          liveMode: isStripeLiveRuntime(),
        });
        return privateJson({
          url: portalUrl,
          flow: 'portal',
          code: 'STARTER_TO_PRO_PORTAL',
        });
      }

      if (activePlan === normalizedPlan) {
        return privateJson(
          { error: `Tu es deja sur le plan ${getPlanLabel(normalizedPlan)}.`, code: 'ALREADY_ON_PLAN' },
          { status: 400 },
        );
      }

      if (activePlan && (PLAN_RANK[activePlan] ?? 0) > targetRank) {
        return privateJson(
          { error: 'Tu es deja sur un plan superieur.', code: 'PLAN_DOWNGRADE_BLOCKED' },
          { status: 400 },
        );
      }

      return privateJson(
        {
          error: 'Un abonnement Stripe existe deja. Gere-le depuis la facturation avant de changer de plan.',
          code: 'SUBSCRIPTION_ACTION_REQUIRED',
        },
        { status: 409 },
      );
    }

    const openCheckout = resolveOpenCheckout(stripeState.openSessions, normalizedPlan);
    if (openCheckout.reusable?.url) {
      return privateJson({ url: openCheckout.reusable.url, flow: 'checkout', reused: true });
    }
    if (openCheckout.conflictingCheckout) {
      return privateJson(
        {
          error: 'Un autre paiement Stripe est deja ouvert. Termine-le ou laisse-le expirer avant de continuer.',
          code: 'CHECKOUT_ALREADY_OPEN',
        },
        { status: 409 },
      );
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: checkoutMode,
      customer: customerId,
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

    const checkoutSession = await stripe.checkout.sessions.create(params, {
      // A generation is shared by every plan and mode. Stripe can therefore
      // create at most one billable Session from the state inspected above,
      // even when Starter/Pro and Lifetime requests race across instances.
      idempotencyKey: checkoutIdempotencyKey({
        userId: session.userId,
        generation: stripeState.checkoutGeneration,
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

    return privateJson({ url: checkoutSession.url, flow: 'checkout', reused: false });
  } catch (error) {
    if (isStripeIdempotencyConflict(error)) {
      console.warn('[checkout] Une autre demande de paiement a gagne le verrou Stripe.');
      return privateJson(
        {
          error: 'Un autre paiement Stripe vient d etre ouvert. Recharge la facturation avant de continuer.',
          code: 'CHECKOUT_ALREADY_OPEN',
        },
        { status: 409 },
      );
    }
    if (error instanceof StripeCheckoutSafetyError) {
      const configurationFailure = error.code.startsWith('portal_upgrade_configuration');
      console.error('[checkout] Etat Stripe refuse.', { code: error.code });
      return privateJson(
        {
          error: configurationFailure
            ? 'Le changement de plan est temporairement indisponible.'
            : 'La facturation de ce compte doit etre verifiee avant un nouveau paiement.',
          code: configurationFailure ? 'BILLING_CONFIGURATION_ERROR' : 'BILLING_STATE_CONFLICT',
        },
        { status: configurationFailure ? 503 : 409 },
      );
    }
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
