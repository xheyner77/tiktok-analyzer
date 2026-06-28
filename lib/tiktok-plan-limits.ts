export type TikTokPlanKey = 'free' | 'starter' | 'pro' | 'lifetime';

export function normalizeTikTokPlan(plan: string | null | undefined): TikTokPlanKey {
  if (plan === 'lifetime' || plan === 'scale') return 'lifetime';
  if (plan === 'pro') return 'pro';
  if (plan === 'starter' || plan === 'creator') return 'starter';
  return 'free';
}

export function getTikTokAccountLimitForPlan(plan: string | null | undefined): number {
  const normalized = normalizeTikTokPlan(plan);
  if (normalized === 'lifetime') return 3;
  if (normalized === 'pro') return 3;
  if (normalized === 'starter') return 1;
  return 0;
}

export function formatTikTokAccountLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : 'illimité';
}
