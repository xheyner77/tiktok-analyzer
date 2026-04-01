import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { blockTestStripeSecretInProduction } from '@/lib/stripe-prod-guard';

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

function getStripe(): Stripe {
  if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY manquant');
  return new Stripe(stripeSecret);
}

export async function POST() {
  const skBlock = blockTestStripeSecretInProduction();
  if (skBlock) return skBlock;

  try {
    const session = await getSession();

    if (!session) {
      console.error('[cancel-plan] No session — cookie missing or expired');
      return NextResponse.json({ error: 'Non authentifié.', code: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const { data: currentUser, error: readError } = await supabase
      .from('users')
      .select('id, plan, stripe_subscription_id, subscription_status')
      .eq('id', session.userId)
      .single();

    if (readError || !currentUser) {
      console.error('[cancel-plan] User not found:', session.userId, readError?.message);
      return NextResponse.json({ error: 'Utilisateur introuvable en base.', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    if (currentUser.plan === 'free') {
      return NextResponse.json({ error: 'Tu es déjà sur le plan Free.', code: 'ALREADY_FREE' }, { status: 400 });
    }

    // Abonnement Stripe : résiliation en fin de période (accès jusqu’à la date de facturation)
    if (currentUser.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.update(currentUser.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (stripeErr) {
        const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        console.error('[cancel-plan] Stripe error:', msg);
        return NextResponse.json(
          { error: 'Impossible d’annuler l’abonnement chez Stripe. Réessaie ou contacte le support.', code: 'STRIPE_ERROR' },
          { status: 502 }
        );
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ subscription_cancel_at_period_end: true })
        .eq('id', session.userId);

      if (updateError) {
        console.error('[cancel-plan] DB update error:', updateError.message);
        return NextResponse.json({ error: 'Erreur DB.', code: 'DB_ERROR' }, { status: 500 });
      }

      console.log(`[cancel-plan] cancel_at_period_end set for sub ${currentUser.stripe_subscription_id}`);
      return NextResponse.json({ success: true, cancelAtPeriodEnd: true });
    }

    // Legacy : pas d’abonnement Stripe → retour immédiat en Free
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ plan: 'free' })
      .eq('id', session.userId)
      .select('id, plan')
      .single();

    if (updateError) {
      console.error('[cancel-plan] DB update error:', updateError.message);
      return NextResponse.json({ error: 'Erreur DB lors de la mise à jour.', code: 'DB_ERROR' }, { status: 500 });
    }

    if (!updated || updated.plan !== 'free') {
      return NextResponse.json({ error: 'La mise à jour na pas été appliquée.', code: 'UPDATE_FAILED' }, { status: 500 });
    }

    console.log(`[cancel-plan] Legacy user → free ${session.userId}`);
    return NextResponse.json({ success: true, cancelAtPeriodEnd: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cancel-plan] Unexpected error:', message);
    return NextResponse.json({ error: message, code: 'UNEXPECTED' }, { status: 500 });
  }
}
