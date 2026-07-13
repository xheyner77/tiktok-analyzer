import Stripe from 'stripe';
import { spawnSync } from 'node:child_process';
import { loadLocalEnv } from './load-local-env.mjs';

loadLocalEnv();

const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
];

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey?.startsWith('sk_test_')) {
  throw new Error('Refus: cette commande exige exclusivement une cle Stripe sk_test_.');
}

const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000 });

if (process.argv.includes('--delete-test')) {
  if (!process.argv.includes('--apply-test')) {
    throw new Error('Refus: ajoute --apply-test pour autoriser la suppression TEST.');
  }
  const endpointId = process.env.STRIPE_WEBHOOK_ENDPOINT_ID;
  if (!endpointId?.startsWith('we_')) throw new Error('Webhook endpoint ID manquant.');
  const endpoint = await stripe.webhookEndpoints.retrieve(endpointId);
  if (
    endpoint.metadata?.app !== 'viralynz'
    || endpoint.metadata?.environment !== 'test'
    || endpoint.metadata?.purpose !== 'preview_stable'
    || !endpoint.url.endsWith('/api/webhook')
  ) {
    throw new Error('Refus: cet endpoint ne correspond pas au webhook Preview Viralynz.');
  }
  await stripe.webhookEndpoints.del(endpointId);
  process.exit(0);
}

if (!process.argv.includes('--apply-test')) {
  throw new Error('Refus: ajoute --apply-test pour autoriser la creation TEST.');
}
if (!process.argv.includes('--configure-vercel-preview')) {
  throw new Error('Refus: ajoute --configure-vercel-preview pour stocker le secret sans l afficher.');
}

const url = process.env.VIRALYNZ_WEBHOOK_URL;
if (!url?.startsWith('https://') || !url.endsWith('/api/webhook')) {
  throw new Error('URL HTTPS /api/webhook invalide.');
}

const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
if (endpoints.data.some((endpoint) => endpoint.url === url && endpoint.status === 'enabled')) {
  throw new Error('stable_test_webhook_already_exists_without_retrievable_secret');
}

const endpoint = await stripe.webhookEndpoints.create({
  url,
  enabled_events: EVENTS,
  description: 'Viralynz Preview stable — TEST only',
  metadata: {
    app: 'viralynz',
    environment: 'test',
    purpose: 'preview_stable',
  },
});

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const vercelResult = spawnSync(
  npxCommand,
  [
    'vercel',
    'env',
    'add',
    'STRIPE_TEST_WEBHOOK_SECRET',
    'preview',
    '--force',
    '--yes',
    '--sensitive',
  ],
  {
    input: endpoint.secret,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  },
);

if (vercelResult.status !== 0) {
  await stripe.webhookEndpoints.del(endpoint.id);
  throw new Error('Stockage Vercel du secret impossible; endpoint TEST annule.');
}

process.stdout.write(JSON.stringify({
  id: endpoint.id,
  url: endpoint.url,
  events: endpoint.enabled_events.length,
  secretStoredIn: 'Vercel Preview',
}));
