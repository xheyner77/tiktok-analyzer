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

export function isPaidPlan(plan: RawPlan): boolean {
  return normalizePlan(plan) !== 'free';
}

export function getPlanLimits(plan: RawPlan): PlanLimits {
  const normalized = normalizePlan(plan);
  if (normalized === 'lifetime') {
    return { analyses: 1000, hooks: 2000, reconstructions: 30, history: 1000, tiktokAccounts: 3 };
  }
  if (normalized === 'pro') {
    return { analyses: 100, hooks: 200, reconstructions: 30, history: 200, tiktokAccounts: 1 };
  }
  if (normalized === 'starter') {
    return { analyses: 30, hooks: 50, reconstructions: 0, history: 30, tiktokAccounts: 1 };
  }
  return { analyses: 3, hooks: 0, reconstructions: 0, history: 0, tiktokAccounts: 0 };
}

export function formatPlanLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : 'illimité';
}
