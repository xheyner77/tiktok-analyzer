import OpenAI from 'openai';
import { OPENAI_CHAT_MODEL } from '@/lib/openai-models';
import type { AnalysisResult } from '@/lib/types';
import { getMemoryPlanLimits } from './limits';
import type { ExtractedMemoryFact, LearnFromAnalysisInput, MemoryExtractionResult, MemoryFactType, MemoryPlan } from './types';
import { logMemoryUsage } from './usage';
import { sanitizeExtractedFacts } from './quality';

const FACT_TYPES: MemoryFactType[] = ['hook', 'mistake', 'format', 'cta', 'retention', 'v2', 'style', 'structure', 'audience', 'risk'];

function cleanText(value: unknown, max = 220): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

function addFact(facts: ExtractedMemoryFact[], fact: ExtractedMemoryFact) {
  facts.push(fact);
}

export function extractDeterministicMemoryFacts(result: AnalysisResult, maxFacts: number): MemoryExtractionResult {
  const facts: ExtractedMemoryFact[] = [];
  const hookWeakness = result.hook?.weaknesses?.[0];
  const hookStrength = result.hook?.strengths?.[0];
  const retentionWeakness = result.retention?.weaknesses?.[0];
  const editingWeakness = result.editing?.weaknesses?.[0];
  const topImprovement = result.improvements?.find((item) => item.priority === 'haute') ?? result.improvements?.[0];
  const caption = result.detectedVideoMeta?.caption;
  const format = (result.videoIntelligence as { visualPattern?: string } | undefined)?.visualPattern ?? result.analyzerMeta?.objectiveLabel;
  const cta = result.repostVersion?.cta ?? result.reconstructionIA?.ctaRecommendations?.[0]?.cta;
  const altHook = result.repostVersion?.hook ?? result.reconstructionIA?.alternativeHooks?.[0]?.hook;
  const v2 = result.reconstructionIA?.retentionFixes?.[0]?.fix ?? result.comparativePriority ?? topImprovement?.tip;

  if (hookWeakness) {
    addFact(facts, {
      type: 'mistake',
      title: 'Hook à resserrer',
      content: `Le hook montre un point faible récurrent : ${hookWeakness}`,
      evidence: result.hook.analysis || hookWeakness,
      confidenceScore: 72,
      importanceScore: 78,
    });
  }

  if (hookStrength || altHook) {
    addFact(facts, {
      type: 'hook',
      title: 'Style de hook observé',
      content: altHook ? `Un angle de hook exploitable ressort : ${altHook}` : `Le hook fonctionne mieux quand il s'appuie sur : ${hookStrength}`,
      evidence: result.hook.analysis || hookStrength || altHook || '',
      confidenceScore: 68,
      importanceScore: 72,
    });
  }

  if (retentionWeakness) {
    addFact(facts, {
      type: 'retention',
      title: 'Risque de décrochage',
      content: `La rétention baisse quand : ${retentionWeakness}`,
      evidence: result.retention.analysis || retentionWeakness,
      confidenceScore: 70,
      importanceScore: 80,
    });
  }

  if (editingWeakness) {
    addFact(facts, {
      type: 'structure',
      title: 'Structure à corriger',
      content: `Le montage crée une friction répétable : ${editingWeakness}`,
      evidence: result.editing.analysis || editingWeakness,
      confidenceScore: 68,
      importanceScore: 72,
    });
  }

  if (topImprovement) {
    addFact(facts, {
      type: 'v2',
      title: 'V2 prioritaire',
      content: `La prochaine V2 doit tester : ${topImprovement.tip}`,
      evidence: result.finalVerdict || result.comparativePriority || topImprovement.tip,
      confidenceScore: topImprovement.priority === 'haute' ? 78 : 62,
      importanceScore: topImprovement.priority === 'haute' ? 84 : 64,
    });
  }

  if (format) {
    addFact(facts, {
      type: 'format',
      title: 'Format observé',
      content: `Le format à mémoriser pour comparaison future : ${format}`,
      evidence: result.analyzerMeta?.objectiveLabel || result.detectedVideoMeta?.caption || result.finalVerdict || String(format),
      confidenceScore: 58,
      importanceScore: 55,
    });
  }

  if (cta) {
    addFact(facts, {
      type: 'cta',
      title: 'CTA à comparer',
      content: `Un CTA recommandé ressort : ${cta}`,
      evidence: result.reconstructionIA?.ctaRecommendations?.[0]?.why || result.repostVersion?.cta || cta,
      confidenceScore: 62,
      importanceScore: 60,
    });
  }

  if (caption) {
    addFact(facts, {
      type: 'style',
      title: 'Style de sujet observé',
      content: `Le contenu analysé donne un signal de style : ${caption}`,
      evidence: caption,
      confidenceScore: 50,
      importanceScore: 46,
    });
  }

  if (v2 && !facts.some((fact) => fact.type === 'v2')) {
    addFact(facts, {
      type: 'v2',
      title: 'Angle V2 à retester',
      content: `La V2 à prioriser : ${v2}`,
      evidence: result.finalVerdict || v2,
      confidenceScore: 65,
      importanceScore: 70,
    });
  }

  const cleaned = sanitizeExtractedFacts(facts, maxFacts);
  return {
    facts: cleaned,
    profileUpdates: {
      creatorStyleSummary: cleaned.find((fact) => fact.type === 'style')?.content,
      hookStyleSummary: cleaned.find((fact) => fact.type === 'hook')?.content,
      commonMistakesSummary: cleaned.find((fact) => fact.type === 'mistake')?.content,
      strongestFormatsSummary: cleaned.find((fact) => fact.type === 'format')?.content,
      weakPatternsSummary: cleaned.find((fact) => fact.type === 'retention' || fact.type === 'structure')?.content,
      v2OpportunitiesSummary: cleaned.find((fact) => fact.type === 'v2')?.content,
    },
  };
}

function parseExtractionJson(raw: string, maxFacts: number): MemoryExtractionResult | null {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean) as {
      facts?: Array<Partial<ExtractedMemoryFact>>;
      profileUpdates?: Record<string, string>;
    };
    const facts = sanitizeExtractedFacts(
      (parsed.facts ?? []).map((fact) => ({
        type: fact.type as MemoryFactType,
        title: String(fact.title ?? ''),
        content: String(fact.content ?? ''),
        evidence: String(fact.evidence ?? ''),
        confidenceScore: Number(fact.confidenceScore ?? 0),
        importanceScore: Number(fact.importanceScore ?? 0),
        metadata: fact.metadata,
      })),
      maxFacts
    );
    return {
      facts,
      profileUpdates: {
        creatorStyleSummary: cleanText(parsed.profileUpdates?.creatorStyleSummary, 420),
        hookStyleSummary: cleanText(parsed.profileUpdates?.hookStyleSummary, 420),
        commonMistakesSummary: cleanText(parsed.profileUpdates?.commonMistakesSummary, 420),
        strongestFormatsSummary: cleanText(parsed.profileUpdates?.strongestFormatsSummary, 420),
        weakPatternsSummary: cleanText(parsed.profileUpdates?.weakPatternsSummary, 420),
        v2OpportunitiesSummary: cleanText(parsed.profileUpdates?.v2OpportunitiesSummary, 420),
      },
    };
  } catch {
    return null;
  }
}

async function extractWithOpenAI(input: LearnFromAnalysisInput, plan: MemoryPlan, maxFacts: number): Promise<MemoryExtractionResult | null> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') return null;

  const model = process.env.OPENAI_MEMORY_MODEL || OPENAI_CHAT_MODEL;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const compactAnalysis = {
    score: input.analysisResult.viralityScore,
    finalVerdict: input.analysisResult.finalVerdict,
    comparativePriority: input.analysisResult.comparativePriority,
    hook: input.analysisResult.hook,
    retention: input.analysisResult.retention,
    editing: input.analysisResult.editing,
    improvements: input.analysisResult.improvements?.slice(0, 5),
    repostVersion: input.analysisResult.repostVersion,
    reconstructionIA: input.analysisResult.reconstructionIA
      ? {
          alternativeHooks: input.analysisResult.reconstructionIA.alternativeHooks?.slice(0, 3),
          ctaRecommendations: input.analysisResult.reconstructionIA.ctaRecommendations?.slice(0, 2),
          retentionFixes: input.analysisResult.reconstructionIA.retentionFixes?.slice(0, 3),
          cutsRecommended: input.analysisResult.reconstructionIA.cutsRecommended?.slice(0, 3),
        }
      : undefined,
    videoMetadata: input.videoMetadata,
  };
  const prompt = [
    'Extrais une mémoire créateur Viralynz depuis cette vraie analyse vidéo.',
    'Retourne uniquement du JSON strict. Aucun conseil générique, aucun score inventé, aucun pattern sans preuve.',
    `Maximum facts: ${maxFacts}. Types autorisés: ${FACT_TYPES.join(', ')}.`,
    'Chaque fact doit être court, concret, réutilisable pour futures analyses/hooks, et contenir une preuve issue de l’analyse.',
    'Format: {"facts":[{"type":"hook","title":"...","content":"...","evidence":"...","confidenceScore":80,"importanceScore":70}],"profileUpdates":{"creatorStyleSummary":"...","hookStyleSummary":"...","commonMistakesSummary":"...","strongestFormatsSummary":"...","weakPatternsSummary":"...","v2OpportunitiesSummary":"..."}}',
    JSON.stringify(compactAnalysis).slice(0, 12000),
  ].join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.15,
      max_tokens: 1400,
      messages: [
        { role: 'system', content: 'Tu es le moteur mémoire d’un SaaS d’analyse TikTok. Tu extrais uniquement des patterns prouvés par l’analyse fournie.' },
        { role: 'user', content: prompt },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    await logMemoryUsage({
      userId: input.userId,
      plan,
      operation: 'extraction',
      model,
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil(raw.length / 4),
      estimatedCostUsd: 0,
    });
    return parseExtractionJson(raw, maxFacts);
  } catch (error) {
    console.warn('[memory] OpenAI extraction failed, using deterministic fallback:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function extractMemoryFromAnalysis(input: LearnFromAnalysisInput): Promise<MemoryExtractionResult> {
  const limits = getMemoryPlanLimits(input.plan);
  if (!limits.canLearn) return { facts: [], profileUpdates: {} };

  const deterministic = extractDeterministicMemoryFacts(input.analysisResult, limits.factsPerAnalysis);
  const ai = await extractWithOpenAI(input, limits.plan, limits.factsPerAnalysis);
  if (!ai?.facts.length) return deterministic;

  return {
    facts: sanitizeExtractedFacts([...ai.facts, ...deterministic.facts], limits.factsPerAnalysis),
    profileUpdates: {
      ...deterministic.profileUpdates,
      ...ai.profileUpdates,
    },
  };
}
