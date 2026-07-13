import type Stripe from 'stripe';

/**
 * Stripe has definitively completed a one-time Lifetime Checkout when funds
 * are available or when an authorized promotion makes payment unnecessary.
 * `unpaid` always remains pending and must never grant access.
 */
export function isLifetimeCheckoutPaymentStatusConfirmed(
  status: Stripe.Checkout.Session['payment_status'],
): boolean {
  return status === 'paid' || status === 'no_payment_required';
}
