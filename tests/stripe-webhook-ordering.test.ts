import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const touchedEnv = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const;
const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_webhook';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_signature_123456789';
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
  updatedSubscription?: Stripe.Subscription;
  lifetimeCheckout?: Stripe.Checkout.Session;
  retrievedCharge?: Stripe.Charge;
  invoicePayment?: Stripe.InvoicePayment;
  invoice?: Stripe.Invoice;
  invoiceSubscriptionId?: string | null;
  storedLifetime?: boolean;
  lifetimeCheckoutMarker?: string;
  revokedLifetimeCheckoutMarker?: string;
  livemode?: boolean;
}) {
  const syncLifetime = vi.fn(async () => ({ ok: true as const }));
  const syncSubscriptionCheckout = vi.fn(async () => ({ ok: true as const }));
  const syncSubscription = vi.fn(async () => ({ ok: true as const }));
  const resetCounters = vi.fn(async () => undefined);
  const downgrade = vi.fn(async () => undefined);
  const revokeLifetime = vi.fn(async () => ({ ok: true as const, subscriptionId: null }));
  const suspendDispute = vi.fn(async () => ({ ok: true as const }));
  const invoiceSubscriptionId = vi.fn(() => (
    input.invoiceSubscriptionId === undefined ? 'sub_current' : input.invoiceSubscriptionId
  ));
  const retrieveSubscription = vi.fn(async () => input.currentSubscription);
  const updateSubscription = vi.fn(async () => input.updatedSubscription ?? input.currentSubscription);
  const cancelSubscription = vi.fn(async () => ({
    ...input.currentSubscription,
    status: 'canceled',
  }));
  const updateCustomer = vi.fn(async () => ({ id: 'cus_lifetime' }));

  vi.doMock('@/lib/stripe-prod-guard', () => ({
    blockTestStripeSecretInProduction: vi.fn(() => null),
  }));
  vi.doMock('@/lib/stripe-subscription-sync', () => ({
    downgradeToFreeBySubscriptionId: downgrade,
    invoiceSubscriptionId,
    LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY: 'viralynz_lifetime_checkout_session_id',
    REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY: 'viralynz_revoked_lifetime_checkout_session_id',
    resetMonthlyCountersForSubscription: resetCounters,
    revokeLifetimeAccessByCustomerId: revokeLifetime,
    suspendSubscriptionForDispute: suspendDispute,
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
  const userTable = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: input.storedLifetime
        ? { plan: 'lifetime', subscription_status: 'lifetime' }
        : null,
      error: null,
    })),
  };
  userTable.select.mockReturnValue(userTable);
  userTable.eq.mockReturnValue(userTable);
  vi.doMock('@/lib/supabase', () => ({
    supabase: {
      from: vi.fn((table: string) => table === 'users' ? userTable : eventTable),
    },
  }));

  vi.doMock('stripe', () => ({
    default: class StripeMock {
      webhooks = { constructEvent: vi.fn(() => ({ ...input.event, livemode: input.livemode ?? false })) };
      subscriptions = {
        retrieve: retrieveSubscription,
        update: updateSubscription,
        cancel: cancelSubscription,
      };
      customers = {
        retrieve: vi.fn(async () => ({
          id: 'cus_lifetime',
          deleted: false,
          metadata: {
            ...(input.lifetimeCheckoutMarker
              ? { viralynz_lifetime_checkout_session_id: input.lifetimeCheckoutMarker }
              : {}),
            ...(input.revokedLifetimeCheckoutMarker
              ? { viralynz_revoked_lifetime_checkout_session_id: input.revokedLifetimeCheckoutMarker }
              : {}),
          },
        })),
        update: updateCustomer,
      };
      checkout = {
        sessions: {
          list: vi.fn(async () => ({
            data: input.lifetimeCheckout ? [input.lifetimeCheckout] : [],
          })),
        },
      };
      charges = { retrieve: vi.fn(async () => input.retrievedCharge) };
      invoicePayments = {
        list: vi.fn(async () => ({
          data: input.invoicePayment ? [input.invoicePayment] : [],
        })),
      };
      invoices = { retrieve: vi.fn(async () => input.invoice) };
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
    downgrade,
    revokeLifetime,
    suspendDispute,
    retrieveSubscription,
    updateSubscription,
    cancelSubscription,
    updateCustomer,
  };
}

describe('Stripe webhook ordering', () => {
  it('rejects a live event in test mode before claiming it', async () => {
    const event = {
      id: 'evt_live_wrong_mode',
      type: 'checkout.session.completed',
      created: 1_800_000_000,
      data: { object: {} },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event, livemode: true });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(webhook.eventTable.insert).not.toHaveBeenCalled();
  });

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

  it('fulfills an authorized no-payment-required Lifetime Checkout', async () => {
    const checkout = {
      id: 'cs_lifetime_promo',
      mode: 'payment',
      payment_status: 'no_payment_required',
      customer: 'cus_lifetime_promo',
      client_reference_id: 'user_1',
      metadata: { userId: 'user_1', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const event = {
      id: 'evt_checkout_completed_lifetime_promo',
      type: 'checkout.session.completed',
      created: 1_800_000_000,
      data: { object: checkout },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.syncLifetime).toHaveBeenCalledWith(expect.anything(), checkout);
    expect(webhook.syncSubscriptionCheckout).not.toHaveBeenCalled();
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

  it('revokes Lifetime after a full refund correlated to its Checkout', async () => {
    const charge = {
      id: 'ch_lifetime_refunded',
      payment_intent: 'pi_lifetime',
      refunded: true,
      amount: 14_900,
      amount_refunded: 14_900,
    } as unknown as Stripe.Charge;
    const checkout = {
      id: 'cs_lifetime_refunded',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_lifetime_refunded',
      metadata: { userId: 'user_1', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const event = {
      id: 'evt_lifetime_refunded',
      type: 'charge.refunded',
      created: 1_800_000_001,
      data: { object: charge },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event, lifetimeCheckout: checkout });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.revokeLifetime).toHaveBeenCalledWith('cus_lifetime_refunded');
  });

  it('does not let an old Lifetime refund revoke a newer Lifetime purchase', async () => {
    const charge = {
      id: 'ch_old_lifetime_refunded',
      payment_intent: 'pi_old_lifetime',
      refunded: true,
      amount: 14_900,
      amount_refunded: 14_900,
    } as unknown as Stripe.Charge;
    const oldCheckout = {
      id: 'cs_old_lifetime',
      mode: 'payment',
      payment_status: 'paid',
      customer: 'cus_lifetime',
      metadata: { userId: 'user_1', plan: 'lifetime' },
    } as unknown as Stripe.Checkout.Session;
    const event = {
      id: 'evt_old_lifetime_refunded',
      type: 'charge.refunded',
      created: 1_800_000_001,
      data: { object: charge },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      lifetimeCheckout: oldCheckout,
      lifetimeCheckoutMarker: 'cs_new_lifetime',
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.revokeLifetime).not.toHaveBeenCalled();
  });

  it('does not revoke Lifetime after a partial refund', async () => {
    const charge = {
      id: 'ch_lifetime_partial',
      payment_intent: 'pi_lifetime',
      refunded: false,
      amount: 14_900,
      amount_refunded: 1_000,
    } as unknown as Stripe.Charge;
    const event = {
      id: 'evt_lifetime_partial_refund',
      type: 'charge.refunded',
      created: 1_800_000_001,
      data: { object: charge },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.revokeLifetime).not.toHaveBeenCalled();
  });

  it('uses the current Stripe subscription for a late payment-failed invoice', async () => {
    const currentSubscription = {
      id: 'sub_current',
      customer: 'cus_current',
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

  it('re-reads Stripe before applying a late subscription update', async () => {
    const eventSnapshot = {
      id: 'sub_stale',
      status: 'active',
    } as unknown as Stripe.Subscription;
    const currentSubscription = {
      id: 'sub_stale',
      status: 'canceled',
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_subscription_update_stale',
      type: 'customer.subscription.updated',
      created: 1_800_000_002,
      data: { object: eventSnapshot },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({ event, currentSubscription });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.retrieveSubscription).toHaveBeenCalledWith('sub_stale');
    expect(webhook.downgrade).toHaveBeenCalledWith('sub_stale');
    expect(webhook.syncSubscription).not.toHaveBeenCalled();
  });

  it('cancels a still-renewing recurring subscription when Lifetime already won', async () => {
    const eventSnapshot = {
      id: 'sub_lost_to_lifetime',
      status: 'active',
    } as unknown as Stripe.Subscription;
    const currentSubscription = {
      id: 'sub_lost_to_lifetime',
      customer: 'cus_lifetime',
      status: 'active',
      cancel_at_period_end: false,
      metadata: { userId: 'user_lifetime' },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_subscription_after_lifetime',
      type: 'customer.subscription.updated',
      created: 1_800_000_003,
      data: { object: eventSnapshot },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      storedLifetime: true,
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.cancelSubscription).toHaveBeenCalledWith('sub_lost_to_lifetime');
    expect(webhook.downgrade).toHaveBeenCalledWith('sub_lost_to_lifetime');
    expect(webhook.syncSubscription).not.toHaveBeenCalled();
  });

  it('keeps a recurring subscription already scheduled to end beside Lifetime', async () => {
    const eventSnapshot = {
      id: 'sub_scheduled_for_lifetime',
      status: 'active',
    } as unknown as Stripe.Subscription;
    const currentSubscription = {
      id: 'sub_scheduled_for_lifetime',
      customer: 'cus_lifetime',
      status: 'active',
      cancel_at_period_end: true,
      metadata: {
        userId: 'user_lifetime',
        replaced_by_lifetime: 'true',
      },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_subscription_scheduled_after_lifetime',
      type: 'customer.subscription.updated',
      created: 1_800_000_003,
      data: { object: eventSnapshot },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      storedLifetime: true,
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.cancelSubscription).not.toHaveBeenCalled();
    expect(webhook.downgrade).not.toHaveBeenCalled();
    expect(webhook.syncSubscription).not.toHaveBeenCalled();
  });

  it('uses the current Stripe subscription before resetting a paid cycle', async () => {
    const currentSubscription = {
      id: 'sub_current',
      customer: 'cus_current',
      status: 'active',
      metadata: { userId: 'user_1' },
    } as unknown as Stripe.Subscription;
    const invoice = {
      id: 'in_old_paid',
      billing_reason: 'subscription_cycle',
      period_start: 1_800_000_000,
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
    expect(webhook.resetCounters).toHaveBeenCalledWith(
      'sub_current',
      new Date(1_800_000_000 * 1_000).toISOString(),
    );
  });

  it('suspends recurring access and schedules cancellation when a dispute opens', async () => {
    const charge = {
      id: 'ch_recurring_disputed',
      customer: 'cus_recurring',
      payment_intent: 'pi_recurring',
      refunded: false,
    } as unknown as Stripe.Charge;
    const dispute = {
      id: 'dp_recurring_open',
      charge,
      status: 'needs_response',
    } as unknown as Stripe.Dispute;
    const invoice = {
      id: 'in_recurring',
      customer: 'cus_recurring',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_recurring' },
      },
    } as unknown as Stripe.Invoice;
    const invoicePayment = {
      id: 'inpay_recurring',
      invoice: 'in_recurring',
      payment: { type: 'payment_intent', payment_intent: 'pi_recurring' },
    } as unknown as Stripe.InvoicePayment;
    const currentSubscription = {
      id: 'sub_recurring',
      customer: 'cus_recurring',
      status: 'active',
      metadata: { userId: 'user_recurring' },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_recurring_dispute_open',
      type: 'charge.dispute.created',
      created: 1_800_000_004,
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      invoicePayment,
      invoice,
      invoiceSubscriptionId: 'sub_recurring',
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.suspendDispute).toHaveBeenCalledWith(currentSubscription);
    expect(webhook.updateSubscription).toHaveBeenCalledWith('sub_recurring', {
      cancel_at_period_end: true,
      metadata: {
        viralynz_dispute_status: 'open',
        viralynz_dispute_id: 'dp_recurring_open',
      },
    });
    expect(webhook.syncSubscription).not.toHaveBeenCalled();
  });

  it('restores recurring access only from the matching won dispute', async () => {
    const charge = {
      id: 'ch_recurring_won',
      customer: 'cus_recurring',
      payment_intent: 'pi_recurring_won',
      refunded: false,
    } as unknown as Stripe.Charge;
    const dispute = {
      id: 'dp_recurring_won',
      charge,
      status: 'won',
    } as unknown as Stripe.Dispute;
    const invoice = {
      id: 'in_recurring_won',
      customer: 'cus_recurring',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_recurring_won' },
      },
    } as unknown as Stripe.Invoice;
    const invoicePayment = {
      id: 'inpay_recurring_won',
      invoice: 'in_recurring_won',
      payment: { type: 'payment_intent', payment_intent: 'pi_recurring_won' },
    } as unknown as Stripe.InvoicePayment;
    const currentSubscription = {
      id: 'sub_recurring_won',
      customer: 'cus_recurring',
      status: 'active',
      metadata: {
        userId: 'user_recurring',
        viralynz_dispute_status: 'open',
        viralynz_dispute_id: 'dp_recurring_won',
      },
    } as unknown as Stripe.Subscription;
    const updatedSubscription = {
      ...currentSubscription,
      cancel_at_period_end: true,
      metadata: { userId: 'user_recurring' },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_recurring_dispute_won',
      type: 'charge.dispute.closed',
      created: 1_800_000_005,
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      updatedSubscription,
      invoicePayment,
      invoice,
      invoiceSubscriptionId: 'sub_recurring_won',
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.updateSubscription).toHaveBeenCalledWith('sub_recurring_won', {
      metadata: {
        viralynz_dispute_status: '',
        viralynz_dispute_id: '',
      },
    });
    expect(webhook.syncSubscription).toHaveBeenCalledWith(updatedSubscription);
    expect(webhook.suspendDispute).not.toHaveBeenCalled();
  });

  it('never reactivates recurring billing after a won dispute when Lifetime is stored', async () => {
    const charge = {
      id: 'ch_lifetime_recurring_won',
      customer: 'cus_lifetime',
      payment_intent: 'pi_lifetime_recurring_won',
      refunded: false,
    } as unknown as Stripe.Charge;
    const dispute = {
      id: 'dp_lifetime_recurring_won',
      charge,
      status: 'won',
    } as unknown as Stripe.Dispute;
    const invoice = {
      id: 'in_lifetime_recurring_won',
      customer: 'cus_lifetime',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_lifetime_recurring' },
      },
    } as unknown as Stripe.Invoice;
    const invoicePayment = {
      id: 'inpay_lifetime_recurring_won',
      invoice: 'in_lifetime_recurring_won',
      payment: {
        type: 'payment_intent',
        payment_intent: 'pi_lifetime_recurring_won',
      },
    } as unknown as Stripe.InvoicePayment;
    const currentSubscription = {
      id: 'sub_lifetime_recurring',
      customer: 'cus_lifetime',
      status: 'active',
      cancel_at_period_end: true,
      metadata: {
        userId: 'user_lifetime',
        viralynz_dispute_status: 'open',
        viralynz_dispute_id: 'dp_lifetime_recurring_won',
      },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_lifetime_recurring_dispute_won',
      type: 'charge.dispute.closed',
      created: 1_800_000_006,
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      invoicePayment,
      invoice,
      invoiceSubscriptionId: 'sub_lifetime_recurring',
      storedLifetime: true,
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.cancelSubscription).toHaveBeenCalledWith('sub_lifetime_recurring');
    expect(webhook.downgrade).toHaveBeenCalledWith('sub_lifetime_recurring');
    expect(webhook.updateSubscription).not.toHaveBeenCalled();
    expect(webhook.syncSubscription).not.toHaveBeenCalled();
  });

  it('cancels and downgrades a recurring subscription when the dispute is lost', async () => {
    const charge = {
      id: 'ch_recurring_lost',
      customer: 'cus_recurring',
      payment_intent: 'pi_recurring_lost',
      refunded: false,
    } as unknown as Stripe.Charge;
    const dispute = {
      id: 'dp_recurring_lost',
      charge,
      status: 'lost',
    } as unknown as Stripe.Dispute;
    const invoice = {
      id: 'in_recurring_lost',
      customer: 'cus_recurring',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_recurring_lost' },
      },
    } as unknown as Stripe.Invoice;
    const invoicePayment = {
      id: 'inpay_recurring_lost',
      invoice: 'in_recurring_lost',
      payment: { type: 'payment_intent', payment_intent: 'pi_recurring_lost' },
    } as unknown as Stripe.InvoicePayment;
    const currentSubscription = {
      id: 'sub_recurring_lost',
      customer: 'cus_recurring',
      status: 'active',
      metadata: { userId: 'user_recurring' },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_recurring_dispute_lost',
      type: 'charge.dispute.closed',
      created: 1_800_000_006,
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      invoicePayment,
      invoice,
      invoiceSubscriptionId: 'sub_recurring_lost',
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.suspendDispute).toHaveBeenCalledWith(currentSubscription);
    expect(webhook.cancelSubscription).toHaveBeenCalledWith('sub_recurring_lost');
    expect(webhook.downgrade).toHaveBeenCalledWith('sub_recurring_lost');
    expect(webhook.syncSubscription).not.toHaveBeenCalled();
  });

  it('finishes a lost-dispute retry without canceling an already canceled subscription twice', async () => {
    const charge = {
      id: 'ch_recurring_lost_retry',
      customer: 'cus_recurring',
      payment_intent: 'pi_recurring_lost_retry',
      refunded: false,
    } as unknown as Stripe.Charge;
    const dispute = {
      id: 'dp_recurring_lost_retry',
      charge,
      status: 'lost',
    } as unknown as Stripe.Dispute;
    const invoice = {
      id: 'in_recurring_lost_retry',
      customer: 'cus_recurring',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_recurring_lost_retry' },
      },
    } as unknown as Stripe.Invoice;
    const invoicePayment = {
      id: 'inpay_recurring_lost_retry',
      invoice: 'in_recurring_lost_retry',
      payment: {
        type: 'payment_intent',
        payment_intent: 'pi_recurring_lost_retry',
      },
    } as unknown as Stripe.InvoicePayment;
    const currentSubscription = {
      id: 'sub_recurring_lost_retry',
      customer: 'cus_recurring',
      status: 'canceled',
      metadata: { userId: 'user_recurring' },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_recurring_dispute_lost_retry',
      type: 'charge.dispute.closed',
      created: 1_800_000_007,
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      invoicePayment,
      invoice,
      invoiceSubscriptionId: 'sub_recurring_lost_retry',
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(webhook.cancelSubscription).not.toHaveBeenCalled();
    expect(webhook.downgrade).toHaveBeenCalledWith('sub_recurring_lost_retry');
  });

  it('rejects a disputed charge whose invoice belongs to another Customer', async () => {
    const charge = {
      id: 'ch_recurring_mismatch',
      customer: 'cus_charge',
      payment_intent: 'pi_recurring_mismatch',
      refunded: false,
    } as unknown as Stripe.Charge;
    const dispute = {
      id: 'dp_recurring_mismatch',
      charge,
      status: 'needs_response',
    } as unknown as Stripe.Dispute;
    const invoice = {
      id: 'in_recurring_mismatch',
      customer: 'cus_other',
      parent: {
        type: 'subscription_details',
        subscription_details: { subscription: 'sub_recurring_mismatch' },
      },
    } as unknown as Stripe.Invoice;
    const invoicePayment = {
      id: 'inpay_recurring_mismatch',
      invoice: 'in_recurring_mismatch',
      payment: { type: 'payment_intent', payment_intent: 'pi_recurring_mismatch' },
    } as unknown as Stripe.InvoicePayment;
    const currentSubscription = {
      id: 'sub_recurring_mismatch',
      customer: 'cus_charge',
      status: 'active',
      metadata: { userId: 'user_recurring' },
    } as unknown as Stripe.Subscription;
    const event = {
      id: 'evt_recurring_dispute_mismatch',
      type: 'charge.dispute.created',
      created: 1_800_000_007,
      data: { object: dispute },
    } as unknown as Stripe.Event;
    const webhook = await setupWebhook({
      event,
      currentSubscription,
      invoicePayment,
      invoice,
      invoiceSubscriptionId: 'sub_recurring_mismatch',
    });

    const response = await webhook.POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(webhook.suspendDispute).not.toHaveBeenCalled();
    expect(webhook.updateSubscription).not.toHaveBeenCalled();
  });
});
