import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      console.error('[cancel-plan] No session — cookie missing or expired');
      return NextResponse.json({ error: 'Non authentifié.', code: 'SESSION_EXPIRED' }, { status: 401 });
    }

    console.log('[cancel-plan] Session OK — userId:', session.userId, 'email:', session.email);

    // ── Read current plan ────────────────────────────────────────────────────
    const { data: currentUser, error: readError } = await supabase
      .from('users')
      .select('id, plan')
      .eq('id', session.userId)
      .single();

    if (readError || !currentUser) {
      console.error('[cancel-plan] User not found in DB for userId:', session.userId, readError?.message);
      return NextResponse.json({ error: 'Utilisateur introuvable en base.', code: 'USER_NOT_FOUND' }, { status: 404 });
    }

    console.log('[cancel-plan] Current plan in DB:', currentUser.plan, 'for row id:', currentUser.id);

    if (currentUser.plan === 'free') {
      return NextResponse.json({ error: 'Tu es déjà sur le plan Free.', code: 'ALREADY_FREE' }, { status: 400 });
    }

    // ── Update plan → free ────────────────────────────────────────────────────
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
      console.error('[cancel-plan] Update ran but plan is still:', updated?.plan);
      return NextResponse.json({ error: 'La mise à jour na pas été appliquée.', code: 'UPDATE_FAILED' }, { status: 500 });
    }

    console.log(`[cancel-plan] ✓ Plan updated → free for user ${session.userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cancel-plan] Unexpected error:', message);
    return NextResponse.json({ error: message, code: 'UNEXPECTED' }, { status: 500 });
  }
}
