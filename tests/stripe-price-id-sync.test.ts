import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stripePriceEnvKeys = [
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_LIFETIME_PRICE_ID',
  'STRIPE_LEGACY_PRO_PRICE_ID',
  'STRIPE_PRICE_CREATOR_MONTHLY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_SCALE_MONTHLY',
  'STRIPE_PRICE_SCALE_YEARLY',
  'STRIPE_PRICE_LIFETIME_ONETIME',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_ELITE',
] as const;

const previousEnv = Object.fromEntries(
  stripePriceEnvKeys.map((key) => [key, process.env[key]])
);

type DbError = { code?: string; message: string };
type DbResult = { data: Record<string, unknown> | null; error: DbError | null };
type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of stripePriceEnvKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/supabase');

  for (const key of stripePriceEnvKeys) {
    const previous = previousEnv[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
});

function ok(data: Record<string, unknown>): DbResult {
  return { data, error: null };
}

function fail(error: DbError): DbResult {
  return { data: null, error };
}

function createUsersTableMock(options: {
  singleResults: DbResult[];
  updateErrors?: Array<DbError | null>;
}) {
  const selections: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  let singleIndex = 0;
  let updateIndex = 0;

  const query = {} as QueryMock;
  query.select = vi.fn((columns?: string) => {
    if (columns) selections.push(columns);
    return query;
  });
  query.eq = vi.fn(() => query);
  query.single = vi.fn(async () => {
    const result = options.singleResults[Math.min(singleIndex, options.singleResults.length - 1)];
    singleIndex += 1;
    return result;
  });
  query.maybeSingle = vi.fn(async () => options.singleResults[0] ?? ok({}));
  query.update = vi.fn((patch: Record<string, unknown>) => {
    updates.push(patch);
    return {
      eq: vi.fn(async () => {
        const error = options.updateErrors?.[updateIndex] ?? null;
        updateIndex += 1;
        return { error };
      }),
    };
  });

  const from = vi.fn(() => query);
  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }));

  return { from, query, selections, updates };
}

function userRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user_test',
    email: 'creator@viralynz.test',
    plan: 'free',
    analyses_count: 0,
    hooks_count: 0,
    reconstructions_count: 0,
    last_reset_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_status: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    tiktok_open_id: null,
    tiktok_display_name: null,
    tiktok_avatar_url: null,
    tiktok_connected_at: null,
    ...overrides,
  };
}

function subscription(overrides: {
  id?: string;
  userId?: string;
  priceId: string;
  customerId?: string;
  status?: Stripe.Subscription.Status;
}): Stripe.Subscription {
  return {
    id: overrides.id ?? 'sub_test',
    status: overrides.status ?? 'active',
    customer: overrides.customerId ?? 'cus_test',
    cancel_at_period_end: false,
    metadata: { userId: overrides.userId ?? 'user_test' },
    items: {
      data: [{
        current_period_end: 1893456000,
        price: {
          id: overrides.priceId,
          recurring: { interval: 'month' },
        },
      }],
    },
  } as unknown as Stripe.Subscription;
}

describe('stripe_price_id sync', () => {
  it('writes stripe_price_id from a paid Pro subscription checkout', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { updates } = createUsersTableMock({
      singleResults: [ok(userRow())],
    });
    const retrieveSubscription = vi.fn(async () => subscription({
      id: 'sub_checkout_pro',
      priceId: 'price_pro_29',
      customerId: 'cus_checkout_pro',
    }));
    const stripe = {
      checkout: { sessions: { retrieve: vi.fn() } },
      subscriptions: { retrieve: retrieveSubscription },
    } as unknown as Stripe;

    const { syncUserFromPaidSubscriptionCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidSubscriptionCheckout(stripe, {
      id: 'cs_checkout_pro',
      mode: 'subscription',
      payment_status: 'paid',
      subscription: 'sub_checkout_pro',
      customer: 'cus_checkout_pro',
      metadata: { userId: 'user_test', plan: 'pro' },
    } as unknown as Stripe.Checkout.Session);

    expect(result).toEqual({ ok: true });
    expect(retrieveSubscription).toHaveBeenCalledWith('sub_checkout_pro');
    expect(updates[0]).toMatchObject({
      plan: 'pro',
      stripe_customer_id: 'cus_checkout_pro',
      stripe_subscription_id: 'sub_checkout_pro',
      stripe_price_id: 'price_pro_29',
      subscription_status: 'active',
    });
  });

  it('writes stripe_price_id when syncing a Pro subscription', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { updates } = createUsersTableMock({
      singleResults: [ok(userRow())],
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription(subscription({
      id: 'sub_pro',
      priceId: 'price_pro_29',
    }));

    expect(result).toEqual({ ok: true });
    expect(updates[0]).toMatchObject({
      plan: 'pro',
      stripe_subscription_id: 'sub_pro',
      stripe_price_id: 'price_pro_29',
      subscription_status: 'active',
    });
  });

  it('writes stripe_price_id when syncing a Starter subscription', async () => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_10';
    const { updates } = createUsersTableMock({
      singleResults: [ok(userRow())],
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription(subscription({
      id: 'sub_starter',
      priceId: 'price_starter_10',
    }));

    expect(result).toEqual({ ok: true });
    expect(updates[0]).toMatchObject({
      plan: 'starter',
      stripe_subscription_id: 'sub_starter',
      stripe_price_id: 'price_starter_10',
    });
  });

  it('preserves canonical Lifetime access from a lower subscription event', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { query } = createUsersTableMock({
      singleResults: [ok(userRow({
        plan: 'lifetime',
        stripe_subscription_id: 'sub_same',
        subscription_status: 'lifetime',
      }))],
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription(subscription({
      id: 'sub_same',
      priceId: 'price_pro_29',
    }));

    expect(result).toEqual({ ok: true });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('preserves legacy Scale access as Lifetime from a lower subscription event', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { query } = createUsersTableMock({
      singleResults: [ok(userRow({
        plan: 'scale',
        stripe_subscription_id: 'sub_legacy_scale',
        subscription_status: null,
      }))],
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription(subscription({
      id: 'sub_legacy_scale',
      priceId: 'price_pro_29',
    }));

    expect(result).toEqual({ ok: true });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('retries without stripe_price_id when the column is not deployed yet', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { updates } = createUsersTableMock({
      singleResults: [ok(userRow())],
      updateErrors: [
        { code: 'PGRST204', message: "Could not find the 'stripe_price_id' column of 'users' in the schema cache" },
        null,
      ],
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription(subscription({
      id: 'sub_pro',
      priceId: 'price_pro_29',
    }));

    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(2);
    expect(updates[0].stripe_price_id).toBe('price_pro_29');
    expect(updates[1]).not.toHaveProperty('stripe_price_id');
  });

  it('writes stripe_price_id for paid Lifetime checkout with legacy Scale metadata', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { updates } = createUsersTableMock({
      singleResults: [ok(userRow())],
    });
    const listLineItems = vi.fn(async () => ({
      data: [{ price: { id: 'price_lifetime_149' } }],
    }));
    const stripe = {
      checkout: { sessions: { listLineItems } },
      subscriptions: { update: vi.fn() },
    } as unknown as Stripe;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, {
      id: 'cs_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_lifetime',
      metadata: { userId: 'user_test', plan: 'scale' },
    } as unknown as Stripe.Checkout.Session);

    expect(result).toEqual({ ok: true });
    expect(listLineItems).toHaveBeenCalledWith('cs_lifetime', { limit: 1 });
    expect(updates[0]).toMatchObject({
      plan: 'lifetime',
      stripe_customer_id: 'cus_lifetime',
      stripe_subscription_id: null,
      stripe_price_id: 'price_lifetime_149',
      subscription_status: 'lifetime',
    });
  });

  it('getUserById reads stripe_price_id when the column exists', async () => {
    const { selections } = createUsersTableMock({
      singleResults: [ok(userRow({ stripe_price_id: 'price_pro_29' }))],
    });

    const { getUserById } = await import('@/lib/auth');
    const user = await getUserById('user_test');

    expect(selections[0]).toContain('stripe_price_id');
    expect(user?.stripe_price_id).toBe('price_pro_29');
  });

  it('getUserById falls back cleanly before the stripe_price_id migration is deployed', async () => {
    const { selections } = createUsersTableMock({
      singleResults: [
        fail({ code: 'PGRST204', message: "Could not find the 'stripe_price_id' column of 'users' in the schema cache" }),
        ok(userRow({ stripe_price_id: undefined })),
      ],
    });

    const { getUserById } = await import('@/lib/auth');
    const user = await getUserById('user_test');

    expect(selections[0]).toContain('stripe_price_id');
    expect(selections[1]).not.toContain('stripe_price_id');
    expect(user?.stripe_price_id).toBeNull();
  });
});
