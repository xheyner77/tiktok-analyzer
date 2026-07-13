import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_webhook';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook';
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('stripe');
  vi.doUnmock('@/lib/stripe-prod-guard');
  vi.doUnmock('@/lib/stripe-subscription-sync');
  vi.doUnmock('@/lib/supabase');

  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

function webhookRequest(): NextRequest {
  return new Request('https://www.viralynz.com/api/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'signature_test',
    },
    body: '{}',
  }) as unknown as NextRequest;
}

async function setupWebhook(input: {
  event: Stripe.Event;
  currentSubscription?: Stripe.Subscription;
}) {
  const syncLifetime = vi.fn(async () => ({ ok: true as const }));
  const syncSubscriptionCheckout = vi.fn(async () => ({ ok: true as const }));
  const syncSubscription = vi.fn(async () => ({ ok: true as const }));
  const resetCounters = vi.fn(async () => undefined);
  const downgrade = vi.fn(async () => undefined);
  const invoiceSubscriptionId = vi.fn(() => 'sub_current');
  const retrieveSubscription = vi.fn(async () => input.currentSubscription);

  vi.doMock('@/lib/stripe-prod-guard', () => ({
    blockTestStripeSecretInProduction: vi.fn(() => null),
  }));
  vi.doMock('@/lib/stripe-subscription-sync', () => ({
    downgradeToFreeBySubscriptionId: downgrade,
    invoiceSubscriptionId,
    resetMonthlyCountersForSubscription: resetCounters,
    syncUserFromPaidLifetimeCheckout: syncLifetime,
    syncUserFromPaidSubscriptionCheckout: syncSubscriptionCheckout,
    syncUserRowFromStripeSubscription: syncSubscription,
  }));

  const eventTable = {
    insert: vi.fn(async () => ({ error: null })),
    update: vi.fn(() => {
      const query = {
        eq: vi.fn(),
        select: vi.fn(),
        maybeSingle: vi.fn(async () => ({ data: { id: input.event.id }, error: null })),
      };
      query.eq.mockReturnValue(query);
      query.select.mockReturnValue(query);
      return query;
    }),
  };
  vi.doMock('@/lib/supabase', () => ({
    supabase: { from: vi.fn(() => eventTable) },
  }));

  vi.doMock('stripe', () => ({
    default: class StripeMock {
      webhooks = { constructEvent: vi.fn(() => input.event) };
      subscriptions = { retrieve: retrieveSubscription };
    },
  }));

  const { POST } = await import('@/app/api/webhook/route');
  return {
    POST,
    eventTable,
    syncLifetime,
    syncSubscriptionCheckout,
    syncSubscription,
    resetCounters,
    retrieveSubscription,
  };
}

describe('Stripe webhook ordering', () => {
  it('acknowledges an unpaid completed Checkout without granting entitlement', async () => {
    const checkout = {
      id: 'cs_delayed',
      mode: 'payment',
      payment_status: 'unpaid',
      metadata: { userId: 'user_1', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const event = {
      id: 'evt_checkout_completed_unpaid',
      type: 'checkout.session.completed',
      created: 1_800_000_000,
      data: { object: checkout },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(webhook.syncLifetime).not.toHaveBeenCalled();
    expect(webhook.syncSubscriptionCheckout).not.toHaveBeenCalled();
    expect(webhook.eventTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processed' }),
    );
  });

  it('grants Lifetime only when the asynchronous payment succeeds', async () => {
    const checkout = {
      id: 'cs_delayed_paid',
      mode: 'payment',
      payment_status: 'paid',
      metadata: { userId: 'user_1', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const event = {
      id: 'evt_checkout_async_paid',
      type: 'checkout.session.async_payment_succeeded',
      created: 1_800_000_001,
      data: { object: checkout },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.syncLifetime).toHaveBeenCalledWith(expect.anything(), checkout);
  });

  it('uses the current Stripe subscription for a late payment-failed invoice', async () => {
    const currentSubscription = {
      id: 'sub_current',
      status: 'active',
      metadata: { userId: 'user_1' },
    } as unknown as Stripe.Subscription;
    const invoice = {
      id: 'in_old_failure',
      billing_reason: 'subscription_cycle',
    } as unknown as Stripe.Invoice;
    const event = {
      id: 'evt_invoice_failed_late',
      type: 'invoice.payment_failed',
      created: 1_800_000_002,
      data: { object: invoice },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event, currentSubscription });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.retrieveSubscription).toHaveBeenCalledWith('sub_current');
    expect(webhook.syncSubscription).toHaveBeenCalledWith(currentSubscription);
    expect(webhook.resetCounters).not.toHaveBeenCalled();
  });

  it('uses the current Stripe subscription before resetting a paid cycle', async () => {
    const currentSubscription = {
      id: 'sub_current',
      status: 'active',
      metadata: { userId: 'user_1' },
    } as unknown as Stripe.Subscription;
    const invoice = {
      id: 'in_old_paid',
      billing_reason: 'subscription_cycle',
    } as unknown as Stripe.Invoice;
    const event = {
      id: 'evt_invoice_paid_late',
      type: 'invoice.paid',
      created: 1_800_000_003,
      data: { object: invoice },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event, currentSubscription });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.retrieveSubscription).toHaveBeenCalledWith('sub_current');
    expect(webhook.syncSubscription).toHaveBeenCalledWith(currentSubscription);
    expect(webhook.resetCounters).toHaveBeenCalledWith('sub_current');
  });
});
