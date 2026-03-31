import OpenAI from 'openai';
import type { Plan } from './supabase';
import type { AnalysisResult, Rating, Priority } from './types';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Prompt builders ────────────────────────────────────────────────────────────

function systemPrompt(): string {
  return `Tu es un expert en analyse de contenu TikTok et en stratégie de viralité.
Tu analyses des vidéos TikTok et fournis des retours ultra-précis, basés sur les données et les patterns algorithmiques de TikTok.
Ton analyse est directe, technique, et orientée résultat.
Tu réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après.`;
}

function buildPrompt(
  videoUrl: string,
  plan: 'pro' | 'elite',
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number }
): string {
  const isPro = plan === 'pro';
  const tipsCount = isPro ? 5 : 10;
  const analysisDepth = isPro
    ? 'courte et directe (2-3 phrases max par section)'
    : 'détaillée et approfondie (4-6 phrases par section avec données chiffrées)';

  const eliteFields = isPro
    ? ''
    : `  "strategy": "string — 150-200 mots — stratégie personnalisée de contenu basée sur l'analyse : fréquence de publication recommandée, formats à tester, accroches optimales, public cible, et plan d'action sur 30 jours",
  "viralTips": ["string", "string", "string", "string"] — exactement 4 insights sur ce que font les créateurs viraux dans cette niche spécifique (données chiffrées, patterns observés, techniques concrètes)`;

  const metricsBlock = observedMetrics
    ? `\nMétriques observées fournies par l'utilisateur :
- vues: ${observedMetrics.views ?? 0}
- likes: ${observedMetrics.likes ?? 0}
- commentaires: ${observedMetrics.comments ?? 0}
- partages: ${observedMetrics.shares ?? 0}
`
    : '\nAucune métrique observée fournie.';

  return `Analyse cette URL de vidéo TikTok : ${videoUrl}
${metricsBlock}

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
    { "priority": <"haute"|"moyenne"|"basse">, "tip": "string" }${isPro ? ' — tips courts (1-2 phrases)' : ' — tips détaillés (3-5 phrases avec exemples concrets)'}
    ... exactement ${tipsCount} éléments
  ]${eliteFields ? `,\n  ${eliteFields.trim()}` : ''}
}

Règles :
- viralityScore = score STRUCTUREL UNIQUEMENT (hook 40%, editing 30%, retention 30%)
- rating : Excellent ≥ 80, Bon ≥ 60, Moyen ≥ 40, Faible < 40
- ${isPro ? 'Exactement 5 tips : 2 haute, 2 moyenne, 1 basse' : 'Exactement 10 tips : 4 haute, 4 moyenne, 2 basse'}
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
    strategy: typeof json.strategy === 'string' ? json.strategy : undefined,
    viralTips: Array.isArray(json.viralTips)
      ? json.viralTips.map(String).filter(Boolean)
      : undefined,
  };
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function analyzeWithOpenAI(
  videoUrl: string,
  plan: Extract<Plan, 'pro' | 'elite'>,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number }
): Promise<AnalysisResult> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: plan === 'elite' ? 2400 : 1400,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: buildPrompt(videoUrl, plan, observedMetrics) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  return parseResult(raw);
}
