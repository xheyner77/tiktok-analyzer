import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  downgradeToFreeBySubscriptionId,
  invoiceSubscriptionId,
  resetMonthlyCountersForSubscription,
  setSubscriptionPaymentFailed,
  syncUserFromPaidSubscriptionCheckout,
  syncUserRowFromStripeSubscription,
} from '@/lib/stripe-subscription-sync';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

function getStripe(): Stripe {
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY manquant');
  }
  return new Stripe(stripeSecret);
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
            return NextResponse.json({ error: res.reason }, { status: 500 });
          }
          console.log('[webhook] checkout.session.completed sync OK — plan accordé en DB user=', session.metadata?.userId);
        } else {
          console.warn('[webhook] Ignored checkout (not subscription) mode=', session.mode, session.id);
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
          return NextResponse.json({ error: res.reason }, { status: 500 });
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
    // 500 → Stripe retente (idempotent sur la plupart des handlers)
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
