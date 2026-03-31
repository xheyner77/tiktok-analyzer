import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import { getSiteUrl } from '@/lib/site-url';
import {
  STRIPE_LAUNCH_PRICE_ELITE_CENTS,
  STRIPE_LAUNCH_PRICE_PRO_CENTS,
  STRIPE_PRODUCT_NAME_ELITE,
  STRIPE_PRODUCT_NAME_PRO,
} from '@/lib/stripe-pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLANS = {
  pro:   { amount: STRIPE_LAUNCH_PRICE_PRO_CENTS,   label: STRIPE_PRODUCT_NAME_PRO,   rank: 1 },
  elite: { amount: STRIPE_LAUNCH_PRICE_ELITE_CENTS, label: STRIPE_PRODUCT_NAME_ELITE, rank: 2 },
} as const;

const CURRENT_PLAN_RANK: Record<string, number> = {
  free:  0,
  pro:   1,
  elite: 2,
};

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

    // ── Check current plan to prevent same-plan purchase or downgrade ─────────
    const userProfile = await getUserById(session.userId);
    const currentPlan = userProfile?.plan ?? 'free';
    const currentRank = CURRENT_PLAN_RANK[currentPlan] ?? 0;
    const targetRank  = PLANS[plan].rank;

    if (currentRank >= targetRank) {
      // User is already on this plan or a better one
      const isSamePlan = currentRank === targetRank;
      return NextResponse.json(
        {
          error: isSamePlan
            ? `Tu es déjà sur le plan ${plan === 'pro' ? 'Pro' : 'Elite'}.`
            : `Tu es déjà sur le plan Elite, qui est supérieur au plan Pro.`,
          code: isSamePlan ? 'ALREADY_ON_PLAN' : 'PLAN_DOWNGRADE_BLOCKED',
        },
        { status: 400 }
      );
    }

    // ── Resolve base URL from NEXT_PUBLIC_SITE_URL (reliable in prod) ─────────
    const baseUrl = getSiteUrl(request.headers.get('origin'));
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
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/pricing`,
    });

    console.log(`[checkout] Session created for user ${session.userId} — plan: ${plan} (current: ${currentPlan})`);
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[checkout] Error:', message);
    return NextResponse.json({ error: 'Erreur lors de la création du paiement.' }, { status: 500 });
  }
}
