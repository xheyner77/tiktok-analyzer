import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertStripePriceIsMonthlySubscription,
  assertStripePriceIsOneTimePayment,
} from '@/lib/stripe-billing';

const previousVercelEnv = process.env.VERCEL_ENV;

beforeEach(() => {
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previousVercelEnv;
});

function stripeWithPrice(price: Partial<Stripe.Price>): Stripe {
  return {
    prices: {
      retrieve: vi.fn(async () => price as Stripe.Price),
    },
  } as unknown as Stripe;
}

function recurringPrice(overrides: Partial<Stripe.Price> = {}): Partial<Stripe.Price> {
  return {
    id: 'price_test_catalog',
    active: true,
    livemode: false,
    currency: 'eur',
    unit_amount: 1_000,
    type: 'recurring',
    recurring: { interval: 'month' } as Stripe.Price.Recurring,
    metadata: { viralynz_plan: 'starter', environment: 'test' },
    product: { metadata: { viralynz_plan: 'starter', environment: 'test' } } as unknown as Stripe.Product,
    ...overrides,
  };
}

describe('official Stripe catalogue validation', () => {
  it('accepts the exact Starter test price', async () => {
    const result = await assertStripePriceIsMonthlySubscription(
      stripeWithPrice(recurringPrice()),
      'price_test_catalog',
      'month',
      'starter',
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects the obsolete 7.99 EUR Starter price', async () => {
    const result = await assertStripePriceIsMonthlySubscription(
      stripeWithPrice(recurringPrice({ unit_amount: 799 })),
      'price_legacy_starter',
      'month',
      'starter',
    );

    expect(result).toMatchObject({ ok: false, code: 'PRICE_AMOUNT_MISMATCH' });
  });

  it('rejects a live Price in test or Preview mode', async () => {
    const result = await assertStripePriceIsMonthlySubscription(
      stripeWithPrice(recurringPrice({ livemode: true })),
      'price_live_wrong_mode',
      'month',
      'starter',
    );

    expect(result).toMatchObject({ ok: false, code: 'PRICE_MODE_MISMATCH' });
  });

  it('rejects conflicting plan metadata', async () => {
    const result = await assertStripePriceIsMonthlySubscription(
      stripeWithPrice(recurringPrice({ metadata: { viralynz_plan: 'pro', environment: 'test' } })),
      'price_wrong_metadata',
      'month',
      'starter',
    );

    expect(result).toMatchObject({ ok: false, code: 'PRICE_METADATA_MISMATCH' });
  });

  it('accepts only a 149 EUR one-time Lifetime price', async () => {
    const result = await assertStripePriceIsOneTimePayment(
      stripeWithPrice({
        id: 'price_lifetime_test',
        active: true,
        livemode: false,
        currency: 'eur',
        unit_amount: 14_900,
        type: 'one_time',
        recurring: null,
        metadata: { viralynz_plan: 'lifetime', environment: 'test' },
        product: { metadata: { viralynz_plan: 'lifetime', environment: 'test' } } as unknown as Stripe.Product,
      }),
      'price_lifetime_test',
    );

    expect(result).toEqual({ ok: true });
  });
});
