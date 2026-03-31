import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Next.js App Router: request.text() reads the raw body without pre-parsing,
// which is required for Stripe signature verification.
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header.');
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, plan } = session.metadata ?? {};

    if (!userId || !plan) {
      console.error('[webhook] Missing metadata in session:', session.id);
      return NextResponse.json({ error: 'Missing metadata.' }, { status: 400 });
    }

    if (plan !== 'pro' && plan !== 'elite') {
      console.error('[webhook] Unknown plan in metadata:', plan);
      return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
    }

    // Upgrade the user's plan and reset all monthly counters
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('users')
      .update({
        plan,
        analyses_count: 0,
        hooks_count:    0,
        last_reset_at:  now,
      })
      .eq('id', userId);

    if (error) {
      console.error('[webhook] Failed to update plan for user', userId, ':', error.message);
      return NextResponse.json({ error: 'DB update failed.' }, { status: 500 });
    }

    console.log(`[webhook] ✓ Plan updated → ${plan} for user ${userId}`);
  }

  return NextResponse.json({ received: true });
}
