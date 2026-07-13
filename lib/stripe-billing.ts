import type { Plan } from '@/lib/supabase';
import type Stripe from 'stripe';
import {
  getConfiguredStripePriceId,
  resolveStripePrice,
  type StripeMappedPlan,
} from '@/lib/billing/stripe-prices';
import { normalizePlan, type AppPlan } from './plans';
import type { PaidCommercialPlanId } from './public-plans';
import { STRIPE_CATALOG } from './stripe-pricing';
import { getStripeRuntimeMode, isStripeLiveRuntime } from './stripe-runtime';

export type PaidStripePlan = PaidCommercialPlanId;
export type BillingInterval = 'month' | 'year';

export type PriceValidationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'PRICE_NOT_RECURRING'
        | 'PRICE_INTERVAL_MISMATCH'
        | 'PRICE_NOT_ONETIME'
        | 'PRICE_INACTIVE'
        | 'PRICE_MODE_MISMATCH'
        | 'PRICE_CURRENCY_MISMATCH'
        | 'PRICE_AMOUNT_MISMATCH'
        | 'PRICE_METADATA_MISMATCH';
      message: string;
    };

function metadataValues(price: Stripe.Price, key: string): string[] {
  const values: string[] = [];
  const priceValue = price.metadata?.[key]?.trim();
  if (priceValue) values.push(priceValue);

  if (typeof price.product === 'object' && price.product && !('deleted' in price.product)) {
    const productValue = price.product.metadata?.[key]?.trim();
    if (productValue) values.push(productValue);
  }

  return values;
}

function validateCatalogPrice(
  price: Stripe.Price,
  expectedPlan: 'starter' | 'pro' | 'lifetime',
): PriceValidationResult {
  const catalog = STRIPE_CATALOG[expectedPlan];
  if (!price.active) {
    return { ok: false, code: 'PRICE_INACTIVE', message: 'Le Price Stripe est archive.' };
  }
  if (price.livemode !== isStripeLiveRuntime()) {
    return {
      ok: false,
      code: 'PRICE_MODE_MISMATCH',
      message: 'Le Price Stripe appartient au mauvais environnement.',
    };
  }
  if (price.currency.toLowerCase() !== catalog.currency) {
    return {
      ok: false,
      code: 'PRICE_CURRENCY_MISMATCH',
      message: 'La devise du Price Stripe ne correspond pas au catalogue Viralynz.',
    };
  }
  if (price.unit_amount !== catalog.unitAmount) {
    return {
      ok: false,
      code: 'PRICE_AMOUNT_MISMATCH',
      message: 'Le montant du Price Stripe ne correspond pas au catalogue Viralynz.',
    };
  }

  const declaredPlans = metadataValues(price, 'viralynz_plan');
  if (declaredPlans.some((plan) => plan !== expectedPlan)) {
    return {
      ok: false,
      code: 'PRICE_METADATA_MISMATCH',
      message: 'Les metadata du Price Stripe designent un autre plan.',
    };
  }

  const expectedEnvironment = getStripeRuntimeMode() === 'live' ? 'production' : 'test';
  const declaredEnvironments = metadataValues(price, 'environment');
  if (declaredEnvironments.some((environment) => environment !== expectedEnvironment)) {
    return {
      ok: false,
      code: 'PRICE_METADATA_MISMATCH',
      message: 'Les metadata du Price Stripe designent un autre environnement.',
    };
  }

  return { ok: true };
}

export async function assertStripePriceIsMonthlySubscription(
  stripe: Stripe,
  priceId: string,
  expectedInterval: BillingInterval,
  expectedPlan: 'starter' | 'pro',
): Promise<PriceValidationResult> {
  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  const catalogValidation = validateCatalogPrice(price, expectedPlan);
  if (!catalogValidation.ok) return catalogValidation;

  if (price.type !== 'recurring') {
    return {
      ok: false,
      code: 'PRICE_NOT_RECURRING',
      message: 'Starter et Pro doivent utiliser un Price recurrent mensuel.',
    };
  }
  if (expectedInterval !== 'month' || price.recurring?.interval !== 'month') {
    return {
      ok: false,
      code: 'PRICE_INTERVAL_MISMATCH',
      message: 'Les abonnements Viralynz commercialises sont mensuels.',
    };
  }
  return { ok: true };
}

export async function assertStripePriceIsOneTimePayment(
  stripe: Stripe,
  priceId: string,
): Promise<PriceValidationResult> {
  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  const catalogValidation = validateCatalogPrice(price, 'lifetime');
  if (!catalogValidation.ok) return catalogValidation;

  if (price.type === 'recurring') {
    return {
      ok: false,
      code: 'PRICE_NOT_ONETIME',
      message: 'Lifetime doit utiliser un Price one-time a 149 EUR.',
    };
  }
  return { ok: true };
}

export const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  creator: 1,
  pro: 2,
  lifetime: 3,
  scale: 3,
};

export function getStripePriceId(plan: PaidStripePlan, interval: BillingInterval = 'month'): string {
  const normalized = normalizePlan(plan);
  if (normalized === 'free') {
    throw new Error('Plan Stripe invalide : free');
  }
  if (interval !== 'month') {
    throw new Error('Les nouveaux checkouts Viralynz sont disponibles uniquement en mensuel.');
  }

  const candidates = normalized === 'starter'
    ? ['STRIPE_STARTER_PRICE_ID']
    : normalized === 'pro'
      ? ['STRIPE_PRO_PRICE_ID']
      : ['STRIPE_LIFETIME_PRICE_ID'];

  const configured = getConfiguredStripePriceId(candidates);
  if (!configured) {
    throw new Error(
      `${candidates[0]} manquant - configure le Price Stripe correspondant au catalogue Viralynz.`,
    );
  }
  return configured.priceId;
}

export function planFromStripePriceId(priceId: string): StripeMappedPlan | null {
  return resolveStripePrice(priceId)?.plan ?? null;
}

export function isLegacyStripePriceId(priceId: string | null | undefined): boolean {
  return resolveStripePrice(priceId)?.legacy ?? false;
}

export function isSubscriptionStatusAllowingAccess(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

export function getEffectivePlan(user: {
  plan: Plan | string | null | undefined;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  subscription_status?: string | null;
}): AppPlan {
  if (user.plan === 'elite') {
    if (user.stripe_subscription_id && isSubscriptionStatusAllowingAccess(user.subscription_status)) {
      return 'pro';
    }
    return 'free';
  }

  const pricePlan = resolveStripePrice(user.stripe_price_id)?.plan;

  // Scale était une offre récurrente. Elle garde les droits Lifetime tant
  // que l'abonnement historique est actif, jamais après résiliation.
  if (user.plan === 'scale' || pricePlan === 'scale') {
    if (
      user.stripe_subscription_id
      && isSubscriptionStatusAllowingAccess(user.subscription_status)
    ) {
      return 'scale';
    }
    return 'free';
  }

  const normalized = normalizePlan(user.plan);
  if (normalized === 'free') return 'free';
  if (normalized === 'lifetime') {
    return user.subscription_status === 'lifetime' || pricePlan === 'lifetime'
      ? 'lifetime'
      : 'free';
  }

  if (pricePlan === 'lifetime') return 'lifetime';
  if (pricePlan && user.stripe_subscription_id && isSubscriptionStatusAllowingAccess(user.subscription_status)) {
    return pricePlan;
  }

  if (!user.stripe_subscription_id) return normalized;
  if (isSubscriptionStatusAllowingAccess(user.subscription_status)) return normalized;
  if (process.env.NODE_ENV !== 'production') return normalized;
  return 'free';
}
