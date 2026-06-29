import Stripe from 'stripe';

type MigrationRow = {
  status: 'migrated' | 'skipped' | 'error';
  customerEmail: string;
  customerId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  oldPriceId: string;
  newPriceId: string;
  message: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} manquant.`);
  return value;
}

async function customerEmail(stripe: Stripe, customerId: string): Promise<string> {
  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) return '(customer supprime)';
  return customer.email ?? '(email absent)';
}

async function verifySubscriptionPrice(
  stripe: Stripe,
  subscriptionId: string,
  subscriptionItemId: string,
  expectedPriceId: string,
): Promise<boolean> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription.items.data.some((item) => (
    item.id === subscriptionItemId &&
    item.price.id === expectedPriceId
  ));
}

async function main() {
  const secretKey = requiredEnv('STRIPE_SECRET_KEY');
  const legacyPriceId = requiredEnv('STRIPE_LEGACY_PRO_PRICE_ID');
  const proPriceId = requiredEnv('STRIPE_PRO_PRICE_ID');
  const confirmed = process.env.CONFIRM_STRIPE_MIGRATION === 'true';

  if (legacyPriceId === proPriceId) {
    throw new Error('STRIPE_LEGACY_PRO_PRICE_ID et STRIPE_PRO_PRICE_ID sont identiques.');
  }

  const stripe = new Stripe(secretKey);
  const rows: MigrationRow[] = [];

  for await (const subscription of stripe.subscriptions.list({
    status: 'active',
    price: legacyPriceId,
    expand: ['data.customer'],
  })) {
    const item = subscription.items.data.find((candidate) => candidate.price.id === legacyPriceId);
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;
    const email = typeof subscription.customer === 'string'
      ? await customerEmail(stripe, subscription.customer)
      : ('deleted' in subscription.customer && subscription.customer.deleted)
        ? '(customer supprime)'
        : subscription.customer.email ?? '(email absent)';

    if (!item) {
      rows.push({
        status: 'skipped',
        customerEmail: email,
        customerId,
        subscriptionId: subscription.id,
        subscriptionItemId: '(introuvable)',
        oldPriceId: legacyPriceId,
        newPriceId: proPriceId,
        message: 'Aucun subscription item ne correspond au Price legacy.',
      });
      continue;
    }

    if (!confirmed) {
      rows.push({
        status: 'skipped',
        customerEmail: email,
        customerId,
        subscriptionId: subscription.id,
        subscriptionItemId: item.id,
        oldPriceId: legacyPriceId,
        newPriceId: proPriceId,
        message: 'Dry-run: aucune modification Stripe. Relancer avec CONFIRM_STRIPE_MIGRATION=true pour migrer.',
      });
      continue;
    }

    try {
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: proPriceId }],
        proration_behavior: 'none',
      });

      const verified = await verifySubscriptionPrice(stripe, subscription.id, item.id, proPriceId);
      rows.push({
        status: verified ? 'migrated' : 'error',
        customerEmail: email,
        customerId,
        subscriptionId: subscription.id,
        subscriptionItemId: item.id,
        oldPriceId: legacyPriceId,
        newPriceId: proPriceId,
        message: verified
          ? 'Migration confirmee: item remplace sans proration immediate.'
          : 'Stripe update appele, mais verification du nouveau Price ID non confirmee.',
      });
    } catch (err) {
      rows.push({
        status: 'error',
        customerEmail: email,
        customerId,
        subscriptionId: subscription.id,
        subscriptionItemId: item.id,
        oldPriceId: legacyPriceId,
        newPriceId: proPriceId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.table(rows);
  console.log(JSON.stringify({
    dryRun: !confirmed,
    scannedLegacyPriceId: legacyPriceId,
    targetProPriceId: proPriceId,
    total: rows.length,
    migrated: rows.filter((row) => row.status === 'migrated').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    errors: rows.filter((row) => row.status === 'error').length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
