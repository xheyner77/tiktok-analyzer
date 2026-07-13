import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import {
  downgradeToFreeBySubscriptionId,
  invoiceSubscriptionId,
  resetMonthlyCountersForSubscription,
  revokeLifetimeAccessByCustomerId,
  suspendSubscriptionForDispute,
  syncUserFromPaidLifetimeCheckout,
  syncUserFromPaidSubscriptionCheckout,
  syncUserRowFromStripeSubscription,
} from '@/lib/stripe-subscription-sync';
import {
  LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY,
  REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY,
} from '@/lib/stripe-customer-metadata';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import { supabase } from '@/lib/supabase';
import { privateJson } from '@/lib/api-route-security';
import {
  getStripeSecretKey,
  getStripeWebhookSecret,
  isStripeLiveRuntime,
} from '@/lib/stripe-runtime';
import { isLifetimeCheckoutPaymentStatusConfirmed } from '@/lib/stripe-payment-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const PROCESSING_CLAIM_TTL_MS = 10 * 60 * 1000;

type WebhookClaim =
  | { ok: true; state: 'claimed' | 'processed' }
  | { ok: false; status: number; reason: string };

class WebhookProcessingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'WebhookProcessingError';
  }
}

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey().value);
}

async function reclaimStripeWebhookEvent(
  eventId: string,
  previousStatus: 'failed' | 'processing',
  staleBeforeIso: string,
): Promise<WebhookClaim> {
  const patch = {
    status: 'processing',
    processing_started_at: new Date().toISOString(),
    processed_at: null,
    last_error: null,
  };

  const query = supabase
    .from('stripe_webhook_events')
    .update(patch)
    .eq('id', eventId)
    .eq('status', previousStatus);

  const result = previousStatus === 'processing'
    ? await query.lt('processing_started_at', staleBeforeIso).select('id').maybeSingle()
    : await query.select('id').maybeSingle();

  if (result.error) {
    console.error('[webhook] Impossible de reprendre un event Stripe.', {
      code: result.error.code,
    });
    return { ok: false, status: 503, reason: 'idempotency_reclaim_failed' };
  }

  if (!result.data) {
    return { ok: false, status: 409, reason: 'event_already_processing' };
  }

  return { ok: true, state: 'claimed' };
}

async function claimStripeWebhookEvent(event: Stripe.Event): Promise<WebhookClaim> {
  const now = new Date();
  const { error } = await supabase.from('stripe_webhook_events').insert({
    id: event.id,
    event_type: event.type,
    stripe_created_at: new Date(event.created * 1000).toISOString(),
    status: 'processing',
    processing_started_at: now.toISOString(),
  });

  if (!error) return { ok: true, state: 'claimed' };

  if (error.code !== '23505') {
    // On échoue fermé : traiter sans registre d'idempotence pourrait
    // accorder deux fois un paiement lors d'une relivraison Stripe.
    console.error('[webhook] Réservation idempotente impossible.', { code: error.code });
    return { ok: false, status: 503, reason: 'idempotency_claim_failed' };
  }

  const { data: existing, error: readError } = await supabase
    .from('stripe_webhook_events')
    .select('status, processing_started_at')
    .eq('id', event.id)
    .maybeSingle();

  if (readError || !existing) {
    console.error('[webhook] Lecture du registre idempotent impossible.', {
      code: readError?.code,
    });
    return { ok: false, status: 503, reason: 'idempotency_read_failed' };
  }

  if (existing.status === 'processed') {
    return { ok: true, state: 'processed' };
  }

  const staleBefore = new Date(now.getTime() - PROCESSING_CLAIM_TTL_MS);
  if (existing.status === 'processing') {
    const startedAt = Date.parse(existing.processing_started_at ?? '');
    if (!Number.isFinite(startedAt)) {
      console.error('[webhook] Horodatage idempotent invalide.');
      return { ok: false, status: 503, reason: 'idempotency_invalid_timestamp' };
    }
    if (startedAt >= staleBefore.getTime()) {
      return { ok: false, status: 409, reason: 'event_already_processing' };
    }
    return reclaimStripeWebhookEvent(event.id, 'processing', staleBefore.toISOString());
  }

  if (existing.status === 'failed') {
    return reclaimStripeWebhookEvent(event.id, 'failed', staleBefore.toISOString());
  }

  console.error('[webhook] Statut idempotent inconnu.');
  return { ok: false, status: 503, reason: 'idempotency_invalid_status' };
}

async function markStripeWebhookEventProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('stripe_webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null })
    .eq('id', eventId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('[webhook] Statut final idempotent non enregistré.', { code: error?.code });
    return false;
  }
  return true;
}

async function markStripeWebhookEventFailed(eventId: string, failureCode: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({ status: 'failed', last_error: failureCode.slice(0, 120) })
    .eq('id', eventId)
    .eq('status', 'processing');

  if (error) {
    console.error('[webhook] Echec de marquage idempotent.', { code: error.code });
  }
}

function assertSyncResult(
  prefix: string,
  result: { ok: true } | { ok: false; reason: string },
): void {
  if (!result.ok) {
    throw new WebhookProcessingError(`${prefix}:${result.reason}`);
  }
}

async function syncInvoiceSubscription(stripe: Stripe, invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await applyCurrentSubscription(stripe, subscription, 'invoice_subscription_sync_failed');

  if (invoice.billing_reason === 'subscription_cycle') {
    const periodStartSeconds = (invoice as Stripe.Invoice & { period_start?: number }).period_start;
    if (!Number.isFinite(periodStartSeconds)) {
      throw new WebhookProcessingError('invoice_period_start_missing');
    }
    await resetMonthlyCountersForSubscription(
      subscriptionId,
      new Date(periodStartSeconds * 1_000).toISOString(),
    );
  }
}

async function applyCurrentSubscription(
  stripe: Stripe,
  current: Stripe.Subscription,
  failurePrefix: string,
): Promise<void> {
  if (current.status === 'canceled') {
    await downgradeToFreeBySubscriptionId(current.id);
    return;
  }

  if (await customerHasStoredLifetimeAccess(current)) {
    // A recurring subscription already scheduled to end belongs to the normal
    // Pro -> Lifetime transition. Any still-renewing subscription is a lost
    // cross-mode race and must be stopped before it can bill again.
    if (!current.cancel_at_period_end) {
      await stripe.subscriptions.cancel(current.id);
      await downgradeToFreeBySubscriptionId(current.id);
    }
    return;
  }

  const result = await syncUserRowFromStripeSubscription(current);
  assertSyncResult(failurePrefix, result);
}

async function syncCurrentSubscription(
  stripe: Stripe,
  eventSubscription: Stripe.Subscription,
): Promise<void> {
  const current = await stripe.subscriptions.retrieve(eventSubscription.id);
  await applyCurrentSubscription(stripe, current, 'subscription_sync_failed');
}

function checkoutCustomerId(checkout: Stripe.Checkout.Session): string | null {
  const customer = checkout.customer;
  return typeof customer === 'string' ? customer : customer?.id ?? null;
}

function chargePaymentIntentId(charge: Stripe.Charge): string | null {
  const paymentIntent = charge.payment_intent;
  return typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id ?? null;
}

async function lifetimeCheckoutForCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<Stripe.Checkout.Session | null> {
  const paymentIntent = chargePaymentIntentId(charge);
  if (!paymentIntent) return null;

  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 10 });
  return sessions.data.find((session) => (
    session.mode === 'payment'
    && session.payment_status === 'paid'
    && (session.metadata?.plan === 'lifetime' || session.metadata?.plan === 'scale')
  )) ?? null;
}

async function revokeLifetimeForCharge(stripe: Stripe, charge: Stripe.Charge): Promise<void> {
  const checkout = await lifetimeCheckoutForCharge(stripe, charge);
  if (!checkout) return;

  const customerId = checkoutCustomerId(checkout);
  if (!customerId) throw new WebhookProcessingError('lifetime_refund_customer_missing');

  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) {
    throw new WebhookProcessingError('lifetime_refund_customer_deleted');
  }
  const activeLifetimeCheckout = customer.metadata?.[LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY] ?? null;
  await stripe.customers.update(customerId, {
    metadata: { [REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY]: checkout.id },
  });
  if (activeLifetimeCheckout && activeLifetimeCheckout !== checkout.id) {
    console.warn('[webhook] Ancien remboursement Lifetime ignore face a un achat plus recent.');
    return;
  }

  const revoked = await revokeLifetimeAccessByCustomerId(customerId);
  if (!revoked.ok) {
    throw new WebhookProcessingError(`lifetime_revoke_failed:${revoked.reason}`);
  }

  if (revoked.subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(revoked.subscriptionId);
    if (subscription.status === 'canceled') {
      await downgradeToFreeBySubscriptionId(subscription.id);
    } else {
      const syncResult = await syncUserRowFromStripeSubscription(subscription);
      assertSyncResult('post_lifetime_revoke_subscription_sync_failed', syncResult);
    }
  }
}

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (typeof customer === 'string') return customer;
  return customer?.id ?? null;
}

function invoiceId(
  invoice: string | Stripe.Invoice | Stripe.DeletedInvoice,
): string {
  return typeof invoice === 'string' ? invoice : invoice.id;
}

function usableInvoice(
  invoice: Stripe.Invoice | Stripe.DeletedInvoice,
): Stripe.Invoice | null {
  return 'deleted' in invoice && invoice.deleted ? null : invoice as Stripe.Invoice;
}

async function invoiceForCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<Stripe.Invoice | null> {
  const legacyInvoice = (charge as unknown as {
    invoice?: string | Stripe.Invoice | Stripe.DeletedInvoice | null;
  }).invoice;
  if (legacyInvoice) {
    if (typeof legacyInvoice !== 'string') return usableInvoice(legacyInvoice);
    return stripe.invoices.retrieve(legacyInvoice);
  }

  const paymentIntentId = chargePaymentIntentId(charge);
  if (!paymentIntentId) return null;

  const payments = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: paymentIntentId },
    limit: 10,
  });
  const invoiceIds = [...new Set(payments.data.map((payment) => invoiceId(payment.invoice)))];
  if (invoiceIds.length === 0) return null;
  if (invoiceIds.length !== 1) {
    throw new WebhookProcessingError('dispute_invoice_ambiguous');
  }

  const expanded = payments.data.find(
    (payment) => typeof payment.invoice !== 'string' && payment.invoice.id === invoiceIds[0],
  )?.invoice;
  if (expanded && typeof expanded !== 'string') {
    const currentInvoice = usableInvoice(expanded);
    if (!currentInvoice) throw new WebhookProcessingError('dispute_invoice_deleted');
    return currentInvoice;
  }

  return stripe.invoices.retrieve(invoiceIds[0]);
}

async function recurringSubscriptionForCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<Stripe.Subscription | null> {
  const invoice = await invoiceForCharge(stripe, charge);
  if (!invoice) return null;

  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return null;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const chargeCustomerId = customerId(charge.customer);
  const invoiceCustomerId = customerId(invoice.customer);
  const subscriptionCustomerId = customerId(subscription.customer);
  if (!chargeCustomerId || !invoiceCustomerId || !subscriptionCustomerId) {
    throw new WebhookProcessingError('dispute_customer_missing');
  }
  if (
    chargeCustomerId !== invoiceCustomerId
    || chargeCustomerId !== subscriptionCustomerId
  ) {
    throw new WebhookProcessingError('dispute_customer_mismatch');
  }

  return subscription;
}

async function customerHasStoredLifetimeAccess(subscription: Stripe.Subscription): Promise<boolean> {
  const subscriptionCustomerId = customerId(subscription.customer);
  if (!subscriptionCustomerId) {
    throw new WebhookProcessingError('subscription_customer_missing');
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('plan, subscription_status')
    .eq('stripe_customer_id', subscriptionCustomerId)
    .maybeSingle();
  if (error) {
    throw new WebhookProcessingError('lifetime_customer_lookup_failed');
  }

  return user?.plan === 'lifetime' && user?.subscription_status === 'lifetime';
}

async function suspendRecurringDispute(
  stripe: Stripe,
  dispute: Stripe.Dispute,
  charge: Stripe.Charge,
): Promise<boolean> {
  const subscription = await recurringSubscriptionForCharge(stripe, charge);
  if (!subscription) return false;
  if (subscription.status === 'canceled') {
    await downgradeToFreeBySubscriptionId(subscription.id);
    return true;
  }

  const result = await suspendSubscriptionForDispute(subscription);
  assertSyncResult('subscription_dispute_suspend_failed', result);
  await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: true,
    metadata: {
      viralynz_dispute_status: 'open',
      viralynz_dispute_id: dispute.id,
    },
  });
  return true;
}

async function closeRecurringDispute(
  stripe: Stripe,
  dispute: Stripe.Dispute,
  charge: Stripe.Charge,
): Promise<boolean> {
  const subscription = await recurringSubscriptionForCharge(stripe, charge);
  if (!subscription) return false;

  if (dispute.status === 'won' && !charge.refunded) {
    if (await customerHasStoredLifetimeAccess(subscription)) {
      // Winning a dispute must never reactivate recurring billing beside a
      // distinct Lifetime purchase. Close the old subscription and let the
      // normal cleanup preserve Lifetime in the user row.
      if (subscription.status !== 'canceled') {
        await stripe.subscriptions.cancel(subscription.id);
      }
      await downgradeToFreeBySubscriptionId(subscription.id);
      return true;
    }

    const markerMatches =
      subscription.metadata?.viralynz_dispute_status === 'open'
      && subscription.metadata?.viralynz_dispute_id === dispute.id;
    const current = markerMatches && subscription.status !== 'canceled'
      ? await stripe.subscriptions.update(subscription.id, {
          // Never undo a cancellation that the user may have confirmed while
          // the dispute was open. Rights can resume until the scheduled end;
          // recurring billing must be reactivated explicitly by the user.
          metadata: {
            viralynz_dispute_status: '',
            viralynz_dispute_id: '',
          },
        })
      : subscription;

    if (current.status === 'canceled') {
      await downgradeToFreeBySubscriptionId(current.id);
    } else {
      const result = await syncUserRowFromStripeSubscription(current);
      assertSyncResult('subscription_dispute_restore_failed', result);
    }
    return true;
  }

  // Un event closed peut arriver sans created. On retire donc d'abord les
  // droits localement, puis on arrête définitivement la facturation.
  const suspended = await suspendSubscriptionForDispute(subscription);
  assertSyncResult('subscription_dispute_close_suspend_failed', suspended);
  if (subscription.status !== 'canceled') {
    await stripe.subscriptions.cancel(subscription.id);
  }
  await downgradeToFreeBySubscriptionId(subscription.id);
  return true;
}

async function disputeCharge(stripe: Stripe, dispute: Stripe.Dispute): Promise<Stripe.Charge> {
  if (typeof dispute.charge !== 'string') return dispute.charge;
  return stripe.charges.retrieve(dispute.charge);
}

async function syncCompletedCheckout(
  stripe: Stripe,
  checkout: Stripe.Checkout.Session,
): Promise<void> {
  if (checkout.mode === 'subscription') {
    const result = await syncUserFromPaidSubscriptionCheckout(stripe, checkout, {});
    assertSyncResult('checkout_subscription_sync_failed', result);
    return;
  }

  if (
    checkout.mode === 'payment'
    && (checkout.metadata?.plan === 'lifetime' || checkout.metadata?.plan === 'scale')
  ) {
    const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout);
    assertSyncResult('checkout_lifetime_sync_failed', result);
  }
}

export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) {
    return privateJson({ error: 'Webhook indisponible.' }, { status: 503 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret().value;
  } catch (error) {
    console.error('[webhook] Secret de signature Stripe absent.');
    return privateJson({ error: 'Webhook indisponible.' }, { status: 503 });
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return privateJson({ error: 'Payload trop volumineux.' }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
    return privateJson({ error: 'Payload trop volumineux.' }, { status: 413 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return privateJson({ error: 'Signature invalide.' }, { status: 400 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    console.error('[webhook] Client Stripe indisponible.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Webhook indisponible.' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[webhook] Signature Stripe refusée.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Signature invalide.' }, { status: 400 });
  }

  if (event.livemode !== isStripeLiveRuntime()) {
    console.error('[webhook] Event Stripe recu depuis le mauvais environnement.', {
      eventType: event.type,
    });
    return privateJson({ error: 'Environnement Stripe invalide.' }, { status: 400 });
  }

  const claim = await claimStripeWebhookEvent(event);
  if (!claim.ok) {
    return privateJson({ error: 'Webhook temporairement indisponible.' }, { status: claim.status });
  }
  if (claim.state === 'processed') {
    return privateJson({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkout = event.data.object as Stripe.Checkout.Session;
        // Un moyen de paiement différé peut terminer Checkout avant que les
        // fonds soient confirmés. On accuse réception sans accorder de droit ;
        // async_payment_succeeded effectuera la synchronisation définitive.
        const isConfirmedLifetime = checkout.mode === 'payment'
          && (checkout.metadata?.plan === 'lifetime' || checkout.metadata?.plan === 'scale')
          && isLifetimeCheckoutPaymentStatusConfirmed(checkout.payment_status);
        if (checkout.payment_status !== 'paid' && !isConfirmedLifetime) break;
        await syncCompletedCheckout(stripe, checkout);
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        const checkout = event.data.object as Stripe.Checkout.Session;
        await syncCompletedCheckout(stripe, checkout);
        break;
      }

      case 'checkout.session.async_payment_failed':
        // No entitlement is granted until the corresponding succeeded event.
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncCurrentSubscription(stripe, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncCurrentSubscription(stripe, subscription);
        break;
      }

      case 'invoice.paid': {
        await syncInvoiceSubscription(stripe, event.data.object as Stripe.Invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoiceSubscriptionId(invoice);
        if (subscriptionId) {
          // Webhook delivery order is not guaranteed. Read Stripe's current
          // source of truth instead of letting an older failed invoice blindly
          // overwrite a newer active subscription.
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const result = await syncUserRowFromStripeSubscription(subscription);
          assertSyncResult('payment_failed_subscription_sync_failed', result);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.refunded && charge.amount_refunded >= charge.amount) {
          await revokeLifetimeForCharge(stripe, charge);
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        const charge = await disputeCharge(stripe, dispute);
        const lifetimeCheckout = await lifetimeCheckoutForCharge(stripe, charge);
        if (lifetimeCheckout) {
          await revokeLifetimeForCharge(stripe, charge);
        } else {
          await suspendRecurringDispute(stripe, dispute, charge);
        }
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        const charge = await disputeCharge(stripe, dispute);
        if (dispute.status === 'won' && !charge.refunded) {
          const checkout = await lifetimeCheckoutForCharge(stripe, charge);
          if (checkout) {
            const result = await syncUserFromPaidLifetimeCheckout(stripe, checkout, {
              restoreRevoked: true,
            });
            assertSyncResult('lifetime_dispute_restore_failed', result);
          } else {
            await closeRecurringDispute(stripe, dispute, charge);
          }
        } else {
          const checkout = await lifetimeCheckoutForCharge(stripe, charge);
          if (checkout) {
            await revokeLifetimeForCharge(stripe, charge);
          } else {
            await closeRecurringDispute(stripe, dispute, charge);
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const failureCode = error instanceof WebhookProcessingError
      ? error.code
      : 'unhandled_processing_error';
    console.error('[webhook] Traitement Stripe échoué.', {
      eventType: event.type,
      failureCode,
      kind: error instanceof Error ? error.name : 'unknown',
    });
    await markStripeWebhookEventFailed(event.id, failureCode);
    return privateJson({ error: 'Traitement du webhook impossible.' }, { status: 500 });
  }

  const markedProcessed = await markStripeWebhookEventProcessed(event.id);
  if (!markedProcessed) {
    return privateJson({ error: 'Finalisation du webhook impossible.' }, { status: 500 });
  }

  return privateJson({ received: true });
}
