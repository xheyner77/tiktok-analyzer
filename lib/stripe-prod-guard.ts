import { NextResponse } from 'next/server';
import {
  getStripePublishableKey,
  getStripeRuntimeMode,
  getStripeSecretKey,
  StripeRuntimeConfigurationError,
} from './stripe-runtime';

function configurationError(kind: 'secret' | 'publishable', error: unknown): NextResponse {
  console.error('[stripe] Configuration Stripe refusee.', {
    kind,
    mode: getStripeRuntimeMode(),
    code: error instanceof StripeRuntimeConfigurationError ? error.code : 'unknown_configuration_error',
  });
  return NextResponse.json(
    { error: 'Configuration Stripe incorrecte.' },
    { status: 500 },
  );
}

/** Cle secrete : toutes les routes Stripe serveur (checkout, webhooks, upgrade, cancel). */
export function blockTestStripeSecretInProduction(): NextResponse | null {
  try {
    getStripeSecretKey();
    return null;
  } catch (error) {
    return configurationError('secret', error);
  }
}

/**
 * Cle publique : checkout uniquement (alignee avec ce que le front chargera pour Stripe.js).
 * Le webhook n'utilise pas cette variable - ne pas l'y verifier.
 */
export function blockTestStripePublishableInProduction(): NextResponse | null {
  try {
    getStripePublishableKey();
    return null;
  } catch (error) {
    return configurationError('publishable', error);
  }
}
