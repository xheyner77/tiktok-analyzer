import { getMemoryPlanLimits } from './limits';
import { createMemorySnapshot, enforceFactLimit, listMemoryFacts, markProfileConsolidated, updateMemoryProfile } from './repository';
import { buildProfileUpdatesFromFacts } from './update-profile';
import type { MemoryPlan } from './types';
import { logMemoryUsage } from './usage';

const CONSOLIDATION_THRESHOLDS = [3, 10, 25, 50];

export function shouldConsolidateMemory(analysesLearned: number, lastConsolidatedAt?: string | null): boolean {
  if (CONSOLIDATION_THRESHOLDS.includes(analysesLearned)) return true;
  if (analysesLearned > 0 && analysesLearned % 25 === 0) return true;
  if (!lastConsolidatedAt && analysesLearned >= 10) return true;
  return false;
}

export async function consolidateMemoryForUser(input: {
  userId: string;
  plan: string;
  force?: boolean;
}): Promise<boolean> {
  const limits = getMemoryPlanLimits(input.plan);
  if (!limits.canLearn) return false;

  const facts = await listMemoryFacts(input.userId, { limit: 200 });
  if (!facts.length) return false;

  const profileUpdates = buildProfileUpdatesFromFacts(facts);
  const profile = await updateMemoryProfile({
    userId: input.userId,
    plan: limits.plan,
    updates: profileUpdates,
  });

  if (!profile) return false;
  if (!input.force && !shouldConsolidateMemory(profile.analyses_learned, profile.last_consolidated_at)) {
    await enforceFactLimit(input.userId, limits.maxActiveFacts);
    return true;
  }

  const summary = [
    profileUpdates.hookStyleSummary,
    profileUpdates.commonMistakesSummary,
    profileUpdates.strongestFormatsSummary,
    profileUpdates.v2OpportunitiesSummary,
  ].filter(Boolean).join(' ');

  if (summary) {
    await createMemorySnapshot({
      userId: input.userId,
      plan: limits.plan as MemoryPlan,
      title: profile.analyses_learned >= 50 ? 'Snapshot long terme' : 'Consolidation mémoire',
      summary: summary.slice(0, 900),
      patterns: {
        hook: profileUpdates.hookStyleSummary,
        mistakes: profileUpdates.commonMistakesSummary,
        formats: profileUpdates.strongestFormatsSummary,
        v2: profileUpdates.v2OpportunitiesSummary,
      },
      factsIncluded: facts.length,
      snapshotType: profile.analyses_learned >= 50 ? 'milestone' : 'consolidation',
    });
  }

  await enforceFactLimit(input.userId, limits.maxActiveFacts);
  await markProfileConsolidated(input.userId);
  await logMemoryUsage({
    userId: input.userId,
    plan: limits.plan,
    operation: 'consolidation',
    model: 'deterministic',
    inputTokens: facts.length,
  });

  return true;
}
