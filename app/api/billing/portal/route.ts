import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getSiteUrl } from '@/lib/site-url';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import { privateJson, rejectCrossSiteMutation } from '@/lib/api-route-security';
import { getStripePortalConfigurationId, getStripeSecretKey } from '@/lib/stripe-runtime';
import {
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
      return privateJson({ error: 'Non authentifié.' }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user?.stripe_customer_id) {
      return privateJson(
        { error: "Aucun compte de facturation Stripe n'est encore relié à ce profil." },
        { status: 400 }
      );
    }

    const baseUrl = getSiteUrl(request.headers.get('origin'));
    const stripe = getStripe();
    const customerId = await ensureStripeCustomerOwnership(stripe, {
      customerId: user.stripe_customer_id,
      userId: session.userId,
      email: session.email,
    });
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: getStripePortalConfigurationId().value,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return privateJson({ url: portalSession.url });
  } catch (err) {
    if (err instanceof StripeCheckoutSafetyError) {
      console.error('[billing-portal] Customer Stripe refuse.', { code: err.code });
      return privateJson(
        { error: 'La facturation de ce compte doit etre verifiee.', code: 'BILLING_STATE_CONFLICT' },
        { status: 409 },
      );
    }
    console.error('[billing-portal] Impossible de créer la session Stripe.', {
      kind: err instanceof Error ? err.name : 'unknown',
    });
    return privateJson({ error: 'Impossible d’ouvrir le portail de facturation.' }, { status: 500 });
  }
}
