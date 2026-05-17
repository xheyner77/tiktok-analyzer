import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/session';
import {
  getUserById,
  checkAndResetMonthly,
  incrementHooksCount,
  canGenerateHook,
  HOOK_LIMITS,
  getEffectivePlan,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { HOOK_GENERATION_MAX_TOKENS, OPENAI_CHAT_MODEL } from '@/lib/openai-models';
import { estimateAnalysisCost } from '@/lib/analysis-quality';
import {
  generateFallbackHookPacks,
  generatedHooksToHookPacks,
  hookPacksToGeneratedHooks,
  normalizeGeneratedHooks,
  normalizeHookPacks,
} from '@/lib/hook-engine';
import type { HookGenerationInput } from '@/lib/hook-engine';
import type { HookObjective, HookPack, VideoFormat } from '@/lib/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeFormat(value: unknown): VideoFormat {
  const allowed: VideoFormat[] = [
    'facecam',
    'texte_ecran',
    'storytelling',
    'tutoriel',
    'ecommerce',
    'humour',
    'playback_lipsync',
    'sans_parole',
    'gaming',
    'lifestyle',
    'motivation',
    'avant_apres',
  ];
  return allowed.includes(value as VideoFormat) ? (value as VideoFormat) : 'facecam';
}

function normalizeObjective(value: unknown): HookObjective {
  const allowed: HookObjective[] = ['views', 'watchtime', 'comments', 'clicks', 'authority', 'repost', 'first_seconds'];
  return allowed.includes(value as HookObjective) ? (value as HookObjective) : 'views';
}

function normalizeMode(value: unknown): HookGenerationInput['mode'] {
  const allowed: NonNullable<HookGenerationInput['mode']>[] = [
    'facecam_text',
    'text_only',
    'opening_3s',
    'repost_angle',
    'comment_bait',
    'watchtime',
  ];
  return allowed.includes(value as NonNullable<HookGenerationInput['mode']>)
    ? (value as HookGenerationInput['mode'])
    : 'opening_3s';
}

async function generateHookPacksWithAI(params: {
  context: string;
  scene: string;
  person?: string;
  tone: string;
  count: number;
  format: VideoFormat;
  objective: HookObjective;
  niche?: string;
  mode?: HookGenerationInput['mode'];
  intensity?: number;
}): Promise<HookPack[]> {
  const { context, scene, person, tone, count, format, objective, niche, mode, intensity } = params;

  const prompt = `Tu es un créateur TikTok senior et un directeur créatif short-form.
Génère ${count} HookPacks complets. Un HookPack n'est pas une phrase : c'est l'ouverture complète 0-3 secondes.

RÈGLES :
- TikTok natif, court, direct, pas corporate, pas LinkedIn.
- Pas de "découvrez comment", pas de promesse impossible, pas de phrases longues.
- Chaque pack doit être tournable immédiatement par un créateur.
- Si le format est sans_parole ou texte écran uniquement, spokenHook peut être vide.
- firstFrame, visualAction, cutTiming et scriptOpening doivent être concrets.
- Réponds uniquement en JSON strict.

Contexte : ${context}
Format vidéo : ${format}
Niche : ${niche || 'non précisée'}
Objectif : ${objective}
Mode : ${mode || 'opening_3s'}
Intensité : ${intensity ?? 7}/10
Type de scène : ${scene}${person ? `\nPersonnage impliqué : ${person}` : ''}
Ton souhaité : ${tone}

Structure JSON attendue :
[
  {
    "title": "Facecam · Curiosité",
    "style": "curiosity",
    "format": "${format}",
    "objective": "${objective}",
    "spokenHook": "Le problème n’est pas ton idée. C’est ton intro.",
    "onScreenText": "Ton meilleur passage arrive trop tard",
    "firstFrame": "Montre le moment fort sans intro.",
    "visualAction": "Zoom léger puis cut rapide.",
    "cameraDirection": "Plan serré visage ou preuve au centre.",
    "cutTiming": "Cut avant 1.5s.",
    "deliveryTone": "Calme, phrase courte, pas d’explication.",
    "soundCue": "Silence court avant le cut",
    "scriptOpening": [
      { "time": "0.0s", "instruction": "Montre le résultat." },
      { "time": "0.5s", "instruction": "Texte écran court." },
      { "time": "1.5s", "instruction": "Phrase d’ouverture." },
      { "time": "2.5s", "instruction": "Cut sur preuve." }
    ],
    "whyItWorks": "Explique pourquoi le viewer reste.",
    "bestFor": ["Facecam", "Watchtime"],
    "risk": "Risque court si utile.",
    "scores": { "overall": 86, "scrollStop": 88, "curiosity": 84, "emotion": 74, "clarity": 82, "comments": 77, "watchtime": 89 },
    "aggression": 7,
    "difficulty": "facile"
  }
]`;

  const compactPrompt = [
    `Genere ${count} HookPacks TikTok 0-3s en JSON strict.`,
    `Contexte=${context.slice(0, 360)}`,
    `Format=${format} | niche=${niche || 'non precisee'} | objectif=${objective} | mode=${mode || 'opening_3s'} | intensite=${intensity ?? 7}/10`,
    scene ? `Scene=${scene.slice(0, 140)}` : '',
    person ? `Personnage=${person.slice(0, 100)}` : '',
    `Ton=${tone.slice(0, 80)}`,
    'Regles: court, humain, TikTok natif, pas corporate, pas de promesse impossible, pas de "decouvrez comment".',
    'Chaque item: title,style,format,objective,spokenHook,onScreenText,firstFrame,visualAction,cameraDirection,cutTiming,deliveryTone,soundCue,scriptOpening[4],whyItWorks,bestFor,risk,scores{overall,scrollStop,curiosity,emotion,clarity,comments,watchtime},aggression,difficulty.',
  ].filter(Boolean).join('\n');
  const costEstimate = estimateAnalysisCost({
    model: OPENAI_CHAT_MODEL,
    framesForOcr: 0,
    framesForReasoning: 0,
    promptChars: compactPrompt.length,
    outputTokens: HOOK_GENERATION_MAX_TOKENS,
  });
  console.info('[hooks-cost] estimate', costEstimate);

  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    temperature: 0.72,
    max_tokens: HOOK_GENERATION_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content: 'Tu génères des HookPacks TikTok complets. Réponds uniquement avec un tableau JSON valide, sans markdown.',
      },
      { role: 'user', content: compactPrompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '[]';
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return normalizeHookPacks(JSON.parse(clean), params, 'openai');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    let user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    user = await checkAndResetMonthly(user);
    const tier = getEffectivePlan(user);
    const hookLimit = HOOK_LIMITS[tier] ?? 0;

    if (hookLimit === 0) {
      return NextResponse.json(
        { error: 'Le Hook Studio est disponible à partir du plan Pro.', plan: tier },
        { status: 403 }
      );
    }

    const remaining = Math.max(0, hookLimit - user.hooks_count);
    if (!canGenerateHook(user) || remaining === 0) {
      return NextResponse.json(
        {
          error: `Tu as utilisé tes ${hookLimit} hooks pour cette période de facturation.`,
          used: user.hooks_count,
          limit: hookLimit,
        },
        { status: 429 }
      );
    }

    let context = '';
    let scene = '';
    let person = '';
    let tone = 'direct';
    let count = 10;
    let format: VideoFormat = 'facecam';
    let objective: HookObjective = 'views';
    let niche = '';
    let mode: HookGenerationInput['mode'] = 'opening_3s';
    let intensity = 7;

    try {
      const body = await request.json();
      context = typeof body.context === 'string' ? body.context.trim() : '';
      scene = typeof body.scene === 'string' ? body.scene.trim() : '';
      person = typeof body.person === 'string' ? body.person.trim() : '';
      tone = typeof body.tone === 'string' ? body.tone.trim() : 'direct';
      niche = typeof body.niche === 'string' ? body.niche.trim() : '';
      mode = normalizeMode(body.mode);
      intensity = typeof body.intensity === 'number' ? Math.min(Math.max(1, body.intensity), 10) : 7;
      format = normalizeFormat(body.format);
      objective = normalizeObjective(body.objective);
      count = typeof body.count === 'number' ? Math.min(Math.max(1, body.count), 12) : 10;
    } catch {
      // Keep defaults.
    }

    if (!context) {
      return NextResponse.json({ error: 'Sujet de vidéo requis' }, { status: 400 });
    }

    if (context.length > 420) {
      return NextResponse.json({ error: 'Le sujet ne doit pas dépasser 420 caractères.' }, { status: 400 });
    }

    if (scene.length > 160 || person.length > 120 || niche.length > 80) {
      return NextResponse.json({ error: 'Un des champs est trop long.' }, { status: 400 });
    }

    if (count > remaining) count = remaining;

    const input = { context, scene, person, tone, count, format, objective, niche, mode, intensity };
    const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here';

    let hookPacks: HookPack[] = [];
    if (hasOpenAI) {
      try {
        hookPacks = await generateHookPacksWithAI(input);
      } catch (err) {
        console.warn('[hooks/generate] OpenAI HookPacks failed, using fallback:', err instanceof Error ? err.message : err);
      }
    }

    if (!hookPacks.length) {
      hookPacks = generateFallbackHookPacks(input);
    }

    let richHooks = hookPacksToGeneratedHooks(hookPacks);
    if (!richHooks.length) {
      richHooks = normalizeGeneratedHooks([], input);
      hookPacks = generatedHooksToHookPacks(richHooks, input, 'local_fallback');
    }

    const hooks = richHooks.map((item) => item.hook).filter(Boolean);
    if (hooks.length === 0 || hookPacks.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de générer des ouvertures pour ce contexte. Réessaie avec plus de détails.' },
        { status: 422 }
      );
    }

    const consumed = hooks.length;
    const rows = hooks.map((hook_text) => ({
      user_id: session.userId,
      hook_text,
      context: context || null,
      scene: scene || null,
      person: person || null,
      tone: tone || null,
      variant_of: null,
    }));

    const { error: insertError } = await supabase.from('hooks_history').insert(rows).select('id');

    if (insertError) {
      console.error('[hooks/generate] INSERT hooks_history FAILED:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId: session.userId,
        rows,
      });
      return NextResponse.json(
        { error: "Impossible d'enregistrer les ouvertures. Réessaie dans un instant." },
        { status: 500 }
      );
    }

    await incrementHooksCount(session.userId, consumed);

    return NextResponse.json({
      hooks,
      richHooks,
      hookPacks,
      quotaUnit: '1 HookPack = 1 hook',
      used: user.hooks_count + consumed,
      limit: hookLimit,
      historySaved: true,
    });
  } catch (err) {
    console.error('[hooks/generate] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
