import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('hooks_history')
      .select('id, hook_text, tone, scene, is_favorite, created_at, variant_of')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('[hooks/history] DB error:', error.message);
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 });
    }

    return NextResponse.json({ hooks: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[hooks/history] Unexpected error:', message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
