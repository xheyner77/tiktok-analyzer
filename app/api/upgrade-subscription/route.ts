import { getSession } from '@/lib/session';
import { privateJson } from '@/lib/api-route-security';

/**
 * Legacy endpoint conservé pour compatibilité.
 * Lifetime n'est plus une mise à niveau d'abonnement : c'est un Checkout `payment`
 * via /api/checkout avec plan=lifetime.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return privateJson({ error: 'Non authentifié.' }, { status: 401 });
    }

    return privateJson(
      { error: 'Lifetime est un paiement unique. Utilise le checkout Lifetime.', code: 'LIFETIME_CHECKOUT_REQUIRED' },
      { status: 410 },
    );
  } catch (error) {
    console.error('[upgrade-subscription] Erreur inattendue.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Service de facturation indisponible.' }, { status: 500 });
  }
}
