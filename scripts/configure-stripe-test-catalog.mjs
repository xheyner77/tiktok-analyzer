import Stripe from 'stripe';
import { loadLocalEnv } from './load-local-env.mjs';

const APPLY_FLAG = '--apply-test';

function assertTestMode(secret) {
  if (!secret?.startsWith('sk_test_')) {
    throw new Error('Refus: cette commande exige exclusivement une cle Stripe sk_test_.');
  }
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(`Refus: relance avec ${APPLY_FLAG} pour autoriser les mutations TEST.`);
  }
}

function metadataFor(plan) {
  return {
    app: 'viralynz',
    viralynz_plan: plan,
    environment: 'test',
  };
}

async function ensureProduct(stripe, input) {
  if (input.existingId) {
    const product = await stripe.products.retrieve(input.existingId);
    if ('deleted' in product && product.deleted) {
      throw new Error(`Produit test supprime: ${input.existingId}`);
    }
    return stripe.products.update(product.id, {
      active: true,
      name: input.name,
      description: input.description,
      metadata: metadataFor(input.plan),
    });
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((product) => (
    product.metadata?.app === 'viralynz'
    && product.metadata?.viralynz_plan === input.plan
    && product.metadata?.environment === 'test'
  ));
  if (existing) {
    return stripe.products.update(existing.id, {
      active: true,
      name: input.name,
      description: input.description,
      metadata: metadataFor(input.plan),
    });
  }

  return stripe.products.create({
    active: true,
    name: input.name,
    description: input.description,
    metadata: metadataFor(input.plan),
  });
}

async function ensurePrice(stripe, input) {
  const prices = await stripe.prices.list({
    product: input.productId,
    active: true,
    limit: 100,
  });
  const existing = prices.data.find((price) => (
    price.currency === 'eur'
    && price.unit_amount === input.unitAmount
    && (input.recurring
      ? price.type === 'recurring' && price.recurring?.interval === 'month'
      : price.type === 'one_time')
    && price.metadata?.viralynz_plan === input.plan
    && price.metadata?.environment === 'test'
  ));

  if (existing) return existing;

  return stripe.prices.create({
    active: true,
    product: input.productId,
    currency: 'eur',
    unit_amount: input.unitAmount,
    recurring: input.recurring ? { interval: 'month' } : undefined,
    nickname: input.nickname,
    metadata: metadataFor(input.plan),
  });
}

async function ensurePortalConfiguration(stripe, input) {
  const configurations = await stripe.billingPortal.configurations.list({ limit: 100 });
  const existing = configurations.data.find((configuration) => (
    configuration.metadata?.app === 'viralynz'
    && configuration.metadata?.environment === 'test'
  ));
  const params = {
    name: 'Viralynz — Portail client TEST',
    default_return_url: 'https://www.viralynz.com/dashboard/billing',
    business_profile: {
      headline: 'Gère ton abonnement Viralynz.',
      privacy_policy_url: 'https://www.viralynz.com/legal/confidentialite',
      terms_of_service_url: 'https://www.viralynz.com/legal/cgv',
    },
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['missing_features', 'too_expensive', 'unused', 'other'],
        },
      },
      // Starter -> Pro uniquement. Le portail confirme le prorata et prend en
      // charge les moyens de paiement/3DS sans exposer les anciens Prices.
      subscription_update: {
        enabled: true,
        billing_cycle_anchor: 'unchanged',
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: [{
          product: input.proProductId,
          prices: [input.proPriceId],
        }],
      },
    },
    metadata: {
      app: 'viralynz',
      environment: 'test',
      allowed_upgrade_plan: 'pro',
      allowed_upgrade_price_id: input.proPriceId,
    },
  };

  if (existing) {
    return stripe.billingPortal.configurations.update(existing.id, { ...params, active: true });
  }
  return stripe.billingPortal.configurations.create(params);
}

async function main() {
  loadLocalEnv();
  const secret = process.env.STRIPE_SECRET_KEY;
  assertTestMode(secret);

  const stripe = new Stripe(secret, {
    maxNetworkRetries: 2,
    timeout: 20_000,
  });

  const starterProduct = await ensureProduct(stripe, {
    existingId: 'prod_UVyiRAFEKPR8yE',
    plan: 'starter',
    name: 'Viralynz — Starter (TEST)',
    description: '30 analyses et 50 hooks par mois.',
  });
  const proProduct = await ensureProduct(stripe, {
    existingId: 'prod_UVyiEr2kj9jeLY',
    plan: 'pro',
    name: 'Viralynz — Pro (TEST)',
    description: '150 analyses, 250 hooks et 30 reconstructions par mois.',
  });
  const lifetimeProduct = await ensureProduct(stripe, {
    plan: 'lifetime',
    name: 'Viralynz — Lifetime (TEST)',
    description: 'Acces Lifetime en paiement unique.',
  });

  const starterPrice = await ensurePrice(stripe, {
    productId: starterProduct.id,
    plan: 'starter',
    unitAmount: 1_000,
    recurring: true,
    nickname: 'Viralynz Starter — 10 EUR/mois — TEST',
  });
  const proPrice = await ensurePrice(stripe, {
    productId: proProduct.id,
    plan: 'pro',
    unitAmount: 2_900,
    recurring: true,
    nickname: 'Viralynz Pro — 29 EUR/mois — TEST',
  });
  const lifetimePrice = await ensurePrice(stripe, {
    productId: lifetimeProduct.id,
    plan: 'lifetime',
    unitAmount: 14_900,
    recurring: false,
    nickname: 'Viralynz Lifetime — 149 EUR — TEST',
  });
  const portalConfiguration = await ensurePortalConfiguration(stripe, {
    proProductId: proProduct.id,
    proPriceId: proPrice.id,
  });

  console.log(JSON.stringify({
    mode: 'test',
    starterProductId: starterProduct.id,
    starterPriceId: starterPrice.id,
    proProductId: proProduct.id,
    proPriceId: proPrice.id,
    lifetimeProductId: lifetimeProduct.id,
    lifetimePriceId: lifetimePrice.id,
    portalConfigurationId: portalConfiguration.id,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'unknown_error',
  }));
  process.exitCode = 1;
});
