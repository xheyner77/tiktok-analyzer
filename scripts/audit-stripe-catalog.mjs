import Stripe from 'stripe';
import { loadLocalEnv } from './load-local-env.mjs';

loadLocalEnv();

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey || (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_'))) {
  throw new Error('Cle Stripe absente ou mode inconnu.');
}

const mode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000 });

const [products, prices, webhooks, portalConfigurations] = await Promise.all([
  stripe.products.list({ limit: 100 }),
  stripe.prices.list({ limit: 100 }),
  stripe.webhookEndpoints.list({ limit: 100 }),
  stripe.billingPortal.configurations.list({ limit: 100 }),
]);

const viralynzProducts = products.data.filter((product) => (
  /viralynz/i.test(product.name)
  || product.metadata?.app === 'viralynz'
));
const productIds = new Set(viralynzProducts.map((product) => product.id));

const result = {
  mode,
  products: viralynzProducts.map((product) => ({
    id: product.id,
    name: product.name,
    active: product.active,
    metadata: product.metadata,
  })),
  prices: prices.data
    .filter((price) => typeof price.product === 'string' && productIds.has(price.product))
    .map((price) => ({
      id: price.id,
      productId: price.product,
      active: price.active,
      currency: price.currency,
      unitAmount: price.unit_amount,
      type: price.type,
      interval: price.recurring?.interval ?? null,
      metadata: price.metadata,
    })),
  webhooks: webhooks.data.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    status: endpoint.status,
    enabledEvents: endpoint.enabled_events,
    metadata: endpoint.metadata,
  })),
  portalConfigurations: portalConfigurations.data.map((configuration) => ({
    id: configuration.id,
    active: configuration.active,
    isDefault: configuration.is_default,
    name: configuration.name,
    defaultReturnUrl: configuration.default_return_url,
    features: configuration.features,
    metadata: configuration.metadata,
  })),
};

console.log(JSON.stringify(result, null, 2));
