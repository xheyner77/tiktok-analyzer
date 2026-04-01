import type { Plan } from '@/lib/supabase';
import type Stripe from 'stripe';

export type PriceValidationResult =
  | { ok: true }
  | { ok: false; code: 'PRICE_NOT_RECURRING' | 'PRICE_NOT_MONTHLY'; message: string };

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
        'Ce Price Stripe est en paiement unique. Dans Products, crée un prix « Récurrent », intervalle « mois », puis mets à jour STRIPE_PRICE_PRO / STRIPE_PRICE_ELITE avec ce price_id.',
    };
  }
  if (price.recurring?.interval !== 'month') {
    return {
      ok: false,
      code: 'PRICE_NOT_MONTHLY',
      message: `L’abonnement doit être mensuel (interval: month). Price actuel : ${price.recurring?.interval ?? '?'}.`,
    };
  }
  return { ok: true };
}

/** Rang pour comparer les plans (anti-rétrogradation via webhooks en retard). */
export const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, elite: 2 };

export function getStripePriceId(plan: 'pro' | 'elite'): string {
  const envKey = plan === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_ELITE';
  const id = process.env[envKey]?.trim();
  if (!id) {
    throw new Error(
      `${envKey} manquant — crée les prix récurrents dans Stripe (Products) et mets les price_… dans les variables d’environnement.`
    );
  }
  return id;
}

export function planFromStripePriceId(priceId: string): 'pro' | 'elite' | null {
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  const elite = process.env.STRIPE_PRICE_ELITE?.trim();
  if (priceId && priceId === pro) return 'pro';
  if (priceId && priceId === elite) return 'elite';
  return null;
}

/** Abonnement considéré comme payé et ouvrant l’accès aux fonctionnalités Pro/Elite. */
export function isSubscriptionStatusAllowingAccess(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

/**
 * Plan effectif pour quotas / features API.
 * Sans `stripe_subscription_id` (anciens achats one-shot) : on honore encore `plan` en base.
 */
export function getEffectivePlan(user: {
  plan: Plan;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}): Plan {
  if (user.plan === 'free') return 'free';
  if (!user.stripe_subscription_id) return user.plan;
  if (isSubscriptionStatusAllowingAccess(user.subscription_status)) return user.plan;
  return 'free';
}
