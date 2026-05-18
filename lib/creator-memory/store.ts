import { supabase } from '@/lib/supabase';
import type { CreatorMemoryEventRecord, CreatorMemoryInsights, CreatorMemoryRecord } from './types';
import { normalizeCreatorMemoryRow, normalizeMemoryInsights } from './validation';

export async function getCreatorMemory(userId: string): Promise<CreatorMemoryRecord | null> {
  const { data, error } = await supabase
    .from('creator_memories')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[creator-memory-v2] read failed:', error.message);
    return null;
  }

  return normalizeCreatorMemoryRow(userId, data as Record<string, unknown> | null);
}

export async function upsertCreatorMemory(memory: CreatorMemoryRecord): Promise<CreatorMemoryRecord | null> {
  const { data, error } = await supabase
    .from('creator_memories')
    .upsert({
      user_id: memory.user_id,
      version: memory.version,
      memory_level: memory.memory_level,
      confidence_score: memory.confidence_score,
      total_analyses_learned_from: memory.total_analyses_learned_from,
      last_analysis_id: memory.last_analysis_id,
      last_learned_at: memory.last_learned_at,
      profile_summary: memory.profile_summary,
      niche: memory.niche,
      audience_profile: memory.audience_profile,
      creator_voice: memory.creator_voice,
      content_style: memory.content_style,
      hook_style: memory.hook_style,
      editing_style: memory.editing_style,
      cta_style: memory.cta_style,
      strongest_patterns: memory.strongest_patterns,
      weakest_patterns: memory.weakest_patterns,
      recurring_mistakes: memory.recurring_mistakes,
      winning_hooks: memory.winning_hooks,
      losing_hooks: memory.losing_hooks,
      retention_patterns: memory.retention_patterns,
      topic_patterns: memory.topic_patterns,
      vocabulary_patterns: memory.vocabulary_patterns,
      pacing_patterns: memory.pacing_patterns,
      format_preferences: memory.format_preferences,
      do_more_of: memory.do_more_of,
      avoid_doing: memory.avoid_doing,
      next_experiments: memory.next_experiments,
      raw_memory_json: memory.raw_memory_json,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    console.warn('[creator-memory-v2] upsert failed:', error.message);
    return null;
  }

  return normalizeCreatorMemoryRow(memory.user_id, data as Record<string, unknown>);
}

export async function insertCreatorMemoryEvent(input: {
  userId: string;
  analysisId: string | null;
  eventType: string;
  insights: CreatorMemoryInsights;
  beforeSummary: string;
  afterSummary: string;
  confidenceDelta: number;
}): Promise<void> {
  const { error } = await supabase.from('creator_memory_events').insert({
    user_id: input.userId,
    analysis_id: input.analysisId,
    event_type: input.eventType,
    extracted_insights_json: input.insights,
    memory_before_summary: input.beforeSummary,
    memory_after_summary: input.afterSummary,
    confidence_delta: input.confidenceDelta,
  });

  if (error) {
    console.warn('[creator-memory-v2] event insert failed:', error.message);
  }
}

export async function getCreatorMemoryEvents(userId: string, limit = 10): Promise<CreatorMemoryEventRecord[]> {
  const { data, error } = await supabase
    .from('creator_memory_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(30, limit)));

  if (error) {
    console.warn('[creator-memory-v2] events read failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id ?? ''),
      user_id: String(record.user_id ?? userId),
      analysis_id: typeof record.analysis_id === 'string' ? record.analysis_id : null,
      event_type: String(record.event_type ?? 'analysis_learned'),
      extracted_insights_json: normalizeMemoryInsights(record.extracted_insights_json),
      memory_before_summary: String(record.memory_before_summary ?? ''),
      memory_after_summary: String(record.memory_after_summary ?? ''),
      confidence_delta: Number(record.confidence_delta) || 0,
      created_at: String(record.created_at ?? new Date().toISOString()),
    };
  }).filter((event) => event.id);
}

export async function resetCreatorMemory(userId: string): Promise<boolean> {
  const { error: eventsError } = await supabase
    .from('creator_memory_events')
    .delete()
    .eq('user_id', userId);

  if (eventsError) {
    console.warn('[creator-memory-v2] events reset failed:', eventsError.message);
  }

  const { error } = await supabase
    .from('creator_memories')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.warn('[creator-memory-v2] reset failed:', error.message);
    return false;
  }

  return true;
}

export async function ignoreCreatorMemoryEvent(userId: string, eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('creator_memory_events')
    .delete()
    .eq('user_id', userId)
    .eq('id', eventId);

  if (error) {
    console.warn('[creator-memory-v2] ignore event failed:', error.message);
    return false;
  }

  return true;
}
