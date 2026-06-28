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

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const STRIPE_WEBHOOK_PROCESSING_STALE_MS = 15 * 60 * 1000;

type StripeWebhookClaimAction =
  | 'process_new'
  | 'process_retry_stale'
  | 'process_retry_failed'
  | 'duplicate_processed'
  | 'duplicate_processing';

type StripeWebhookClaimRow = {
  action?: StripeWebhookClaimAction | string;
  status?: string;
  attempts?: number;
};

type StripeWebhookClaim =
  | { ok: true; shouldProcess: true; action: StripeWebhookClaimAction; attempts: number }
  | { ok: true; shouldProcess: false; action: StripeWebhookClaimAction; attempts: number }
  | { ok: false; status: number; reason: string };

function getStripe(): Stripe {
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY manquant');
  }
  return new Stripe(stripeSecret);
}

function shouldProcessClaim(action: string | undefined): action is Extract<StripeWebhookClaimAction, 'process_new' | 'process_retry_stale' | 'process_retry_failed'> {
  return action === 'process_new' || action === 'process_retry_stale' || action === 'process_retry_failed';
}

function isDuplicateClaim(action: string | undefined): action is Extract<StripeWebhookClaimAction, 'duplicate_processed' | 'duplicate_processing'> {
  return action === 'duplicate_processed' || action === 'duplicate_processing';
}

async function claimStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookClaim> {
  const staleBefore = new Date(Date.now() - STRIPE_WEBHOOK_PROCESSING_STALE_MS).toISOString();
  const { data, error } = await supabase.rpc('claim_stripe_webhook_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_stripe_created_at: new Date(event.created * 1000).toISOString(),
    p_stale_before: staleBefore,
  });

  if (error) {
    console.error('[webhook] Idempotency claim failed:', event.id, error.message);
    return { ok: false, status: 500, reason: 'idempotency_claim_failed' };
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as StripeWebhookClaimRow | undefined;
  const action = row?.action;
  const attempts = typeof row?.attempts === 'number' ? row.attempts : 1;

  if (shouldProcessClaim(action)) {
    return { ok: true, shouldProcess: true, action, attempts };
  }

  if (isDuplicateClaim(action)) {
    return { ok: true, shouldProcess: false, action, attempts };
  }

  console.error('[webhook] Idempotency claim returned unexpected action:', event.id, action);
  return { ok: false, status: 500, reason: 'idempotency_claim_invalid' };
}

async function markStripeWebhookEventProcessed(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('event_id', eventId);

  if (error) {
    console.error('[webhook] Event processed but idempotency status update failed:', eventId, error.message);
    return false;
  }

  return true;
}

async function markStripeWebhookEventFailed(eventId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'failed',
      last_error: message.slice(0, 1000),
    })
    .eq('event_id', eventId);

  if (error) {
    console.error('[webhook] Failed to mark Stripe event as failed:', eventId, error.message);
  }
}

/**
 * Body brut obligatoire pour `constructEvent` — ne jamais utiliser request.json() avant.
 */
export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  if (!webhookSecret || webhookSecret === 'whsec_your_webhook_secret_here') {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET invalide ou placeholder.');
    return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header.');
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const claim = await claimStripeWebhookEvent(event);
  if (!claim.ok) {
    return NextResponse.json({ error: claim.reason }, { status: claim.status });
  }

  if (!claim.shouldProcess) {
    console.log('[webhook] Duplicate Stripe event acked:', {
      eventId: event.id,
      type: event.type,
      action: claim.action,
      attempts: claim.attempts,
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Détection PayPal : la session expose payment_method_types sur l'objet
        const paymentTypes = (session as unknown as { payment_method_types?: string[] }).payment_method_types ?? [];
        const isPayPal = paymentTypes.includes('paypal');

        console.log('[webhook] checkout.session.completed', {
          sessionId: session.id,
          mode: session.mode,
          payment_status: session.payment_status,
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
          payment_method_types: paymentTypes,
          paypal_detected: isPayPal,
          userId: session.metadata?.userId ?? '(no metadata)',
          plan: session.metadata?.plan ?? '(no metadata)',
        });

        if (session.mode === 'subscription') {
          if (isPayPal) {
            console.log('[webhook] PayPal subscription checkout — sync en cours (billing agreement Stripe)');
          }
          const res = await syncUserFromPaidSubscriptionCheckout(stripe, session, {});
          if (!res.ok) {
            console.error('[webhook] checkout.session.completed sync failed:', res.reason, res.log ?? '');
            throw new Error(`checkout_subscription_sync_failed:${res.reason}:${res.log ?? ''}`);
          }
          console.log('[webhook] checkout.session.completed sync OK — plan accordé en DB user=', session.metadata?.userId);
        } else if (session.mode === 'payment' && session.metadata?.plan === 'scale') {
          const res = await syncUserFromPaidLifetimeCheckout(stripe, session);
          if (!res.ok) {
            console.error('[webhook] lifetime checkout sync failed:', res.reason, res.log ?? '');
            throw new Error(`checkout_lifetime_sync_failed:${res.reason}:${res.log ?? ''}`);
          }
          console.log('[webhook] checkout.session.completed lifetime sync OK — user=', session.metadata?.userId);
        } else {
          console.warn('[webhook] Ignored checkout mode=', session.mode, session.id);
        }
        break;
      }

      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[webhook] customer.subscription.created', {
          subscriptionId: sub.id,
          status: sub.status,
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          priceId: sub.items.data[0]?.price?.id,
          interval: sub.items.data[0]?.price?.recurring?.interval,
          metadata: sub.metadata,
        });
        const res = await syncUserRowFromStripeSubscription(sub);
        if (!res.ok) {
          console.warn(
            '[webhook] customer.subscription.created sync deferred (souvent normal avant metadata / checkout):',
            res.reason,
            res.log
          );
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);

        if (!subId) {
          console.log('[webhook] invoice.paid — no subscription, skip (one-off?)', invoice.id);
          break;
        }

        console.log('[webhook] invoice.paid', {
          invoiceId: invoice.id,
          subscriptionId: subId,
          billing_reason: invoice.billing_reason,
          // payment_intent peut être null pour PayPal (pas de pi_) — normal
          payment_intent: (invoice as unknown as { payment_intent?: string | null }).payment_intent ?? 'null (PayPal ou mandate)',
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
        });

        // Renouvellement de période uniquement — pas le premier cycle (déjà géré au checkout)
        if (invoice.billing_reason === 'subscription_cycle') {
          await resetMonthlyCountersForSubscription(subId);
          console.log('[webhook] invoice.paid — compteurs mensuels réinitialisés sub=', subId);
        } else {
          console.log(
            '[webhook] invoice.paid skip counter reset — billing_reason=',
            invoice.billing_reason,
            invoice.id
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        console.warn('[webhook] invoice.payment_failed', {
          invoiceId: invoice.id,
          subscriptionId: subId ?? '(none)',
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? '?',
          amount_due: invoice.amount_due,
          billing_reason: invoice.billing_reason,
        });
        if (subId) {
          await setSubscriptionPaymentFailed(subId);
        } else {
          console.warn('[webhook] invoice.payment_failed — pas de subscription_id, skip', invoice.id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[webhook] customer.subscription.updated', {
          subscriptionId: sub.id,
          status: sub.status,
          priceId: sub.items.data[0]?.price?.id,
          userId: sub.metadata?.userId ?? '(no metadata)',
          plan: sub.metadata?.plan ?? '(no metadata)',
        });
        const res = await syncUserRowFromStripeSubscription(sub);
        if (!res.ok) {
          console.error('[webhook] subscription.updated sync failed:', res.reason, res.log ?? '');
          throw new Error(`subscription_sync_failed:${res.reason}:${res.log ?? ''}`);
        }
        console.log('[webhook] subscription.updated sync OK sub=', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        console.log('[webhook] customer.subscription.deleted — downgrade free sub=', sub.id, 'user=', sub.metadata?.userId ?? '(no metadata)');
        await downgradeToFreeBySubscriptionId(sub.id);
        break;
      }

      default:
        console.log('[webhook] Unhandled event (ack OK):', event.type, event.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Handler error:', event.type, message);
    await markStripeWebhookEventFailed(event.id, message);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  const markedProcessed = await markStripeWebhookEventProcessed(event.id);
  if (!markedProcessed) {
    return NextResponse.json({ error: 'idempotency_processed_mark_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
