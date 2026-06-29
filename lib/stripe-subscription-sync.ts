import type Stripe from 'stripe';
import { isLifetimePlan, normalizePlan } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { PLAN_RANK, planFromStripePriceId } from '@/lib/stripe-billing';

type SupabaseWriteError = {
  message: string;
  code?: string;
};

export type SyncCheckoutResult =
  | { ok: true }
  | { ok: false; reason: string; log?: string };

export function subscriptionCurrentPeriodEndIso(sub: Stripe.Subscription): string {
  const endSec =
    sub.items.data[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    Math.floor(Date.now() / 1000);
  return new Date(endSec * 1000).toISOString();
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type === 'subscription_details' && parent.subscription_details?.subscription) {
    const subscription = parent.subscription_details.subscription;
    return typeof subscription === 'string' ? subscription : subscription.id;
  }

  const legacy = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id;
  return null;
}

function subscriptionCustomerId(sub: Stripe.Subscription): string | null {
  const customer = sub.customer;
  if (typeof customer === 'string') return customer;
  if (customer && typeof customer === 'object' && 'id' in customer && !('deleted' in customer && (customer as { deleted?: boolean }).deleted)) {
    return (customer as Stripe.Customer).id;
  }
  return null;
}

function primaryPriceId(sub: Stripe.Subscription): string | null {
  return sub.items.data[0]?.price?.id ?? null;
}

function hasStoredLifetimeAccess(user: { plan?: string | null; subscription_status?: string | null } | null | undefined): boolean {
  return isLifetimePlan(user?.plan) || user?.subscription_status === 'lifetime';
}

function isMissingStripePriceIdColumn(error: SupabaseWriteError): boolean {
  return error.code === 'PGRST204' || /stripe_price_id/i.test(error.message);
}

async function updateUserById(userId: string, patch: Record<string, unknown>): Promise<SupabaseWriteError | null> {
  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (!error || !('stripe_price_id' in patch) || !isMissingStripePriceIdColumn(error)) return error;

  const retryPatch = { ...patch };
  delete retryPatch.stripe_price_id;
  const retry = await supabase.from('users').update(retryPatch).eq('id', userId);
  return retry.error;
}

async function updateUsersBySubscriptionId(subscriptionId: string, patch: Record<string, unknown>): Promise<{
  data: Array<Record<string, unknown>> | null;
  error: SupabaseWriteError | null;
}> {
  const result = await supabase
    .from('users')
    .update(patch)
    .eq('stripe_subscription_id', subscriptionId)
    .select('id, email, plan');

  if (!result.error || !('stripe_price_id' in patch) || !isMissingStripePriceIdColumn(result.error)) {
    return { data: result.data as Array<Record<string, unknown>> | null, error: result.error };
  }

  const retryPatch = { ...patch };
  delete retryPatch.stripe_price_id;
  const retry = await supabase
    .from('users')
    .update(retryPatch)
    .eq('stripe_subscription_id', subscriptionId)
    .select('id, email, plan');

  return { data: retry.data as Array<Record<string, unknown>> | null, error: retry.error };
}

export async function syncUserFromPaidSubscriptionCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  opts: { expectedUserId?: string } = {}
): Promise<SyncCheckoutResult> {
  if (session.mode !== 'subscription') {
    return { ok: false, reason: 'not_subscription_mode', log: session.id };
  }
  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'not_paid', log: session.id };
  }

  const userId = session.metadata?.userId;
  const metaPlan = session.metadata?.plan;
  if (!userId || !['starter', 'creator', 'pro', 'lifetime', 'scale'].includes(metaPlan ?? '')) {
    return { ok: false, reason: 'invalid_metadata', log: session.id };
  }
  if (opts.expectedUserId && opts.expectedUserId !== userId) {
    return { ok: false, reason: 'user_mismatch', log: session.id };
  }

  let subRef = session.subscription;
  let subId = typeof subRef === 'string' ? subRef : subRef?.id;

  if (!subId) {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, { expand: ['subscription'] });
    subRef = expanded.subscription;
    subId = typeof subRef === 'string' ? subRef : subRef?.id;
  }

  if (!subId) {
    return { ok: false, reason: 'missing_subscription_id', log: session.id };
  }

  const sub = await stripe.subscriptions.retrieve(subId);
  const priceId = primaryPriceId(sub);
  if (!priceId) {
    return { ok: false, reason: 'missing_price_on_subscription', log: sub.id };
  }

  const planFromPrice = planFromStripePriceId(priceId);
  if (!planFromPrice) {
    return { ok: false, reason: 'price_not_mapped_to_env', log: priceId };
  }
  if (normalizePlan(planFromPrice) !== normalizePlan(metaPlan)) {
    return { ok: false, reason: 'price_metadata_mismatch', log: `price:${planFromPrice} metadata:${metaPlan}` };
  }

  const customerId =
    (typeof session.customer === 'string' ? session.customer : session.customer?.id) ??
    subscriptionCustomerId(sub);
  if (!customerId) {
    return { ok: false, reason: 'missing_customer_id', log: session.id };
  }

  const { data: currentUser, error: readErr } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single();

  if (readErr) {
    return { ok: false, reason: 'db_read_failed', log: readErr.message };
  }

  if (hasStoredLifetimeAccess(currentUser) && !isLifetimePlan(planFromPrice)) {
    console.warn('[stripe-sync] Lifetime access preserved from subscription checkout', {
      userId,
      current: currentUser?.plan,
      incoming: planFromPrice,
      subscriptionId: sub.id,
    });
    return { ok: true };
  }

  const targetRank = PLAN_RANK[planFromPrice] ?? 0;
  const currentRank = PLAN_RANK[currentUser?.plan ?? 'free'] ?? 0;
  const sameSub = currentUser?.stripe_subscription_id === sub.id;

  if (!sameSub && currentRank > targetRank) {
    console.warn('[stripe-sync] Skip stale checkout', { userId, current: currentUser?.plan, target: planFromPrice });
    return { ok: true };
  }

  const now = new Date().toISOString();
  const upErr = await updateUserById(userId, {
    plan: planFromPrice,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    subscription_status: sub.status,
    subscription_current_period_end: subscriptionCurrentPeriodEndIso(sub),
    subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    analyses_count: 0,
    hooks_count: 0,
    reconstructions_count: 0,
    last_reset_at: now,
  });

  if (upErr) {
    return { ok: false, reason: 'db_update_failed', log: upErr.message };
  }

  console.log('[stripe-sync] Subscription synced from checkout', {
    userId,
    plan: planFromPrice,
    subscriptionId: sub.id,
    customerId,
    priceId,
    status: sub.status,
    sessionId: session.id,
  });
  return { ok: true };
}

export async function syncUserFromPaidLifetimeCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<SyncCheckoutResult> {
  if (session.mode !== 'payment') {
    return { ok: false, reason: 'not_payment_mode', log: session.id };
  }
  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'not_paid', log: session.id };
  }

  const userId = session.metadata?.userId;
  const metaPlan = session.metadata?.plan;
  if (!userId || (metaPlan !== 'lifetime' && metaPlan !== 'scale')) {
    return { ok: false, reason: 'invalid_lifetime_metadata', log: session.id };
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id ?? null;
  if (!priceId) {
    return { ok: false, reason: 'missing_price_on_payment', log: session.id };
  }

  const planFromPrice = planFromStripePriceId(priceId);
  if (planFromPrice !== 'lifetime') {
    return { ok: false, reason: 'price_not_mapped_to_lifetime', log: priceId };
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) {
    return { ok: false, reason: 'missing_customer_id', log: session.id };
  }

  const { data: currentUser, error: readErr } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id')
    .eq('id', userId)
    .single();

  if (readErr) {
    return { ok: false, reason: 'db_read_failed', log: readErr.message };
  }

  if (currentUser?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(currentUser.stripe_subscription_id, {
        cancel_at_period_end: true,
        metadata: {
          lifetime_checkout_session_id: session.id,
          replaced_by_lifetime: 'true',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[stripe-sync] Lifetime paid but old subscription cancellation failed:', message);
    }
  }

  const now = new Date().toISOString();
  const upErr = await updateUserById(userId, {
    plan: 'lifetime',
    stripe_customer_id: customerId,
    stripe_subscription_id: null,
    stripe_price_id: priceId,
    subscription_status: 'lifetime',
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    analyses_count: 0,
    hooks_count: 0,
    reconstructions_count: 0,
    last_reset_at: now,
  });

  if (upErr) {
    return { ok: false, reason: 'db_update_failed', log: upErr.message };
  }

  console.log('[stripe-sync] Lifetime synced from checkout', { userId, customerId, priceId, sessionId: session.id });
  return { ok: true };
}

export async function syncUserRowFromStripeSubscription(sub: Stripe.Subscription): Promise<SyncCheckoutResult> {
  const priceId = primaryPriceId(sub);
  const planFromPrice = priceId ? planFromStripePriceId(priceId) : null;
  const customerId = subscriptionCustomerId(sub);
  const periodEndIso = subscriptionCurrentPeriodEndIso(sub);

  let userId: string | null = sub.metadata?.userId ?? null;
  if (!userId) {
    const { data: row } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();
    userId = row?.id ?? null;
  }

  if (!userId) {
    return { ok: false, reason: 'user_not_found_for_subscription', log: sub.id };
  }

  const { data: currentUser, error: readErr } = await supabase
    .from('users')
    .select('plan, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single();

  if (readErr) {
    return { ok: false, reason: 'db_read_failed', log: readErr.message };
  }

  if (hasStoredLifetimeAccess(currentUser) && !isLifetimePlan(planFromPrice)) {
    console.log('[stripe-sync] Lifetime access preserved from subscription event', {
      userId,
      current: currentUser?.plan,
      incoming: planFromPrice,
      subscriptionId: sub.id,
      status: sub.status,
    });
    return { ok: true };
  }

  let nextPlan = (currentUser?.plan ?? 'free') as string;
  const statusAllowsTierFromPrice =
    sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';

  if (planFromPrice && statusAllowsTierFromPrice) {
    const curR = PLAN_RANK[nextPlan] ?? 0;
    const newR = PLAN_RANK[planFromPrice] ?? 0;
    if (newR < curR && currentUser?.stripe_subscription_id !== sub.id) {
      console.warn('[stripe-sync] Skip stale lower-tier subscription', {
        userId,
        current: currentUser?.plan,
        incoming: planFromPrice,
        subscriptionId: sub.id,
      });
      return { ok: true };
    }
    if (newR >= curR || currentUser?.stripe_subscription_id === sub.id) {
      nextPlan = planFromPrice;
    }
  }

  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    subscription_status: sub.status,
    subscription_current_period_end: periodEndIso,
    subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    plan: nextPlan,
  };
  if (customerId) {
    patch.stripe_customer_id = customerId;
  }

  const upErr = await updateUserById(userId, patch);
  if (upErr) {
    return { ok: false, reason: 'db_update_failed', log: upErr.message };
  }

  console.log('[stripe-sync] Subscription synced', { userId, subscriptionId: sub.id, status: sub.status, priceId });
  return { ok: true };
}

export async function resetMonthlyCountersForSubscription(subscriptionId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({ analyses_count: 0, hooks_count: 0, reconstructions_count: 0, last_reset_at: now })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('[stripe-sync] Renewal counter reset failed:', subscriptionId, error.message);
    throw new Error(error.message);
  }
  console.log('[stripe-sync] Monthly counters reset', { subscriptionId });
}

export async function setSubscriptionPaymentFailed(subscriptionId: string): Promise<void> {
  const { data: affected, error } = await supabase
    .from('users')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)
    .select('id, email, plan');

  if (error) {
    console.error('[stripe-sync] payment_failed status update failed:', subscriptionId, error.message);
    throw new Error(error.message);
  }
  console.warn('[stripe-sync] subscription marked past_due', {
    subscriptionId,
    affectedUser: affected?.[0] ? { id: affected[0].id, plan: affected[0].plan } : '(not found in DB)',
  });
}

export async function downgradeToFreeBySubscriptionId(subscriptionId: string): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from('users')
    .select('id, email, plan, subscription_status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (readError) {
    console.error('[stripe-sync] downgrade lookup failed:', subscriptionId, readError.message);
    throw new Error(readError.message);
  }

  if (!current) {
    console.log('[stripe-sync] Subscription deleted for unknown or already migrated user', { subscriptionId });
    return;
  }

  if (hasStoredLifetimeAccess(current)) {
    console.log('[stripe-sync] Lifetime access preserved after subscription.deleted', {
      subscriptionId,
      userId: current.id,
    });
    return;
  }

  const { data: affected, error } = await updateUsersBySubscriptionId(subscriptionId, {
    plan: 'free',
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_status: 'canceled',
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
  });

  if (error) {
    console.error('[stripe-sync] downgrade to free failed:', subscriptionId, error.message);
    throw new Error(error.message);
  }

  console.log('[stripe-sync] User downgraded to free', {
    subscriptionId,
    userId: affected?.[0]?.id ?? '(not found)',
  });
}
