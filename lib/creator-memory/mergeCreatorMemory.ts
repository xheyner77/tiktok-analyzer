import type { CreatorMemoryInsights, CreatorMemoryRecord, MemoryAnalysisSource } from './types';
import { emptyCreatorMemory } from './validation';

const LIST_LIMIT = 8;
const LONG_LIST_LIMIT = 10;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clean(value: string | undefined, max = 260) {
  return (value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeKey(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function mergeList(current: string[], incoming: string[], limit = LIST_LIMIT): string[] {
  const scored = new Map<string, { value: string; score: number }>();
  current.forEach((value, index) => {
    const text = clean(value);
    if (!text) return;
    scored.set(normalizeKey(text), { value: text, score: 100 - index * 2 });
  });
  incoming.forEach((value, index) => {
    const text = clean(value);
    if (!text) return;
    const key = normalizeKey(text);
    const existing = scored.get(key);
    const score = (existing?.score ?? 0) + 24 - index;
    scored.set(key, { value: existing?.value ?? text, score });
  });
  return [...scored.values()]
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((item) => item.value);
}

function chooseText(current: string, incoming?: string, incomingConfidence = 0.5) {
  const next = clean(incoming);
  if (!next) return current;
  if (!current) return next;
  if (incomingConfidence >= 0.72 && next.length >= 10) return next;
  return current;
}

function summarize(memory: CreatorMemoryRecord) {
  const parts = [
    memory.niche ? `Niche: ${memory.niche}` : undefined,
    memory.creator_voice ? `Voix: ${memory.creator_voice}` : undefined,
    memory.weakest_patterns[0] ? `Erreur recurrente: ${memory.weakest_patterns[0]}` : undefined,
    memory.strongest_patterns[0] ? `Pattern fort: ${memory.strongest_patterns[0]}` : undefined,
    memory.next_experiments[0] ? `Prochain test: ${memory.next_experiments[0]}` : undefined,
  ].filter(Boolean);
  return parts.join(' | ').slice(0, 520);
}

function confidenceFromInsights(insights: CreatorMemoryInsights) {
  const values = insights.new_learnings.map((learning) => learning.confidence).filter(Number.isFinite);
  if (!values.length) return 0.45;
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length, 0.05, 1);
}

export function getCreatorMemoryLevelLabel(level: number) {
  if (level >= 85) return 'Memoire mature';
  if (level >= 60) return 'Avance';
  if (level >= 30) return 'Personnalise';
  if (level >= 10) return 'En apprentissage';
  return 'Nouveau';
}

export function mergeCreatorMemory(input: {
  previous: CreatorMemoryRecord | null;
  insights: CreatorMemoryInsights;
  source: MemoryAnalysisSource;
}): CreatorMemoryRecord {
  const previous = input.previous ?? emptyCreatorMemory(input.source.userId);
  const confidence = confidenceFromInsights(input.insights);
  const nextCount = previous.total_analyses_learned_from + 1;
  const strongSignals = input.insights.new_learnings
    .filter((learning) => learning.confidence >= 0.62)
    .map((learning) => learning.insight);
  const weakSignals = input.insights.new_learnings
    .filter((learning) => /faible|lent|tard|cta|drop|explique|generique|confus/i.test(learning.insight))
    .map((learning) => learning.insight);
  const strongPatternCount = new Set([
    ...previous.strongest_patterns,
    ...input.insights.winning_patterns,
    ...strongSignals,
  ].map(normalizeKey)).size;
  const confidenceScore = clamp(
    previous.confidence_score
      ? previous.confidence_score * 0.72 + confidence * 0.28
      : confidence,
    0,
    1
  );
  const memoryLevel = clamp(
    Math.round(nextCount * 8 + confidenceScore * 30 + strongPatternCount * 3),
    0,
    100
  );

  const updates = input.insights.creator_profile_updates;
  const now = new Date().toISOString();
  const merged: CreatorMemoryRecord = {
    ...previous,
    version: previous.version + 1,
    memory_level: memoryLevel,
    confidence_score: Math.round(confidenceScore * 1000) / 1000,
    total_analyses_learned_from: nextCount,
    last_analysis_id: input.source.analysisId,
    last_learned_at: now,
    niche: chooseText(previous.niche, updates.niche, confidence),
    audience_profile: chooseText(previous.audience_profile, updates.audience_profile, confidence),
    creator_voice: chooseText(previous.creator_voice, updates.creator_voice, confidence),
    content_style: chooseText(previous.content_style, updates.content_style, confidence),
    hook_style: chooseText(previous.hook_style, updates.hook_style, confidence),
    editing_style: chooseText(previous.editing_style, updates.editing_style, confidence),
    cta_style: chooseText(previous.cta_style, updates.cta_style, confidence),
    strongest_patterns: mergeList(previous.strongest_patterns, [...input.insights.winning_patterns, ...strongSignals], LONG_LIST_LIMIT),
    weakest_patterns: mergeList(previous.weakest_patterns, [...input.insights.weak_patterns, ...weakSignals], LONG_LIST_LIMIT),
    recurring_mistakes: mergeList(previous.recurring_mistakes, input.insights.recurring_mistakes),
    winning_hooks: mergeList(previous.winning_hooks, input.insights.winning_hooks, 6),
    losing_hooks: mergeList(previous.losing_hooks, input.insights.losing_hooks, 6),
    retention_patterns: mergeList(previous.retention_patterns, input.insights.retention_patterns),
    topic_patterns: mergeList(previous.topic_patterns, input.insights.topic_patterns),
    vocabulary_patterns: mergeList(previous.vocabulary_patterns, input.insights.vocabulary_patterns),
    pacing_patterns: mergeList(previous.pacing_patterns, input.insights.pacing_patterns),
    format_preferences: mergeList(previous.format_preferences, input.insights.format_preferences),
    do_more_of: mergeList(previous.do_more_of, input.insights.do_more_of),
    avoid_doing: mergeList(previous.avoid_doing, input.insights.avoid_doing),
    next_experiments: mergeList(previous.next_experiments, input.insights.next_experiments),
    raw_memory_json: {
      lastInsights: input.insights,
      levelLabel: getCreatorMemoryLevelLabel(memoryLevel),
      lastSource: {
        analysisId: input.source.analysisId,
        videoUrl: input.source.videoUrl,
      },
    },
  };

  return {
    ...merged,
    profile_summary: summarize(merged),
  };
}
