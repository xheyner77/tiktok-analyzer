import { supabase } from './supabase';
import {
  formatTikTokAccountLimit,
  getTikTokAccountLimitForPlan,
  type TikTokPlanKey,
} from './tiktok-plan-limits';

export { formatTikTokAccountLimit, getTikTokAccountLimitForPlan, type TikTokPlanKey };

type TikTokAccountLimitReason = 'count_failed' | 'limit_reached';

export type TikTokAccountEligibility = {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  reason?: TikTokAccountLimitReason;
};

export async function getConnectedTikTokAccountCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tiktok_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.warn('[tiktok-account-limits] count failed:', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function canConnectTikTokAccount(
  userId: string,
  plan: string | null | undefined,
  options: { excludingOpenId?: string } = {}
): Promise<TikTokAccountEligibility> {
  const limit = getTikTokAccountLimitForPlan(plan);
  if (!Number.isFinite(limit)) {
    return { allowed: true, limit, current: 0, remaining: Number.POSITIVE_INFINITY };
  }

  const { data, error } = await supabase
    .from('tiktok_accounts')
    .select('id,tiktok_open_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.warn('[tiktok-account-limits] eligibility count failed:', error.message);
    return { allowed: false, limit, current: 0, remaining: 0, reason: 'count_failed' as const };
  }

  const current = (data ?? []).filter((row) => row.tiktok_open_id !== options.excludingOpenId).length;
  const remaining = Math.max(0, limit - current);
  return {
    allowed: current < limit,
    limit,
    current,
    remaining,
    reason: current < limit ? undefined : ('limit_reached' as const),
  };
}
