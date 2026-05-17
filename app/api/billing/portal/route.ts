import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getSiteUrl } from '@/lib/site-url';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

export async function POST(request: NextRequest) {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Aucun compte de facturation Stripe n'est encore relié à ce profil." },
        { status: 400 }
      );
    }

    const baseUrl = getSiteUrl(request.headers.get('origin'));
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[billing-portal] Error:', message);
    return NextResponse.json({ error: 'Impossible d’ouvrir le portail de facturation.' }, { status: 500 });
  }
}
