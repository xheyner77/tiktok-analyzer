import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = [
  'VERCEL_ENV',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PORTAL_CONFIGURATION_ID',
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_LIFETIME_PRICE_ID',
] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.VERCEL_ENV;
  process.env.STRIPE_SECRET_KEY = 'sk_test_checkout_safety';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_checkout_safety';
  process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_test_safe_12345';
  process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_10';
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro_29';
  process.env.STRIPE_LIFETIME_PRICE_ID = 'price_lifetime_149';
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('stripe');
  vi.doUnmock('@/lib/auth');
  vi.doUnmock('@/lib/session');
  vi.doUnmock('@/lib/stripe-prod-guard');
  vi.doUnmock('@/lib/stripe-checkout-safety');
  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

function request(plan: 'starter' | 'pro' | 'lifetime'): NextRequest {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, interval: 'month' }),
  }) as unknown as NextRequest;
}

function mockCommon(profile: Record<string, unknown>) {
  vi.doMock('@/lib/session', () => ({
    getSession: vi.fn(async () => ({ userId: 'user_safe', email: 'creator@viralynz.test' })),
  }));
  vi.doMock('@/lib/auth', () => ({
    getUserById: vi.fn(async () => profile),
  }));
  vi.doMock('@/lib/stripe-prod-guard', () => ({
    blockTestStripePublishableInProduction: vi.fn(() => null),
    blockTestStripeSecretInProduction: vi.fn(() => null),
  }));
}

function price(priceId: string): Partial<Stripe.Price> {
  if (priceId === 'price_lifetime_149') {
    return {
      id: priceId,
      type: 'one_time',
      active: true,
      livemode: false,
      currency: 'eur',
      unit_amount: 14_900,
      metadata: { viralynz_plan: 'lifetime', environment: 'test' },
      product: {
        metadata: { viralynz_plan: 'lifetime', environment: 'test' },
      } as unknown as Stripe.Product,
    };
  }
  const isPro = priceId === 'price_pro_29';
  const plan = isPro ? 'pro' : 'starter';
  return {
    id: priceId,
    type: 'recurring',
    active: true,
    livemode: false,
    currency: 'eur',
    unit_amount: isPro ? 2_900 : 1_000,
    recurring: { interval: 'month' } as Stripe.Price.Recurring,
    metadata: { viralynz_plan: plan, environment: 'test' },
    product: { metadata: { viralynz_plan: plan, environment: 'test' } } as unknown as Stripe.Product,
  };
}

describe('Checkout subscription concurrency', () => {
  it('uses one shared Stripe lock for concurrent Starter and Lifetime requests', async () => {
    mockCommon({
      id: 'user_safe',
      plan: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: null,
    });

    class SafetyError extends Error {
      code = 'test';
    }
    vi.doMock('@/lib/stripe-checkout-safety', () => ({
      StripeCheckoutSafetyError: SafetyError,
      ensureStableStripeCustomer: vi.fn(async () => 'cus_stable'),
      inspectStripeCheckoutState: vi.fn(async () => ({
        subscriptions: [],
        openSessions: [],
        checkoutGeneration: 'initial',
      })),
      resolveOpenCheckout: vi.fn(() => ({ reusable: null, conflictingCheckout: false })),
      createProUpgradePortalSession: vi.fn(),
    }));

    let firstKey: string | null = null;
    let firstPlan: string | null = null;
    const createCheckout = vi.fn(async (
      params: Stripe.Checkout.SessionCreateParams,
      options?: Stripe.RequestOptions,
    ) => {
      const key = options?.idempotencyKey ?? '';
      const requestedPlan = typeof params.metadata?.plan === 'string'
        ? params.metadata.plan
        : null;
      if (!firstKey) {
        firstKey = key;
        firstPlan = requestedPlan;
      } else if (key === firstKey && requestedPlan !== firstPlan) {
        throw Object.assign(new Error('Stripe idempotency conflict'), {
          name: 'StripeIdempotencyError',
          rawType: 'idempotency_error',
        });
      }
      return {
        id: `cs_${params.metadata?.plan}`,
        mode: params.mode,
        url: `https://checkout.stripe.test/${params.metadata?.plan}`,
      };
    });
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        prices = { retrieve: vi.fn(async (priceId: string) => price(priceId)) };
        checkout = { sessions: { create: createCheckout } };
      },
    }));

    const { POST } = await import('@/app/api/checkout/route');
    const [starterResponse, lifetimeResponse] = await Promise.all([
      POST(request('starter')),
      POST(request('lifetime')),
    ]);

    expect([starterResponse.status, lifetimeResponse.status].sort()).toEqual([200, 409]);
    const conflictResponse = starterResponse.status === 409 ? starterResponse : lifetimeResponse;
    await expect(conflictResponse.json()).resolves.toMatchObject({
      code: 'CHECKOUT_ALREADY_OPEN',
    });
    const keys = createCheckout.mock.calls.map((call) => call[1]?.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toBe('viralynz-checkout:user_safe:initial');
    expect(keys[0]).not.toContain(':subscription:');
    expect(keys[0]).not.toContain(':payment:');
  });

  it('redirects an unsynchronized active Starter subscriber to the allowlisted Pro Portal flow', async () => {
    mockCommon({
      id: 'user_safe',
      plan: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: null,
    });

    const starterSubscription = {
      id: 'sub_starter',
      status: 'active',
      customer: 'cus_stable',
      metadata: { userId: 'user_safe' },
      items: { data: [{ id: 'si_starter', quantity: 1, price: { id: 'price_starter_10' } }] },
    } as unknown as Stripe.Subscription;
    const createPortal = vi.fn(async () => 'https://billing.stripe.test/upgrade-pro');
    class SafetyError extends Error {
      code = 'test';
    }
    vi.doMock('@/lib/stripe-checkout-safety', () => ({
      StripeCheckoutSafetyError: SafetyError,
      ensureStableStripeCustomer: vi.fn(async () => 'cus_stable'),
      inspectStripeCheckoutState: vi.fn(async () => ({
        subscriptions: [starterSubscription],
        openSessions: [],
        checkoutGeneration: 'initial',
      })),
      resolveOpenCheckout: vi.fn(() => ({ reusable: null, conflictingCheckout: false })),
      createProUpgradePortalSession: createPortal,
    }));

    const createCheckout = vi.fn();
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        prices = { retrieve: vi.fn(async (priceId: string) => price(priceId)) };
        checkout = { sessions: { create: createCheckout } };
      },
    }));

    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(request('pro'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      url: 'https://billing.stripe.test/upgrade-pro',
      flow: 'portal',
      code: 'STARTER_TO_PRO_PORTAL',
    });
    expect(createPortal).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      customerId: 'cus_stable',
      subscription: starterSubscription,
      targetPriceId: 'price_pro_29',
    }));
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('blocks Lifetime while a recurring Stripe subscription is still billable', async () => {
    mockCommon({
      id: 'user_safe',
      plan: 'pro',
      stripe_customer_id: 'cus_stable',
      stripe_subscription_id: 'sub_pro',
      stripe_price_id: 'price_pro_29',
      subscription_status: 'active',
    });

    const proSubscription = {
      id: 'sub_pro',
      status: 'active',
      customer: 'cus_stable',
      metadata: { userId: 'user_safe' },
      items: { data: [{ id: 'si_pro', quantity: 1, price: { id: 'price_pro_29' } }] },
    } as unknown as Stripe.Subscription;
    class SafetyError extends Error {
      code = 'test';
    }
    vi.doMock('@/lib/stripe-checkout-safety', () => ({
      StripeCheckoutSafetyError: SafetyError,
      ensureStableStripeCustomer: vi.fn(async () => 'cus_stable'),
      inspectStripeCheckoutState: vi.fn(async () => ({
        subscriptions: [proSubscription],
        openSessions: [],
        checkoutGeneration: 'initial',
      })),
      resolveOpenCheckout: vi.fn(() => ({ reusable: null, conflictingCheckout: false })),
      createProUpgradePortalSession: vi.fn(),
    }));

    const createCheckout = vi.fn();
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        prices = { retrieve: vi.fn(async (priceId: string) => price(priceId)) };
        checkout = { sessions: { create: createCheckout } };
      },
    }));

    const { POST } = await import('@/app/api/checkout/route');
    const response = await POST(request('lifetime'));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SUBSCRIPTION_ACTION_REQUIRED',
      action: 'billing_portal',
    });
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
