/**
 * Écritures abonnement / plan payant (starter, pro, lifetime) sur `public.users`.
 * `creator` et `scale` restent acceptés uniquement comme valeurs legacy Stripe.
 * **uniquement** depuis `app/api/webhook/route.ts` (événements Stripe signés).
 * Ne pas appeler ces fonctions depuis une route « success », le client ou des query params.
 */
import type Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { PLAN_RANK, planFromStripePriceId } from '@/lib/stripe-billing';
import { isLifetimePlan, normalizePlan } from '@/lib/plans';

/** Fin de période de facturation (Stripe API récente : sur l’item d’abonnement). */
export function subscriptionCurrentPeriodEndIso(sub: Stripe.Subscription): string {
  const endSec =
    sub.items.data[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    Math.floor(Date.now() / 1000);
  return new Date(endSec * 1000).toISOString();
}

/** ID abonnement depuis une facture (API 2025+ : sous `parent.subscription_details`). */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const p = invoice.parent;
  if (p?.type === 'subscription_details' && p.subscription_details?.subscription) {
    const s = p.subscription_details.subscription;
    return typeof s === 'string' ? s : s.id;
  }
  const legacy = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id;
  return null;
}

function subscriptionCustomerId(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && 'id' in c && !('deleted' in c && (c as { deleted?: boolean }).deleted)) {
    return (c as Stripe.Customer).id;
  }
  return null;
}

function primaryPriceId(sub: Stripe.Subscription): string | null {
  return sub.items.data[0]?.price?.id ?? null;
}

function hasStoredLifetimeAccess(user: { plan?: string | null; subscription_status?: string | null } | null | undefined): boolean {
  return isLifetimePlan(user?.plan) || user?.subscription_status === 'lifetime';
}

export type SyncCheckoutResult =
  | { ok: true }
  | { ok: false; reason: string; log?: string };

function isMissingStripePriceIdColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = error?.message ?? '';
  return error?.code === 'PGRST204' || error?.code === '42703' || /stripe_price_id/i.test(message);
}

async function updateUserByIdWithStripePriceFallback(
  userId: string,
  patch: Record<string, unknown>
): Promise<{ message: string } | null> {
  const { error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId);

  if (!error || !('stripe_price_id' in patch) || !isMissingStripePriceIdColumn(error)) {
    return error;
  }

  const legacyPatch = { ...patch };
  delete legacyPatch.stripe_price_id;

  const { error: retryError } = await supabase
    .from('users')
    .update(legacyPatch)
    .eq('id', userId);

  if (!retryError) {
    console.warn('[stripe-sync] stripe_price_id column missing; user sync retried without it', { userId });
  }

  return retryError;
}

/**
 * Après Checkout Session (mode subscription) payée — source de vérité partagée webhook + /api/upgrade-plan.
 */
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
  if (!userId || (metaPlan !== 'starter' && metaPlan !== 'creator' && metaPlan !== 'pro' && metaPlan !== 'lifetime' && metaPlan !== 'scale')) {
    return { ok: false, reason: 'invalid_metadata', log: session.id };
  }
  if (opts.expectedUserId && opts.expectedUserId !== userId) {
    return { ok: false, reason: 'user_mismatch', log: session.id };
  }

  let subRef = session.subscription;
  let subId = typeof subRef === 'string' ? subRef : subRef?.id;

  if (!subId && session.mode === 'subscription') {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['subscription'],
    });
    subRef = expanded.subscription;
    subId = typeof subRef === 'string' ? subRef : subRef?.id;
    console.log('[stripe-sync] Session récupérée avec expand subscription', {
      sessionId: session.id,
      subscriptionId: subId ?? '(toujours absent)',
    });
  }

  if (!subId) {
    console.error('[stripe-sync] Aucun sub_ sur checkout session', session.id, 'mode=', session.mode);
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
    return {
      ok: false,
      reason: 'price_metadata_mismatch',
      log: `price→${planFromPrice} metadata→${metaPlan}`,
    };
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
    console.warn(
      '[stripe-sync] Skip stale checkout (would downgrade):',
      userId,
      'current',
      currentUser?.plan,
      'target',
      planFromPrice
    );
    return { ok: true };
  }

  const now = new Date().toISOString();
  const periodEndIso = subscriptionCurrentPeriodEndIso(sub);

  const upErr = await updateUserByIdWithStripePriceFallback(
    userId,
    {
      plan: planFromPrice,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      subscription_status: sub.status,
      subscription_current_period_end: periodEndIso,
      subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
      analyses_count: 0,
      hooks_count: 0,
      reconstructions_count: 0,
      last_reset_at: now,
    }
  );

  if (upErr) {
    return { ok: false, reason: 'db_update_failed', log: upErr.message };
  }

  const priceObj = sub.items.data[0]?.price;
  console.log('[stripe-sync] Abonnement Stripe enregistré (checkout.session.completed)', {
    userId,
    plan: planFromPrice,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    subscription_status: sub.status,
    price_id: priceId,
    recurring_interval: priceObj?.recurring?.interval ?? null,
    session_id: session.id,
  });
  return { ok: true };
}

/**
 * Après Checkout Session `mode: payment` payée — attribue l'accès Lifetime.
 * Lifetime est stocké comme `lifetime`; `scale` reste seulement accepté en metadata legacy.
 */
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
  const upErr = await updateUserByIdWithStripePriceFallback(
    userId,
    {
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
    }
  );

  if (upErr) {
    return { ok: false, reason: 'db_update_failed', log: upErr.message };
  }

  console.log('[stripe-sync] Lifetime Stripe enregistré (checkout.session.completed)', {
    userId,
    plan: 'lifetime',
    stripe_customer_id: customerId,
    price_id: priceId,
    session_id: session.id,
  });
  return { ok: true };
}

/**
 * Met à jour la ligne users depuis un objet Subscription Stripe (webhooks updated / reconcile).
 */
export async function syncUserRowFromStripeSubscription(sub: Stripe.Subscription): Promise<SyncCheckoutResult> {
  const priceId = primaryPriceId(sub);
  const planFromPrice = priceId ? planFromStripePriceId(priceId) : null;
  const customerId = subscriptionCustomerId(sub);
  const periodEndIso = subscriptionCurrentPeriodEndIso(sub);

  const metaUserId = sub.metadata?.userId;

  let userId: string | null = metaUserId ?? null;
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
      console.warn(
        '[stripe-sync] Skip stale lower-tier subscription (would overwrite higher plan):',
        userId,
        'current',
        currentUser?.plan,
        currentUser?.stripe_subscription_id,
        'incoming',
        planFromPrice,
        sub.id
      );
      return { ok: true };
    }
    if (newR >= curR || currentUser?.stripe_subscription_id === sub.id) {
      nextPlan = planFromPrice;
    }
  }

  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_current_period_end: periodEndIso,
    subscription_cancel_at_period_end: sub.cancel_at_period_end ?? false,
    plan: nextPlan,
  };
  if (priceId) {
    patch.stripe_price_id = priceId;
  }
  if (customerId) {
    patch.stripe_customer_id = customerId;
  }

  const upErr = await updateUserByIdWithStripePriceFallback(userId, patch);
  if (upErr) {
    return { ok: false, reason: 'db_update_failed', log: upErr.message };
  }

  console.log('[stripe-sync] Subscription synced → user', userId, 'sub', sub.id, 'status', sub.status);
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
  console.log('[stripe-sync] Monthly counters reset (renewal) for sub', subscriptionId);
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
  console.warn('[stripe-sync] subscription marked past_due (invoice failed):', {
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

  const { data: affected, error } = await supabase
    .from('users')
    .update({
      plan: 'free',
      stripe_subscription_id: null,
      subscription_status: 'canceled',
      subscription_current_period_end: null,
      subscription_cancel_at_period_end: false,
    })
    .eq('stripe_subscription_id', subscriptionId)
    .select('id, email');

  if (error) {
    console.error('[stripe-sync] downgrade to free failed:', subscriptionId, error.message);
    throw new Error(error.message);
  }
  console.log('[stripe-sync] User downgraded to free (subscription deleted):', {
    subscriptionId,
    userId: affected?.[0]?.id ?? '(not found)',
  });
}
