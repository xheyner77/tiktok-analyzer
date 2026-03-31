import OpenAI, { APIError, APIConnectionError, RateLimitError } from 'openai';
import type { ChatCompletion, ChatCompletionContentPart } from 'openai/resources/chat/completions';
import type { Plan } from './supabase';
import { OPENAI_CHAT_MODEL } from './openai-models';
import { VISION_MAX_FRAMES } from './vision-config';
import type { AnalysisResult, Rating, Priority } from './types';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 4,
  timeout: 120_000,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 / 503 : backoff exponentiel (2^n × base) + header Retry-After si présent. Max 3 tentatives HTTP. */
function getOpenAIRetryDelayMs(e: unknown, attemptIndex: number): number | null {
  if (attemptIndex >= 2) return null;
  const baseMs = 2000;
  let delay = baseMs * Math.pow(2, attemptIndex);
  if (e instanceof APIError && e.headers) {
    const h = e.headers as Headers;
    const ra = h.get('retry-after');
    if (ra) {
      const sec = parseInt(ra, 10);
      if (!Number.isNaN(sec) && sec >= 0) delay = Math.max(delay, sec * 1000);
    }
  }
  return Math.min(delay, 60_000);
}

function isOpenAIRetryableTransient(e: unknown): boolean {
  if (e instanceof RateLimitError) return true;
  if (e instanceof APIError && (e.status === 429 || e.status === 503)) return true;
  return false;
}

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
  const json = JSON.parse(clean) as Record<string, unknown>;

  // Defensive section builder — handles null / undefined / wrong-type fields
  // that OpenAI occasionally returns when the prompt is minimal (e.g. no URL).
  const section = (s: unknown) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      return { score: 0, rating: 'Moyen' as Rating, analysis: '', strengths: [], weaknesses: [] };
    }
    const o = s as Record<string, unknown>;
    return {
      score: Math.min(100, Math.max(0, Number(o.score) || 0)),
      rating: isValidRating(o.rating) ? o.rating : 'Moyen' as Rating,
      analysis: String(o.analysis ?? ''),
      strengths: Array.isArray(o.strengths) ? o.strengths.map(String) : [],
      weaknesses: Array.isArray(o.weaknesses) ? o.weaknesses.map(String) : [],
    };
  };

  // If the AI returned an error field instead of the expected structure,
  // surface it as a proper error rather than returning empty results.
  if (typeof json.error === 'string' && !json.viralityScore && !json.hook) {
    throw new Error(`IA: ${json.error}`);
  }

  return {
    viralityScore: Math.min(100, Math.max(0, Number(json.viralityScore) || 0)),
    hook:      section(json.hook),
    editing:   section(json.editing),
    retention: section(json.retention),
    improvements: Array.isArray(json.improvements)
      ? json.improvements.map((i: unknown) => {
          const o = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
          return {
            priority: isValidPriority(o.priority) ? o.priority : 'moyenne' as Priority,
            tip: String(o.tip ?? ''),
          };
        })
      : [],
    comparativeInsight:
      typeof json.comparativeInsight === 'string' ? json.comparativeInsight.trim() : undefined,
    comparativePriority:
      typeof json.comparativePriority === 'string' ? json.comparativePriority.trim() : undefined,
    strategy:  typeof json.strategy  === 'string' ? json.strategy  : undefined,
    viralTips: Array.isArray(json.viralTips)
      ? json.viralTips.map(String).filter(Boolean)
      : undefined,
  };
}

/** Prompt système court (vision) — évite de dupliquer le long systemPrompt URL. */
function systemPromptVision(): string {
  return `Expert analyse TikTok. Réponds UNIQUEMENT en JSON valide.

Règles : pas de conseils génériques ; tout doit s’appuyer sur les images ou les métriques fournies.
Images = même vidéo, ordre chronologique ; décris le visible (cadrage, texte, sujet, rythme). Pas d’audio réel.
Français.`;
}

function truncateForPrompt(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function buildVisionUserContent(
  plan: 'pro' | 'elite',
  frameCount: number,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  meta?: { durationSec?: number; tiktokUrl?: string; fileName?: string }
): string {
  const isPro = plan === 'pro';
  const tipsCount = isPro ? 5 : 10;
  const depth = isPro ? 'court (2–3 phrases/section)' : 'détaillé (4–6 phrases/section)';

  const m = observedMetrics
    ? `Stats TikTok: v=${observedMetrics.views ?? 0} l=${observedMetrics.likes ?? 0} c=${observedMetrics.comments ?? 0} s=${observedMetrics.shares ?? 0}`
    : 'Stats: n/a';

  const fn = truncateForPrompt(meta?.fileName ?? 'vidéo', 80);
  const link = meta?.tiktokUrl ? truncateForPrompt(meta.tiktokUrl, 96) : '';

  const eliteExtra = isPro
    ? ''
    : ` + strategy (string), viralTips (4 strings)`;

  return `${frameCount} frames (vertical TikTok, ordre chronologique). Fichier: ${fn} · ~${meta?.durationSec ?? '?'}s · ${m}${link ? ` · lien stats: ${link}` : ''}.
${meta?.tiktokUrl ? 'Si fichier ≠ vidéo du lien, une phrase dans comparativeInsight.' : ''}

Analyse ${depth}. ${tipsCount} tips (priorités haute/moyenne/basse selon plan Pro/Elite).

JSON: viralityScore ; hook/editing/retention {score,rating,analysis,strengths[],weaknesses[]} ; improvements[${tipsCount}] {priority,tip} ; comparativeInsight ; comparativePriority${eliteExtra}.

Règles: scores 0–100 ; hook 40% · montage 30% · rétention 30% ; tips ancrés visible + hook/montage/rétention ; français.`;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function analyzeWithOpenAIVision(
  framesBase64: string[],
  plan: Extract<Plan, 'pro' | 'elite'>,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  meta?: { durationSec?: number; tiktokUrl?: string; fileName?: string }
): Promise<AnalysisResult> {
  /**
   * Coût TPM (entrée) : ~85–170 tokens par image basse déf. selon OpenAI.
   * Ici le coût DOMINE dans les `image_url` (base64) du tableau userContent ci‑dessous,
   * pas dans le texte du prompt.
   */
  const frames = framesBase64.slice(0, VISION_MAX_FRAMES);
  const text = buildVisionUserContent(plan, frames.length, observedMetrics, meta);

  const userContent: ChatCompletionContentPart[] = [
    { type: 'text', text },
    ...frames.map((b64) => ({
      type: 'image_url' as const,
      image_url: {
        url: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
      },
    })),
  ];

  /** Limite la sortie (tokens) pour réduire charge côté modèle / cohérence TPM. */
  const maxOut = plan === 'elite' ? 2600 : 1800;

  const createParams = {
    model: OPENAI_CHAT_MODEL,
    temperature: 0.4,
    max_tokens: maxOut,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: systemPromptVision() },
      { role: 'user' as const, content: userContent },
    ],
  };

  let response: ChatCompletion | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await client.chat.completions.create(createParams);
      break;
    } catch (e) {
      if (!isOpenAIRetryableTransient(e)) throw e;
      const delay = getOpenAIRetryDelayMs(e, attempt);
      if (delay == null) throw e;
      console.warn(
        `[openai] vision retry after transient error (attempt ${attempt + 1}/3, wait ${delay}ms)`,
        e instanceof APIError ? e.status : e
      );
      await sleep(delay);
    }
  }

  if (!response) {
    throw new Error(
      'Le service IA est saturé après plusieurs tentatives. Réessaie dans une minute.'
    );
  }

  const choice = response.choices[0];
  const raw = choice?.message?.content ?? '';
  const finish = choice?.finish_reason;

  if (!raw.trim()) {
    throw new Error(
      "L'IA n'a renvoyé aucune analyse. Réessaie ; si le problème continue, essaie une vidéo plus courte ou un autre export MP4."
    );
  }

  if (finish === 'length') {
    throw new Error(
      'Réponse de l’IA interrompue (trop longue). Réessaie ; nous avons augmenté la limite côté serveur.'
    );
  }

  try {
    return parseResult(raw);
  } catch (parseErr) {
    console.error('[openai] vision parseResult failed', {
      finish,
      rawLength: raw.length,
      preview: raw.slice(0, 1200),
      err: parseErr instanceof Error ? parseErr.message : parseErr,
    });
    // Surface AI's own error message if it returned {"error":"..."}
    const aiMsg = parseErr instanceof Error && parseErr.message.startsWith('IA:')
      ? parseErr.message
      : 'Format de réponse IA inattendu. Réessaie dans un instant ; si ça persiste, contacte le support.';
    throw new Error(aiMsg);
  }
}

/** Messages utilisateur + code HTTP pour l’API (vision). */
export function mapOpenAIVisionError(e: unknown): { message: string; status: number } {
  if (e instanceof APIConnectionError) {
    return {
      message: 'Impossible de joindre le service IA. Vérifie ta connexion et réessaie.',
      status: 503,
    };
  }
  if (e instanceof APIError) {
    if (e.status === 429) {
      return {
        message:
          'OpenAI limite le débit (trop de données par requête ou trop d’appels). Réessaie dans 2 à 5 minutes. Si ça revient souvent : augmenter le quota TPM sur platform.openai.com ou espacer les analyses.',
        status: 503,
      };
    }
    if (e.status === 401) {
      return {
        message: 'Clé API OpenAI invalide ou absente (configuration serveur).',
        status: 502,
      };
    }
    if (e.status === 503 || e.status === 502) {
      return {
        message: 'Service IA temporairement indisponible. Réessaie dans quelques minutes.',
        status: 503,
      };
    }
    if (e.status === 400) {
      return {
        message: `Requête refusée par l’IA : ${e.message}`,
        status: 502,
      };
    }
    return {
      message: `Erreur du service IA (${e.status ?? '?'}). Réessaie.`,
      status: 502,
    };
  }
  if (e instanceof Error && e.message) {
    return { message: e.message, status: 502 };
  }
  return {
    message: 'Analyse vision indisponible. Réessaie dans un instant.',
    status: 502,
  };
}

export async function analyzeWithOpenAI(
  videoUrl: string,
  plan: Extract<Plan, 'pro' | 'elite'>,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  videoContext?: { caption?: string; authorUsername?: string; durationSec?: number }
): Promise<AnalysisResult> {
  const response = await client.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
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
