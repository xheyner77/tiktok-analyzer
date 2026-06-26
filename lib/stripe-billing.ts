import type { Plan } from '@/lib/supabase';
import type Stripe from 'stripe';
import {
  getConfiguredStripePriceId,
  resolveStripePrice,
  type StripeMappedPlan,
} from '@/lib/billing/stripe-prices';
import { normalizePlan, type AppPlan } from './plans';

export type PaidStripePlan = 'starter' | 'pro' | 'lifetime' | 'creator' | 'scale';
export type BillingInterval = 'month' | 'year';

export type PriceValidationResult =
  | { ok: true }
  | { ok: false; code: 'PRICE_NOT_RECURRING' | 'PRICE_NOT_SUPPORTED_INTERVAL' | 'PRICE_NOT_ONETIME'; message: string };

export async function assertStripePriceIsMonthlySubscription(
  stripe: Stripe,
  priceId: string
): Promise<PriceValidationResult> {
  const price = await stripe.prices.retrieve(priceId);
  if (price.type !== 'recurring') {
    return {
      ok: false,
      code: 'PRICE_NOT_RECURRING',
      message:
        'Ce Price Stripe est en paiement unique. Dans Products, cree un prix recurrent mensuel, puis renseigne STRIPE_STARTER_PRICE_ID ou STRIPE_PRO_PRICE_ID.',
    };
  }
  if (price.recurring?.interval !== 'month' && price.recurring?.interval !== 'year') {
    return {
      ok: false,
      code: 'PRICE_NOT_SUPPORTED_INTERVAL',
      message: `L'abonnement doit etre mensuel ou annuel. Price actuel : ${price.recurring?.interval ?? '?'}.`,
    };
  }
  return { ok: true };
}

export async function assertStripePriceIsOneTimePayment(
  stripe: Stripe,
  priceId: string
): Promise<PriceValidationResult> {
  const price = await stripe.prices.retrieve(priceId);
  if (price.type === 'recurring') {
    return {
      ok: false,
      code: 'PRICE_NOT_ONETIME',
      message:
        'Le plan Lifetime doit utiliser un Price Stripe en paiement unique. Cree un Price one-time a 149 EUR puis renseigne STRIPE_LIFETIME_PRICE_ID.',
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

  const candidates =
    normalized === 'starter' ? ['STRIPE_STARTER_PRICE_ID', 'STRIPE_PRICE_CREATOR_MONTHLY'] :
    normalized === 'pro' && interval === 'year' ? ['STRIPE_PRICE_PRO_YEARLY'] :
    normalized === 'pro' ? ['STRIPE_PRO_PRICE_ID', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO'] :
    ['STRIPE_LIFETIME_PRICE_ID', 'STRIPE_PRICE_LIFETIME_ONETIME'];

  const configured = getConfiguredStripePriceId(candidates);
  if (!configured) {
    throw new Error(
      `${candidates[0]} manquant - mets le price_ Stripe correspondant dans les variables d'environnement.`
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

  const normalized = normalizePlan(user.plan);
  if (normalized === 'free') return 'free';
  if (normalized === 'lifetime') return 'lifetime';

  const pricePlan = resolveStripePrice(user.stripe_price_id)?.plan;
  if (pricePlan === 'lifetime') return 'lifetime';
  if (pricePlan && user.stripe_subscription_id && isSubscriptionStatusAllowingAccess(user.subscription_status)) {
    return pricePlan;
  }

  if (!user.stripe_subscription_id) return normalized;
  if (isSubscriptionStatusAllowingAccess(user.subscription_status)) return normalized;
  if (process.env.NODE_ENV !== 'production') return normalized;
  return 'free';
}
