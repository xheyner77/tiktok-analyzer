import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { privateJson } from '@/lib/api-route-security';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return privateJson({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('hooks_history')
      .select('id, hook_text, tone, scene, is_favorite, created_at, variant_of')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('[hooks/history] select_failed', { code: error.code });
      return privateJson({ error: 'Historique temporairement indisponible.', hooks: [] }, { status: 500 });
    }

    return privateJson({ hooks: data ?? [] });

  } catch (error) {
    console.error('[hooks/history] request_failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return privateJson({ error: 'Historique temporairement indisponible.', hooks: [] }, { status: 500 });
  }
}
