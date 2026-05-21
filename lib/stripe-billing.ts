import type { Plan } from '@/lib/supabase';
import type Stripe from 'stripe';
import { normalizePlan, type AppPlan } from './plans';

export type PaidStripePlan = 'starter' | 'pro' | 'lifetime' | 'creator' | 'scale';
export type BillingInterval = 'month' | 'year';

export type PriceValidationResult =
  | { ok: true }
  | { ok: false; code: 'PRICE_NOT_RECURRING' | 'PRICE_NOT_SUPPORTED_INTERVAL' | 'PRICE_NOT_ONETIME'; message: string };

/**
 * Un Checkout `mode: subscription` exige un Price **récurrent**. Un price one-time → paiement simple (pi_) sans sub_.
 */
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
        'Ce Price Stripe est en paiement unique. Dans Products, crée un prix « Récurrent », intervalle « mois », puis mets à jour les variables STRIPE_PRICE_*_MONTHLY avec ce price_id.',
    };
  }
  if (price.recurring?.interval !== 'month' && price.recurring?.interval !== 'year') {
    return {
      ok: false,
      code: 'PRICE_NOT_SUPPORTED_INTERVAL',
      message: `L’abonnement doit être mensuel ou annuel. Price actuel : ${price.recurring?.interval ?? '?'}.`,
    };
  }
  return { ok: true };
}

/** Un Checkout Lifetime `mode: payment` exige un Price en paiement unique. */
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
        'Le plan Lifetime doit utiliser un Price Stripe en paiement unique. Crée un Price one-time à 149€ puis renseigne STRIPE_PRICE_LIFETIME_ONETIME.',
    };
  }
  return { ok: true };
}

/** Rang pour comparer les plans (anti-rétrogradation via webhooks en retard). */
export const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, lifetime: 3, creator: 1, scale: 3 };

export function getStripePriceId(plan: PaidStripePlan, interval: BillingInterval = 'month'): string {
  const normalized = normalizePlan(plan);
  if (normalized === 'free') {
    throw new Error('Plan Stripe invalide : free');
  }
  const envKey =
    normalized === 'starter' ? 'STRIPE_PRICE_CREATOR_MONTHLY' :
    normalized === 'pro' && interval === 'year' ? 'STRIPE_PRICE_PRO_YEARLY' :
    normalized === 'pro' ? 'STRIPE_PRICE_PRO_MONTHLY' :
    'STRIPE_PRICE_LIFETIME_ONETIME';
  const id = process.env[envKey]?.trim();
  if (!id) {
    throw new Error(
      `${envKey} manquant — mets le price_… Stripe correspondant dans les variables d’environnement.`
    );
  }
  return id;
}

export function planFromStripePriceId(priceId: string): PaidStripePlan | null {
  const mappings: Array<[string | undefined, PaidStripePlan]> = [
    [process.env.STRIPE_PRICE_CREATOR_MONTHLY?.trim(), 'starter'],
    [process.env.STRIPE_PRICE_PRO_MONTHLY?.trim(), 'pro'],
    [process.env.STRIPE_PRICE_PRO_YEARLY?.trim(), 'pro'],
    [process.env.STRIPE_PRICE_LIFETIME_ONETIME?.trim(), 'lifetime'],
    [process.env.STRIPE_PRICE_SCALE_MONTHLY?.trim(), 'lifetime'],
    [process.env.STRIPE_PRICE_SCALE_YEARLY?.trim(), 'lifetime'],
    [process.env.STRIPE_PRICE_PRO?.trim(), 'pro'],
    [process.env.STRIPE_PRICE_ELITE?.trim(), 'lifetime'],
  ];
  const match = mappings.find(([id]) => id && id === priceId);
  if (match) return match[1];
  return null;
}

/** Abonnement considéré comme payé et ouvrant l’accès aux fonctionnalités payantes. */
export function isSubscriptionStatusAllowingAccess(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Plan effectif pour quotas / features API.
 * `elite` reste uniquement une valeur legacy Stripe et est converti ici vers le plan actif équivalent.
 */
export function getEffectivePlan(user: {
  plan: Plan | string | null | undefined;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}): AppPlan {
  if (user.plan === 'elite') {
    if (user.stripe_subscription_id && isSubscriptionStatusAllowingAccess(user.subscription_status)) {
      return 'lifetime';
    }
    if (process.env.NODE_ENV !== 'production') return 'lifetime';
    return 'free';
  }

  const normalized = normalizePlan(user.plan);
  if (normalized === 'free') return 'free';
  if (normalized === 'lifetime') return 'lifetime';
  if (!user.stripe_subscription_id) return normalized;
  if (isSubscriptionStatusAllowingAccess(user.subscription_status)) return normalized;
  if (process.env.NODE_ENV !== 'production') return normalized;
  return 'free';
}
