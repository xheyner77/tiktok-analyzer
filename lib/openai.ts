import OpenAI from 'openai';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import type { Plan } from './supabase';
import type { AnalysisResult, Rating, Priority } from './types';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Prompt builders ────────────────────────────────────────────────────────────

function systemPrompt(): string {
  return `Tu es un expert en analyse de contenu TikTok et en stratégie de viralité.
Tu analyses des vidéos TikTok et fournis des retours ultra-précis, basés sur les données et les patterns algorithmiques de TikTok.
Ton analyse est directe, technique, et orientée résultat.

RÈGLE ABSOLUE — PAS DE CONTENU « TEMPLATE » :
- Interdit : conseils génériques copiables sur n'importe quelle vidéo (ex. « les créateurs viraux font… », « pense à optimiser… » sans lien avec CETTE analyse).
- Obligatoire : chaque phrase doit s'appuyer sur les scores, forces et faiblesses que TU viens de produire pour CETTE URL, ou sur les métriques fournies.
- Formulations à éviter sauf si tu les relies à une faiblesse précise listée : « en général », « la plupart des créateurs », « il est important de » sans suite concrète.
- Les recommandations (improvements) doivent chacune mentionner explicitement un angle parmi : hook, montage ou rétention, en renvoyant à une faiblesse ou un score de la section concernée.

Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après.`;
}

function buildPrompt(
  videoUrl: string,
  plan: 'pro' | 'elite',
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  videoContext?: { caption?: string; authorUsername?: string; durationSec?: number }
): string {
  const isPro = plan === 'pro';
  const tipsCount = isPro ? 5 : 10;
  const analysisDepth = isPro
    ? 'courte et directe (2-3 phrases max par section)'
    : 'détaillée et approfondie (4-6 phrases par section avec données chiffrées)';

  const eliteFields = isPro
    ? ''
    : `  "strategy": "string — 150-200 mots — stratégie personnalisée ANCRÉE dans les faiblesses et forces de cette analyse (pas de généralités réutilisables)",
  "viralTips": ["string", "string", "string", "string"] — exactement 4 insights : chacun doit se rattacher à un point précis de cette vidéo ou de son format (pas de liste générique sans lien)`;

  const metricsBlock = observedMetrics
    ? `\nMétriques observées fournies par l'utilisateur :
- vues: ${observedMetrics.views ?? 0}
- likes: ${observedMetrics.likes ?? 0}
- commentaires: ${observedMetrics.comments ?? 0}
- partages: ${observedMetrics.shares ?? 0}
`
    : '\nAucune métrique observée fournie.';

  const ctx = videoContext?.caption?.trim() || videoContext?.authorUsername
    ? `\nContexte public détecté (si disponible — t'en sers pour personnaliser, sans inventer ce que montre la vidéo) :
- auteur / pseudo : ${videoContext?.authorUsername ?? 'inconnu'}
- durée (s) : ${videoContext?.durationSec ?? 'inconnue'}
- légende / description : ${videoContext?.caption?.trim() ? `"${videoContext.caption.trim().slice(0, 500)}"` : 'non fournie'}
`
    : '';

  return `Analyse cette URL de vidéo TikTok : ${videoUrl}
${metricsBlock}${ctx}

Génère une analyse ${analysisDepth} avec exactement ${tipsCount} recommandations d'amélioration.

Réponds avec ce JSON exact (sans markdown, sans commentaires) :
{
  "viralityScore": <entier 0-100>,
  "hook": {
    "score": <entier 0-100>,
    "rating": <"Excellent"|"Bon"|"Moyen"|"Faible">,
    "analysis": "string",
    "strengths": ["string", ...],
    "weaknesses": ["string", ...]
  },
  "editing": {
    "score": <entier 0-100>,
    "rating": <"Excellent"|"Bon"|"Moyen"|"Faible">,
    "analysis": "string",
    "strengths": ["string", ...],
    "weaknesses": ["string", ...]
  },
  "retention": {
    "score": <entier 0-100>,
    "rating": <"Excellent"|"Bon"|"Moyen"|"Faible">,
    "analysis": "string",
    "strengths": ["string", ...],
    "weaknesses": ["string", ...]
  },
  "improvements": [
    { "priority": <"haute"|"moyenne"|"basse">, "tip": "string" }${isPro ? ' — 1 à 2 phrases max, actionnable, spécifique à cette analyse' : ' — 2 à 4 phrases, avec un exemple concret applicable à cette vidéo (pas un exemple générique)'}
    ... exactement ${tipsCount} éléments
  ],
  "comparativeInsight": "string — 2 à 4 phrases : où se situe CETTE vidéo par rapport à ce que ton analyse des 3 piliers (hook, montage, rétention) implique pour la distribution. Si des métriques sont fournies, les utiliser. Aucun cliché sans lien avec les scores.",
  "comparativePriority": "string — 2 à 3 phrases : LA prochaine action la plus rentable, en s'appuyant sur la faiblesse la plus impactante parmi celles que tu as listées (cite hook, montage ou rétention)"
  ${eliteFields ? `,\n  ${eliteFields.trim()}` : ''}
}

Règles :
- viralityScore = score STRUCTUREL UNIQUEMENT (hook 40%, editing 30%, retention 30%)
- rating : Excellent ≥ 80, Bon ≥ 60, Moyen ≥ 40, Faible < 40
- ${isPro ? 'Exactement 5 tips : 2 haute, 2 moyenne, 1 basse' : 'Exactement 10 tips : 4 haute, 4 moyenne, 2 basse'}
- Chaque "tip" doit commencer par ou contenir un ancrage explicite (ex. « Côté hook, … », « Sur le montage, … », « Pour la rétention, … ») puis le conseil.
- comparativeInsight et comparativePriority : obligatoires, uniques à cette analyse.
- Répondre en français`;
}

// ── Parser & validator ─────────────────────────────────────────────────────────

function isValidRating(v: unknown): v is Rating {
  return v === 'Excellent' || v === 'Bon' || v === 'Moyen' || v === 'Faible';
}

function isValidPriority(v: unknown): v is Priority {
  return v === 'haute' || v === 'moyenne' || v === 'basse';
}

function parseResult(raw: string): AnalysisResult {
  // Strip potential markdown code fences
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const json = JSON.parse(clean);

  const section = (s: Record<string, unknown>) => ({
    score: Math.min(100, Math.max(0, Number(s.score) || 0)),
    rating: isValidRating(s.rating) ? s.rating : 'Moyen' as Rating,
    analysis: String(s.analysis ?? ''),
    strengths: Array.isArray(s.strengths) ? s.strengths.map(String) : [],
    weaknesses: Array.isArray(s.weaknesses) ? s.weaknesses.map(String) : [],
  });

  return {
    viralityScore: Math.min(100, Math.max(0, Number(json.viralityScore) || 0)),
    hook: section(json.hook),
    editing: section(json.editing),
    retention: section(json.retention),
    improvements: Array.isArray(json.improvements)
      ? json.improvements.map((i: Record<string, unknown>) => ({
          priority: isValidPriority(i.priority) ? i.priority : 'moyenne' as Priority,
          tip: String(i.tip ?? ''),
        }))
      : [],
    comparativeInsight:
      typeof json.comparativeInsight === 'string' ? String(json.comparativeInsight).trim() : undefined,
    comparativePriority:
      typeof json.comparativePriority === 'string' ? String(json.comparativePriority).trim() : undefined,
    strategy: typeof json.strategy === 'string' ? json.strategy : undefined,
    viralTips: Array.isArray(json.viralTips)
      ? json.viralTips.map(String).filter(Boolean)
      : undefined,
  };
}

function systemPromptVision(): string {
  return `${systemPrompt()}

MODE VISION — images fournies :
- Ce sont des captures successives d’UNE vidéo importée par l’utilisateur (ordre chronologique).
- Tu DOIS décrire ce que tu vois réellement (cadrage, texte à l’écran, visage, décor, mouvement, coupes apparentes, rythme perçu).
- Si une image est floue ou peu lisible, dis-le sans inventer de détails.
- Les scores et conseils doivent être justifiés par ce qui est visible sur les images, pas par des clichés TikTok génériques.
- Ne prétends pas avoir entendu l’audio : si pertinent, note « audio non disponible dans cet échantillon ».`;
}

function buildVisionUserContent(
  plan: 'pro' | 'elite',
  frameCount: number,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  meta?: { durationSec?: number; tiktokUrl?: string; fileName?: string }
): string {
  const isPro = plan === 'pro';
  const tipsCount = isPro ? 5 : 10;
  const analysisDepth = isPro
    ? 'courte et directe (2-3 phrases max par section), en t’appuyant sur le visible'
    : 'détaillée (4-6 phrases par section) avec références aux frames (début / milieu / fin)';

  const metricsBlock = observedMetrics
    ? `\nMétriques TikTok associées (si fournies) :
- vues: ${observedMetrics.views ?? 0}
- likes: ${observedMetrics.likes ?? 0}
- commentaires: ${observedMetrics.comments ?? 0}
- partages: ${observedMetrics.shares ?? 0}
`
    : '\nAucune métrique TikTok fournie (upload seul).';

  const metaBlock = `\nContexte fichier : ${meta?.fileName ?? 'vidéo importée'} — durée ~${meta?.durationSec ?? '?'} s${meta?.tiktokUrl ? ` — lien TikTok optionnel pour stats : ${meta.tiktokUrl}` : ''}`;

  const eliteFields = isPro
    ? ''
    : `  "strategy": "string — 150-200 mots — stratégie ancrée dans ce que montrent les images",
  "viralTips": ["string", "string", "string", "string"] — 4 insights liés à ce que tu as vu sur les frames`;

  return `Tu reçois ${frameCount} images extraites d’une même vidéo verticale (type TikTok), ordre chronologique.
${metaBlock}
${metricsBlock}

Analyse ${analysisDepth}. Génère exactement ${tipsCount} recommandations.

Réponds avec ce JSON exact (sans markdown) :
{
  "viralityScore": <entier 0-100>,
  "hook": { "score": <0-100>, "rating": <"Excellent"|"Bon"|"Moyen"|"Faible">, "analysis": "string", "strengths": ["string"], "weaknesses": ["string"] },
  "editing": { "score": <0-100>, "rating": <...>, "analysis": "string", "strengths": ["string"], "weaknesses": ["string"] },
  "retention": { "score": <0-100>, "rating": <...>, "analysis": "string", "strengths": ["string"], "weaknesses": ["string"] },
  "improvements": [ { "priority": <"haute"|"moyenne"|"basse">, "tip": "string" }, ... exactement ${tipsCount} ],
  "comparativeInsight": "string",
  "comparativePriority": "string"
  ${eliteFields ? `,\n  ${eliteFields.trim()}` : ''}
}

Règles :
- viralityScore = score structurel déduit des images (hook 40%, montage 30%, rétention 30%).
- Chaque tip doit citer un angle (hook / montage / rétention) et un élément visible ou manquant sur les images.
- comparativeInsight / comparativePriority : obligatoires, spécifiques à cette vidéo.
- Répondre en français.`;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function analyzeWithOpenAIVision(
  framesBase64: string[],
  plan: Extract<Plan, 'pro' | 'elite'>,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  meta?: { durationSec?: number; tiktokUrl?: string; fileName?: string }
): Promise<AnalysisResult> {
  const text = buildVisionUserContent(plan, framesBase64.length, observedMetrics, meta);

  const userContent: ChatCompletionContentPart[] = [
    { type: 'text', text },
    ...framesBase64.slice(0, 12).map((b64) => ({
      type: 'image_url' as const,
      image_url: {
        url: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
      },
    })),
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: plan === 'elite' ? 3200 : 1800,
    messages: [
      { role: 'system', content: systemPromptVision() },
      { role: 'user', content: userContent },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  return parseResult(raw);
}

export async function analyzeWithOpenAI(
  videoUrl: string,
  plan: Extract<Plan, 'pro' | 'elite'>,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  videoContext?: { caption?: string; authorUsername?: string; durationSec?: number }
): Promise<AnalysisResult> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.45,
    max_tokens: plan === 'elite' ? 2800 : 1600,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: buildPrompt(videoUrl, plan, observedMetrics, videoContext) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  return parseResult(raw);
}
