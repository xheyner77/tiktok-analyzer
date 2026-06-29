import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  downgradeToFreeBySubscriptionId,
  invoiceSubscriptionId,
  resetMonthlyCountersForSubscription,
  setSubscriptionPaymentFailed,
  syncUserFromPaidLifetimeCheckout,
  syncUserFromPaidSubscriptionCheckout,
  syncUserRowFromStripeSubscription,
} from '@/lib/stripe-subscription-sync';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type WebhookClaim =
  | { ok: true; duplicate: false; persisted: boolean }
  | { ok: true; duplicate: true; persisted: boolean }
  | { ok: false; status: number; reason: string };

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY manquant');
  }
  return new Stripe(stripeSecret);
}

function isMissingWebhookEventsTable(error: { message?: string; code?: string }): boolean {
  return error.code === '42P01' || /stripe_webhook_events/i.test(error.message ?? '');
}

async function claimStripeWebhookEvent(event: Stripe.Event): Promise<WebhookClaim> {
  const { error } = await supabase.from('stripe_webhook_events').insert({
    id: event.id,
    event_type: event.type,
    stripe_created_at: new Date(event.created * 1000).toISOString(),
    status: 'processing',
    processing_started_at: new Date().toISOString(),
  });

  if (!error) return { ok: true, duplicate: false, persisted: true };

  if (isMissingWebhookEventsTable(error)) {
    console.warn('[webhook] stripe_webhook_events absente - idempotence DB non active.', { eventId: event.id });
    return { ok: true, duplicate: false, persisted: false };
  }

  if (error.code !== '23505') {
    console.error('[webhook] Impossible de reserver l event Stripe:', event.id, error.message);
    return { ok: false, status: 500, reason: 'idempotency_claim_failed' };
  }

  const { data: existing, error: readError } = await supabase
    .from('stripe_webhook_events')
    .select('status')
    .eq('id', event.id)
    .maybeSingle();

  if (readError) {
    console.error('[webhook] Impossible de lire l event Stripe existant:', event.id, readError.message);
    return { ok: false, status: 500, reason: 'idempotency_read_failed' };
  }

  if (existing?.status === 'processed' || existing?.status === 'processing') {
    return { ok: true, duplicate: true, persisted: true };
  }

  const retry = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', event.id);

  if (retry.error) {
    console.error('[webhook] Impossible de relancer l event Stripe:', event.id, retry.error.message);
    return { ok: false, status: 500, reason: 'idempotency_retry_failed' };
  }

  return { ok: true, duplicate: false, persisted: true };
}

async function markStripeWebhookEventProcessed(eventId: string, persisted: boolean): Promise<void> {
  if (!persisted) return;
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString(), last_error: null })
    .eq('id', eventId);

  if (error) {
    console.error('[webhook] Event traite mais statut idempotence non mis a jour:', eventId, error.message);
  }
}

async function markStripeWebhookEventFailed(eventId: string, persisted: boolean, message: string): Promise<void> {
  if (!persisted) return;
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({ status: 'failed', last_error: message.slice(0, 500) })
    .eq('id', eventId);

  if (error) {
    console.error('[webhook] Echec de marquage failed:', eventId, error.message);
  }
}

async function syncInvoiceSubscription(stripe: Stripe, invoice: Stripe.Invoice): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) {
    console.log('[webhook] invoice sans subscription, ignore', { invoiceId: invoice.id });
    return;
  }

  const sub = await stripe.subscriptions.retrieve(subId);
  const res = await syncUserRowFromStripeSubscription(sub);
  if (!res.ok) {
    throw new Error(`invoice_subscription_sync_failed:${res.reason}:${res.log ?? ''}`);
  }

  if (invoice.billing_reason === 'subscription_cycle') {
    await resetMonthlyCountersForSubscription(subId);
  }
}

export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || webhookSecret === 'whsec_your_webhook_secret_here') {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET invalide ou placeholder.');
    return NextResponse.json({ error: 'Webhook non configure.' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header.');
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const claim = await claimStripeWebhookEvent(event);
  if (!claim.ok) {
    return NextResponse.json({ error: claim.reason }, { status: claim.status });
  }
  if (claim.duplicate) {
    console.log('[webhook] Event Stripe deja traite ou en cours:', event.id, event.type);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[webhook] checkout.session.completed', {
          sessionId: session.id,
          mode: session.mode,
          paymentStatus: session.payment_status,
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
          userId: session.metadata?.userId ?? '(no metadata)',
          plan: session.metadata?.plan ?? '(no metadata)',
        });

        if (session.mode === 'subscription') {
          const res = await syncUserFromPaidSubscriptionCheckout(stripe, session, {});
          if (!res.ok) throw new Error(`checkout_subscription_sync_failed:${res.reason}:${res.log ?? ''}`);
        } else if (session.mode === 'payment' && (session.metadata?.plan === 'lifetime' || session.metadata?.plan === 'scale')) {
          const res = await syncUserFromPaidLifetimeCheckout(stripe, session);
          if (!res.ok) throw new Error(`checkout_lifetime_sync_failed:${res.reason}:${res.log ?? ''}`);
        } else {
          console.warn('[webhook] Checkout ignore', { mode: session.mode, sessionId: session.id });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[webhook] subscription event', {
          type: event.type,
          subscriptionId: sub.id,
          status: sub.status,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          priceId: sub.items.data[0]?.price?.id,
          userId: sub.metadata?.userId ?? '(no metadata)',
        });
        const res = await syncUserRowFromStripeSubscription(sub);
        if (!res.ok && event.type === 'customer.subscription.updated') {
          throw new Error(`subscription_sync_failed:${res.reason}:${res.log ?? ''}`);
        }
        if (!res.ok) {
          console.warn('[webhook] subscription.created sync differe:', res.reason, res.log ?? '');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[webhook] customer.subscription.deleted', { subscriptionId: sub.id });
        await downgradeToFreeBySubscriptionId(sub.id);
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[webhook] invoice success', {
          type: event.type,
          invoiceId: invoice.id,
          subscriptionId: invoiceSubscriptionId(invoice),
          billingReason: invoice.billing_reason,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
        });
        await syncInvoiceSubscription(stripe, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        console.warn('[webhook] invoice.payment_failed', {
          invoiceId: invoice.id,
          subscriptionId: subId ?? '(none)',
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? '?',
          amountDue: invoice.amount_due,
          billingReason: invoice.billing_reason,
        });
        if (subId) await setSubscriptionPaymentFailed(subId);
        break;
      }

      default:
        console.log('[webhook] Unhandled event ack OK:', event.type, event.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Handler error:', event.type, message);
    await markStripeWebhookEventFailed(event.id, claim.persisted, message);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  await markStripeWebhookEventProcessed(event.id, claim.persisted);
  return NextResponse.json({ received: true });
}
