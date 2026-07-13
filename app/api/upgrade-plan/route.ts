import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { normalizePlan } from '@/lib/plans';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import {
  privateJson,
  readJsonObject,
  rejectCrossSiteMutation,
} from '@/lib/api-route-security';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

function getStripe(): Stripe {
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

/**
 * Vérifie côté serveur que le Checkout Session est payé et appartient à l’utilisateur.
 * **Ne modifie pas le plan en base** : seul le webhook `checkout.session.completed` (signé Stripe) applique Starter/Pro/Lifetime.
 */
export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) {
    return privateJson({ error: 'Le service de facturation est indisponible.' }, { status: 503 });
  }

  try {
    const session = await getSession();

    if (!session) {
      return privateJson({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await readJsonObject(request);
    if (!body) {
      return privateJson({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    const plan = typeof body.plan === 'string' ? body.plan : undefined;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    if (plan !== 'starter' && plan !== 'creator' && plan !== 'pro' && plan !== 'lifetime' && plan !== 'scale') {
      return privateJson({ error: 'Plan invalide.' }, { status: 400 });
    }
    const normalizedPlan = normalizePlan(plan);

    if (!/^cs_[A-Za-z0-9_]{3,255}$/.test(sessionId)) {
      return privateJson({ error: 'Session de paiement invalide.' }, { status: 400 });
    }

    const stripe = getStripe();
    let checkoutSession: Stripe.Checkout.Session;

    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('[upgrade-plan] Session Stripe introuvable.', {
        kind: error instanceof Error ? error.name : 'unknown',
      });
      return privateJson({ error: 'Session Stripe introuvable.' }, { status: 400 });
    }

    const expectedMode = normalizedPlan === 'lifetime' ? 'payment' : 'subscription';
    if (checkoutSession.mode !== expectedMode) {
      console.error('[upgrade-plan] Mode de paiement incohérent.');
      return privateJson({ error: 'Session Stripe incohérente.' }, { status: 400 });
    }

    if (checkoutSession.payment_status !== 'paid') {
      return privateJson({ error: 'Paiement non confirmé.' }, { status: 402 });
    }

    if (checkoutSession.metadata?.userId !== session.userId) {
      console.error('[upgrade-plan] Session de paiement non rattachée au compte courant.');
      return privateJson({ error: 'Session invalide.' }, { status: 403 });
    }

    if (normalizePlan(checkoutSession.metadata?.plan) !== normalizedPlan) {
      console.error('[upgrade-plan] Plan de paiement incohérent.');
      return privateJson({ error: 'Plan incohérent.' }, { status: 400 });
    }

    return privateJson({
      success: true,
      plan: normalizedPlan,
      syncedByWebhookOnly: true,
    });
  } catch (error) {
    console.error('[upgrade-plan] Erreur inattendue.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Impossible de vérifier le paiement pour le moment.' }, { status: 500 });
  }
}
