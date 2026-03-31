import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { hookId } = await request.json() as { hookId?: string };
    if (!hookId) {
      return NextResponse.json({ error: 'hookId requis' }, { status: 400 });
    }

    const { error } = await supabase
      .from('hooks_history')
      .delete()
      .eq('id', hookId)
      .eq('user_id', session.userId);

    if (error) {
      console.error('[hooks/delete] DB error:', error.message);
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[hooks/delete] Unexpected error:', message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
