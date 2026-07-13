import { supabase } from './supabase';
import type { Plan } from './supabase';
import { HOOK_LIMITS, PLAN_LIMITS, RECONSTRUCTION_LIMITS } from './plan-limits';
import { getNextMonthlyResetAt } from './plans';
import { getEffectivePlan } from './stripe-billing';

export {
  HOOK_LIMITS,
  PLAN_LIMITS,
  RECONSTRUCTION_LIMITS,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_PRO,
} from './plan-limits';

export { getEffectivePlan } from './stripe-billing';

export interface SessionPayload {
  userId: string;
  email: string;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  /** Produit souscrit en base (l’accès effectif dépend aussi de subscription_status). */
  plan: Plan;
  analyses_count: number;
  hooks_count: number;
  reconstructions_count: number;
  last_reset_at: string;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  /** TikTok Login Kit — identifiant stable côté TikTok (null si non lié). */
  tiktok_open_id: string | null;
  tiktok_display_name: string | null;
  tiktok_avatar_url: string | null;
  tiktok_connected_at: string | null;
}

export type User = UserProfile;

export async function ensureUserProfile(input: { userId: string; email: string }): Promise<UserProfile | null> {
  const existing = await getUserById(input.userId);
  if (existing) return existing;

  const { error } = await supabase
    .from('users')
    .upsert(
      {
        id: input.userId,
        email: input.email,
        plan: 'free',
        analyses_count: 0,
        hooks_count: 0,
        reconstructions_count: 0,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[ensureUserProfile] public.users upsert failed:', error.message);
    return null;
  }

  return getUserById(input.userId);
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Read the user profile from public.users (single source of truth) */
export async function getUserById(id: string): Promise<UserProfile | null> {
  const selectWithStripePrice =
    'id, email, plan, analyses_count, hooks_count, reconstructions_count, last_reset_at, created_at, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, tiktok_open_id, tiktok_display_name, tiktok_avatar_url, tiktok_connected_at';
  const selectWithoutStripePrice =
    'id, email, plan, analyses_count, hooks_count, reconstructions_count, last_reset_at, created_at, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, tiktok_open_id, tiktok_display_name, tiktok_avatar_url, tiktok_connected_at';

  let result = await supabase
    .from('users')
    .select(selectWithStripePrice)
    .eq('id', id)
    .single();

  if (result.error && /stripe_price_id/i.test(result.error.message)) {
    result = await supabase
      .from('users')
      .select(selectWithoutStripePrice)
      .eq('id', id)
      .single();
  }

  const { data, error } = result;
  if (error || !data) return null;

  const profile: UserProfile = {
    id:                                data.id,
    email:                             data.email,
    plan:                              (data.plan as Plan) ?? 'free',
    analyses_count:                    (data.analyses_count as number) ?? 0,
    hooks_count:                       (data.hooks_count as number) ?? 0,
    reconstructions_count:             (data.reconstructions_count as number) ?? 0,
    last_reset_at:                     data.last_reset_at ?? new Date().toISOString(),
    created_at:                        data.created_at,
    stripe_customer_id:               (data.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id:           (data.stripe_subscription_id as string | null) ?? null,
    stripe_price_id:                  (data as { stripe_price_id?: string | null }).stripe_price_id ?? null,
    subscription_status:              (data.subscription_status as string | null) ?? null,
    subscription_current_period_end:  (data.subscription_current_period_end as string | null) ?? null,
    subscription_cancel_at_period_end: Boolean(data.subscription_cancel_at_period_end),
    tiktok_open_id:                    (data as { tiktok_open_id?: string | null }).tiktok_open_id ?? null,
    tiktok_display_name:               (data as { tiktok_display_name?: string | null }).tiktok_display_name ?? null,
    tiktok_avatar_url:                 (data as { tiktok_avatar_url?: string | null }).tiktok_avatar_url ?? null,
    tiktok_connected_at:               (data as { tiktok_connected_at?: string | null }).tiktok_connected_at ?? null,
  };

  return profile;
}

// ── Monthly reset ─────────────────────────────────────────────────────────────

/**
 * Reset rolling monthly quotas for recurring paid plans. Stripe monthly
 * renewals also reset them via `invoice.paid`; annual subscriptions use this
 * path so a monthly product quota never becomes an accidental annual quota.
 */
export async function checkAndResetMonthly(user: UserProfile): Promise<UserProfile> {
  const tier = getEffectivePlan(user);

  // Free is a lifetime trial (3 analyses total), not a monthly allowance.
  // Lifetime is intentionally not reset either.
  if (tier === 'free' || tier === 'lifetime') return user;

  const now = new Date();
  const nextReset = getNextMonthlyResetAt(user.last_reset_at);
  if (nextReset && now < nextReset) return user;

  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from('users')
    .update({ analyses_count: 0, hooks_count: 0, reconstructions_count: 0, last_reset_at: nowIso })
    .eq('id', user.id)
    .eq('last_reset_at', user.last_reset_at)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[checkAndResetMonthly] Reset failed:', error.name || 'database_error');
    return user;
  }

  if (!data) {
    // Another request already performed the reset. Return the current row so
    // a stale request cannot overwrite counters reserved after that reset.
    return (await getUserById(user.id)) ?? user;
  }

  return { ...user, analyses_count: 0, hooks_count: 0, reconstructions_count: 0, last_reset_at: nowIso };
}

// ── Quota guards (toujours sur le plan effectif — impossible de bypass via le client) ──

/** True if the user has not yet exhausted their analysis quota this period */
export function canRunAnalysis(user: UserProfile): boolean {
  const tier = getEffectivePlan(user);
  const limit = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
  return user.analyses_count < limit;
}

/** True if the user's plan includes hook generation and quota is not exhausted */
export function canGenerateHook(user: UserProfile): boolean {
  const tier = getEffectivePlan(user);
  const limit = HOOK_LIMITS[tier] ?? 0;
  return limit > 0 && user.hooks_count < limit;
}

/** True if the user's plan includes complete AI reconstruction and quota is not exhausted */
export function canGenerateReconstruction(user: UserProfile): boolean {
  const tier = getEffectivePlan(user);
  const limit = RECONSTRUCTION_LIMITS[tier] ?? 0;
  return limit > 0 && user.reconstructions_count < limit;
}

// ── Increments ───────────────────────────────────────────────────────────────

/**
 * Atomically increments analyses_count using a server-side SQL function.
 * Avoids the read-then-write race condition that allows quota bypass under
 * concurrent requests.
 */
export interface QuotaReservation {
  allowed: boolean;
  used: number;
  limit: number;
}

async function reconcileQuotaRpcReservation(params: {
  data: unknown;
  expectedLimit: number;
  previousUsed: number;
  amount: number;
  quota: 'analysis' | 'hook' | 'reconstruction';
  refund: () => Promise<boolean>;
}): Promise<QuotaReservation> {
  const candidate: unknown = Array.isArray(params.data) ? params.data[0] : params.data;
  const row = candidate && typeof candidate === 'object'
    ? candidate as Record<string, unknown>
    : null;
  const allowed = row?.allowed;
  const used = row?.used;
  const rpcLimit = row?.limit_value;
  const usedIsValid = typeof used === 'number' && Number.isFinite(used) && used >= 0;
  const shapeIsValid =
    typeof allowed === 'boolean'
    && usedIsValid
    && typeof rpcLimit === 'number'
    && Number.isFinite(rpcLimit)
    && rpcLimit >= 0;
  const entitlementMatches = shapeIsValid && rpcLimit === params.expectedLimit;

  if (entitlementMatches) {
    return {
      allowed,
      used,
      limit: params.expectedLimit,
    };
  }

  let adjustedUsed = usedIsValid ? used : params.previousUsed;
  let refunded = false;
  if (allowed === true && usedIsValid) {
    try {
      refunded = await params.refund();
      if (refunded) adjustedUsed = Math.max(0, used - params.amount);
    } catch (error) {
      console.error('[quota] entitlement mismatch refund failed', {
        quota: params.quota,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  console.error('[quota] RPC entitlement mismatch', {
    quota: params.quota,
    expectedLimit: params.expectedLimit,
    receivedLimit: typeof rpcLimit === 'number' ? rpcLimit : 'invalid',
    reservationRefunded: refunded,
  });
  return { allowed: false, used: adjustedUsed, limit: params.expectedLimit };
}

async function reserveAnalysisQuotaFallback(user: UserProfile, limit: number): Promise<QuotaReservation> {
  const { data: freshRow, error: readError } = await supabase
    .from('users')
    .select('analyses_count')
    .eq('id', user.id)
    .single();

  if (readError || !freshRow) {
    console.error('[reserveAnalysisQuotaFallback] Read failed:', readError?.message);
    return { allowed: false, used: user.analyses_count, limit };
  }

  const current = (freshRow as { analyses_count?: number }).analyses_count ?? user.analyses_count;
  if (current >= limit) {
    return { allowed: false, used: current, limit };
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('users')
    .update({ analyses_count: current + 1 })
    .eq('id', user.id)
    .eq('analyses_count', current)
    .select('analyses_count')
    .single();

  if (updateError || !updatedRow) {
    console.error('[reserveAnalysisQuotaFallback] Update failed:', updateError?.message);
    return { allowed: false, used: current, limit };
  }

  return {
    allowed: true,
    used: (updatedRow as { analyses_count?: number }).analyses_count ?? current + 1,
    limit,
  };
}

export async function reserveAnalysisQuota(user: UserProfile): Promise<QuotaReservation> {
  const tier = getEffectivePlan(user);
  const limit = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

  if (!Number.isFinite(limit)) {
    await incrementAnalysesCount(user.id);
    return { allowed: true, used: user.analyses_count + 1, limit };
  }

  const { data, error } = await supabase.rpc('reserve_analysis_quota', {
    p_user_id: user.id,
    p_amount: 1,
  });

  if (error) {
    console.error('[reserveAnalysisQuota] RPC failed:', error.message);
    console.warn('[reserveAnalysisQuota] using temporary server fallback after quota RPC failure', {
      userId: user.id,
      plan: tier,
      limit,
    });
    return reserveAnalysisQuotaFallback(user, limit);
  }

  return reconcileQuotaRpcReservation({
    data,
    expectedLimit: limit,
    previousUsed: user.analyses_count,
    amount: 1,
    quota: 'analysis',
    refund: () => refundAnalysisQuota(user.id),
  });
}

export async function refundAnalysisQuota(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('refund_analysis_quota', { p_user_id: userId });
  if (!error) return true;

  console.error('[refundAnalysisQuota] RPC failed:', error.message);
  const { data: row, error: readErr } = await supabase
    .from('users')
    .select('analyses_count')
    .eq('id', userId)
    .single();

  if (readErr || !row) {
    console.error('[refundAnalysisQuota] Fallback read failed:', readErr?.message);
    return false;
  }

  const current = (row as { analyses_count?: number }).analyses_count ?? 0;
  const nextCount = Math.max(0, current - 1);
  const { data: updated, error: writeErr } = await supabase
    .from('users')
    .update({ analyses_count: nextCount })
    .eq('id', userId)
    .eq('analyses_count', current)
    .select('analyses_count')
    .maybeSingle();

  if (writeErr || !updated) {
    console.error(
      '[refundAnalysisQuota] Fallback write failed or lost a concurrent update:',
      writeErr?.message ?? 'conflict',
    );
    return false;
  }

  return true;
}

async function reserveHookQuotaFallback(
  user: UserProfile,
  amount: number,
  limit: number,
): Promise<QuotaReservation> {
  const { data: freshRow, error: readError } = await supabase
    .from('users')
    .select('hooks_count')
    .eq('id', user.id)
    .single();

  if (readError || !freshRow) {
    console.error('[reserveHookQuotaFallback] Read failed:', readError?.code ?? 'unknown');
    return { allowed: false, used: user.hooks_count, limit };
  }

  const current = (freshRow as { hooks_count?: number }).hooks_count ?? user.hooks_count;
  if (current + amount > limit) return { allowed: false, used: current, limit };

  const { data: updatedRow, error: updateError } = await supabase
    .from('users')
    .update({ hooks_count: current + amount })
    .eq('id', user.id)
    .eq('hooks_count', current)
    .select('hooks_count')
    .maybeSingle();

  if (updateError || !updatedRow) {
    console.error('[reserveHookQuotaFallback] Concurrent update or write failure:', updateError?.code ?? 'conflict');
    return { allowed: false, used: current, limit };
  }

  return {
    allowed: true,
    used: (updatedRow as { hooks_count?: number }).hooks_count ?? current + amount,
    limit,
  };
}

/** Atomically reserves HookPacks before the external AI call is started. */
export async function reserveHookQuota(user: UserProfile, amount: number): Promise<QuotaReservation> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const tier = getEffectivePlan(user);
  const limit = HOOK_LIMITS[tier] ?? 0;
  if (limit <= 0) return { allowed: false, used: user.hooks_count, limit };

  if (!Number.isFinite(limit)) {
    await incrementHooksCount(user.id, safeAmount);
    return { allowed: true, used: user.hooks_count + safeAmount, limit };
  }

  const { data, error } = await supabase.rpc('reserve_hook_quota', {
    p_user_id: user.id,
    p_amount: safeAmount,
  });

  if (error) {
    console.error('[reserveHookQuota] RPC failed:', error.code ?? 'unknown');
    return reserveHookQuotaFallback(user, safeAmount, limit);
  }

  return reconcileQuotaRpcReservation({
    data,
    expectedLimit: limit,
    previousUsed: user.hooks_count,
    amount: safeAmount,
    quota: 'hook',
    refund: () => refundHookQuota(user.id, safeAmount),
  });
}

export async function refundHookQuota(userId: string, amount: number): Promise<boolean> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const { error } = await supabase.rpc('refund_hook_quota', {
    p_user_id: userId,
    p_amount: safeAmount,
  });
  if (!error) return true;

  console.error('[refundHookQuota] RPC failed:', error.code ?? 'unknown');
  const { data: row, error: readError } = await supabase
    .from('users')
    .select('hooks_count')
    .eq('id', userId)
    .single();

  if (readError || !row) return false;
  const current = (row as { hooks_count?: number }).hooks_count ?? 0;
  const nextCount = Math.max(0, current - safeAmount);
  const { data: updated, error: writeError } = await supabase
    .from('users')
    .update({ hooks_count: nextCount })
    .eq('id', userId)
    .eq('hooks_count', current)
    .select('hooks_count')
    .maybeSingle();

  return !writeError && Boolean(updated);
}

async function reserveReconstructionQuotaFallback(
  user: UserProfile,
  amount: number,
  limit: number,
): Promise<QuotaReservation> {
  const { data: freshRow, error: readError } = await supabase
    .from('users')
    .select('reconstructions_count')
    .eq('id', user.id)
    .single();

  if (readError || !freshRow) {
    console.error('[reserveReconstructionQuotaFallback] Read failed:', readError?.code ?? 'unknown');
    return { allowed: false, used: user.reconstructions_count, limit };
  }

  const current =
    (freshRow as { reconstructions_count?: number }).reconstructions_count
    ?? user.reconstructions_count;
  if (current + amount > limit) return { allowed: false, used: current, limit };

  const { data: updatedRow, error: updateError } = await supabase
    .from('users')
    .update({ reconstructions_count: current + amount })
    .eq('id', user.id)
    .eq('reconstructions_count', current)
    .select('reconstructions_count')
    .maybeSingle();

  if (updateError || !updatedRow) {
    console.error(
      '[reserveReconstructionQuotaFallback] Concurrent update or write failure:',
      updateError?.code ?? 'conflict',
    );
    return { allowed: false, used: current, limit };
  }

  return {
    allowed: true,
    used:
      (updatedRow as { reconstructions_count?: number }).reconstructions_count
      ?? current + amount,
    limit,
  };
}

/** Atomically reserves reconstruction quota before constructing the V2. */
export async function reserveReconstructionQuota(
  user: UserProfile,
  amount = 1,
): Promise<QuotaReservation> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const tier = getEffectivePlan(user);
  const limit = RECONSTRUCTION_LIMITS[tier] ?? 0;
  if (limit <= 0) {
    return { allowed: false, used: user.reconstructions_count, limit };
  }

  if (!Number.isFinite(limit)) {
    await incrementReconstructionsCount(user.id, safeAmount);
    return {
      allowed: true,
      used: user.reconstructions_count + safeAmount,
      limit,
    };
  }

  const { data, error } = await supabase.rpc('reserve_reconstruction_quota', {
    p_user_id: user.id,
    p_amount: safeAmount,
  });

  if (error) {
    console.error('[reserveReconstructionQuota] RPC failed:', error.code ?? 'unknown');
    return reserveReconstructionQuotaFallback(user, safeAmount, limit);
  }

  return reconcileQuotaRpcReservation({
    data,
    expectedLimit: limit,
    previousUsed: user.reconstructions_count,
    amount: safeAmount,
    quota: 'reconstruction',
    refund: () => refundReconstructionQuota(user.id, safeAmount),
  });
}

export async function refundReconstructionQuota(userId: string, amount = 1): Promise<boolean> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const { error } = await supabase.rpc('refund_reconstruction_quota', {
    p_user_id: userId,
    p_amount: safeAmount,
  });
  if (!error) return true;

  console.error('[refundReconstructionQuota] RPC failed:', error.code ?? 'unknown');
  const { data: row, error: readError } = await supabase
    .from('users')
    .select('reconstructions_count')
    .eq('id', userId)
    .single();
  if (readError || !row) return false;

  const current = (row as { reconstructions_count?: number }).reconstructions_count ?? 0;
  const nextCount = Math.max(0, current - safeAmount);
  const { data: updated, error: writeError } = await supabase
    .from('users')
    .update({ reconstructions_count: nextCount })
    .eq('id', userId)
    .eq('reconstructions_count', current)
    .select('reconstructions_count')
    .maybeSingle();

  return !writeError && Boolean(updated);
}

export async function incrementAnalysesCount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_analyses_count', { user_id: userId });
  if (!error) return;

  // RPC missing or failed — fallback to direct UPDATE with server-side arithmetic.
  // Supabase PostgREST supports raw SQL via .rpc, but we can also use the
  // pg-level arithmetic through the JS client's filter + direct update chain.
  console.warn('[incrementAnalysesCount] RPC failed, trying direct fallback:', error.message);
  const { data: row, error: readErr } = await supabase
    .from('users')
    .select('analyses_count')
    .eq('id', userId)
    .single();

  if (readErr || !row) {
    console.error('[incrementAnalysesCount] Fallback read failed:', readErr?.message);
    return;
  }

  const { error: writeErr } = await supabase
    .from('users')
    .update({ analyses_count: (row.analyses_count as number) + 1 })
    .eq('id', userId);

  if (writeErr) {
    console.error('[incrementAnalysesCount] Fallback write failed:', writeErr.message);
  }
}

/**
 * Atomically increments hooks_count by `amount` using a server-side SQL function.
 * Avoids the read-then-write race condition that allows quota bypass under
 * concurrent requests.
 */
export async function incrementHooksCount(userId: string, amount = 1): Promise<void> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const { error } = await supabase.rpc('increment_hooks_count_by', {
    p_user_id: userId,
    p_amount:  safeAmount,
  });
  if (!error) return;

  console.warn('[incrementHooksCount] RPC failed, trying direct fallback:', error.message);
  const { data: row, error: readErr } = await supabase
    .from('users')
    .select('hooks_count')
    .eq('id', userId)
    .single();

  if (readErr || !row) {
    console.error('[incrementHooksCount] Fallback read failed:', readErr?.message);
    return;
  }

  const { error: writeErr } = await supabase
    .from('users')
    .update({ hooks_count: (row.hooks_count as number) + safeAmount })
    .eq('id', userId);

  if (writeErr) {
    console.error('[incrementHooksCount] Fallback write failed:', writeErr.message);
  }
}

export async function incrementReconstructionsCount(userId: string, amount = 1): Promise<void> {
  const safeAmount = Math.max(1, Math.floor(amount));
  const { error } = await supabase.rpc('increment_reconstructions_count_by', {
    p_user_id: userId,
    p_amount: safeAmount,
  });
  if (!error) return;

  console.warn('[incrementReconstructionsCount] RPC failed, trying direct fallback:', error.message);
  const { data: row, error: readErr } = await supabase
    .from('users')
    .select('reconstructions_count')
    .eq('id', userId)
    .single();

  if (readErr || !row) {
    console.error('[incrementReconstructionsCount] Fallback read failed:', readErr?.message);
    return;
  }

  const { error: writeErr } = await supabase
    .from('users')
    .update({ reconstructions_count: ((row as { reconstructions_count?: number }).reconstructions_count ?? 0) + safeAmount })
    .eq('id', userId);

  if (writeErr) {
    console.error('[incrementReconstructionsCount] Fallback write failed:', writeErr.message);
  }
}
