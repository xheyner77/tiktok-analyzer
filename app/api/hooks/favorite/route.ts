import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { privateJson, readJsonObject, rejectCrossSiteMutation } from '@/lib/api-route-security';

export async function POST(request: NextRequest) {
  try {
    const rejected = rejectCrossSiteMutation(request);
    if (rejected) return rejected;
    const session = await getSession();
    if (!session) {
      return privateJson({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await readJsonObject(request);
    const hookId = typeof body?.hookId === 'string' ? body.hookId.trim() : '';
    const favorite = body?.favorite;

    if (!hookId || hookId.length > 128 || typeof favorite !== 'boolean') {
      return privateJson({ error: 'Paramètres invalides' }, { status: 400 });
    }

    const { error } = await supabase
      .from('hooks_history')
      .update({ is_favorite: favorite })
      .eq('id', hookId)
      .eq('user_id', session.userId);

    if (error) {
      console.error('[hooks/favorite] update_failed', { code: error.code });
      return privateJson({ error: 'Mise à jour temporairement indisponible.' }, { status: 500 });
    }

    return privateJson({ success: true });
  } catch (error) {
    console.error('[hooks/favorite] request_failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return privateJson({ error: 'Mise à jour temporairement indisponible.' }, { status: 500 });
  }
}
