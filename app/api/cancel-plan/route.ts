import Stripe from 'stripe';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import { getStripeSecretKey } from '@/lib/stripe-runtime';
import { privateJson, rejectCrossSiteMutation } from '@/lib/api-route-security';
import {
  assertStripeSubscriptionOwnership,
  ensureStripeCustomerOwnership,
  StripeCheckoutSafetyError,
} from '@/lib/stripe-checkout-safety';

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey().value);
}

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
      return privateJson({ error: 'Non authentifié.', code: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const { data: currentUser, error: readError } = await supabase
      .from('users')
      .select('id, plan, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', session.userId)
      .maybeSingle();

    if (readError || !currentUser) {
      console.error('[cancel-plan] Compte ou abonnement introuvable.', {
        databaseError: Boolean(readError),
      });
      return privateJson({ error: 'Compte utilisateur introuvable.', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    if (currentUser.plan === 'free') {
      return privateJson({ error: 'Tu es déjà sur le plan Free.', code: 'ALREADY_FREE' }, { status: 400 });
    }

    if (currentUser.plan === 'lifetime' || currentUser.subscription_status === 'lifetime') {
      return privateJson(
        { error: 'Lifetime est un accès à vie et ne peut pas être annulé comme un abonnement mensuel.', code: 'LIFETIME_ACCESS' },
        { status: 400 }
      );
    }

    // Abonnement Stripe : résiliation en fin de période (accès jusqu’à la date de facturation)
    if (currentUser.stripe_subscription_id) {
      if (!currentUser.stripe_customer_id) {
        return privateJson(
          {
            error: 'Le compte de facturation doit etre verifie avant toute resiliation.',
            code: 'BILLING_STATE_CONFLICT',
          },
          { status: 409 },
        );
      }

      try {
        const stripe = getStripe();
        const customerId = await ensureStripeCustomerOwnership(stripe, {
          customerId: currentUser.stripe_customer_id,
          userId: session.userId,
          email: session.email,
        });
        const subscription = await stripe.subscriptions.retrieve(currentUser.stripe_subscription_id);
        assertStripeSubscriptionOwnership(subscription, {
          customerId,
          userId: session.userId,
        });
        await stripe.subscriptions.update(currentUser.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (stripeErr) {
        if (stripeErr instanceof StripeCheckoutSafetyError) {
          console.error('[cancel-plan] Ownership Stripe refuse.', { code: stripeErr.code });
          return privateJson(
            {
              error: 'La facturation de ce compte doit etre verifiee avant toute resiliation.',
              code: 'BILLING_STATE_CONFLICT',
            },
            { status: 409 },
          );
        }
        console.error('[cancel-plan] Stripe a refusé la résiliation.', {
          kind: stripeErr instanceof Error ? stripeErr.name : 'unknown',
        });
        return privateJson(
          { error: 'Impossible d’annuler l’abonnement chez Stripe. Réessaie ou contacte le support.', code: 'STRIPE_ERROR' },
          { status: 502 }
        );
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ subscription_cancel_at_period_end: true })
        .eq('id', session.userId);

      if (updateError) {
        // Stripe reste la source de vérité. Le webhook subscription.updated
        // resynchronisera ce drapeau sans faire croire que l'annulation a échoué.
        console.error('[cancel-plan] Résiliation Stripe confirmée, synchronisation locale en attente.', {
          code: updateError.code,
        });
      }

      return privateJson({ success: true, cancelAtPeriodEnd: true, syncPending: Boolean(updateError) });
    }

    // Aucun droit n'est modifié directement ici : seul Stripe + son webhook
    // signé peut changer l'état d'un abonnement payant.
    return privateJson(
      {
        error: 'La référence d’abonnement est absente. Contacte le support pour vérifier le compte.',
        code: 'SUBSCRIPTION_REFERENCE_MISSING',
      },
      { status: 409 },
    );
  } catch (error) {
    console.error('[cancel-plan] Erreur inattendue.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Impossible de modifier l’abonnement pour le moment.', code: 'UNEXPECTED' }, { status: 500 });
  }
}
