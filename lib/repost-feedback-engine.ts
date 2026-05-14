import { supabase } from './supabase';

export type FeedbackLevel = 'worse' | 'same' | 'better' | 'unknown';

export interface RepostFeedbackInput {
  userId: string;
  analysisId?: string | null;
  videoId?: string;
  reposted: boolean;
  hookBetter?: boolean;
  retentionBetter?: FeedbackLevel;
  engagementBetter?: FeedbackLevel;
  performedBetter?: FeedbackLevel;
  useful?: boolean;
  satisfaction?: number;
  appliedRecommendations?: string[];
  ignoredRecommendations?: string[];
  patternKeys?: string[];
}

export interface RecommendationLearningPattern {
  patternKey: string;
  recommendation: string;
  appliedCount: number;
  ignoredCount: number;
  usefulCount: number;
  repostedCount: number;
  positiveOutcomeCount: number;
  priorityScore: number;
  confidenceScore: number;
  usefulnessScore: number;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function normalizeRecommendation(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function patternKeyFor(recommendation: string) {
  return normalizeRecommendation(recommendation)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'recommendation';
}

function positiveOutcome(input: RepostFeedbackInput) {
  return [
    input.hookBetter,
    input.retentionBetter === 'better',
    input.engagementBetter === 'better',
    input.performedBetter === 'better',
    input.useful,
  ].filter(Boolean).length;
}

export function scoreRecommendationLearning(input: {
  appliedCount: number;
  ignoredCount: number;
  usefulCount: number;
  repostedCount: number;
  positiveOutcomeCount: number;
}): Pick<RecommendationLearningPattern, 'priorityScore' | 'confidenceScore' | 'usefulnessScore'> {
  const total = input.appliedCount + input.ignoredCount;
  const usefulnessScore = clamp((input.usefulCount / Math.max(input.appliedCount, 1)) * 100);
  const confidenceScore = clamp(24 + total * 9 + input.repostedCount * 6);
  const priorityScore = clamp(
    38
      + input.appliedCount * 7
      - input.ignoredCount * 4
      + input.usefulCount * 9
      + input.repostedCount * 5
      + input.positiveOutcomeCount * 8,
  );
  return { priorityScore, confidenceScore, usefulnessScore };
}

export async function saveRepostFeedback(input: RepostFeedbackInput) {
  const satisfaction = clamp(input.satisfaction ?? (input.useful ? 82 : 55), 0, 100);
  const outcomeScore = clamp(
    35
      + (input.reposted ? 12 : 0)
      + (input.hookBetter ? 12 : 0)
      + (input.retentionBetter === 'better' ? 12 : input.retentionBetter === 'worse' ? -10 : 0)
      + (input.engagementBetter === 'better' ? 12 : input.engagementBetter === 'worse' ? -10 : 0)
      + (input.performedBetter === 'better' ? 16 : input.performedBetter === 'worse' ? -14 : 0)
      + (input.useful ? 12 : -4),
  );

  const { data, error } = await supabase
    .from('repost_feedback')
    .insert({
      user_id: input.userId,
      analysis_id: input.analysisId,
      video_id: input.videoId,
      reposted: input.reposted,
      hook_better: input.hookBetter,
      retention_better: input.retentionBetter ?? 'unknown',
      engagement_better: input.engagementBetter ?? 'unknown',
      performed_better: input.performedBetter ?? 'unknown',
      useful: input.useful,
      satisfaction,
      improvement_score: outcomeScore,
      applied_recommendations: input.appliedRecommendations ?? [],
      ignored_recommendations: input.ignoredRecommendations ?? [],
      pattern_keys: input.patternKeys ?? [],
    })
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);

  await persistRecommendationEvents(input, outcomeScore);
  return { id: (data as { id?: string } | null)?.id ?? null, outcomeScore };
}

async function persistRecommendationEvents(input: RepostFeedbackInput, outcomeScore: number) {
  const applied = (input.appliedRecommendations ?? []).map(normalizeRecommendation).filter(Boolean);
  const ignored = (input.ignoredRecommendations ?? []).map(normalizeRecommendation).filter(Boolean);
  const events = [
    ...applied.map((recommendation) => ({ recommendation, action: 'applied' })),
    ...ignored.map((recommendation) => ({ recommendation, action: 'ignored' })),
  ];
  if (!events.length) return;

  const rows = events.map((event) => ({
    user_id: input.userId,
    analysis_id: input.analysisId,
    recommendation: event.recommendation,
    pattern_key: patternKeyFor(event.recommendation),
    action: event.action,
    useful: input.useful,
    reposted: input.reposted,
    outcome_score: outcomeScore,
  }));

  const { error } = await supabase.from('recommendation_feedback_events').insert(rows);
  if (error) console.warn('[feedback-loop] event save failed:', error.message);

  await Promise.allSettled(applied.map((recommendation) => upsertLearningPattern(input.userId, recommendation, {
    applied: true,
    ignored: false,
    useful: Boolean(input.useful),
    reposted: input.reposted,
    positiveOutcome: positiveOutcome(input) >= 2,
  })));
  await Promise.allSettled(ignored.map((recommendation) => upsertLearningPattern(input.userId, recommendation, {
    applied: false,
    ignored: true,
    useful: false,
    reposted: input.reposted,
    positiveOutcome: false,
  })));
}

async function upsertLearningPattern(
  userId: string,
  recommendation: string,
  delta: { applied: boolean; ignored: boolean; useful: boolean; reposted: boolean; positiveOutcome: boolean },
) {
  const patternKey = patternKeyFor(recommendation);
  const { data } = await supabase
    .from('recommendation_learning_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_key', patternKey)
    .maybeSingle();
  const row = data as Partial<RecommendationLearningPattern> | null;
  const next = {
    appliedCount: (row?.appliedCount ?? (row as { applied_count?: number } | null)?.applied_count ?? 0) + (delta.applied ? 1 : 0),
    ignoredCount: (row?.ignoredCount ?? (row as { ignored_count?: number } | null)?.ignored_count ?? 0) + (delta.ignored ? 1 : 0),
    usefulCount: (row?.usefulCount ?? (row as { useful_count?: number } | null)?.useful_count ?? 0) + (delta.useful ? 1 : 0),
    repostedCount: (row?.repostedCount ?? (row as { reposted_count?: number } | null)?.reposted_count ?? 0) + (delta.reposted ? 1 : 0),
    positiveOutcomeCount: (row?.positiveOutcomeCount ?? (row as { positive_outcome_count?: number } | null)?.positive_outcome_count ?? 0) + (delta.positiveOutcome ? 1 : 0),
  };
  const scores = scoreRecommendationLearning(next);
  const { error } = await supabase.from('recommendation_learning_patterns').upsert({
    user_id: userId,
    pattern_key: patternKey,
    recommendation,
    applied_count: next.appliedCount,
    ignored_count: next.ignoredCount,
    useful_count: next.usefulCount,
    reposted_count: next.repostedCount,
    positive_outcome_count: next.positiveOutcomeCount,
    priority_score: scores.priorityScore,
    confidence_score: scores.confidenceScore,
    usefulness_score: scores.usefulnessScore,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,pattern_key' });
  if (error) console.warn('[feedback-loop] learning upsert failed:', error.message);
}

export async function getRecommendationLearningContext(userId: string) {
  const { data, error } = await supabase
    .from('recommendation_learning_patterns')
    .select('pattern_key,recommendation,applied_count,ignored_count,useful_count,reposted_count,positive_outcome_count,priority_score,confidence_score,usefulness_score')
    .eq('user_id', userId)
    .order('priority_score', { ascending: false })
    .limit(8);

  if (error) {
    console.warn('[feedback-loop] learning read failed:', error.message);
    return null;
  }

  const rows = (data ?? []) as Array<{
    pattern_key: string;
    recommendation: string;
    applied_count: number;
    ignored_count: number;
    useful_count: number;
    reposted_count: number;
    positive_outcome_count: number;
    priority_score: number;
    confidence_score: number;
    usefulness_score: number;
  }>;
  if (!rows.length) return null;

  return {
    summary: rows.slice(0, 4).map((row) => `${row.recommendation} (priority ${row.priority_score}, confidence ${row.confidence_score}, usefulness ${row.usefulness_score})`).join(' | '),
    patterns: rows,
  };
}
