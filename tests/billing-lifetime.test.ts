import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = ['STRIPE_SECRET_KEY', 'STRIPE_PRO_PRICE_ID', 'STRIPE_LIFETIME_PRICE_ID'] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_lifetime';
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

  it('blocks checkout creation for legacy Scale users normalized as Lifetime', async () => {
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

    expect(response.status).toBe(400);
    expect(body.code).toBe('ALREADY_ON_PLAN');
  });

  it('keeps the Pro to Lifetime checkout path open', async () => {
    process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
    mockSession();
    mockProdGuard();
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
    const retrievePrice = vi.fn(async () => ({ type: 'one_time' }));
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
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      customer: 'cus_pro',
      metadata: expect.objectContaining({ plan: 'lifetime' }),
    }));
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
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('LIFETIME_ACCESS');
    expect(query.update).not.toHaveBeenCalled();
  });

  it('accepts canonical Lifetime in upgrade-plan verification without direct DB writes', async () => {
    mockSession();
    mockProdGuard();
    const retrieve = vi.fn(async () => ({
      id: 'cs_lifetime',
      mode: 'payment',
      payment_status: 'paid',
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

  it('accepts legacy Scale checkout metadata when verifying canonical Lifetime', async () => {
    mockSession();
    mockProdGuard();
    const retrieve = vi.fn(async () => ({
      id: 'cs_scale_legacy',
      mode: 'payment',
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

    expect(response.status).toBe(200);
    expect(body.plan).toBe('lifetime');
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
});
