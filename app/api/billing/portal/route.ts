import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getSiteUrl } from '@/lib/site-url';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';
import { privateJson, rejectCrossSiteMutation } from '@/lib/api-route-security';

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
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
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return privateJson({ url: portalSession.url });
  } catch (err) {
    console.error('[billing-portal] Impossible de créer la session Stripe.', {
      kind: err instanceof Error ? err.name : 'unknown',
    });
    return privateJson({ error: 'Impossible d’ouvrir le portail de facturation.' }, { status: 500 });
  }
}
