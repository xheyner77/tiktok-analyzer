import { supabase } from '@/lib/supabase';
import type {
  CreatorMemoryFact,
  CreatorMemoryJob,
  CreatorMemoryProfile,
  CreatorMemorySnapshot,
  ExtractedMemoryFact,
  MemoryFactType,
  MemoryPlan,
  MemoryProfileUpdates,
} from './types';
import { calculateMemoryScore, getMemoryPlanLimits } from './limits';
import { isSimilarMemoryFact, memoryTextSimilarity, normalizeMemoryText } from './similarity';

const FACT_TYPES: MemoryFactType[] = ['hook', 'mistake', 'format', 'cta', 'retention', 'v2', 'style', 'structure', 'audience', 'risk'];

export async function getMemoryProfile(userId: string): Promise<CreatorMemoryProfile | null> {
  const { data, error } = await supabase
    .from('creator_memory_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[memory] profile read failed:', error.message);
    return null;
  }

  return (data as CreatorMemoryProfile | null) ?? null;
}

export async function ensureMemoryProfile(userId: string, planInput: string): Promise<CreatorMemoryProfile | null> {
  const limits = getMemoryPlanLimits(planInput);
  const existing = await getMemoryProfile(userId);
  if (existing) {
    if (existing.plan === limits.plan && existing.memory_tier === limits.tier) return existing;
    const { data, error } = await supabase
      .from('creator_memory_profiles')
      .update({ plan: limits.plan, memory_tier: limits.tier, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) {
      console.warn('[memory] profile plan update failed:', error.message);
      return existing;
    }
    return (data as CreatorMemoryProfile | null) ?? existing;
  }

  const { data, error } = await supabase
    .from('creator_memory_profiles')
    .insert({
      user_id: userId,
      plan: limits.plan,
      memory_tier: limits.tier,
      memory_score: 0,
      analyses_learned: 0,
      active_facts_count: 0,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[memory] profile create failed:', error.message);
    return null;
  }

  return (data as CreatorMemoryProfile | null) ?? null;
}

export async function updateMemoryProfile(input: {
  userId: string;
  plan: string;
  updates?: MemoryProfileUpdates;
  analysisLearned?: boolean;
}): Promise<CreatorMemoryProfile | null> {
  const existing = await ensureMemoryProfile(input.userId, input.plan);
  const limits = getMemoryPlanLimits(input.plan);
  const activeFacts = await listMemoryFacts(input.userId, { limit: 1000 });
  const avgConfidence = activeFacts.length
    ? activeFacts.reduce((sum, fact) => sum + fact.confidence_score, 0) / activeFacts.length
    : 0;
  const analysesLearned = (existing?.analyses_learned ?? 0) + (input.analysisLearned ? 1 : 0);
  const memoryScore = calculateMemoryScore({
    analysesLearned,
    activeFactsCount: activeFacts.length,
    averageConfidence: avgConfidence || undefined,
  });

  const updatePayload = {
    plan: limits.plan,
    memory_tier: limits.tier,
    memory_score: memoryScore,
    analyses_learned: analysesLearned,
    active_facts_count: activeFacts.length,
    creator_style_summary: input.updates?.creatorStyleSummary ?? existing?.creator_style_summary ?? null,
    hook_style_summary: input.updates?.hookStyleSummary ?? existing?.hook_style_summary ?? null,
    common_mistakes_summary: input.updates?.commonMistakesSummary ?? existing?.common_mistakes_summary ?? null,
    strongest_formats_summary: input.updates?.strongestFormatsSummary ?? existing?.strongest_formats_summary ?? null,
    weak_patterns_summary: input.updates?.weakPatternsSummary ?? existing?.weak_patterns_summary ?? null,
    v2_opportunities_summary: input.updates?.v2OpportunitiesSummary ?? existing?.v2_opportunities_summary ?? null,
    last_learned_at: input.analysisLearned ? new Date().toISOString() : existing?.last_learned_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('creator_memory_profiles')
    .update(updatePayload)
    .eq('user_id', input.userId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[memory] profile update failed:', error.message);
    return existing;
  }

  return (data as CreatorMemoryProfile | null) ?? existing;
}

export async function createMemoryJob(input: {
  userId: string;
  analysisId?: string | null;
  jobType: 'learn_from_analysis' | 'consolidate' | 'rebuild_profile';
}): Promise<CreatorMemoryJob | null> {
  const { data, error } = await supabase
    .from('creator_memory_jobs')
    .insert({
      user_id: input.userId,
      analysis_id: input.analysisId ?? null,
      job_type: input.jobType,
      status: 'pending',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('[memory] job create failed:', error.message);
    return null;
  }

  return (data as CreatorMemoryJob | null) ?? null;
}

export async function getPendingMemoryJob(jobId?: string): Promise<CreatorMemoryJob | null> {
  let query = supabase
    .from('creator_memory_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (jobId) query = query.eq('id', jobId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn('[memory] pending job read failed:', error.message);
    return null;
  }
  return (data as CreatorMemoryJob | null) ?? null;
}

export async function markMemoryJob(jobId: string, status: 'running' | 'success' | 'failed', errorMessage?: string): Promise<void> {
  const payload: Record<string, unknown> = { status };
  if (status === 'running') payload.started_at = new Date().toISOString();
  if (status === 'success' || status === 'failed') payload.finished_at = new Date().toISOString();
  if (errorMessage) payload.error = errorMessage.slice(0, 1000);

  const { error } = await supabase.from('creator_memory_jobs').update(payload).eq('id', jobId);
  if (error) console.warn('[memory] job status update failed:', error.message);
}

export async function listMemoryFacts(userId: string, options?: {
  type?: MemoryFactType;
  limit?: number;
  includeArchived?: boolean;
  query?: string;
}): Promise<CreatorMemoryFact[]> {
  let query = supabase
    .from('creator_memory_facts')
    .select('*')
    .eq('user_id', userId)
    .order('importance_score', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(1, Math.min(options?.limit ?? 30, 1000)));

  if (options?.type) query = query.eq('type', options.type);
  if (!options?.includeArchived) query = query.eq('status', 'active');

  const { data, error } = await query;
  if (error) {
    console.warn('[memory] facts read failed:', error.message);
    return [];
  }

  const facts = ((data ?? []) as CreatorMemoryFact[]);
  if (!options?.query) return facts;
  const normalizedQuery = normalizeMemoryText(options.query);
  return facts
    .map((fact) => ({
      fact,
      score: memoryTextSimilarity(normalizedQuery, `${fact.title} ${fact.content} ${fact.evidence ?? ''}`),
    }))
    .filter((item) => item.score > 0 || FACT_TYPES.includes(options.query as MemoryFactType))
    .sort((a, b) => b.score - a.score || b.fact.importance_score - a.fact.importance_score)
    .map((item) => item.fact);
}

export async function upsertMemoryFacts(input: {
  userId: string;
  analysisId: string | null;
  sourceVideoId?: string | null;
  facts: ExtractedMemoryFact[];
  maxActiveFacts: number;
}): Promise<CreatorMemoryFact[]> {
  const insertedOrUpdated: CreatorMemoryFact[] = [];
  const existingByType = new Map<MemoryFactType, CreatorMemoryFact[]>();

  for (const fact of input.facts) {
    if (!existingByType.has(fact.type)) {
      existingByType.set(fact.type, await listMemoryFacts(input.userId, { type: fact.type, limit: 200 }));
    }
    const similar = existingByType.get(fact.type)?.find((existing) => isSimilarMemoryFact(fact, existing));

    if (similar) {
      const { data, error } = await supabase
        .from('creator_memory_facts')
        .update({
          occurrence_count: similar.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
          confidence_score: Math.min(100, Math.max(similar.confidence_score, fact.confidenceScore) + 2),
          importance_score: Math.min(100, Math.max(similar.importance_score, fact.importanceScore) + 2),
          evidence: fact.evidence || similar.evidence,
          metadata: { ...(similar.metadata ?? {}), ...(fact.metadata ?? {}), last_analysis_id: input.analysisId },
          updated_at: new Date().toISOString(),
        })
        .eq('id', similar.id)
        .select('*')
        .maybeSingle();
      if (!error && data) insertedOrUpdated.push(data as CreatorMemoryFact);
      continue;
    }

    const { data, error } = await supabase
      .from('creator_memory_facts')
      .insert({
        user_id: input.userId,
        analysis_id: input.analysisId,
        source_video_id: input.sourceVideoId ?? null,
        type: fact.type,
        title: fact.title,
        content: fact.content,
        evidence: fact.evidence,
        confidence_score: fact.confidenceScore,
        importance_score: fact.importanceScore,
        metadata: fact.metadata ?? {},
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('[memory] fact insert failed:', error.message);
      continue;
    }

    if (data) insertedOrUpdated.push(data as CreatorMemoryFact);
  }

  await enforceFactLimit(input.userId, input.maxActiveFacts);
  return insertedOrUpdated;
}

export async function enforceFactLimit(userId: string, maxActiveFacts: number): Promise<void> {
  if (maxActiveFacts <= 0) return;
  const facts = await listMemoryFacts(userId, { limit: 1000 });
  const overflow = facts.length - maxActiveFacts;
  if (overflow <= 0) return;

  const toArchive = [...facts]
    .sort((a, b) => a.importance_score - b.importance_score || a.occurrence_count - b.occurrence_count)
    .slice(0, overflow);

  const ids = toArchive.map((fact) => fact.id);
  if (!ids.length) return;

  const { error } = await supabase
    .from('creator_memory_facts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) console.warn('[memory] fact archive failed:', error.message);
}

export async function listMemorySnapshots(userId: string, limit = 5): Promise<CreatorMemorySnapshot[]> {
  const { data, error } = await supabase
    .from('creator_memory_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 20)));

  if (error) {
    console.warn('[memory] snapshots read failed:', error.message);
    return [];
  }
  return (data ?? []) as CreatorMemorySnapshot[];
}

export async function createMemorySnapshot(input: {
  userId: string;
  plan: MemoryPlan;
  title: string;
  summary: string;
  patterns: Record<string, unknown>;
  factsIncluded: number;
  snapshotType?: 'weekly' | 'monthly' | 'consolidation' | 'milestone';
}): Promise<void> {
  const { error } = await supabase.from('creator_memory_snapshots').insert({
    user_id: input.userId,
    plan: input.plan,
    snapshot_type: input.snapshotType ?? 'consolidation',
    title: input.title,
    summary: input.summary,
    patterns: input.patterns,
    facts_included: input.factsIncluded,
  });
  if (error) console.warn('[memory] snapshot insert failed:', error.message);
}

export async function markProfileConsolidated(userId: string): Promise<void> {
  const { error } = await supabase
    .from('creator_memory_profiles')
    .update({ last_consolidated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) console.warn('[memory] profile consolidation mark failed:', error.message);
}

export async function getMemoryOverviewForUser(userId: string, planInput: string) {
  const limits = getMemoryPlanLimits(planInput);
  const profile = await ensureMemoryProfile(userId, planInput);
  const facts = await listMemoryFacts(userId, { limit: 120 });
  const snapshots = limits.canUseSnapshots ? await listMemorySnapshots(userId, 3) : [];
  const byType = FACT_TYPES.reduce<Record<MemoryFactType, CreatorMemoryFact[]>>((acc, type) => {
    acc[type] = facts.filter((fact) => fact.type === type).slice(0, 4);
    return acc;
  }, {} as Record<MemoryFactType, CreatorMemoryFact[]>);

  return {
    limits,
    profile,
    facts,
    snapshots,
    topFacts: byType,
  };
}
