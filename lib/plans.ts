import {
  HISTORY_LIMITS,
  HOOK_LIMITS,
  PLAN_LIMITS,
  RECONSTRUCTION_LIMITS,
} from './plan-limits';

export type AppPlan = 'free' | 'starter' | 'pro' | 'lifetime' | 'creator' | 'scale';
export type RawPlan = AppPlan | string | null | undefined;

export interface PlanLimits {
  analyses: number;
  hooks: number;
  reconstructions: number;
  history: number;
  tiktokAccounts: number;
}

export function normalizePlan(plan: RawPlan): AppPlan {
  if (plan === 'starter' || plan === 'creator') return 'starter';
  if (plan === 'pro') return 'pro';
  if (plan === 'lifetime' || plan === 'scale') return 'lifetime';
  return 'free';
}

export function getPlanLabel(plan: RawPlan): string {
  const normalized = normalizePlan(plan);
  if (normalized === 'starter') return 'Starter';
  if (normalized === 'pro') return 'Pro';
  if (normalized === 'lifetime') return 'Lifetime';
  return 'Free';
}

export function isLifetimePlan(plan: RawPlan): boolean {
  return normalizePlan(plan) === 'lifetime';
}

export function hasProOrLifetimeAccess(plan: RawPlan): boolean {
  const normalized = normalizePlan(plan);
  return normalized === 'pro' || normalized === 'lifetime';
}

export function isPaidPlan(plan: RawPlan): boolean {
  return normalizePlan(plan) !== 'free';
}

export function getNextMonthlyResetAt(lastResetAt: string): Date | null {
  const lastReset = new Date(lastResetAt);
  if (!Number.isFinite(lastReset.getTime())) return null;

  const day = lastReset.getUTCDate();
  const next = new Date(lastReset);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDayOfTargetMonth = new Date(Date.UTC(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  next.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return next;
}

export function getPlanLimits(plan: RawPlan): PlanLimits {
  const normalized = normalizePlan(plan);
  return {
    analyses: PLAN_LIMITS[normalized] ?? PLAN_LIMITS.free,
    hooks: HOOK_LIMITS[normalized] ?? HOOK_LIMITS.free,
    reconstructions: RECONSTRUCTION_LIMITS[normalized] ?? RECONSTRUCTION_LIMITS.free,
    history: HISTORY_LIMITS[normalized] ?? HISTORY_LIMITS.free,
    tiktokAccounts: normalized === 'lifetime' ? 3 : normalized === 'free' ? 0 : 1,
  };
}

export function formatPlanLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : 'illimité';
}
