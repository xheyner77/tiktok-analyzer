import OpenAI from 'openai';
import { OPENAI_CHAT_MODEL } from '@/lib/openai-models';
import type { AnalysisResult } from '@/lib/types';
import type { CreatorMemoryInsights, CreatorMemoryLearning, CreatorMemoryRecord, MemoryAnalysisSource } from './types';
import { normalizeMemoryInsights } from './validation';
import { buildCreatorMemoryContext } from './buildCreatorMemoryContext';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 45_000,
});

function safeJoin(values: Array<string | undefined | null>, separator = ' ') {
  return values.filter((value): value is string => Boolean(value && value.trim())).join(separator);
}

function listFromResult(result: AnalysisResult) {
  const diagnostics = result.structuredDiagnostics ?? result.coachAnalysis?.detectedProblems?.map((problem) => ({
    title: problem.title,
    evidence: problem.impact,
    fix: problem.action,
  })) ?? [];
  return {
    weaknesses: [
      ...(result.hook?.weaknesses ?? []),
      ...(result.retention?.weaknesses ?? []),
      ...(result.editing?.weaknesses ?? []),
      ...diagnostics.map((item) => item.title),
    ].filter(Boolean).slice(0, 8),
    strengths: [
      ...(result.hook?.strengths ?? []),
      ...(result.retention?.strengths ?? []),
      ...(result.editing?.strengths ?? []),
    ].filter(Boolean).slice(0, 6),
    recommendations: [
      ...(result.actionPlan ?? []),
      ...(result.improvements ?? []).map((item) => item.tip),
      ...(result.coachAnalysis?.priorityActions?.critical ?? []),
      ...(result.coachAnalysis?.priorityActions?.important ?? []),
    ].filter(Boolean).slice(0, 8),
    hooks: [
      result.repostVersion?.hook,
      ...(result.repostVersion?.hookVariants ?? []),
      ...(result.coachAnalysis?.hookVariants ?? []),
      ...(result.reconstructionIA?.alternativeHooks?.map((item) => item.hook) ?? []),
    ].filter(Boolean).slice(0, 8) as string[],
  };
}

function fallbackInsights(source: MemoryAnalysisSource): CreatorMemoryInsights {
  const result = source.result;
  const extracted = listFromResult(result);
  const firstWeakness = extracted.weaknesses[0];
  const firstRecommendation = extracted.recommendations[0];
  const hookScore = result.hook?.score ?? result.viralityScore ?? 50;
  const retentionScore = result.retention?.score ?? result.viralityScore ?? 50;
  const ctaScore = result.coachAnalysis?.subScores?.cta ?? result.viralityScore ?? 50;
  const newLearnings: CreatorMemoryLearning[] = [];
  if (firstWeakness) {
    newLearnings.push({
          type: 'hook_pattern' as const,
          insight: firstWeakness,
          evidence: 'Apprentissage extrait du diagnostic Viralynz de cette analyse.',
          confidence: hookScore < 55 ? 0.7 : 0.55,
        });
  }
  if (retentionScore < 60) {
    newLearnings.push({
          type: 'retention_pattern' as const,
          insight: 'La preuve ou le payoff arrive probablement trop tard pour tenir la retention.',
          evidence: `Score retention ${retentionScore}/100 sur l'analyse source.`,
          confidence: 0.62,
        });
  }
  if (ctaScore < 60) {
    newLearnings.push({
          type: 'cta_pattern' as const,
          insight: 'Le CTA revient comme levier a rendre plus concret et plus simple a executer.',
          evidence: `Score CTA ${ctaScore}/100 sur l'analyse source.`,
          confidence: 0.6,
        });
  }

  return normalizeMemoryInsights({
    new_learnings: newLearnings,
    creator_profile_updates: {
      niche: result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche,
      audience_profile: result.analyzerMeta?.objectiveLabel ?? result.analyzerMeta?.objective,
      content_style: result.coachAnalysis?.patternLabel ?? result.coachAnalysis?.detectedVideoFormat?.primary,
      hook_style: hookScore >= 70 ? 'Hook deja clair, a renforcer avec preuve rapide.' : 'Hook a rendre moins explicatif et plus tendu.',
      cta_style: ctaScore >= 70 ? 'CTA plutot clair.' : 'CTA a raccourcir et rendre plus actionnable.',
    },
    winning_patterns: extracted.strengths,
    weak_patterns: extracted.weaknesses,
    recurring_mistakes: extracted.weaknesses.slice(0, 4),
    winning_hooks: hookScore >= 70 ? extracted.hooks.slice(0, 3) : [],
    losing_hooks: hookScore < 60 ? extracted.hooks.slice(0, 3) : [],
    retention_patterns: retentionScore < 65 ? ['Surveiller la zone 3s-8s et avancer la preuve avant le premier drop.'] : [],
    topic_patterns: [result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche].filter(Boolean),
    format_preferences: [result.coachAnalysis?.patternLabel ?? result.coachAnalysis?.detectedVideoFormat?.primary].filter(Boolean),
    next_experiments: firstRecommendation ? [firstRecommendation] : [],
    do_more_of: extracted.strengths.slice(0, 3),
    avoid_doing: extracted.weaknesses.slice(0, 3),
  });
}

function buildExtractionPrompt(source: MemoryAnalysisSource, previous: CreatorMemoryRecord | null) {
  const result = source.result;
  const extracted = listFromResult(result);
  return [
    'Tu es le moteur Memoire Createur de Viralynz.',
    'Ta mission: extraire uniquement ce que cette analyse reelle apprend sur le createur. Pas de donnees inventees.',
    'Chaque apprentissage doit avoir une evidence issue du diagnostic, du transcript, des scores ou des recommandations.',
    'Ne stocke aucune information personnelle inutile. Reste concis et actionnable.',
    '',
    previous ? buildCreatorMemoryContext(previous) : 'Memoire precedente: vide.',
    '',
    'ANALYSE SOURCE:',
    JSON.stringify({
      analysisId: source.analysisId,
      score: result.viralityScore,
      hookScore: result.hook?.score,
      retentionScore: result.retention?.score,
      editingScore: result.editing?.score,
      ctaScore: result.coachAnalysis?.subScores?.cta,
      niche: result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche,
      objective: result.analyzerMeta?.objectiveLabel ?? result.analyzerMeta?.objective,
      format: result.coachAnalysis?.patternLabel ?? result.coachAnalysis?.detectedVideoFormat?.primary,
      weaknesses: extracted.weaknesses,
      strengths: extracted.strengths,
      recommendations: extracted.recommendations,
      hooks: extracted.hooks,
      transcript: source.transcript?.slice(0, 1800),
    }, null, 2),
    '',
    'JSON strict attendu:',
    '{ "new_learnings": [{"type":"hook_pattern|retention_pattern|editing_pattern|cta_pattern|topic_pattern|voice_pattern|format_pattern|experiment","insight":"...","evidence":"...","confidence":0.0}], "creator_profile_updates": {"niche":"...","audience_profile":"...","creator_voice":"...","content_style":"...","hook_style":"...","editing_style":"...","cta_style":"..."}, "winning_patterns": [], "weak_patterns": [], "recurring_mistakes": [], "winning_hooks": [], "losing_hooks": [], "retention_patterns": [], "topic_patterns": [], "vocabulary_patterns": [], "pacing_patterns": [], "format_preferences": [], "next_experiments": [], "do_more_of": [], "avoid_doing": [] }',
  ].join('\n');
}

function parseJson(raw: string): unknown {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

export async function extractMemoryInsights(input: {
  source: MemoryAnalysisSource;
  previousMemory: CreatorMemoryRecord | null;
}): Promise<CreatorMemoryInsights> {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here');
  if (!hasOpenAI) return fallbackInsights(input.source);

  try {
    const response = await client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.18,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Tu extrais une memoire createur privee pour Viralynz. JSON strict uniquement. Tu n inventes rien.',
        },
        {
          role: 'user',
          content: buildExtractionPrompt(input.source, input.previousMemory),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const normalized = normalizeMemoryInsights(parseJson(raw));
    if (!normalized.new_learnings.length && !safeJoin(Object.values(normalized.creator_profile_updates)).trim()) {
      return fallbackInsights(input.source);
    }
    return normalized;
  } catch (error) {
    console.warn('[creator-memory-v2] extraction failed, using fallback:', error instanceof Error ? error.message : error);
    return fallbackInsights(input.source);
  }
}
