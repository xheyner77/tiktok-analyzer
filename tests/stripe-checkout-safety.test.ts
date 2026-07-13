import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = ['VERCEL_ENV', 'STRIPE_STARTER_PRICE_ID'] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.VERCEL_ENV;
  process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_10';
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

function mockCustomerPersistence(customerId: string) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: { stripe_customer_id: customerId },
      error: null,
    })),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const from = vi.fn(() => query);
  vi.doMock('@/lib/supabase', () => ({ supabase: { from } }));
  return { from, query };
}

function checkoutCustomerApi(metadata: Record<string, string> = {}) {
  return {
    retrieve: vi.fn(async () => ({
      id: 'cus_stable',
      deleted: false,
      metadata,
    })),
  };
}

describe('Stripe Checkout customer safety', () => {
  it('never claims an untagged legacy Customer whose email belongs to someone else', async () => {
    const update = vi.fn();
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_legacy_other',
          deleted: false,
          email: 'other@viralynz.test',
          metadata: {},
        })),
        update,
      },
    } as unknown as Stripe;

    const {
      ensureStripeCustomerOwnership,
      StripeCheckoutSafetyError,
    } = await import('@/lib/stripe-checkout-safety');

    await expect(ensureStripeCustomerOwnership(stripe, {
      customerId: 'cus_legacy_other',
      userId: 'user_123',
      email: 'creator@viralynz.test',
    })).rejects.toMatchObject({
      name: StripeCheckoutSafetyError.name,
      code: 'stripe_customer_legacy_email_mismatch',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps an owner-tagged Customer valid even when its historical email differs', async () => {
    const update = vi.fn();
    const stripe = {
      customers: {
        retrieve: vi.fn(async () => ({
          id: 'cus_owned',
          deleted: false,
          email: 'old-address@viralynz.test',
          metadata: { viralynz_user_id: 'user_123' },
        })),
        update,
      },
    } as unknown as Stripe;

    const { ensureStripeCustomerOwnership } = await import('@/lib/stripe-checkout-safety');
    await expect(ensureStripeCustomerOwnership(stripe, {
      customerId: 'cus_owned',
      userId: 'user_123',
      email: 'creator@viralynz.test',
    })).resolves.toBe('cus_owned');
    expect(update).not.toHaveBeenCalled();
  });

  it('creates one stable Customer with an idempotency key derived only from user_id', async () => {
    const { query } = mockCustomerPersistence('cus_stable');
    const search = vi.fn(async () => ({ data: [] }));
    const create = vi.fn(async () => ({
      id: 'cus_stable',
      metadata: { viralynz_user_id: 'user_123' },
    }));
    const retrieve = vi.fn(async () => ({
      id: 'cus_stable',
      deleted: false,
      email: null,
      metadata: { viralynz_user_id: 'user_123' },
    }));
    const update = vi.fn(async () => ({ id: 'cus_stable' }));
    const stripe = {
      customers: { search, create, retrieve, update },
    } as unknown as Stripe;

    const { ensureStableStripeCustomer } = await import('@/lib/stripe-checkout-safety');
    const customerId = await ensureStableStripeCustomer(stripe, {
      userId: 'user_123',
      email: 'creator@viralynz.test',
      persistedCustomerId: null,
      persistedSubscriptionId: null,
    });

    expect(customerId).toBe('cus_stable');
    expect(create).toHaveBeenCalledWith(
      { metadata: { viralynz_user_id: 'user_123' } },
      { idempotencyKey: 'viralynz-customer:user_123' },
    );
    expect(query.eq).toHaveBeenCalledWith('id', 'user_123');
    expect(query.is).toHaveBeenCalledWith('stripe_customer_id', null);
  });

  it('recovers the existing Customer from Stripe when the database write is delayed', async () => {
    mockCustomerPersistence('cus_from_subscription');
    const retrieveSubscription = vi.fn(async () => ({
      id: 'sub_existing',
      customer: 'cus_from_subscription',
      metadata: { userId: 'user_123' },
    }));
    const search = vi.fn();
    const create = vi.fn();
    const retrieveCustomer = vi.fn(async () => ({
      id: 'cus_from_subscription',
      deleted: false,
      email: 'creator@viralynz.test',
      metadata: { viralynz_user_id: 'user_123' },
    }));
    const stripe = {
      subscriptions: { retrieve: retrieveSubscription },
      customers: { search, create, retrieve: retrieveCustomer, update: vi.fn() },
    } as unknown as Stripe;

    const { ensureStableStripeCustomer } = await import('@/lib/stripe-checkout-safety');
    const customerId = await ensureStableStripeCustomer(stripe, {
      userId: 'user_123',
      email: 'creator@viralynz.test',
      persistedCustomerId: null,
      persistedSubscriptionId: 'sub_existing',
    });

    expect(customerId).toBe('cus_from_subscription');
    expect(search).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('reuses an owned open Checkout instead of creating another session', async () => {
    const checkout = {
      id: 'cs_open',
      mode: 'subscription',
      url: 'https://checkout.stripe.test/open',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'starter' },
    } as unknown as Stripe.Checkout.Session;
    const stripe = {
      customers: checkoutCustomerApi(),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: {
        sessions: {
          list: vi.fn(async () => ({ data: [checkout], has_more: false })),
        },
      },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState, resolveOpenCheckout } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });
    const resolution = resolveOpenCheckout(state.openSessions, 'starter');

    expect(resolution.reusable?.id).toBe('cs_open');
    expect(resolution.conflictingCheckout).toBe(false);
    expect(state.checkoutGeneration).toBe('cs_open');
  });

  it('derives the next global Checkout lock from the latest closed Session', async () => {
    const latestClosed = {
      id: 'cs_latest_closed',
      status: 'complete',
      mode: 'subscription',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'starter' },
    } as unknown as Stripe.Checkout.Session;
    const listSessions = vi.fn(async (params: Stripe.Checkout.SessionListParams) => ({
      data: params.status === 'open' ? [] : [latestClosed],
      has_more: false,
    }));
    const stripe = {
      customers: checkoutCustomerApi(),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: { sessions: { list: listSessions } },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });

    expect(state.openSessions).toEqual([]);
    expect(state.checkoutGeneration).toBe('cs_latest_closed');
    expect(listSessions).toHaveBeenCalledWith({ customer: 'cus_stable', status: 'open', limit: 100 });
    expect(listSessions).toHaveBeenCalledWith({ customer: 'cus_stable', limit: 1 });
  });

  it('blocks a Session visible only in the latest read during a mixed Stripe snapshot', async () => {
    const racedOpen = {
      id: 'cs_raced_open',
      status: 'open',
      mode: 'payment',
      url: 'https://checkout.stripe.test/raced',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const stripe = {
      customers: checkoutCustomerApi(),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: {
        sessions: {
          list: vi.fn(async (params: Stripe.Checkout.SessionListParams) => ({
            data: params.status === 'open' ? [] : [racedOpen],
            has_more: false,
          })),
        },
      },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState, resolveOpenCheckout } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });

    expect(state.openSessions).toEqual([racedOpen]);
    expect(state.checkoutGeneration).toBe('cs_raced_open');
    expect(resolveOpenCheckout(state.openSessions, 'starter')).toEqual({
      reusable: null,
      conflictingCheckout: true,
    });
  });

  it('blocks a recently completed Checkout while its paid entitlement is settling', async () => {
    const completedLifetime = {
      id: 'cs_lifetime_settling',
      status: 'complete',
      created: Math.floor(Date.now() / 1000) - 60,
      mode: 'payment',
      payment_status: 'paid',
      url: 'https://checkout.stripe.test/already-complete',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const stripe = {
      customers: checkoutCustomerApi(),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: {
        sessions: {
          list: vi.fn(async (params: Stripe.Checkout.SessionListParams) => ({
            data: params.status === 'open' ? [] : [completedLifetime],
            has_more: false,
          })),
        },
      },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState, resolveOpenCheckout } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });

    expect(state.openSessions).toEqual([completedLifetime]);
    expect(resolveOpenCheckout(state.openSessions, 'lifetime')).toEqual({
      reusable: null,
      conflictingCheckout: true,
    });
  });

  it('keeps an unrevoked confirmed Lifetime locked after the settlement grace period', async () => {
    const completedLifetime = {
      id: 'cs_lifetime_unsynced',
      status: 'complete',
      created: Math.floor(Date.now() / 1000) - (48 * 60 * 60),
      mode: 'payment',
      payment_status: 'no_payment_required',
      customer: 'cus_stable',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const stripe = {
      customers: checkoutCustomerApi({
        viralynz_lifetime_checkout_session_id: completedLifetime.id,
      }),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: {
        sessions: {
          list: vi.fn(async (params: Stripe.Checkout.SessionListParams) => ({
            data: params.status === 'open' ? [] : [completedLifetime],
            has_more: false,
          })),
        },
      },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState, resolveOpenCheckout } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });

    expect(state.openSessions).toEqual([completedLifetime]);
    expect(resolveOpenCheckout(state.openSessions, 'starter').conflictingCheckout).toBe(true);
  });

  it('unlocks a fully revoked Lifetime Checkout for a later repurchase', async () => {
    const refundedLifetime = {
      id: 'cs_lifetime_refunded',
      status: 'complete',
      created: Math.floor(Date.now() / 1000) - 60,
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_stable',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const stripe = {
      customers: checkoutCustomerApi({
        viralynz_lifetime_checkout_session_id: refundedLifetime.id,
        viralynz_revoked_lifetime_checkout_session_id: refundedLifetime.id,
      }),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: {
        sessions: {
          list: vi.fn(async (params: Stripe.Checkout.SessionListParams) => ({
            data: params.status === 'open' ? [] : [refundedLifetime],
            has_more: false,
          })),
        },
      },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });

    expect(state.openSessions).toEqual([]);
    expect(state.checkoutGeneration).toBe(refundedLifetime.id);
  });

  it('keeps untagged legacy Sessions and blocks every cross-plan or cross-mode conflict', async () => {
    const legacyPayment = {
      id: 'cs_legacy_payment',
      mode: 'payment',
      url: 'https://checkout.stripe.test/legacy',
      client_reference_id: null,
      metadata: {},
    } as unknown as Stripe.Checkout.Session;
    const stripe = {
      customers: checkoutCustomerApi(),
      subscriptions: {
        list: vi.fn(async () => ({ data: [], has_more: false })),
      },
      checkout: {
        sessions: {
          list: vi.fn(async () => ({ data: [legacyPayment], has_more: false })),
        },
      },
    } as unknown as Stripe;

    const { inspectStripeCheckoutState, resolveOpenCheckout } = await import('@/lib/stripe-checkout-safety');
    const state = await inspectStripeCheckoutState(stripe, {
      customerId: 'cus_stable',
      userId: 'user_123',
      persistedSubscriptionId: null,
    });

    expect(state.openSessions).toEqual([legacyPayment]);
    expect(resolveOpenCheckout(state.openSessions, 'starter')).toEqual({
      reusable: null,
      conflictingCheckout: true,
    });
    expect(resolveOpenCheckout(state.openSessions, 'lifetime')).toEqual({
      reusable: null,
      conflictingCheckout: true,
    });

    const openStarter = {
      id: 'cs_open_starter',
      mode: 'subscription',
      url: 'https://checkout.stripe.test/starter',
      client_reference_id: 'user_123',
      metadata: { userId: 'user_123', plan: 'starter' },
    } as unknown as Stripe.Checkout.Session;
    expect(resolveOpenCheckout([openStarter], 'lifetime')).toEqual({
      reusable: null,
      conflictingCheckout: true,
    });
    expect(resolveOpenCheckout([openStarter, legacyPayment], 'starter')).toEqual({
      reusable: null,
      conflictingCheckout: true,
    });
  });

  it('opens only an allowlisted Starter to Pro confirmation flow', async () => {
    const subscription = {
      id: 'sub_starter',
      status: 'active',
      customer: 'cus_stable',
      metadata: { userId: 'user_123' },
      items: {
        data: [{
          id: 'si_starter',
          quantity: 1,
          price: { id: 'price_starter_10' },
        }],
      },
    } as unknown as Stripe.Subscription;
    const createPortal = vi.fn(async () => ({ url: 'https://billing.stripe.test/upgrade' }));
    const stripe = {
      billingPortal: {
        configurations: {
          retrieve: vi.fn(async () => ({
            id: 'bpc_safe',
            active: true,
            livemode: false,
            metadata: {
              app: 'viralynz',
              environment: 'test',
              allowed_upgrade_plan: 'pro',
              allowed_upgrade_price_id: 'price_pro_29',
            },
            features: {
              subscription_update: {
                enabled: true,
                default_allowed_updates: ['price'],
                proration_behavior: 'always_invoice',
                products: [{ product: 'prod_pro', prices: ['price_pro_29'] }],
              },
            },
          })),
        },
        sessions: { create: createPortal },
      },
    } as unknown as Stripe;

    const { createProUpgradePortalSession } = await import('@/lib/stripe-checkout-safety');
    const url = await createProUpgradePortalSession(stripe, {
      configurationId: 'bpc_safe',
      customerId: 'cus_stable',
      userId: 'user_123',
      subscription,
      targetPriceId: 'price_pro_29',
      returnUrl: 'https://www.viralynz.com/dashboard/billing?billing=updated',
      liveMode: false,
    });

    expect(url).toBe('https://billing.stripe.test/upgrade');
    expect(createPortal).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_stable',
      configuration: 'bpc_safe',
      flow_data: expect.objectContaining({
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: 'sub_starter',
          items: [{ id: 'si_starter', price: 'price_pro_29', quantity: 1 }],
        },
      }),
    }));
  });

  it('refuses a Pro Portal upgrade that would not invoice proration immediately', async () => {
    const subscription = {
      id: 'sub_starter',
      status: 'active',
      customer: 'cus_stable',
      metadata: { userId: 'user_123' },
      items: {
        data: [{
          id: 'si_starter',
          quantity: 1,
          price: { id: 'price_starter_10' },
        }],
      },
    } as unknown as Stripe.Subscription;
    const createPortal = vi.fn();
    const stripe = {
      billingPortal: {
        configurations: {
          retrieve: vi.fn(async () => ({
            active: true,
            livemode: false,
            metadata: {
              app: 'viralynz',
              environment: 'test',
              allowed_upgrade_plan: 'pro',
              allowed_upgrade_price_id: 'price_pro_29',
            },
            features: {
              subscription_update: {
                enabled: true,
                default_allowed_updates: ['price'],
                proration_behavior: 'none',
              },
            },
          })),
        },
        sessions: { create: createPortal },
      },
    } as unknown as Stripe;

    const {
      createProUpgradePortalSession,
      StripeCheckoutSafetyError,
    } = await import('@/lib/stripe-checkout-safety');

    await expect(createProUpgradePortalSession(stripe, {
      configurationId: 'bpc_unsafe_proration',
      customerId: 'cus_stable',
      userId: 'user_123',
      subscription,
      targetPriceId: 'price_pro_29',
      returnUrl: 'https://www.viralynz.com/dashboard/billing?billing=updated',
      liveMode: false,
    })).rejects.toMatchObject({
      name: StripeCheckoutSafetyError.name,
      code: 'portal_upgrade_configuration_invalid',
    });
    expect(createPortal).not.toHaveBeenCalled();
  });

  it('fails closed when Stripe rejects the Portal Price allowlist', async () => {
    const subscription = {
      id: 'sub_starter',
      status: 'active',
      customer: 'cus_stable',
      metadata: { userId: 'user_123' },
      items: {
        data: [{
          id: 'si_starter',
          quantity: 1,
          price: { id: 'price_starter_10' },
        }],
      },
    } as unknown as Stripe.Subscription;
    const stripe = {
      billingPortal: {
        configurations: {
          retrieve: vi.fn(async () => ({
            active: true,
            livemode: false,
            metadata: {
              app: 'viralynz',
              environment: 'test',
              allowed_upgrade_plan: 'pro',
              allowed_upgrade_price_id: 'price_pro_29',
            },
            features: {
              subscription_update: {
                enabled: true,
                default_allowed_updates: ['price'],
                proration_behavior: 'always_invoice',
              },
            },
          })),
        },
        sessions: {
          create: vi.fn(async () => {
            throw new Error('Price is not configured for this portal');
          }),
        },
      },
    } as unknown as Stripe;

    const {
      createProUpgradePortalSession,
      StripeCheckoutSafetyError,
    } = await import('@/lib/stripe-checkout-safety');

    await expect(createProUpgradePortalSession(stripe, {
      configurationId: 'bpc_safe',
      customerId: 'cus_stable',
      userId: 'user_123',
      subscription,
      targetPriceId: 'price_pro_29',
      returnUrl: 'https://www.viralynz.com/dashboard/billing?billing=updated',
      liveMode: false,
    })).rejects.toMatchObject({
      name: StripeCheckoutSafetyError.name,
      code: 'portal_upgrade_configuration_rejected',
    });
  });
});
