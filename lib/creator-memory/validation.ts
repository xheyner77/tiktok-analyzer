import type { CreatorMemoryInsights, CreatorMemoryLearning, CreatorMemoryRecord } from './types';

const MAX_TEXT = 220;
const MAX_LONG_TEXT = 520;
const MAX_LIST_ITEMS = 8;

function cleanText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanList(value: unknown, limit = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const text = cleanText(entry);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length >= limit) break;
  }
  return items;
}

function clamp01(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0.45;
  return Math.max(0.05, Math.min(1, Math.round(numeric * 100) / 100));
}

function cleanLearning(value: unknown): CreatorMemoryLearning | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const insight = cleanText(record.insight, MAX_LONG_TEXT);
  const evidence = cleanText(record.evidence, MAX_LONG_TEXT);
  if (!insight || !evidence) return null;
  return {
    type: typeof record.type === 'string' ? record.type as CreatorMemoryLearning['type'] : 'experiment',
    insight,
    evidence,
    confidence: clamp01(record.confidence),
  };
}

export function normalizeMemoryInsights(raw: unknown): CreatorMemoryInsights {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const updates = record.creator_profile_updates && typeof record.creator_profile_updates === 'object' && !Array.isArray(record.creator_profile_updates)
    ? record.creator_profile_updates as Record<string, unknown>
    : {};

  return {
    new_learnings: Array.isArray(record.new_learnings)
      ? record.new_learnings.map(cleanLearning).filter((item): item is CreatorMemoryLearning => Boolean(item)).slice(0, 6)
      : [],
    creator_profile_updates: {
      niche: cleanText(updates.niche),
      audience_profile: cleanText(updates.audience_profile, MAX_LONG_TEXT),
      creator_voice: cleanText(updates.creator_voice),
      content_style: cleanText(updates.content_style),
      hook_style: cleanText(updates.hook_style),
      editing_style: cleanText(updates.editing_style),
      cta_style: cleanText(updates.cta_style),
    },
    winning_patterns: cleanList(record.winning_patterns),
    weak_patterns: cleanList(record.weak_patterns),
    recurring_mistakes: cleanList(record.recurring_mistakes),
    winning_hooks: cleanList(record.winning_hooks, 6),
    losing_hooks: cleanList(record.losing_hooks, 6),
    retention_patterns: cleanList(record.retention_patterns),
    topic_patterns: cleanList(record.topic_patterns),
    vocabulary_patterns: cleanList(record.vocabulary_patterns),
    pacing_patterns: cleanList(record.pacing_patterns),
    format_preferences: cleanList(record.format_preferences),
    next_experiments: cleanList(record.next_experiments),
    do_more_of: cleanList(record.do_more_of),
    avoid_doing: cleanList(record.avoid_doing),
  };
}

export function emptyCreatorMemory(userId: string): CreatorMemoryRecord {
  return {
    user_id: userId,
    version: 1,
    memory_level: 0,
    confidence_score: 0,
    total_analyses_learned_from: 0,
    last_analysis_id: null,
    last_learned_at: null,
    profile_summary: '',
    niche: '',
    audience_profile: '',
    creator_voice: '',
    content_style: '',
    hook_style: '',
    editing_style: '',
    cta_style: '',
    strongest_patterns: [],
    weakest_patterns: [],
    recurring_mistakes: [],
    winning_hooks: [],
    losing_hooks: [],
    retention_patterns: [],
    topic_patterns: [],
    vocabulary_patterns: [],
    pacing_patterns: [],
    format_preferences: [],
    do_more_of: [],
    avoid_doing: [],
    next_experiments: [],
    raw_memory_json: {},
  };
}

export function normalizeCreatorMemoryRow(userId: string, row: Record<string, unknown> | null | undefined): CreatorMemoryRecord | null {
  if (!row) return null;
  const list = (key: string) => cleanList(row[key], 10);
  return {
    id: cleanText(row.id),
    user_id: cleanText(row.user_id) || userId,
    version: Number(row.version) || 1,
    memory_level: Math.max(0, Math.min(100, Math.round(Number(row.memory_level) || 0))),
    confidence_score: clamp01(row.confidence_score),
    total_analyses_learned_from: Math.max(0, Math.round(Number(row.total_analyses_learned_from) || 0)),
    last_analysis_id: cleanText(row.last_analysis_id) || null,
    last_learned_at: cleanText(row.last_learned_at) || null,
    profile_summary: cleanText(row.profile_summary, MAX_LONG_TEXT),
    niche: cleanText(row.niche),
    audience_profile: cleanText(row.audience_profile, MAX_LONG_TEXT),
    creator_voice: cleanText(row.creator_voice),
    content_style: cleanText(row.content_style),
    hook_style: cleanText(row.hook_style),
    editing_style: cleanText(row.editing_style),
    cta_style: cleanText(row.cta_style),
    strongest_patterns: list('strongest_patterns'),
    weakest_patterns: list('weakest_patterns'),
    recurring_mistakes: list('recurring_mistakes'),
    winning_hooks: list('winning_hooks'),
    losing_hooks: list('losing_hooks'),
    retention_patterns: list('retention_patterns'),
    topic_patterns: list('topic_patterns'),
    vocabulary_patterns: list('vocabulary_patterns'),
    pacing_patterns: list('pacing_patterns'),
    format_preferences: list('format_preferences'),
    do_more_of: list('do_more_of'),
    avoid_doing: list('avoid_doing'),
    next_experiments: list('next_experiments'),
    raw_memory_json: row.raw_memory_json && typeof row.raw_memory_json === 'object' && !Array.isArray(row.raw_memory_json)
      ? row.raw_memory_json as Record<string, unknown>
      : {},
    created_at: cleanText(row.created_at) || undefined,
    updated_at: cleanText(row.updated_at) || undefined,
  };
}
