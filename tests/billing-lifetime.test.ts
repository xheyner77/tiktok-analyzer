import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_LIFETIME_PRICE_ID',
  'STRIPE_PORTAL_CONFIGURATION_ID',
  'STRIPE_PRICE_SCALE_MONTHLY',
] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_lifetime';
  process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_test_portal_12345';
  delete process.env.STRIPE_PRO_PRICE_ID;
  delete process.env.STRIPE_LIFETIME_PRICE_ID;
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('stripe');
  vi.doUnmock('@/lib/auth');
  vi.doUnmock('@/lib/session');
  vi.doUnmock('@/lib/supabase');
  vi.doUnmock('@/lib/stripe-prod-guard');
  vi.doUnmock('@/lib/stripe-checkout-safety');

  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
});

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSession() {
  vi.doMock('@/lib/session', () => ({
    getSession: vi.fn(async () => ({ userId: 'user_lifetime', email: 'creator@viralynz.test' })),
  }));
}

function mockProdGuard() {
  vi.doMock('@/lib/stripe-prod-guard', () => ({
    blockTestStripePublishableInProduction: vi.fn(() => null),
    blockTestStripeSecretInProduction: vi.fn(() => null),
  }));
}

function mockCheckoutSafety() {
  vi.doMock('@/lib/stripe-checkout-safety', () => ({
    StripeCheckoutSafetyError: class StripeCheckoutSafetyError extends Error {},
    ensureStableStripeCustomer: vi.fn(async (_stripe, input) => input.persistedCustomerId ?? 'cus_safe'),
    inspectStripeCheckoutState: vi.fn(async () => ({
      subscriptions: [],
      openSessions: [],
      checkoutGeneration: 'initial',
    })),
    resolveOpenCheckout: vi.fn(() => ({ reusable: null, conflictingCheckout: false })),
    createProUpgradePortalSession: vi.fn(),
  }));
}

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function createSupabaseReadMock(row: Record<string, unknown>) {
  const query = {} as QueryMock;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn(async () => ({ data: row, error: null }));
  query.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  query.update = vi.fn(() => query);

  const from = vi.fn(() => query);
  vi.doMock('@/lib/supabase', () => ({
    supabase: { from },
  }));

  return { from, query };
}

describe('billing Lifetime protections', () => {
  it('rejects legacy Creator and Scale aliases for every new Checkout', async () => {
    mockSession();
    mockProdGuard();
    const getUserById = vi.fn();
    vi.doMock('@/lib/auth', () => ({ getUserById }));

    const { POST } = await import('@/app/api/checkout/route');
    for (const legacyPlan of ['creator', 'scale']) {
      const response = await POST(jsonRequest({ plan: legacyPlan, interval: 'month' }) as unknown as NextRequest);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: 'Plan invalide.' });
    }
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('rejects annual checkout requests because the official catalogue is monthly', async () => {
    mockSession();
    mockProdGuard();
    const getUserById = vi.fn();
    vi.doMock('@/lib/auth', () => ({ getUserById }));

    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(jsonRequest({ plan: 'pro', interval: 'year' }) as unknown as NextRequest);

    expect(response.status).toBe(400);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('blocks checkout creation for canonical Lifetime users without an active subscription', async () => {
    mockSession();
    mockProdGuard();
    vi.doMock('@/lib/auth', () => ({
      getUserById: vi.fn(async () => ({
        id: 'user_lifetime',
        plan: 'lifetime',
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_status: 'lifetime',
      })),
    }));

    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(jsonRequest({ plan: 'lifetime', interval: 'month' }) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('ALREADY_ON_PLAN');
  });

  it('does not treat an inactive legacy Scale row as irrevocable Lifetime', async () => {
    mockSession();
    mockProdGuard();
    vi.doMock('@/lib/auth', () => ({
      getUserById: vi.fn(async () => ({
        id: 'user_lifetime',
        plan: 'scale',
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_status: null,
      })),
    }));

    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(jsonRequest({ plan: 'pro', interval: 'month' }) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).not.toBe('ALREADY_ON_PLAN');
  });

  it('keeps the Pro to Lifetime checkout path open', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    mockSession();
    mockProdGuard();
    mockCheckoutSafety();
    vi.doMock('@/lib/auth', () => ({
      getUserById: vi.fn(async () => ({
        id: 'user_lifetime',
        plan: 'pro',
        stripe_customer_id: 'cus_pro',
        stripe_subscription_id: 'sub_pro',
        stripe_price_id: null,
        subscription_status: 'active',
      })),
    }));
    const retrievePrice = vi.fn(async () => ({
      type: 'one_time',
      active: true,
      livemode: false,
      currency: 'eur',
      unit_amount: 14_900,
      metadata: { viralynz_plan: 'lifetime', environment: 'test' },
      product: { metadata: { viralynz_plan: 'lifetime', environment: 'test' } },
    }));
    const createSession = vi.fn(async () => ({
      id: 'cs_lifetime_new',
      mode: 'payment',
      url: 'https://checkout.stripe.test/session',
    }));
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        prices = { retrieve: retrievePrice };
        checkout = { sessions: { create: createSession } };
      },
    }));

    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(jsonRequest({ plan: 'lifetime', interval: 'month' }) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.test/session');
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer: 'cus_pro',
        client_reference_id: 'user_lifetime',
        metadata: expect.objectContaining({ plan: 'lifetime' }),
        payment_intent_data: {
          metadata: expect.objectContaining({
            userId: 'user_lifetime',
            plan: 'lifetime',
          }),
        },
      }),
      expect.objectContaining({
        idempotencyKey: 'viralynz-checkout:user_lifetime:initial',
      }),
    );
  });

  it('does not cancel Lifetime access as a recurring subscription', async () => {
    mockSession();
    mockProdGuard();
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime',
      plan: 'lifetime',
      stripe_subscription_id: 'sub_stale',
      subscription_status: 'lifetime',
    });

    const { POST } = await import('@/app/api/cancel-plan/route');
    const response = await POST(jsonRequest({}) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('LIFETIME_ACCESS');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('rejects cross-site cancellation before reading the session', async () => {
    const getSession = vi.fn(async () => ({ userId: 'user_lifetime', email: 'creator@viralynz.test' }));
    vi.doMock('@/lib/session', () => ({ getSession }));
    mockProdGuard();
    createSupabaseReadMock({ id: 'user_lifetime', plan: 'lifetime' });

    const { POST } = await import('@/app/api/cancel-plan/route');
    const request = new Request('https://www.viralynz.com/api/cancel-plan', {
      method: 'POST',
      headers: {
        origin: 'https://example.invalid',
        'sec-fetch-site': 'cross-site',
      },
    });
    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rejects cross-site billing portal access before reading the session', async () => {
    const getSession = vi.fn(async () => ({ userId: 'user_lifetime', email: 'creator@viralynz.test' }));
    const getUserById = vi.fn();
    vi.doMock('@/lib/session', () => ({ getSession }));
    vi.doMock('@/lib/auth', () => ({ getUserById }));
    mockProdGuard();

    const { POST } = await import('@/app/api/billing/portal/route');
    const request = new Request('https://www.viralynz.com/api/billing/portal', {
      method: 'POST',
      headers: { origin: 'https://example.invalid' },
    });
    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(getSession).not.toHaveBeenCalled();
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('opens the explicitly allowlisted test Customer Portal configuration', async () => {
    mockSession();
    mockProdGuard();
    vi.doMock('@/lib/auth', () => ({
      getUserById: vi.fn(async () => ({
        id: 'user_lifetime',
        stripe_customer_id: 'cus_test_portal',
      })),
    }));
    const createPortalSession = vi.fn(async () => ({
      url: 'https://billing.stripe.test/session',
    }));
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        customers = {
          retrieve: vi.fn(async () => ({
            id: 'cus_test_portal',
            deleted: false,
            email: 'creator@viralynz.test',
            metadata: { viralynz_user_id: 'user_lifetime' },
          })),
          update: vi.fn(),
        };
        billingPortal = { sessions: { create: createPortalSession } };
      },
    }));

    const { POST } = await import('@/app/api/billing/portal/route');
    const response = await POST(jsonRequest({}) as unknown as NextRequest);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: 'https://billing.stripe.test/session' });
    expect(createPortalSession).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_test_portal',
      configuration: 'bpc_test_portal_12345',
      return_url: expect.stringContaining('/dashboard/billing'),
    }));
  });

  it('does not open the Portal for an unowned legacy Customer ID stored in the user row', async () => {
    mockSession();
    mockProdGuard();
    vi.doMock('@/lib/auth', () => ({
      getUserById: vi.fn(async () => ({
        id: 'user_lifetime',
        stripe_customer_id: 'cus_corrupted',
      })),
    }));
    const createPortalSession = vi.fn();
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        customers = {
          retrieve: vi.fn(async () => ({
            id: 'cus_corrupted',
            deleted: false,
            email: 'other@viralynz.test',
            metadata: {},
          })),
          update: vi.fn(),
        };
        billingPortal = { sessions: { create: createPortalSession } };
      },
    }));

    const { POST } = await import('@/app/api/billing/portal/route');
    const response = await POST(jsonRequest({}) as unknown as NextRequest);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'BILLING_STATE_CONFLICT' });
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it('does not cancel a Subscription attached to a different Stripe Customer', async () => {
    mockSession();
    mockProdGuard();
    createSupabaseReadMock({
      id: 'user_lifetime',
      plan: 'pro',
      stripe_customer_id: 'cus_owned',
      stripe_subscription_id: 'sub_corrupted',
      subscription_status: 'active',
    });
    const updateSubscription = vi.fn();
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        customers = {
          retrieve: vi.fn(async () => ({
            id: 'cus_owned',
            deleted: false,
            email: 'creator@viralynz.test',
            metadata: { viralynz_user_id: 'user_lifetime' },
          })),
          update: vi.fn(),
        };
        subscriptions = {
          retrieve: vi.fn(async () => ({
            id: 'sub_corrupted',
            customer: 'cus_other',
            metadata: { userId: 'user_lifetime' },
          })),
          update: updateSubscription,
        };
      },
    }));

    const { POST } = await import('@/app/api/cancel-plan/route');
    const response = await POST(jsonRequest({}) as unknown as NextRequest);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'BILLING_STATE_CONFLICT' });
    expect(updateSubscription).not.toHaveBeenCalled();
  });

  it('accepts canonical no-payment-required Lifetime verification without direct DB writes', async () => {
    mockSession();
    mockProdGuard();
    const retrieve = vi.fn(async () => ({
      id: 'cs_lifetime',
      mode: 'payment',
      livemode: false,
      payment_status: 'no_payment_required',
      metadata: { userId: 'user_lifetime', plan: 'lifetime' },
      payment_method_types: ['card'],
    }));
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        checkout = { sessions: { retrieve } };
      },
    }));

    const { POST } = await import('@/app/api/upgrade-plan/route');
    const response = await POST(jsonRequest({ plan: 'lifetime', sessionId: 'cs_lifetime' }) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      plan: 'lifetime',
      syncedByWebhookOnly: true,
    });
  });

  it('rejects legacy Scale metadata for a new canonical Lifetime verification', async () => {
    mockSession();
    mockProdGuard();
    const retrieve = vi.fn(async () => ({
      id: 'cs_scale_legacy',
      mode: 'payment',
      livemode: false,
      payment_status: 'paid',
      metadata: { userId: 'user_lifetime', plan: 'scale' },
      payment_method_types: ['card'],
    }));
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        checkout = { sessions: { retrieve } };
      },
    }));

    const { POST } = await import('@/app/api/upgrade-plan/route');
    const response = await POST(jsonRequest({ plan: 'lifetime', sessionId: 'cs_scale_legacy' }) as unknown as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/incohérent/i);
  });

  it('does not let a same-subscription Stripe event downgrade Lifetime to Pro', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime',
      plan: 'lifetime',
      stripe_subscription_id: 'sub_same',
      subscription_status: 'lifetime',
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription({
      id: 'sub_same',
      status: 'active',
      customer: 'cus_lifetime',
      cancel_at_period_end: false,
      metadata: { userId: 'user_lifetime' },
      items: {
        data: [{
          current_period_end: 1893456000,
          price: { id: 'price_pro_29' },
        }],
      },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: true });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('quarantines an active subscription whose Price is unknown', async () => {
    const { query } = createSupabaseReadMock({
      id: 'user_unknown_price',
      plan: 'pro',
      stripe_subscription_id: 'sub_unknown_price',
      subscription_status: 'active',
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription({
      id: 'sub_unknown_price',
      status: 'active',
      customer: 'cus_unknown_price',
      cancel_at_period_end: false,
      metadata: { userId: 'user_unknown_price' },
      items: {
        data: [{ current_period_end: 1_893_456_000, price: { id: 'price_not_configured' } }],
      },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: false, reason: 'active_subscription_price_not_mapped' });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      stripe_subscription_id: 'sub_unknown_price',
      stripe_price_id: 'price_not_configured',
      subscription_status: 'billing_configuration_error',
    }));
  });

  it('does not attach a signed subscription event to a user owned by another Stripe Customer', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { query } = createSupabaseReadMock({
      id: 'user_customer_bound',
      plan: 'free',
      stripe_customer_id: 'cus_expected',
      stripe_subscription_id: null,
      subscription_status: null,
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription({
      id: 'sub_wrong_customer',
      status: 'active',
      customer: 'cus_other',
      cancel_at_period_end: false,
      metadata: { userId: 'user_customer_bound' },
      items: {
        data: [{ current_period_end: 1_893_456_000, price: { id: 'price_pro_29' } }],
      },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: false, reason: 'stored_customer_mismatch' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('does not grant Lifetime when Checkout points to another stored Stripe Customer', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime_bound',
      plan: 'free',
      stripe_customer_id: 'cus_expected',
      stripe_subscription_id: null,
    });
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      subscriptions: { update: vi.fn() },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_wrong_customer_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_other',
      client_reference_id: 'user_lifetime_bound',
      metadata: { userId: 'user_lifetime_bound', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: false, reason: 'stored_customer_mismatch' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('does not grant Lifetime without the exact Checkout client reference', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime_bound',
      plan: 'free',
      stripe_customer_id: 'cus_lifetime_bound',
      stripe_subscription_id: null,
    });
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_missing_reference_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_lifetime_bound',
      client_reference_id: null,
      metadata: { userId: 'user_lifetime_bound', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: false, reason: 'client_reference_mismatch' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('does not grant Lifetime when the Stripe Customer owner differs', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime_bound',
      plan: 'free',
      stripe_customer_id: 'cus_lifetime_bound',
      stripe_subscription_id: null,
    });
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
          id: 'cus_lifetime_bound',
          deleted: false,
          metadata: { viralynz_user_id: 'user_other' },
        })),
        update: vi.fn(),
      },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_wrong_owner_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_lifetime_bound',
      client_reference_id: 'user_lifetime_bound',
      metadata: { userId: 'user_lifetime_bound', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: false, reason: 'lifetime_customer_owner_mismatch' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('downgrades recurring legacy Scale when Stripe marks it canceled', async () => {
    process.env.STRIPE_PRICE_SCALE_MONTHLY = 'price_scale_legacy';
    const { query } = createSupabaseReadMock({
      id: 'user_scale',
      plan: 'scale',
      stripe_subscription_id: 'sub_scale',
      subscription_status: 'active',
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription({
      id: 'sub_scale',
      status: 'canceled',
      customer: 'cus_scale',
      cancel_at_period_end: false,
      metadata: { userId: 'user_scale' },
      items: {
        data: [{ current_period_end: 1_893_456_000, price: { id: 'price_scale_legacy' } }],
      },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: true });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      subscription_status: 'canceled',
    }));
  });

  it('keeps an active subscription fail-closed while its Stripe dispute marker is open', async () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
    const { query } = createSupabaseReadMock({
      id: 'user_disputed',
      plan: 'pro',
      stripe_customer_id: 'cus_disputed',
      stripe_subscription_id: 'sub_disputed',
      subscription_status: 'disputed',
    });

    const { syncUserRowFromStripeSubscription } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserRowFromStripeSubscription({
      id: 'sub_disputed',
      status: 'active',
      customer: 'cus_disputed',
      cancel_at_period_end: true,
      metadata: {
        userId: 'user_disputed',
        viralynz_dispute_status: 'open',
        viralynz_dispute_id: 'dp_open',
      },
      items: {
        data: [{ current_period_end: 1_893_456_000, price: { id: 'price_pro_29' } }],
      },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: true });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      subscription_status: 'disputed',
      subscription_cancel_at_period_end: true,
    }));
  });

  it('suspends only the recurring subscription owned by the disputed Customer', async () => {
    const { query } = createSupabaseReadMock({
      id: 'user_disputed',
      plan: 'pro',
      stripe_customer_id: 'cus_disputed',
      stripe_subscription_id: 'sub_disputed',
      subscription_status: 'active',
    });
    const { suspendSubscriptionForDispute } = await import('@/lib/stripe-subscription-sync');

    const result = await suspendSubscriptionForDispute({
      id: 'sub_disputed',
      customer: 'cus_disputed',
      metadata: { userId: 'user_disputed' },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: true });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'free',
      stripe_customer_id: 'cus_disputed',
      subscription_status: 'disputed',
      subscription_cancel_at_period_end: true,
    }));
  });

  it('refuses to suspend a different subscription referenced by forged metadata', async () => {
    const { query } = createSupabaseReadMock({
      id: 'user_disputed',
      plan: 'pro',
      stripe_customer_id: 'cus_disputed',
      stripe_subscription_id: 'sub_owned',
      subscription_status: 'active',
    });
    const { suspendSubscriptionForDispute } = await import('@/lib/stripe-subscription-sync');

    const result = await suspendSubscriptionForDispute({
      id: 'sub_other',
      customer: 'cus_disputed',
      metadata: { userId: 'user_disputed' },
    } as unknown as Stripe.Subscription);

    expect(result).toEqual({ ok: false, reason: 'stored_subscription_mismatch' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('ignores a replayed invoice period that predates the last quota reset', async () => {
    const { query } = createSupabaseReadMock({
      id: 'user_quota',
      last_reset_at: '2026-07-01T00:00:00.000Z',
    });
    const { resetMonthlyCountersForSubscription } = await import('@/lib/stripe-subscription-sync');

    await resetMonthlyCountersForSubscription(
      'sub_quota',
      '2026-06-01T00:00:00.000Z',
    );

    expect(query.update).not.toHaveBeenCalled();
  });

  it('grants an authorized no-payment-required Lifetime Checkout with exact ownership', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime_promo',
      plan: 'free',
      stripe_customer_id: 'cus_lifetime_promo',
      stripe_subscription_id: null,
      subscription_status: null,
    });
    const updateCustomer = vi.fn(async () => ({ id: 'cus_lifetime_promo' }));
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
          id: 'cus_lifetime_promo',
          deleted: false,
          metadata: { viralynz_user_id: 'user_lifetime_promo' },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_lifetime_promo',
      mode: 'payment',
      payment_status: 'no_payment_required',
      customer: 'cus_lifetime_promo',
      client_reference_id: 'user_lifetime_promo',
      metadata: { userId: 'user_lifetime_promo', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: true });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'lifetime',
      stripe_customer_id: 'cus_lifetime_promo',
      stripe_price_id: 'price_lifetime_149',
      subscription_status: 'lifetime',
    }));
    expect(updateCustomer).toHaveBeenCalledWith('cus_lifetime_promo', {
      metadata: { viralynz_lifetime_checkout_session_id: 'cs_lifetime_promo' },
    });
  });

  it('never grants an unpaid Lifetime Checkout', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime_pending',
      plan: 'free',
      stripe_customer_id: 'cus_lifetime_pending',
      stripe_subscription_id: null,
      subscription_status: null,
    });
    const listLineItems = vi.fn();
    const stripe = {
      checkout: { sessions: { listLineItems } },
      customers: { retrieve: vi.fn(), update: vi.fn() },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_lifetime_pending',
      mode: 'payment',
      payment_status: 'unpaid',
      customer: 'cus_lifetime_pending',
      client_reference_id: 'user_lifetime_pending',
      metadata: { userId: 'user_lifetime_pending', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: false, reason: 'not_paid' });
    expect(listLineItems).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });

  it('keeps the previous subscription addressable after a paid Lifetime upgrade', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    const { query } = createSupabaseReadMock({
      id: 'user_lifetime',
      plan: 'pro',
      stripe_subscription_id: 'sub_previous_pro',
    });
    const cancelPreviousSubscription = vi.fn(async () => ({ id: 'sub_previous_pro' }));
    const retrievePreviousSubscription = vi.fn(async () => ({
      id: 'sub_previous_pro',
      status: 'active',
      customer: 'cus_lifetime',
      metadata: { userId: 'user_lifetime' },
    }));
    const updateCustomer = vi.fn(async () => ({ id: 'cus_lifetime' }));
    const stripe = {
      checkout: {
        sessions: {
          listLineItems: vi.fn(async () => ({
            data: [{ price: { id: 'price_lifetime_149' } }],
          })),
        },
      },
      subscriptions: {
        retrieve: retrievePreviousSubscription,
        update: cancelPreviousSubscription,
      },
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_lifetime',
          deleted: false,
          metadata: { viralynz_user_id: 'user_lifetime' },
        })),
        update: updateCustomer,
      },
    } as unknown as Stripe;
    const checkout = {
      id: 'cs_paid_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_lifetime',
      client_reference_id: 'user_lifetime',
      metadata: { userId: 'user_lifetime', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;

    const { syncUserFromPaidLifetimeCheckout } = await import('@/lib/stripe-subscription-sync');
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);

    expect(result).toEqual({ ok: true });
    expect(updateCustomer).toHaveBeenCalledWith('cus_lifetime', {
      metadata: { viralynz_lifetime_checkout_session_id: 'cs_paid_lifetime' },
    });
    expect(cancelPreviousSubscription).toHaveBeenCalledWith(
      'sub_previous_pro',
      expect.objectContaining({ cancel_at_period_end: true }),
    );
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'lifetime',
      stripe_subscription_id: 'sub_previous_pro',
      stripe_price_id: 'price_lifetime_149',
      subscription_status: 'lifetime',
      subscription_cancel_at_period_end: true,
    }));
  });
});
