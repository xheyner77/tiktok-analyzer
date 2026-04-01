import { NextResponse } from 'next/server';

function isDeployedProduction(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && process.env.VERCEL === '1')
  );
}

/** Clé secrète : toutes les routes Stripe serveur (checkout, webhooks, upgrade, cancel). */
export function blockTestStripeSecretInProduction(): NextResponse | null {
  if (!isDeployedProduction()) return null;

  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (sk?.startsWith('sk_test')) {
    console.error('[stripe] PRODUCTION: STRIPE_SECRET_KEY est sk_test_ — requête bloquée.');
    return NextResponse.json(
      { error: 'Configuration Stripe incorrecte (clé secrète test en production).' },
      { status: 500 }
    );
  }

  return null;
}

/**
 * Clé publique : checkout uniquement (alignée avec ce que le front chargera pour Stripe.js).
 * Le webhook n’utilise pas cette variable — ne pas l’y vérifier.
 */
export function blockTestStripePublishableInProduction(): NextResponse | null {
  if (!isDeployedProduction()) return null;

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (pk?.startsWith('pk_test')) {
    console.error('[stripe] PRODUCTION: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY est pk_test_ — checkout bloqué.');
    return NextResponse.json(
      { error: 'Configuration Stripe incorrecte (clé publique test en production).' },
      { status: 500 }
    );
  }

  return null;
}
