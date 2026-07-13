import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = ['STRIPE_PRO_PRICE_ID', 'STRIPE_LIFETIME_PRICE_ID'] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
  process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/supabase');
  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

function mockSupabase(
  rows: Array<Record<string, unknown>>,
  guardedWrite: { data: Record<string, unknown> | null; error: null } = { data: null, error: null },
) {
  const pendingRows = [...rows];
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    update: vi.fn(),
    single: vi.fn(async () => ({ data: pendingRows.shift() ?? null, error: null })),
    maybeSingle: vi.fn(async () => guardedWrite),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.update.mockReturnValue(query);
  const from = vi.fn(() => query);
  vi.doMock('@/lib/supabase', () => ({ supabase: { from } }));
  return { from, query };
}

function recurringSubscription(metadata: Record<string, string> = { userId: 'user_race' }) {
  return {
    id: 'sub_race',
    status: 'active',
    customer: 'cus_race',
    cancel_at_period_end: false,
    metadata,
    items: {
      data: [{
        current_period_end: 1_893_456_000,
        price: { id: 'price_pro_29' },
      }],
    },
  } as unknown as Stripe.Subscription;
}

function recurringCheckout() {
  return {
    id: 'cs_recurring_race',
    mode: 'subscription',
    payment_status: 'paid',
    customer: 'cus_race',
    client_reference_id: 'user_race',
    subscription: 'sub_race',
    metadata: { userId: 'user_race', plan: 'pro' },
  } as unknown as Stripe.Checkout.Session;
}

describe('Stripe cross-mode Checkout race', () => {
  it('cancels the owned recurring Checkout when Lifetime already won', async () => {
    const { query } = mockSupabase([{
      plan: 'lifetime',
      stripe_customer_id: 'cus_race',
      stripe_subscription_id: null,
      subscription_status: 'lifetime',
    }]);
    const subscription = recurringSubscription();
    const cancel = vi.fn(async () => ({ ...subscription, status: 'canceled' }));
    const stripe = {
      subscriptions: {
        retrieve: vi.fn(async () => subscription),
        cancel,
      },
    } as unknown as Stripe;

    const { syncUserFromPaidSubscriptionCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidSubscriptionCheckout(stripe, recurringCheckout());

    expect(result).toEqual({ ok: true });
    expect(cancel).toHaveBeenCalledWith('sub_race');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('never cancels a recurring subscription whose canonical owner differs', async () => {
    mockSupabase([{
      plan: 'lifetime',
      stripe_customer_id: 'cus_race',
      stripe_subscription_id: null,
      subscription_status: 'lifetime',
    }]);
    const subscription = recurringSubscription({
      userId: 'user_race',
      viralynz_user_id: 'user_other',
    });
    const cancel = vi.fn();
    const stripe = {
      subscriptions: {
        retrieve: vi.fn(async () => subscription),
        cancel,
      },
    } as unknown as Stripe;

    const { syncUserFromPaidSubscriptionCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidSubscriptionCheckout(stripe, recurringCheckout());

    expect(result).toEqual({ ok: false, reason: 'subscription_user_mismatch' });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('uses a compare-and-set and cancels recurring when Lifetime wins during the DB write', async () => {
    const { query } = mockSupabase([
      {
        plan: 'free',
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
        subscription_status: null,
      },
      {
        plan: 'lifetime',
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
        subscription_status: 'lifetime',
      },
    ]);
    const subscription = recurringSubscription();
    const cancel = vi.fn(async () => ({ ...subscription, status: 'canceled' }));
    const stripe = {
      subscriptions: {
        retrieve: vi.fn(async () => subscription),
        cancel,
      },
    } as unknown as Stripe;

    const { syncUserFromPaidSubscriptionCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidSubscriptionCheckout(stripe, recurringCheckout());

    expect(result).toEqual({ ok: true });
    expect(query.neq).toHaveBeenCalledWith('plan', 'lifetime');
    expect(cancel).toHaveBeenCalledWith('sub_race');
  });

  it('does not let an older Lifetime replay replace the active purchase marker', async () => {
    const { query } = mockSupabase([{
      plan: 'lifetime',
      stripe_customer_id: 'cus_race',
      stripe_subscription_id: null,
      subscription_status: 'lifetime',
    }]);
    const updateCustomer = vi.fn();
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_race',
          deleted: false,
          metadata: {
            viralynz_user_id: 'user_race',
            viralynz_lifetime_checkout_session_id: 'cs_new_lifetime',
          },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const oldCheckout = {
      id: 'cs_old_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_race',
      client_reference_id: 'user_race',
      metadata: { userId: 'user_race', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, oldCheckout);

    expect(result).toEqual({ ok: true });
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });

  it('does not grant Lifetime when its refund marker arrived before Checkout sync', async () => {
    const { query } = mockSupabase([{
      plan: 'free',
      stripe_customer_id: 'cus_race',
      stripe_subscription_id: null,
      subscription_status: 'lifetime_revoked',
    }]);
    const updateCustomer = vi.fn();
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_race',
          deleted: false,
          metadata: {
            viralynz_user_id: 'user_race',
            viralynz_revoked_lifetime_checkout_session_id: 'cs_refunded_lifetime',
          },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const refundedCheckout = {
      id: 'cs_refunded_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_race',
      client_reference_id: 'user_race',
      metadata: { userId: 'user_race', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, refundedCheckout);

    expect(result).toEqual({ ok: true });
    expect(updateCustomer).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });

  it('restores a won Lifetime dispute and clears only its own refund marker', async () => {
    const { query } = mockSupabase([
      {
        plan: 'free',
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
        subscription_status: 'lifetime_revoked',
      },
      {
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
      },
    ]);
    const updateCustomer = vi.fn(async () => ({ id: 'cus_race' }));
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_race',
          deleted: false,
          metadata: {
            viralynz_user_id: 'user_race',
            viralynz_revoked_lifetime_checkout_session_id: 'cs_won_lifetime',
          },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const wonCheckout = {
      id: 'cs_won_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_race',
      client_reference_id: 'user_race',
      metadata: { userId: 'user_race', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, wonCheckout, {
      restoreRevoked: true,
    });

    expect(result).toEqual({ ok: true });
    expect(updateCustomer).toHaveBeenCalledWith('cus_race', {
      metadata: {
        viralynz_lifetime_checkout_session_id: 'cs_won_lifetime',
        viralynz_revoked_lifetime_checkout_session_id: '',
      },
    });
    expect(query.update).toHaveBeenCalledTimes(1);
  });

  it('preserves another purchase refund marker while restoring a won Lifetime dispute', async () => {
    mockSupabase([
      {
        plan: 'free',
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
        subscription_status: 'lifetime_revoked',
      },
      {
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
      },
    ]);
    const updateCustomer = vi.fn(async () => ({ id: 'cus_race' }));
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_race',
          deleted: false,
          metadata: {
            viralynz_user_id: 'user_race',
            viralynz_revoked_lifetime_checkout_session_id: 'cs_other_refunded_lifetime',
          },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const wonCheckout = {
      id: 'cs_won_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_race',
      client_reference_id: 'user_race',
      metadata: { userId: 'user_race', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, wonCheckout, {
      restoreRevoked: true,
    });

    expect(result).toEqual({ ok: true });
    expect(updateCustomer).toHaveBeenCalledWith('cus_race', {
      metadata: { viralynz_lifetime_checkout_session_id: 'cs_won_lifetime' },
    });
  });

  it('preserves and immediately stops a subscription written during Lifetime fulfillment', async () => {
    const { query } = mockSupabase([
      {
        plan: 'free',
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: null,
        subscription_status: null,
      },
      {
        plan: 'lifetime',
        stripe_customer_id: 'cus_race',
        stripe_subscription_id: 'sub_race',
      },
    ]);
    const subscription = recurringSubscription();
    const cancel = vi.fn(async () => ({ ...subscription, status: 'canceled' }));
    const updateCustomer = vi.fn(async () => ({ id: 'cus_race' }));
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      subscriptions: {
        retrieve: vi.fn(async () => subscription),
        cancel,
      },
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_race',
          deleted: false,
          metadata: { viralynz_user_id: 'user_race' },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_lifetime_race',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_race',
      client_reference_id: 'user_race',
      metadata: { userId: 'user_race', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: true });
    expect(query.update).toHaveBeenCalledTimes(1);
    expect(query.update.mock.calls[0]?.[0]).not.toHaveProperty('stripe_subscription_id');
    expect(cancel).toHaveBeenCalledWith('sub_race');
    expect(updateCustomer).toHaveBeenCalledWith('cus_race', {
      metadata: { viralynz_lifetime_checkout_session_id: 'cs_lifetime_race' },
    });
  });
});
