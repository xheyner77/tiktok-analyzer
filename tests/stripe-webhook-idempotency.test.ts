import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

let currentEvent: Stripe.Event;
let constructEvent: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let eq: ReturnType<typeof vi.fn>;
let downgradeToFreeBySubscriptionId: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  process.env.STRIPE_SECRET_KEY = 'sk_test_webhook';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook';

  constructEvent = vi.fn(() => currentEvent);
  rpc = vi.fn();
  eq = vi.fn(async () => ({ error: null }));
  update = vi.fn(() => ({ eq }));
  from = vi.fn(() => ({ update }));
  downgradeToFreeBySubscriptionId = vi.fn(async () => undefined);

  vi.doMock('stripe', () => ({
    default: class StripeMock {
      webhooks = { constructEvent };
    },
  }));

  vi.doMock('@/lib/supabase', () => ({
    supabase: { rpc, from },
  }));

  vi.doMock('@/lib/stripe-prod-guard', () => ({
    blockTestStripeSecretInProduction: vi.fn(() => null),
  }));

  vi.doMock('@/lib/stripe-subscription-sync', () => ({
    downgradeToFreeBySubscriptionId,
    invoiceSubscriptionId: vi.fn(() => 'sub_test'),
    resetMonthlyCountersForSubscription: vi.fn(async () => undefined),
    setSubscriptionPaymentFailed: vi.fn(async () => undefined),
    syncUserFromPaidLifetimeCheckout: vi.fn(async () => ({ ok: true })),
    syncUserFromPaidSubscriptionCheckout: vi.fn(async () => ({ ok: true })),
    syncUserRowFromStripeSubscription: vi.fn(async () => ({ ok: true })),
  }));
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('stripe');
  vi.doUnmock('@/lib/supabase');
  vi.doUnmock('@/lib/stripe-prod-guard');
  vi.doUnmock('@/lib/stripe-subscription-sync');

  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
});

function stripeEvent(id: string): Stripe.Event {
  return {
    id,
    type: 'customer.subscription.deleted',
    created: 1_735_689_600,
    data: {
      object: {
        id: 'sub_test',
        metadata: { userId: 'user_test' },
      },
    },
  } as unknown as Stripe.Event;
}

function webhookRequest(): NextRequest {
  return new Request('http://localhost/api/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test' },
    body: '{"ok":true}',
  }) as unknown as NextRequest;
}

function mockClaim(action: string, attempts = 1) {
  rpc.mockResolvedValue({
    data: [{ action, status: action === 'duplicate_processed' ? 'processed' : 'processing', attempts }],
    error: null,
  });
}

async function postWebhook() {
  const { POST } = await import('@/app/api/webhook/route');
  return POST(webhookRequest());
}

describe('Stripe webhook idempotency', () => {
  it('processes a new event and marks it processed', async () => {
    currentEvent = stripeEvent('evt_new');
    mockClaim('process_new');

    const response = await postWebhook();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(downgradeToFreeBySubscriptionId).toHaveBeenCalledWith('sub_test');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'processed',
      last_error: null,
    }));
    expect(eq).toHaveBeenCalledWith('event_id', 'evt_new');
  });

  it('acks an already processed event without reprocessing it', async () => {
    currentEvent = stripeEvent('evt_processed');
    mockClaim('duplicate_processed', 2);

    const response = await postWebhook();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, duplicate: true });
    expect(downgradeToFreeBySubscriptionId).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('asks Stripe to retry a recent processing event without reprocessing it', async () => {
    currentEvent = stripeEvent('evt_processing_recent');
    mockClaim('duplicate_processing', 1);

    const response = await postWebhook();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(body).toEqual({ error: 'stripe_event_already_processing', retry: true });
    expect(downgradeToFreeBySubscriptionId).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('reprocesses a stale processing event', async () => {
    currentEvent = stripeEvent('evt_processing_stale');
    mockClaim('process_retry_stale', 2);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(downgradeToFreeBySubscriptionId).toHaveBeenCalledWith('sub_test');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
  });

  it('reprocesses a failed event', async () => {
    currentEvent = stripeEvent('evt_failed');
    mockClaim('process_retry_failed', 2);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(downgradeToFreeBySubscriptionId).toHaveBeenCalledWith('sub_test');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
  });

  it('marks the event failed when the handler fails', async () => {
    currentEvent = stripeEvent('evt_handler_error');
    mockClaim('process_new');
    downgradeToFreeBySubscriptionId.mockRejectedValueOnce(new Error('stripe handler boom'));

    const response = await postWebhook();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Handler failed.' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      last_error: expect.stringContaining('stripe handler boom'),
    }));
    expect(eq).toHaveBeenCalledWith('event_id', 'evt_handler_error');
  });

  it('reprocesses a retry after failed and marks it processed', async () => {
    currentEvent = stripeEvent('evt_retry_after_failed');
    mockClaim('process_retry_failed', 3);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(downgradeToFreeBySubscriptionId).toHaveBeenCalledWith('sub_test');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
    expect(constructEvent).toHaveBeenCalledWith('{"ok":true}', 'sig_test', 'whsec_test_webhook');
  });
});
