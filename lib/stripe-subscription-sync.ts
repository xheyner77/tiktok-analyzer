import type Stripe from 'stripe';
import { normalizePlan } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { PLAN_RANK, planFromStripePriceId } from '@/lib/stripe-billing';
import {
  LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY,
  REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY,
  STRIPE_CUSTOMER_OWNER_METADATA_KEY,
} from '@/lib/stripe-customer-metadata';
import { isLifetimeCheckoutPaymentStatusConfirmed } from '@/lib/stripe-payment-status';

type SupabaseWriteError = {
  message: string;
  code?: string;
};

export type SyncCheckoutResult =
  | { ok: true }
  | { ok: false; reason: string };

export type LifetimeRevocationResult =
  | { ok: true; subscriptionId: string | null }
  | { ok: false; reason: string };

const OPEN_DISPUTE_STATUS = 'open';

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
  return user?.plan === 'lifetime' && user?.subscription_status === 'lifetime';
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

async function updateUserByIdUnlessLifetime(
  userId: string,
  patch: Record<string, unknown>,
): Promise<{ updated: boolean; error: SupabaseWriteError | null }> {
  const write = async (nextPatch: Record<string, unknown>) => supabase
    .from('users')
    .update(nextPatch)
    .eq('id', userId)
    // This compare-and-set prevents a recurring Checkout webhook that read an
    // older row from overwriting a concurrent one-time Lifetime entitlement.
    .neq('plan', 'lifetime')
    .select('id')
    .maybeSingle();

  const first = await write(patch);
  if (!first.error || !('stripe_price_id' in patch) || !isMissingStripePriceIdColumn(first.error)) {
    return { updated: Boolean(first.data), error: first.error };
  }

  const retryPatch = { ...patch };
  delete retryPatch.stripe_price_id;
  const retry = await write(retryPatch);
  return { updated: Boolean(retry.data), error: retry.error };
}

function subscriptionOwnershipFailure(
  subscription: Stripe.Subscription,
  input: { customerId: string; userId: string },
): string | null {
  if (subscriptionCustomerId(subscription) !== input.customerId) {
    return 'subscription_customer_mismatch';
  }
  const canonicalOwner = subscription.metadata?.viralynz_user_id ?? null;
  const legacyOwner = subscription.metadata?.userId ?? null;
  if (
    (canonicalOwner && canonicalOwner !== input.userId)
    || (legacyOwner && legacyOwner !== input.userId)
  ) {
    return 'subscription_user_mismatch';
  }
  return null;
}

async function cancelRecurringCheckoutAfterLifetime(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  input: {
    customerId: string;
    userId: string;
    checkout: Stripe.Checkout.Session;
    storedCustomerId: string | null | undefined;
  },
): Promise<SyncCheckoutResult> {
  // These fields are written together by Viralynz Checkout. Requiring every
  // independent ownership signal avoids cancelling an unrelated Stripe sub.
  if (
    input.checkout.client_reference_id !== input.userId
    || input.checkout.metadata?.userId !== input.userId
    || input.storedCustomerId !== input.customerId
  ) {
    return { ok: false, reason: 'orphan_subscription_ownership_unconfirmed' };
  }
  const ownershipFailure = subscriptionOwnershipFailure(subscription, input);
  if (ownershipFailure) return { ok: false, reason: ownershipFailure };

  try {
    if (subscription.status !== 'canceled') {
      await stripe.subscriptions.cancel(subscription.id);
    }
  } catch {
    return { ok: false, reason: 'orphan_subscription_cancellation_failed' };
  }

  console.warn('[stripe-sync] Souscription concurrente annulee apres attribution Lifetime.');
  return { ok: true };
}

async function updateUsersBySubscriptionId(
  subscriptionId: string,
  patch: Record<string, unknown>,
): Promise<SupabaseWriteError | null> {
  const result = await supabase
    .from('users')
    .update(patch)
    .eq('stripe_subscription_id', subscriptionId);

  if (!result.error || !('stripe_price_id' in patch) || !isMissingStripePriceIdColumn(result.error)) {
    return result.error;
  }

  const retryPatch = { ...patch };
  delete retryPatch.stripe_price_id;
  const retry = await supabase
    .from('users')
    .update(retryPatch)
    .eq('stripe_subscription_id', subscriptionId);

  return retry.error;
}

export async function syncUserFromPaidSubscriptionCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  opts: { expectedUserId?: string } = {}
): Promise<SyncCheckoutResult> {
  if (session.mode !== 'subscription') {
    return { ok: false, reason: 'not_subscription_mode' };
  }
  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'not_paid' };
  }

  const userId = session.metadata?.userId;
  const metaPlan = session.metadata?.plan;
  if (!userId || !['starter', 'creator', 'pro', 'scale'].includes(metaPlan ?? '')) {
    return { ok: false, reason: 'invalid_metadata' };
  }
  if (opts.expectedUserId && opts.expectedUserId !== userId) {
    return { ok: false, reason: 'user_mismatch' };
  }

  let subRef = session.subscription;
  let subId = typeof subRef === 'string' ? subRef : subRef?.id;

  if (!subId) {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, { expand: ['subscription'] });
    subRef = expanded.subscription;
    subId = typeof subRef === 'string' ? subRef : subRef?.id;
  }

  if (!subId) {
    return { ok: false, reason: 'missing_subscription_id' };
  }

  const sub = await stripe.subscriptions.retrieve(subId);
  const priceId = primaryPriceId(sub);
  if (!priceId) {
    return { ok: false, reason: 'missing_price_on_subscription' };
  }

  const planFromPrice = planFromStripePriceId(priceId);
  if (!planFromPrice) {
    return { ok: false, reason: 'price_not_mapped_to_env' };
  }
  if (normalizePlan(planFromPrice) !== normalizePlan(metaPlan)) {
    return { ok: false, reason: 'price_metadata_mismatch' };
  }

  const customerId =
    (typeof session.customer === 'string' ? session.customer : session.customer?.id) ??
    subscriptionCustomerId(sub);
  if (!customerId) {
    return { ok: false, reason: 'missing_customer_id' };
  }
  const subscriptionCustomer = subscriptionCustomerId(sub);
  if (subscriptionCustomer && subscriptionCustomer !== customerId) {
    return { ok: false, reason: 'subscription_customer_mismatch' };
  }
  if (session.client_reference_id && session.client_reference_id !== userId) {
    return { ok: false, reason: 'client_reference_mismatch' };
  }
  if (sub.metadata?.userId && sub.metadata.userId !== userId) {
    return { ok: false, reason: 'subscription_user_mismatch' };
  }

  const { data: currentUser, error: readErr } = await supabase
    .from('users')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single();

  if (readErr) {
    return { ok: false, reason: 'db_read_failed' };
  }
  if (currentUser?.stripe_customer_id && currentUser.stripe_customer_id !== customerId) {
    return { ok: false, reason: 'stored_customer_mismatch' };
  }

  if (hasStoredLifetimeAccess(currentUser)) {
    return cancelRecurringCheckoutAfterLifetime(stripe, sub, {
      customerId,
      userId,
      checkout: session,
      storedCustomerId: currentUser?.stripe_customer_id,
    });
  }

  const targetRank = PLAN_RANK[planFromPrice] ?? 0;
  const currentRank = PLAN_RANK[currentUser?.plan ?? 'free'] ?? 0;
  const sameSub = currentUser?.stripe_subscription_id === sub.id;

  if (!sameSub && currentRank > targetRank) {
    console.warn('[stripe-sync] Checkout obsolète ignoré.');
    return { ok: true };
  }

  const now = new Date().toISOString();
  const guardedWrite = await updateUserByIdUnlessLifetime(userId, {
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

  if (guardedWrite.error) {
    return { ok: false, reason: 'db_update_failed' };
  }
  if (!guardedWrite.updated) {
    const { data: latestUser, error: latestReadError } = await supabase
      .from('users')
      .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .single();
    if (latestReadError) return { ok: false, reason: 'db_race_read_failed' };
    if (hasStoredLifetimeAccess(latestUser)) {
      return cancelRecurringCheckoutAfterLifetime(stripe, sub, {
        customerId,
        userId,
        checkout: session,
        storedCustomerId: latestUser?.stripe_customer_id,
      });
    }
    return { ok: false, reason: 'db_update_conflict' };
  }

  console.log('[stripe-sync] Abonnement synchronisé depuis le checkout.', {
    plan: planFromPrice,
    status: sub.status,
  });
  return { ok: true };
}

async function stopOwnedSubscriptionForLifetime(
  stripe: Stripe,
  subscriptionId: string,
  input: {
    customerId: string;
    userId: string;
    checkoutSessionId: string;
    immediate: boolean;
  },
): Promise<SyncCheckoutResult> {
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return { ok: false, reason: 'previous_subscription_lookup_failed' };
  }

  const ownershipFailure = subscriptionOwnershipFailure(subscription, input);
  if (ownershipFailure) return { ok: false, reason: ownershipFailure };
  if (subscription.status === 'canceled') return { ok: true };

  try {
    if (input.immediate) {
      await stripe.subscriptions.cancel(subscription.id);
    } else {
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: {
          lifetime_checkout_session_id: input.checkoutSessionId,
          replaced_by_lifetime: 'true',
        },
      });
    }
  } catch {
    return { ok: false, reason: 'previous_subscription_cancellation_pending' };
  }

  return { ok: true };
}

export async function syncUserFromPaidLifetimeCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  opts: { restoreRevoked?: boolean } = {},
): Promise<SyncCheckoutResult> {
  if (session.mode !== 'payment') {
    return { ok: false, reason: 'not_payment_mode' };
  }
  if (!isLifetimeCheckoutPaymentStatusConfirmed(session.payment_status)) {
    return { ok: false, reason: 'not_paid' };
  }

  const userId = session.metadata?.userId;
  const metaPlan = session.metadata?.plan;
  if (!userId || (metaPlan !== 'lifetime' && metaPlan !== 'scale')) {
    return { ok: false, reason: 'invalid_lifetime_metadata' };
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id ?? null;
  if (!priceId) {
    return { ok: false, reason: 'missing_price_on_payment' };
  }

  const planFromPrice = planFromStripePriceId(priceId);
  if (planFromPrice !== 'lifetime') {
    return { ok: false, reason: 'price_not_mapped_to_lifetime' };
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) {
    return { ok: false, reason: 'missing_customer_id' };
  }
  if (session.client_reference_id !== userId) {
    return { ok: false, reason: 'client_reference_mismatch' };
  }

  const { data: currentUser, error: readErr } = await supabase
    .from('users')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single();

  if (readErr) {
    return { ok: false, reason: 'db_read_failed' };
  }
  if (currentUser?.stripe_customer_id && currentUser.stripe_customer_id !== customerId) {
    return { ok: false, reason: 'stored_customer_mismatch' };
  }

  let customer: Stripe.Customer | Stripe.DeletedCustomer;
  try {
    customer = await stripe.customers.retrieve(customerId);
  } catch {
    return { ok: false, reason: 'lifetime_customer_lookup_failed' };
  }
  if ('deleted' in customer && customer.deleted) {
    return { ok: false, reason: 'lifetime_customer_deleted' };
  }
  if (customer.metadata?.[STRIPE_CUSTOMER_OWNER_METADATA_KEY] !== userId) {
    return { ok: false, reason: 'lifetime_customer_owner_mismatch' };
  }

  const activeLifetimeCheckout = customer.metadata?.[LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY] ?? null;
  const revokedLifetimeCheckout = customer.metadata?.[REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY] ?? null;
  if (
    hasStoredLifetimeAccess(currentUser)
    && activeLifetimeCheckout
    && activeLifetimeCheckout !== session.id
  ) {
    console.warn('[stripe-sync] Ancien achat Lifetime ignore face a un achat plus recent.');
    return { ok: true };
  }
  if (revokedLifetimeCheckout === session.id && !opts.restoreRevoked) {
    console.warn('[stripe-sync] Achat Lifetime rembourse ou conteste non reaccorde.');
    return { ok: true };
  }

  try {
    await stripe.customers.update(customerId, {
      metadata: {
        [LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY]: session.id,
        ...(opts.restoreRevoked && revokedLifetimeCheckout === session.id
          ? { [REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY]: '' }
          : {}),
      },
    });
  } catch {
    return { ok: false, reason: 'lifetime_customer_marker_update_failed' };
  }

  const previousSubscriptionId = currentUser?.stripe_subscription_id ?? null;
  let previousSubscriptionStop: SyncCheckoutResult = { ok: true };

  if (previousSubscriptionId) {
    if (session.client_reference_id !== userId) {
      return { ok: false, reason: 'previous_subscription_ownership_unconfirmed' };
    }
    previousSubscriptionStop = await stopOwnedSubscriptionForLifetime(
      stripe,
      previousSubscriptionId,
      {
        customerId,
        userId,
        checkoutSessionId: session.id,
        // A retry where Lifetime is already stored means this subscription
        // lost a concurrent race and must stop immediately.
        immediate: hasStoredLifetimeAccess(currentUser),
      },
    );
  }

  const now = new Date().toISOString();
  const lifetimePatch: Record<string, unknown> = {
    plan: 'lifetime',
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    subscription_status: 'lifetime',
    subscription_current_period_end: null,
    subscription_cancel_at_period_end:
      Boolean(previousSubscriptionId) && previousSubscriptionStop.ok,
    analyses_count: 0,
    hooks_count: 0,
    reconstructions_count: 0,
    last_reset_at: now,
  };
  if (previousSubscriptionId) {
    // Keep the previous subscription addressable until Stripe confirms its
    // deletion. If the initial read saw no sub, omitting this field preserves
    // any subscription ID written by the concurrently winning webhook.
    lifetimePatch.stripe_subscription_id = previousSubscriptionId;
  }
  const upErr = await updateUserById(userId, lifetimePatch);

  if (upErr) {
    return { ok: false, reason: 'db_update_failed' };
  }

  if (!previousSubscriptionStop.ok) {
    // The entitlement is fulfilled because payment succeeded, but the webhook
    // must be retried until the old recurring subscription is safely closed.
    return previousSubscriptionStop;
  }

  if (!previousSubscriptionId) {
    const { data: latestUser, error: latestReadError } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single();
    if (latestReadError) return { ok: false, reason: 'db_race_read_failed' };

    const concurrentSubscriptionId = latestUser?.stripe_subscription_id ?? null;
    if (concurrentSubscriptionId) {
      if (
        session.client_reference_id !== userId
        || latestUser?.stripe_customer_id !== customerId
      ) {
        return { ok: false, reason: 'orphan_subscription_ownership_unconfirmed' };
      }
      const stopped = await stopOwnedSubscriptionForLifetime(
        stripe,
        concurrentSubscriptionId,
        {
          customerId,
          userId,
          checkoutSessionId: session.id,
          immediate: true,
        },
      );
      if (!stopped.ok) return stopped;
    }
  }

  console.log('[stripe-sync] Accès Lifetime synchronisé depuis le checkout.');
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
    return { ok: false, reason: 'user_not_found_for_subscription' };
  }

  const { data: currentUser, error: readErr } = await supabase
    .from('users')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single();

  if (readErr) {
    return { ok: false, reason: 'db_read_failed' };
  }
  if (!customerId) {
    return { ok: false, reason: 'subscription_customer_missing' };
  }
  if (currentUser?.stripe_customer_id && currentUser.stripe_customer_id !== customerId) {
    return { ok: false, reason: 'stored_customer_mismatch' };
  }

  if (hasStoredLifetimeAccess(currentUser)) {
    console.log('[stripe-sync] Accès Lifetime conservé face à un event d’abonnement inférieur.');
    return { ok: true };
  }

  const hasOpenDispute = sub.metadata?.viralynz_dispute_status === OPEN_DISPUTE_STATUS;
  const statusAllowsTierFromPrice = !hasOpenDispute && (
    sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
  );

  if (statusAllowsTierFromPrice && (!priceId || !planFromPrice)) {
    const quarantineError = await updateUserById(userId, {
      plan: 'free',
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      subscription_status: 'billing_configuration_error',
      subscription_current_period_end: periodEndIso,
      subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    });
    if (quarantineError) {
      return { ok: false, reason: 'billing_configuration_quarantine_failed' };
    }
    return { ok: false, reason: 'active_subscription_price_not_mapped' };
  }

  let nextPlan = statusAllowsTierFromPrice && planFromPrice
    ? planFromPrice
    : 'free';

  if (planFromPrice && statusAllowsTierFromPrice) {
    const curR = PLAN_RANK[currentUser?.plan ?? 'free'] ?? 0;
    const newR = PLAN_RANK[planFromPrice] ?? 0;
    if (newR < curR && currentUser?.stripe_subscription_id !== sub.id) {
      console.warn('[stripe-sync] Event d’abonnement inférieur obsolète ignoré.');
      return { ok: true };
    }
  }

  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    subscription_status: hasOpenDispute ? 'disputed' : sub.status,
    subscription_current_period_end: periodEndIso,
    subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    plan: nextPlan,
  };
  if (customerId) {
    patch.stripe_customer_id = customerId;
  }

  const upErr = await updateUserById(userId, patch);
  if (upErr) {
    return { ok: false, reason: 'db_update_failed' };
  }

  console.log('[stripe-sync] Abonnement synchronisé.', { status: sub.status });
  return { ok: true };
}

export async function suspendSubscriptionForDispute(
  sub: Stripe.Subscription,
): Promise<SyncCheckoutResult> {
  const customerId = subscriptionCustomerId(sub);
  if (!customerId) {
    return { ok: false, reason: 'subscription_customer_missing' };
  }

  let userId: string | null = sub.metadata?.userId ?? null;
  if (!userId) {
    const { data: row, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();
    if (lookupError) return { ok: false, reason: 'db_lookup_failed' };
    userId = row?.id ?? null;
  }
  if (!userId) {
    return { ok: false, reason: 'user_not_found_for_subscription' };
  }

  const { data: currentUser, error: readError } = await supabase
    .from('users')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', userId)
    .single();

  if (readError) return { ok: false, reason: 'db_read_failed' };
  if (currentUser?.stripe_customer_id && currentUser.stripe_customer_id !== customerId) {
    return { ok: false, reason: 'stored_customer_mismatch' };
  }
  if (currentUser?.stripe_subscription_id !== sub.id) {
    return { ok: false, reason: 'stored_subscription_mismatch' };
  }

  // Un achat Lifetime distinct reste valable même si une ancienne échéance
  // récurrente est contestée. La souscription Stripe sera tout de même fermée.
  if (hasStoredLifetimeAccess(currentUser)) {
    return { ok: true };
  }

  const updateError = await updateUserById(userId, {
    plan: 'free',
    stripe_customer_id: customerId,
    subscription_status: 'disputed',
    subscription_cancel_at_period_end: true,
  });
  if (updateError) return { ok: false, reason: 'db_update_failed' };

  console.warn('[stripe-sync] Accès récurrent suspendu pendant un litige.');
  return { ok: true };
}

export async function resetMonthlyCountersForSubscription(
  subscriptionId: string,
  billingPeriodStartIso: string,
): Promise<void> {
  const billingPeriodStart = Date.parse(billingPeriodStartIso);
  if (!Number.isFinite(billingPeriodStart)) {
    throw new Error('invalid_billing_period_start');
  }

  const { data: current, error: readError } = await supabase
    .from('users')
    .select('id, last_reset_at')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (readError) {
    console.error('[stripe-sync] Lecture du dernier reset échouée.', { code: readError.code });
    throw new Error('counter_reset_lookup_failed');
  }
  if (!current) return;

  const previousResetAt = Date.parse(current.last_reset_at ?? '');
  if (Number.isFinite(previousResetAt) && previousResetAt >= billingPeriodStart) {
    console.log('[stripe-sync] Facture ancienne ignorée pour les quotas.');
    return;
  }

  let update = supabase
    .from('users')
    .update({
      analyses_count: 0,
      hooks_count: 0,
      reconstructions_count: 0,
      last_reset_at: billingPeriodStartIso,
    })
    .eq('stripe_subscription_id', subscriptionId);

  update = current.last_reset_at
    ? update.eq('last_reset_at', current.last_reset_at)
    : update.is('last_reset_at', null);

  const { data: updated, error } = await update.select('id').maybeSingle();

  if (error) {
    console.error('[stripe-sync] Remise à zéro des quotas échouée.', { code: error.code });
    throw new Error('counter_reset_failed');
  }
  if (!updated) {
    console.log('[stripe-sync] Reset déjà traité par une livraison concurrente.');
    return;
  }
  console.log('[stripe-sync] Quotas mensuels remis à zéro.');
}

export async function revokeLifetimeAccessByCustomerId(
  customerId: string,
): Promise<LifetimeRevocationResult> {
  const { data: current, error: readError } = await supabase
    .from('users')
    .select('id, plan, subscription_status, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (readError) return { ok: false, reason: 'lifetime_customer_lookup_failed' };
  if (!current) return { ok: false, reason: 'lifetime_customer_not_found' };

  const subscriptionId = current.stripe_subscription_id ?? null;
  if (!hasStoredLifetimeAccess(current)) {
    return { ok: true, subscriptionId };
  }

  const updateError = await updateUserById(current.id, {
    plan: 'free',
    stripe_price_id: null,
    subscription_status: 'lifetime_revoked',
    subscription_current_period_end: null,
  });
  if (updateError) return { ok: false, reason: 'lifetime_revoke_failed' };

  console.warn('[stripe-sync] Accès Lifetime révoqué après remboursement ou litige.');
  return { ok: true, subscriptionId };
}

export async function setSubscriptionPaymentFailed(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('[stripe-sync] Statut de paiement en échec non synchronisé.', { code: error.code });
    throw new Error('payment_status_update_failed');
  }
  console.warn('[stripe-sync] Abonnement marqué en retard de paiement.');
}

export async function downgradeToFreeBySubscriptionId(subscriptionId: string): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from('users')
    .select('plan, subscription_status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (readError) {
    console.error('[stripe-sync] Lecture avant rétrogradation échouée.', { code: readError.code });
    throw new Error('downgrade_lookup_failed');
  }

  if (!current) {
    console.log('[stripe-sync] Suppression Stripe sans abonnement local actif.');
    return;
  }

  if (hasStoredLifetimeAccess(current)) {
    const cleanupError = await updateUsersBySubscriptionId(subscriptionId, {
      stripe_subscription_id: null,
      subscription_current_period_end: null,
      subscription_cancel_at_period_end: false,
    });
    if (cleanupError) {
      console.error('[stripe-sync] Nettoyage de l’ancienne souscription Lifetime échoué.', {
        code: cleanupError.code,
      });
      throw new Error('lifetime_subscription_cleanup_failed');
    }
    console.log('[stripe-sync] Accès Lifetime conservé, ancienne souscription nettoyée.');
    return;
  }

  const error = await updateUsersBySubscriptionId(subscriptionId, {
    plan: 'free',
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_status: 'canceled',
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
  });

  if (error) {
    console.error('[stripe-sync] Rétrogradation Free échouée.', { code: error.code });
    throw new Error('downgrade_update_failed');
  }

  console.log('[stripe-sync] Compte rétrogradé vers Free.');
}
