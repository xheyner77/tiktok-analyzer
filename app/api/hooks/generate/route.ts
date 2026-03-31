import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/session';
import {
  getUserById,
  checkAndResetMonthly,
  incrementHooksCount,
  canGenerateHook,
  HOOK_LIMITS,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { HOOK_GENERATION_MAX_TOKENS, OPENAI_CHAT_MODEL } from '@/lib/openai-models';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── OpenAI hook generation ────────────────────────────────────────────────────

async function generateHooksWithAI(params: {
  context: string;
  scene: string;
  person?: string;
  tone: string;
  count: number;
}): Promise<string[]> {
  const { context, scene, person, tone, count } = params;

  const prompt = `Tu es un expert en contenu viral TikTok spécialisé dans les hooks textuels courts.
Génère ${count} hooks textuels COURTS et PERCUTANTS pour un overlay TikTok.

RÈGLES ABSOLUES :
- Maximum 6 à 8 mots par hook
- Tout en MAJUSCULES
- Pas de point final, parfois "..." pour créer du suspense
- Style : intrigant, dramatique, choquant ou mystérieux selon le ton
- Conçu pour être affiché EN TEXTE sur la vidéo (pas de narration, pas de voix off)
- Pas de script complet — juste le hook textuel d'accroche
- Exemples du style attendu :
  "JE RECADRE UN HATER..."
  "ELLE VA REGRETTER CE QU'ELLE A DIT"
  "IL PENSE QUE JE SUIS RUINÉ..."
  "ON M'A TOUT PRIS"
  "TU VAS PAS Y CROIRE..."
  "REGARDEZ CE QU'ILS ONT FAIT..."

Contexte de la vidéo : ${context}
Type de scène : ${scene}${person ? `\nPersonnage impliqué : ${person}` : ''}
Ton souhaité : ${tone}

Réponds UNIQUEMENT avec un tableau JSON de strings, sans markdown, sans commentaires :
["HOOK 1", "HOOK 2", ...]`;

  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    temperature: 0.85,
    max_tokens: HOOK_GENERATION_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content:
          "Tu génères des hooks textuels TikTok ultra-courts. Réponds UNIQUEMENT avec un tableau JSON valide de strings, rien d'autre.",
      },
      { role: 'user', content: prompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '[]';
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed)) throw new Error('Invalid response format');

  const normalized = parsed
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((h) => h.replace(/\s+/g, ' ').toUpperCase())
    .map((h) => (h.length > 70 ? h.slice(0, 70).trim() : h));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const hook of normalized) {
    if (!seen.has(hook)) {
      seen.add(hook);
      unique.push(hook);
    }
    if (unique.length >= count) break;
  }

  return unique;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    let user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    user = await checkAndResetMonthly(user);

    // ── Feature availability ──────────────────────────────────────────────────
    const hookLimit = HOOK_LIMITS[user.plan] ?? 0;

    if (hookLimit === 0) {
      return NextResponse.json(
        { error: 'Le générateur de hooks est disponible à partir du plan Pro.', plan: user.plan },
        { status: 403 }
      );
    }

    // ── Quota check ───────────────────────────────────────────────────────────
    const remaining = Math.max(0, hookLimit - user.hooks_count);

    if (!canGenerateHook(user) || remaining === 0) {
      return NextResponse.json(
        {
          error: `Tu as utilisé tes ${hookLimit} hooks ce mois-ci. Renouvellement le 1er du mois.`,
          used:  user.hooks_count,
          limit: hookLimit,
        },
        { status: 429 }
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let context  = '';
    let scene    = '';
    let person   = '';
    let tone     = 'dramatique';
    let count    = 5;

    try {
      const body = await request.json();
      context = typeof body.context === 'string' ? body.context.trim() : '';
      scene   = typeof body.scene   === 'string' ? body.scene.trim()   : '';
      person  = typeof body.person  === 'string' ? body.person.trim()  : '';
      tone    = typeof body.tone    === 'string' ? body.tone.trim()    : 'dramatique';
      count   = typeof body.count   === 'number' ? Math.min(Math.max(1, body.count), 10) : 5;
    } catch {
      // Fall back to defaults
    }

    if (!context) {
      return NextResponse.json({ error: 'Contexte requis' }, { status: 400 });
    }

    if (count > remaining) {
      count = remaining; // cap silencieux plutôt qu'erreur
    }

    // ── Generate ──────────────────────────────────────────────────────────────
    const hooks = await generateHooksWithAI({ context, scene, person, tone, count });
    if (hooks.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de générer des hooks pour ce contexte. Réessaie avec plus de détails.' },
        { status: 422 }
      );
    }

    // ── Increment quota ───────────────────────────────────────────────────────
    const consumed = hooks.length;
    await incrementHooksCount(session.userId, consumed);

    // ── Save to history ───────────────────────────────────────────────────────
    // Columns must exactly match public.hooks_history schema.
    // user_id references public.users(id) — NOT auth.users.
    const rows = hooks.map((hook_text) => ({
      user_id:    session.userId,
      hook_text,
      context:    context || null,
      scene:      scene   || null,
      person:     person  || null,
      tone:       tone    || null,
      variant_of: null,
    }));

    const { error: insertError, data: insertedRows } = await supabase
      .from('hooks_history')
      .insert(rows)
      .select('id');

    if (insertError) {
      // Log complet pour debug — ne bloque pas la réponse client
      console.error('[hooks/generate] INSERT hooks_history FAILED:', {
        code:    insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint:    insertError.hint,
        userId:  session.userId,
        rows,
      });
    } else {
      console.log(`[hooks/generate] ${insertedRows?.length ?? 0} hooks saved to history for user ${session.userId}`);
    }

    console.log('[hooks/generate] success', {
      userId:  session.userId,
      plan:    user.plan,
      used:    user.hooks_count + consumed,
      limit:   hookLimit,
      tone,
      count:   consumed,
    });

    return NextResponse.json({
      hooks,
      used:          user.hooks_count + consumed,
      limit:         hookLimit,
      historySaved:  !insertError,
    });

  } catch (err) {
    console.error('[hooks/generate] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
