export type TikTokPlanKey = 'free' | 'creator' | 'pro' | 'scale';

export function normalizeTikTokPlan(plan: string | null | undefined): TikTokPlanKey {
  if (plan === 'scale') return 'scale';
  if (plan === 'pro') return 'pro';
  if (plan === 'creator') return 'creator';
  return 'free';
}

export function getTikTokAccountLimitForPlan(plan: string | null | undefined): number {
  const normalized = normalizeTikTokPlan(plan);
  if (normalized === 'scale') return 8;
  if (normalized === 'pro') return 3;
  if (normalized === 'creator') return 1;
  return 0;
}

export function formatTikTokAccountLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : 'illimité';
}
