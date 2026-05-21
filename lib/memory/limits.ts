import { getPlanLimits, normalizePlan } from '@/lib/plans';
import type { MemoryPlan, MemoryStatus, MemoryTier } from './types';

export interface MemoryPlanLimits {
  plan: MemoryPlan;
  tier: MemoryTier;
  tierLabel: string;
  monthlyAnalysesLearned: number;
  maxActiveFacts: number;
  retrievalLimit: number;
  factsPerAnalysis: number;
  canLearn: boolean;
  canRebuild: boolean;
  canUseSnapshots: boolean;
}

function readPositiveEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function normalizeMemoryPlan(plan: string | null | undefined): MemoryPlan {
  const normalized = normalizePlan(plan);
  if (normalized === 'starter' || normalized === 'pro' || normalized === 'lifetime') return normalized;
  return 'free';
}

export function getMemoryPlanLimits(planInput: string | null | undefined): MemoryPlanLimits {
  const plan = normalizeMemoryPlan(planInput);
  const planLimits = getPlanLimits(plan);

  if (plan === 'lifetime') {
    return {
      plan,
      tier: 'permanent',
      tierLabel: 'Mémoire Permanente',
      monthlyAnalysesLearned: planLimits.analyses,
      maxActiveFacts: readPositiveEnv('MEMORY_MAX_FACTS_LIFETIME', 1500),
      retrievalLimit: 12,
      factsPerAnalysis: 14,
      canLearn: true,
      canRebuild: true,
      canUseSnapshots: true,
    };
  }

  if (plan === 'pro') {
    return {
      plan,
      tier: 'extended',
      tierLabel: 'Mémoire Étendue',
      monthlyAnalysesLearned: planLimits.analyses,
      maxActiveFacts: readPositiveEnv('MEMORY_MAX_FACTS_PRO', 600),
      retrievalLimit: 10,
      factsPerAnalysis: 10,
      canLearn: true,
      canRebuild: true,
      canUseSnapshots: false,
    };
  }

  if (plan === 'starter') {
    return {
      plan,
      tier: 'essential',
      tierLabel: 'Mémoire Essentielle',
      monthlyAnalysesLearned: planLimits.analyses,
      maxActiveFacts: readPositiveEnv('MEMORY_MAX_FACTS_STARTER', 120),
      retrievalLimit: 5,
      factsPerAnalysis: 5,
      canLearn: true,
      canRebuild: false,
      canUseSnapshots: false,
    };
  }

  return {
    plan: 'free',
    tier: 'locked',
    tierLabel: 'Mémoire verrouillée',
    monthlyAnalysesLearned: 0,
    maxActiveFacts: 0,
    retrievalLimit: 0,
    factsPerAnalysis: 0,
    canLearn: false,
    canRebuild: false,
    canUseSnapshots: false,
  };
}

export function getMemoryStatus(analysesLearned: number, tier: MemoryTier): MemoryStatus {
  if (tier === 'locked') return 'locked';
  if (analysesLearned <= 0) return 'empty';
  if (analysesLearned < 3) return 'learning';
  if (analysesLearned < 10) return 'patterns';
  if (analysesLearned < 25) return 'active';
  return 'advanced';
}

export function getNextMemoryMilestone(analysesLearned: number) {
  const milestones = [
    { target: 3, label: 'Premiers patterns détectés' },
    { target: 10, label: 'Profil créateur actif' },
    { target: 25, label: 'Mémoire avancée' },
    { target: 50, label: 'Snapshot long terme' },
  ];
  const next = milestones.find((milestone) => analysesLearned < milestone.target);
  return next ? { ...next, remaining: next.target - analysesLearned } : null;
}

export function calculateMemoryScore(input: {
  analysesLearned: number;
  activeFactsCount: number;
  averageConfidence?: number;
}): number {
  const analysisScore = Math.min(45, input.analysesLearned * 4);
  const factScore = Math.min(35, Math.floor(input.activeFactsCount / 3));
  const confidenceScore = Math.min(20, Math.round(((input.averageConfidence ?? 55) / 100) * 20));
  return Math.max(0, Math.min(100, analysisScore + factScore + confidenceScore));
}
