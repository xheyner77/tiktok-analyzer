import type Stripe from 'stripe';
import { planFromStripePriceId, type PaidStripePlan } from '@/lib/stripe-billing';
import {
  LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY,
  REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY,
  STRIPE_CUSTOMER_OWNER_METADATA_KEY,
} from '@/lib/stripe-customer-metadata';
import { isLifetimeCheckoutPaymentStatusConfirmed } from '@/lib/stripe-payment-status';

const SAFE_USER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CHECKOUT_SETTLEMENT_GRACE_SECONDS = 24 * 60 * 60;
const BLOCKING_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
]);

export class StripeCheckoutSafetyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StripeCheckoutSafetyError';
  }
}

type StableCustomerInput = {
  userId: string;
  email: string;
  persistedCustomerId: string | null;
  persistedSubscriptionId: string | null;
};

export type StripeCheckoutState = {
  subscriptions: Stripe.Subscription[];
  openSessions: Stripe.Checkout.Session[];
  checkoutGeneration: string;
};

function fail(code: string): never {
  throw new StripeCheckoutSafetyError(code);
}

function customerIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer;
  if (typeof customer === 'string') return customer;
  if (customer && typeof customer === 'object' && 'id' in customer) return customer.id;
  return null;
}

function customerIdFromCheckout(checkout: Stripe.Checkout.Session): string | null {
  const customer = checkout.customer;
  if (typeof customer === 'string') return customer;
  if (customer && typeof customer === 'object' && 'id' in customer) return customer.id;
  return null;
}

function normalizedEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export async function ensureStripeCustomerOwnership(
  stripe: Stripe,
  input: {
    customerId: string;
    userId: string;
    email: string;
  },
): Promise<string> {
  const retrieved = await stripe.customers.retrieve(input.customerId);
  if ('deleted' in retrieved && retrieved.deleted) {
    fail('stripe_customer_deleted');
  }

  const customer = retrieved as Stripe.Customer;
  const canonicalOwner = customer.metadata?.[STRIPE_CUSTOMER_OWNER_METADATA_KEY] || null;
  const legacyOwner = customer.metadata?.userId || null;
  if (
    (canonicalOwner && canonicalOwner !== input.userId)
    || (legacyOwner && legacyOwner !== input.userId)
  ) {
    fail('stripe_customer_owner_mismatch');
  }

  const hasDeclaredOwner = Boolean(canonicalOwner || legacyOwner);
  const stripeEmail = normalizedEmail(customer.email);
  const sessionEmail = normalizedEmail(input.email);
  if (
    !hasDeclaredOwner
    && (!stripeEmail || !sessionEmail || stripeEmail !== sessionEmail)
  ) {
    fail('stripe_customer_legacy_email_mismatch');
  }

  const needsOwnerMetadata = canonicalOwner !== input.userId;
  const needsEmail = !customer.email && Boolean(input.email);
  if (needsOwnerMetadata || needsEmail) {
    await stripe.customers.update(customer.id, {
      ...(needsEmail ? { email: input.email } : {}),
      ...(needsOwnerMetadata
        ? { metadata: { [STRIPE_CUSTOMER_OWNER_METADATA_KEY]: input.userId } }
        : {}),
    });
  }

  return customer.id;
}

async function persistCustomerIdForUser(userId: string, customerId: string): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const { data: claimed, error: claimError } = await supabase
    .from('users')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId)
    .is('stripe_customer_id', null)
    .select('stripe_customer_id')
    .maybeSingle();

  if (claimError) {
    fail('stripe_customer_persistence_failed');
  }
  if (claimed?.stripe_customer_id === customerId) return;

  const { data: current, error: readError } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (readError || !current?.stripe_customer_id) {
    fail('stripe_customer_persistence_unconfirmed');
  }
  if (current.stripe_customer_id !== customerId) {
    fail('stripe_customer_persistence_conflict');
  }
}

/**
 * Resolves exactly one Stripe Customer for an app user before Checkout.
 * The create call is idempotent for the lifetime of the Stripe idempotency key,
 * and the database claim never writes outside the authenticated user row.
 */
export async function ensureStableStripeCustomer(
  stripe: Stripe,
  input: StableCustomerInput,
): Promise<string> {
  if (!SAFE_USER_ID.test(input.userId)) {
    fail('invalid_customer_owner_id');
  }

  if (input.persistedCustomerId) {
    return ensureStripeCustomerOwnership(stripe, {
      customerId: input.persistedCustomerId,
      userId: input.userId,
      email: input.email,
    });
  }

  let candidateCustomerId: string | null = null;

  if (input.persistedSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(input.persistedSubscriptionId);
    const subscriptionOwner = subscription.metadata?.userId ?? null;
    if (subscriptionOwner && subscriptionOwner !== input.userId) {
      fail('stripe_subscription_owner_mismatch');
    }
    candidateCustomerId = customerIdFromSubscription(subscription);
    if (!candidateCustomerId) fail('stripe_subscription_customer_missing');
  }

  if (!candidateCustomerId) {
    const existing = await stripe.customers.search({
      query: `metadata['${STRIPE_CUSTOMER_OWNER_METADATA_KEY}']:'${input.userId}'`,
      limit: 10,
    });
    if (existing.data.length > 1) {
      fail('multiple_stripe_customers_for_user');
    }
    candidateCustomerId = existing.data[0]?.id ?? null;
  }

  if (!candidateCustomerId) {
    const created = await stripe.customers.create(
      {
        metadata: { [STRIPE_CUSTOMER_OWNER_METADATA_KEY]: input.userId },
      },
      {
        idempotencyKey: `viralynz-customer:${input.userId}`,
      },
    );
    candidateCustomerId = created.id;
  }

  const customerId = await ensureStripeCustomerOwnership(stripe, {
    customerId: candidateCustomerId,
    userId: input.userId,
    email: input.email,
  });
  await persistCustomerIdForUser(input.userId, customerId);
  return customerId;
}

export function assertStripeSubscriptionOwnership(
  subscription: Stripe.Subscription,
  input: { customerId: string; userId: string },
): void {
  if (customerIdFromSubscription(subscription) !== input.customerId) {
    fail('stripe_subscription_customer_mismatch');
  }
  const canonicalOwner = subscription.metadata?.[STRIPE_CUSTOMER_OWNER_METADATA_KEY] || null;
  const legacyOwner = subscription.metadata?.userId || null;
  if (
    (canonicalOwner && canonicalOwner !== input.userId)
    || (legacyOwner && legacyOwner !== input.userId)
  ) {
    fail('stripe_subscription_owner_mismatch');
  }
}

export function subscriptionBlocksNewCheckout(subscription: Stripe.Subscription): boolean {
  return BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status);
}

/** Reads Stripe's current state instead of relying on a possibly delayed webhook write. */
export async function inspectStripeCheckoutState(
  stripe: Stripe,
  input: {
    customerId: string;
    userId: string;
    persistedSubscriptionId: string | null;
  },
): Promise<StripeCheckoutState> {
  const [subscriptionPage, sessionPage, latestSessionPage, customerResult] = await Promise.all([
    stripe.subscriptions.list({ customer: input.customerId, status: 'all', limit: 100 }),
    stripe.checkout.sessions.list({ customer: input.customerId, status: 'open', limit: 100 }),
    // The newest Session is a stable generation marker. All concurrent plan
    // requests that observed the same billing state will therefore share one
    // Stripe idempotency key, including subscription <-> Lifetime races.
    stripe.checkout.sessions.list({ customer: input.customerId, limit: 1 }),
    stripe.customers.retrieve(input.customerId),
  ]);

  if (subscriptionPage.has_more || sessionPage.has_more) {
    fail('stripe_billing_state_requires_manual_review');
  }
  if ('deleted' in customerResult && customerResult.deleted) {
    fail('stripe_customer_deleted');
  }

  const subscriptions = subscriptionPage.data.filter(subscriptionBlocksNewCheckout);
  for (const subscription of subscriptions) {
    assertStripeSubscriptionOwnership(subscription, input);
  }
  if (
    input.persistedSubscriptionId
    && !subscriptionPage.data.some((subscription) => subscription.id === input.persistedSubscriptionId)
  ) {
    const persistedSubscription = await stripe.subscriptions.retrieve(input.persistedSubscriptionId);
    if (subscriptionBlocksNewCheckout(persistedSubscription)) {
      assertStripeSubscriptionOwnership(persistedSubscription, input);
      subscriptions.push(persistedSubscription);
    }
  }

  const uniqueSubscriptions = [...new Map(
    subscriptions.map((subscription) => [subscription.id, subscription]),
  ).values()];

  const newestSession = latestSessionPage.data[0] ?? null;
  const sessionsToInspect = new Map(
    sessionPage.data.map((checkout) => [checkout.id, checkout]),
  );
  const customer = customerResult as Stripe.Customer;
  const activeLifetimeCheckoutId =
    customer.metadata?.[LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY] ?? null;
  const revokedLifetimeCheckoutId =
    customer.metadata?.[REVOKED_LIFETIME_CHECKOUT_CUSTOMER_METADATA_KEY] ?? null;

  // A successful one-time payment must remain a hard lock even if its webhook
  // has been failing for more than the short settlement grace period. The
  // explicit refund/dispute marker is the only automatic unlock.
  const newestSessionIsUnrevokedPaidOneTime = Boolean(
    newestSession
    && newestSession.status === 'complete'
    && newestSession.mode === 'payment'
    && isLifetimeCheckoutPaymentStatusConfirmed(newestSession.payment_status)
    && revokedLifetimeCheckoutId !== newestSession.id,
  );
  // Close the mixed-snapshot gap between the `open` and `latest` Stripe reads:
  // if another instance created a Session between them, either read is enough
  // to make it block this request instead of advancing the generation.
  const newestSessionIsSettling = Boolean(
    newestSession
    && newestSession.status === 'complete'
    && revokedLifetimeCheckoutId !== newestSession.id
    && Number.isFinite(newestSession.created)
    && newestSession.created >= Math.floor(Date.now() / 1000) - CHECKOUT_SETTLEMENT_GRACE_SECONDS,
  );
  if (
    newestSession?.status === 'open'
    || newestSessionIsSettling
    || newestSessionIsUnrevokedPaidOneTime
  ) {
    sessionsToInspect.set(newestSession.id, newestSession);
  }

  if (
    activeLifetimeCheckoutId
    && activeLifetimeCheckoutId !== revokedLifetimeCheckoutId
  ) {
    let activeLifetimeCheckout = newestSession?.id === activeLifetimeCheckoutId
      ? newestSession
      : null;
    if (!activeLifetimeCheckout) {
      try {
        activeLifetimeCheckout = await stripe.checkout.sessions.retrieve(activeLifetimeCheckoutId);
      } catch {
        fail('stripe_lifetime_checkout_requires_manual_review');
      }
    }
    if (customerIdFromCheckout(activeLifetimeCheckout) !== input.customerId) {
      fail('checkout_session_customer_mismatch');
    }
    sessionsToInspect.set(activeLifetimeCheckout.id, activeLifetimeCheckout);
  }

  const openSessions: Stripe.Checkout.Session[] = [];
  for (const checkout of sessionsToInspect.values()) {
    const metadataOwner = checkout.metadata?.userId ?? null;
    const referenceOwner = checkout.client_reference_id ?? null;
    if (metadataOwner && metadataOwner !== input.userId) {
      fail('checkout_session_owner_mismatch');
    }
    if (referenceOwner && referenceOwner !== input.userId) {
      fail('checkout_session_reference_mismatch');
    }
    // The Stripe Customer itself has already been ownership-validated. Legacy
    // Checkout Sessions may have neither metadata nor client_reference_id and
    // must still block a concurrent payment for this same Customer.
    openSessions.push(checkout);
  }

  return {
    subscriptions: uniqueSubscriptions,
    openSessions,
    checkoutGeneration: newestSession?.id ?? 'initial',
  };
}

export function resolveOpenCheckout(
  openSessions: Stripe.Checkout.Session[],
  targetPlan: PaidStripePlan,
): { reusable: Stripe.Checkout.Session | null; conflictingCheckout: boolean } {
  const expectedMode = targetPlan === 'lifetime' ? 'payment' : 'subscription';
  const exactMatches = openSessions.filter((checkout) => (
    checkout.status !== 'complete'
    && checkout.mode === expectedMode
    && checkout.metadata?.plan === targetPlan
    && Boolean(checkout.url)
  ));
  const reusable = openSessions.length === 1 && exactMatches.length === 1
    ? exactMatches[0]
    : null;

  return {
    reusable,
    // A different plan/mode, an untagged legacy Session, or multiple open
    // Sessions are all ambiguous. Never create another payment in that state.
    conflictingCheckout: openSessions.length > 0 && !reusable,
  };
}

export async function createProUpgradePortalSession(
  stripe: Stripe,
  input: {
    configurationId: string;
    customerId: string;
    userId: string;
    subscription: Stripe.Subscription;
    targetPriceId: string;
    returnUrl: string;
    liveMode: boolean;
  },
): Promise<string> {
  assertStripeSubscriptionOwnership(input.subscription, input);
  if (input.subscription.status !== 'active' && input.subscription.status !== 'trialing') {
    fail('portal_subscription_not_upgradeable');
  }

  const items = input.subscription.items.data;
  if (items.length !== 1 || (items[0]?.quantity ?? 1) !== 1) {
    fail('portal_subscription_items_unsupported');
  }
  const item = items[0];
  if (!item || planFromStripePriceId(item.price.id) !== 'starter') {
    fail('portal_upgrade_source_not_starter');
  }

  const configuration = await stripe.billingPortal.configurations.retrieve(input.configurationId);
  const expectedEnvironment = input.liveMode ? 'production' : 'test';
  const updateFeature = configuration.features.subscription_update;

  if (
    !configuration.active
    || configuration.livemode !== input.liveMode
    || configuration.metadata?.app !== 'viralynz'
    || configuration.metadata?.environment !== expectedEnvironment
    || configuration.metadata?.allowed_upgrade_plan !== 'pro'
    || configuration.metadata?.allowed_upgrade_price_id !== input.targetPriceId
    || !updateFeature.enabled
    || !updateFeature.default_allowed_updates.includes('price')
    || updateFeature.proration_behavior !== 'always_invoice'
  ) {
    fail('portal_upgrade_configuration_invalid');
  }

  let portalSession: Stripe.BillingPortal.Session;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      configuration: input.configurationId,
      locale: 'fr',
      return_url: input.returnUrl,
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: input.subscription.id,
          items: [{
            id: item.id,
            price: input.targetPriceId,
            quantity: 1,
          }],
        },
        after_completion: {
          type: 'redirect',
          redirect: { return_url: input.returnUrl },
        },
      },
    });
  } catch {
    // Stripe is the final authority for the Portal product/Price allowlist.
    // Its configuration response does not expose that list, so a rejected
    // deep-link is treated as a safe configuration failure (HTTP 503 upstream).
    fail('portal_upgrade_configuration_rejected');
  }

  if (!portalSession.url) fail('portal_upgrade_url_missing');
  return portalSession.url;
}
