import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSession } from '@/lib/session';
import {
  getUserById,
  checkAndResetMonthly,
  refundHookQuota,
  reserveHookQuota,
  HOOK_LIMITS,
  getEffectivePlan,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { HOOK_GENERATION_MAX_TOKENS, OPENAI_CHAT_MODEL } from '@/lib/openai-models';
import { estimateAnalysisCost } from '@/lib/analysis-quality';
import {
  hookPacksToGeneratedHooks,
  normalizeHookPacks,
} from '@/lib/hook-engine';
import { getMemoryContextForUser } from '@/lib/memory/memory-context';
import type { HookGenerationInput } from '@/lib/hook-engine';
import type { HookObjective, HookPack, VideoFormat } from '@/lib/types';
import { exceedsDeclaredBodyLimit, privateJson, readJsonObject } from '@/lib/api-route-security';

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey === 'sk-your-key-here') {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

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

function normalizeHookMode(value: unknown): NonNullable<HookGenerationInput['hookMode']> {
  return value === 'spoken' ? 'spoken' : 'text';
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
  hookMode?: HookGenerationInput['hookMode'];
  mode?: HookGenerationInput['mode'];
  intensity?: number;
  creatorMemoryContext?: string;
}): Promise<HookPack[]> {
  const { context, scene, person, tone, count, format, objective, niche, hookMode, mode, intensity, creatorMemoryContext } = params;

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
    `HookMode=${hookMode || 'text'} (${hookMode === 'spoken' ? 'phrase orale naturelle facecam/voix off' : 'texte ecran court lisible en 1 seconde'})`,
    scene ? `Scene=${scene.slice(0, 140)}` : '',
    person ? `Personnage=${person.slice(0, 100)}` : '',
    `Ton=${tone.slice(0, 80)}`,
    creatorMemoryContext ? `\n${creatorMemoryContext}` : '',
    'Regles: court, humain, TikTok natif, pas corporate, pas de promesse impossible, pas de "decouvrez comment".',
    hookMode === 'spoken'
      ? 'Mode parle: spokenHook obligatoire, naturel a dire, avec ton, pause et texte ecran complementaire.'
      : 'Mode textuel: onScreenText prioritaire, 8-12 mots max si possible, punch immediat, spokenHook optionnel.',
    creatorMemoryContext ? 'Utilise la memoire createur pour eviter les hooks generiques et renforcer les patterns deja observes.' : '',
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

  const response = await getOpenAIClient().chat.completions.create({
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
    if (exceedsDeclaredBodyLimit(request, 64 * 1024)) {
      return privateJson({ error: 'Payload trop volumineux.' }, { status: 413 });
    }

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
        { error: 'Le Hook Studio est disponible à partir du plan Starter.', plan: tier },
        { status: 403 }
      );
    }

    const remaining = Math.max(0, hookLimit - user.hooks_count);
    if (remaining === 0) {
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
    let hookMode: NonNullable<HookGenerationInput['hookMode']> = 'text';
    let mode: HookGenerationInput['mode'] = 'opening_3s';
    let intensity = 7;
    let useMemory = true;

    try {
      const body = await readJsonObject(request, 64 * 1024);
      if (!body) throw new Error('INVALID_JSON');
      context = typeof body.context === 'string' ? body.context.trim() : '';
      scene = typeof body.scene === 'string' ? body.scene.trim() : '';
      person = typeof body.person === 'string' ? body.person.trim() : '';
      tone = typeof body.tone === 'string' ? body.tone.trim() : 'direct';
      niche = typeof body.niche === 'string' ? body.niche.trim() : '';
      hookMode = normalizeHookMode(body.hookMode);
      useMemory = body.useMemory !== false;
      mode = normalizeMode(body.mode);
      intensity = typeof body.intensity === 'number' ? Math.min(Math.max(1, body.intensity), 10) : 7;
      format = normalizeFormat(body.format);
      objective = normalizeObjective(body.objective);
      count = typeof body.count === 'number'
        ? Math.floor(Math.min(Math.max(1, body.count), 12))
        : 10;
    } catch {
      return privateJson({ error: 'Payload JSON invalide.' }, { status: 400 });
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

    const input = { context, scene, person, tone, count, format, objective, niche, hookMode, mode, intensity };
    const hasOpenAI = Boolean(
      process.env.OPENAI_API_KEY
      && process.env.OPENAI_API_KEY !== 'sk-your-key-here',
    );

    if (!hasOpenAI) {
      return NextResponse.json(
        {
          error: 'La génération de hooks est temporairement indisponible.',
          code: 'AI_PROVIDER_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }

    const reservation = await reserveHookQuota(user, count);
    if (!reservation.allowed) {
      return NextResponse.json(
        {
          error: `Ton quota de ${hookLimit} hooks est atteint pour cette période de facturation.`,
          used: reservation.used,
          limit: reservation.limit,
        },
        { status: 429 },
      );
    }

    let reservationActive = true;
    const releaseReservation = async () => {
      if (!reservationActive) return;
      reservationActive = false;
      await refundHookQuota(session.userId, count);
    };

    try {
    const creatorMemory = useMemory
      ? await getMemoryContextForUser({
          userId: session.userId,
          plan: tier,
          task: 'generate_hook',
          query: [context, niche, objective, format].filter(Boolean).join(' '),
        })
      : null;
    const creatorMemoryContext = creatorMemory?.enabled ? creatorMemory.prompt : '';
    const hookPacks: HookPack[] = (await generateHookPacksWithAI({
      ...input,
      creatorMemoryContext: useMemory ? creatorMemoryContext : '',
    })).slice(0, count);

    const richHooks = hookPacksToGeneratedHooks(hookPacks);

    const hooks = richHooks.map((item) => item.hook).filter(Boolean);
    if (hooks.length === 0 || hookPacks.length === 0) {
      await releaseReservation();
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
      console.error('[hooks/generate] hooks_history insert failed:', insertError.code ?? 'unknown');
      await releaseReservation();
      return NextResponse.json(
        { error: "Impossible d'enregistrer les ouvertures. Réessaie dans un instant." },
        { status: 500 }
      );
    }

    let quotaUsed = reservation.used;
    if (consumed < count) {
      const refunded = await refundHookQuota(session.userId, count - consumed);
      if (refunded && Number.isFinite(quotaUsed)) quotaUsed -= count - consumed;
    }
    reservationActive = false;

    return privateJson({
      hooks,
      richHooks,
      hookPacks,
      quotaUnit: '1 HookPack = 1 hook',
      used: quotaUsed,
      limit: Number.isFinite(hookLimit) ? hookLimit : null,
      unlimited: !Number.isFinite(hookLimit),
      historySaved: true,
    });
    } catch (error) {
      await releaseReservation();
      console.error('[hooks/generate] AI generation failed:', error instanceof Error ? error.name : 'unknown');
      return NextResponse.json(
        {
          error: 'La génération a échoué. Ton quota n’a pas été consommé, tu peux réessayer.',
          code: 'AI_GENERATION_FAILED',
        },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error('[hooks/generate] Unexpected error:', err instanceof Error ? err.name : 'unknown');
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
