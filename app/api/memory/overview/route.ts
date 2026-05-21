import { NextResponse } from 'next/server';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getMemoryStatus, getNextMemoryMilestone } from '@/lib/memory/limits';
import { getMemoryOverviewForUser } from '@/lib/memory/repository';
import { getSession } from '@/lib/session';
import type { MemoryFactType } from '@/lib/memory/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const plan = getEffectivePlan(user);
  const overview = await getMemoryOverviewForUser(session.userId, plan);
  const profile = overview.profile;
  const analysesLearned = profile?.analyses_learned ?? 0;
  const topFacts = overview.topFacts as Record<MemoryFactType, unknown[]>;

  return NextResponse.json({
    memoryTier: overview.limits.tier,
    tierLabel: overview.limits.tierLabel,
    memoryScore: profile?.memory_score ?? 0,
    analysesLearned,
    activeFactsCount: profile?.active_facts_count ?? overview.facts.length,
    status: getMemoryStatus(analysesLearned, overview.limits.tier),
    nextMilestone: getNextMemoryMilestone(analysesLearned),
    profile: {
      creatorStyleSummary: profile?.creator_style_summary ?? '',
      hookStyleSummary: profile?.hook_style_summary ?? '',
      commonMistakesSummary: profile?.common_mistakes_summary ?? '',
      strongestFormatsSummary: profile?.strongest_formats_summary ?? '',
      weakPatternsSummary: profile?.weak_patterns_summary ?? '',
      v2OpportunitiesSummary: profile?.v2_opportunities_summary ?? '',
    },
    topFacts,
    locked: {
      memory: !overview.limits.canLearn,
      proSections: plan === 'free' || plan === 'starter',
      snapshots: !overview.limits.canUseSnapshots,
    },
    snapshots: overview.snapshots,
  });
}
