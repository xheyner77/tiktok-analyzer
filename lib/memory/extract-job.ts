import { supabase } from '@/lib/supabase';
import type { AnalysisResult } from '@/lib/types';
import { consolidateMemoryForUser } from './consolidate-memory';
import { createEmbeddingsForFacts } from './embeddings';
import { extractMemoryFromAnalysis } from './extract-memory';
import { getMemoryPlanLimits } from './limits';
import { buildProfileUpdatesFromFacts } from './update-profile';
import { getMemoryProfile, markMemoryJob, updateMemoryProfile, upsertMemoryFacts } from './repository';
import type { CreatorMemoryJob, LearnFromAnalysisInput } from './types';

async function getAnalysisForJob(userId: string, analysisId: string): Promise<{ result: AnalysisResult; videoUrl: string | null } | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select('result, video_url')
    .eq('id', analysisId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[memory] analysis read failed:', error.message);
    return null;
  }

  const row = data as { result?: AnalysisResult; video_url?: string | null } | null;
  if (!row?.result) return null;
  return { result: row.result, videoUrl: row.video_url ?? null };
}

export async function learnFromAnalysis(input: LearnFromAnalysisInput): Promise<{ factsCreated: number; skipped: boolean }> {
  const limits = getMemoryPlanLimits(input.plan);
  await updateMemoryProfile({ userId: input.userId, plan: limits.plan });

  if (!limits.canLearn) {
    return { factsCreated: 0, skipped: true };
  }

  const extraction = await extractMemoryFromAnalysis(input);
  const facts = await upsertMemoryFacts({
    userId: input.userId,
    analysisId: input.analysisId,
    sourceVideoId: input.videoMetadata?.videoUrl ?? null,
    facts: extraction.facts,
    maxActiveFacts: limits.maxActiveFacts,
  });

  if (facts.length) {
    await createEmbeddingsForFacts(facts, limits.plan);
  }

  const activeFactsForProfile = facts.length ? facts : [];
  const profileUpdates = {
    ...buildProfileUpdatesFromFacts(activeFactsForProfile),
    ...extraction.profileUpdates,
  };
  const profile = await updateMemoryProfile({
    userId: input.userId,
    plan: limits.plan,
    updates: profileUpdates,
    analysisLearned: true,
  });

  if (profile) {
    const current = await getMemoryProfile(input.userId);
    if (current && current.analyses_learned >= 3) {
      await consolidateMemoryForUser({ userId: input.userId, plan: limits.plan });
    }
  }

  return { factsCreated: facts.length, skipped: false };
}

export async function processMemoryJob(job: CreatorMemoryJob, plan: string): Promise<{ ok: boolean; factsCreated?: number; error?: string }> {
  await markMemoryJob(job.id, 'running');

  try {
    if (job.job_type === 'learn_from_analysis') {
      if (!job.analysis_id) throw new Error('Missing analysis_id for memory learning job.');
      const analysis = await getAnalysisForJob(job.user_id, job.analysis_id);
      if (!analysis) throw new Error('Analysis not found for memory learning job.');
      const result = await learnFromAnalysis({
        userId: job.user_id,
        analysisId: job.analysis_id,
        analysisResult: analysis.result,
        videoMetadata: { videoUrl: analysis.videoUrl ?? undefined },
        plan,
      });
      await markMemoryJob(job.id, 'success');
      return { ok: true, factsCreated: result.factsCreated };
    }

    if (job.job_type === 'consolidate' || job.job_type === 'rebuild_profile') {
      const ok = await consolidateMemoryForUser({ userId: job.user_id, plan, force: true });
      await markMemoryJob(job.id, ok ? 'success' : 'failed', ok ? undefined : 'No memory facts to consolidate.');
      return { ok };
    }

    throw new Error(`Unsupported memory job type: ${job.job_type}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown memory job error';
    await markMemoryJob(job.id, 'failed', message);
    return { ok: false, error: message };
  }
}
