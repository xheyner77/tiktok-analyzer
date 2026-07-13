import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listStripePriceMappings, resolveStripePrice } from '@/lib/billing/stripe-prices';
import {
  getEffectivePlan,
  getStripePriceId,
  isLegacyStripePriceId,
  planFromStripePriceId,
} from '@/lib/stripe-billing';

const touchedEnv = [
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_LIFETIME_PRICE_ID',
  'STRIPE_LEGACY_PRO_PRICE_ID',
  'STRIPE_PRICE_CREATOR_MONTHLY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_LIFETIME_ONETIME',
  'STRIPE_PRICE_SCALE_MONTHLY',
  'STRIPE_PRICE_SCALE_YEARLY',
  'STRIPE_PRICE_ELITE',
] as const;

const previousEnv = Object.fromEntries(
  touchedEnv.map((key) => [key, process.env[key]])
);

beforeEach(() => {
  for (const key of touchedEnv) delete process.env[key];
});

afterEach(() => {
  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
});

describe('stripe price mapping', () => {
  it('maps Starter current Price ID to starter', () => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_10';

    expect(planFromStripePriceId('price_starter_10')).toBe('starter');
    expect(resolveStripePrice('price_starter_10')).toMatchObject({ plan: 'starter', legacy: false });
  });

  it('maps Pro current Price ID to pro', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';

    expect(planFromStripePriceId('price_pro_29')).toBe('pro');
    expect(resolveStripePrice('price_pro_29')).toMatchObject({ plan: 'pro', legacy: false });
  });

  it('maps legacy 24.99 Pro Price ID to pro with legacy flag', () => {
    process.env.STRIPE_LEGACY_PRO_PRICE_ID = 'price_pro_2499';

    expect(planFromStripePriceId('price_pro_2499')).toBe('pro');
    expect(isLegacyStripePriceId('price_pro_2499')).toBe(true);
  });

  it('maps legacy Elite Price ID to pro with legacy flag', () => {
    process.env.STRIPE_PRICE_ELITE = 'price_elite_2499';

    expect(planFromStripePriceId('price_elite_2499')).toBe('pro');
    expect(resolveStripePrice('price_elite_2499')).toMatchObject({
      envVar: 'STRIPE_PRICE_ELITE',
      plan: 'pro',
      legacy: true,
    });
  });

  it('maps Lifetime current Price ID to lifetime', () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';

    expect(planFromStripePriceId('price_lifetime_149')).toBe('lifetime');
    expect(resolveStripePrice('price_lifetime_149')).toMatchObject({ plan: 'lifetime', legacy: false });
  });

  it('keeps aliases that map the same Price ID to the same normalized plan', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_shared_pro';
    process.env.STRIPE_PRICE_ELITE = 'price_shared_pro';

    expect(planFromStripePriceId('price_shared_pro')).toBe('pro');
    expect(resolveStripePrice('price_shared_pro')).toMatchObject({
      envVar: 'STRIPE_PRO_PRICE_ID',
      plan: 'pro',
      legacy: false,
    });
    expect(listStripePriceMappings().filter(({ priceId }) => priceId === 'price_shared_pro')).toHaveLength(1);
  });

  it('fails closed when one Price ID is assigned to different normalized plans', () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_conflicting_plan';
    process.env.STRIPE_PRICE_ELITE = 'price_conflicting_plan';

    expect(resolveStripePrice('price_conflicting_plan')).toBeNull();
    expect(planFromStripePriceId('price_conflicting_plan')).toBeNull();
    expect(listStripePriceMappings()).not.toContainEqual(
      expect.objectContaining({ priceId: 'price_conflicting_plan' }),
    );
    expect(() => getStripePriceId('lifetime')).toThrow(/STRIPE_LIFETIME_PRICE_ID manquant/);
  });

  it('treats active legacy Elite users as Pro', () => {
    expect(getEffectivePlan({
      plan: 'elite',
      stripe_subscription_id: 'sub_elite_legacy',
      subscription_status: 'active',
    })).toBe('pro');
  });

  it('treats inactive legacy Elite users as Free', () => {
    expect(getEffectivePlan({
      plan: 'elite',
      stripe_subscription_id: null,
      subscription_status: null,
    })).toBe('free');

    expect(getEffectivePlan({
      plan: 'elite',
      stripe_subscription_id: 'sub_elite_legacy',
      subscription_status: 'canceled',
    })).toBe('free');
  });
});
