import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    if (user.plan === 'free') {
      return NextResponse.json({ error: 'Tu es déjà sur le plan Free.' }, { status: 400 });
    }

    // Downgrade to free — keep existing analysis history intact
    const { error } = await supabase
      .from('users')
      .update({ plan: 'free' })
      .eq('id', session.userId);

    if (error) {
      console.error('[cancel-plan] DB error:', error.message);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du plan.' }, { status: 500 });
    }

    console.log(`[cancel-plan] ✓ Plan → free for user ${session.userId} (was ${user.plan})`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cancel-plan] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
