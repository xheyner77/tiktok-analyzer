import { NextResponse } from 'next/server';

function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview';
}

/** Cle secrete : toutes les routes Stripe serveur (checkout, webhooks, upgrade, cancel). */
export function blockTestStripeSecretInProduction(): NextResponse | null {
  const sk = process.env.STRIPE_SECRET_KEY?.trim();

  if (isVercelProduction() && sk?.startsWith('sk_test')) {
    console.error('[stripe] PRODUCTION: STRIPE_SECRET_KEY est sk_test_ - requete bloquee.');
    return NextResponse.json(
      { error: 'Configuration Stripe incorrecte (cle secrete test en production).' },
      { status: 500 }
    );
  }

  if (isVercelPreview() && sk?.startsWith('sk_live')) {
    console.error('[stripe] PREVIEW: STRIPE_SECRET_KEY est sk_live_ - requete bloquee.');
    return NextResponse.json(
      { error: 'Configuration Stripe incorrecte (cle secrete live en preview).' },
      { status: 500 }
    );
  }

  return null;
}

/**
 * Cle publique : checkout uniquement (alignee avec ce que le front chargera pour Stripe.js).
 * Le webhook n'utilise pas cette variable - ne pas l'y verifier.
 */
export function blockTestStripePublishableInProduction(): NextResponse | null {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  if (isVercelProduction() && pk?.startsWith('pk_test')) {
    console.error('[stripe] PRODUCTION: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY est pk_test_ - checkout bloque.');
    return NextResponse.json(
      { error: 'Configuration Stripe incorrecte (cle publique test en production).' },
      { status: 500 }
    );
  }

  if (isVercelPreview() && pk?.startsWith('pk_live')) {
    console.error('[stripe] PREVIEW: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY est pk_live_ - checkout bloque.');
    return NextResponse.json(
      { error: 'Configuration Stripe incorrecte (cle publique live en preview).' },
      { status: 500 }
    );
  }

  return null;
}
