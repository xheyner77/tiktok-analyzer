export type AppPlan = 'free' | 'creator' | 'pro' | 'scale';
export type RawPlan = AppPlan | string | null | undefined;

export interface PlanLimits {
  analyses: number;
  hooks: number;
  reconstructions: number;
  history: number;
  tiktokAccounts: number;
}

export function normalizePlan(plan: RawPlan): AppPlan {
  if (plan === 'creator') return 'creator';
  if (plan === 'pro') return 'pro';
  if (plan === 'scale') return 'scale';
  return 'free';
}

export function getPlanLabel(plan: RawPlan): string {
  const normalized = normalizePlan(plan);
  if (normalized === 'creator') return 'Creator';
  if (normalized === 'pro') return 'Pro';
  if (normalized === 'scale') return 'Scale';
  return 'Free';
}

export function isPaidPlan(plan: RawPlan): boolean {
  return normalizePlan(plan) !== 'free';
}

export function getPlanLimits(plan: RawPlan): PlanLimits {
  const normalized = normalizePlan(plan);
  if (normalized === 'scale') {
    return {
      analyses: Number.POSITIVE_INFINITY,
      hooks: Number.POSITIVE_INFINITY,
      reconstructions: 150,
      history: Number.POSITIVE_INFINITY,
      tiktokAccounts: 8,
    };
  }
  if (normalized === 'pro') {
    return { analyses: 150, hooks: 500, reconstructions: 30, history: 200, tiktokAccounts: 3 };
  }
  if (normalized === 'creator') {
    return { analyses: 30, hooks: 150, reconstructions: 0, history: 30, tiktokAccounts: 1 };
  }
  return { analyses: 3, hooks: 0, reconstructions: 0, history: 0, tiktokAccounts: 0 };
}

export function formatPlanLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : 'illimité';
}
