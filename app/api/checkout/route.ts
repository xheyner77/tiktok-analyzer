import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLANS = {
  pro:   { amount: 999,  label: 'TikTok Analyzer — Plan Pro' },
  elite: { amount: 2499, label: 'TikTok Analyzer — Plan Elite' },
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body as { plan?: string };

    if (plan !== 'pro' && plan !== 'elite') {
      return NextResponse.json({ error: 'Plan invalide. Valeurs acceptées : pro, elite.' }, { status: 400 });
    }

    // Derive base URL from incoming request — works in dev and prod
    const baseUrl = new URL(request.url).origin;
    const price = PLANS[plan];

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: session.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: price.amount,
            product_data: { name: price.label },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.userId,
        plan,
      },
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/pricing`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[checkout] Error:', message);
    return NextResponse.json({ error: 'Erreur lors de la création du paiement.' }, { status: 500 });
  }
}
