import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import {
  downgradeToFreeBySubscriptionId,
  invoiceSubscriptionId,
  resetMonthlyCountersForSubscription,
  syncUserFromPaidLifetimeCheckout,
  syncUserFromPaidSubscriptionCheckout,
  syncUserRowFromStripeSubscription,
} from '@/lib/stripe-subscription-sync';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import { supabase } from '@/lib/supabase';
import { privateJson } from '@/lib/api-route-security';

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
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) throw new Error('stripe_not_configured');
  return new Stripe(stripeSecret);
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
  const result = await syncUserRowFromStripeSubscription(subscription);
  assertSyncResult('invoice_subscription_sync_failed', result);

  if (invoice.billing_reason === 'subscription_cycle') {
    await resetMonthlyCountersForSubscription(subscriptionId);
  }
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

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || webhookSecret === 'whsec_your_webhook_secret_here') {
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
        if (checkout.payment_status !== 'paid') break;
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
        const result = await syncUserRowFromStripeSubscription(subscription);
        assertSyncResult('subscription_sync_failed', result);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await downgradeToFreeBySubscriptionId(subscription.id);
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
