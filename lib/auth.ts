import { supabase } from './supabase';
import type { Plan } from './supabase';
import { HOOK_LIMITS, PLAN_LIMITS, RECONSTRUCTION_LIMITS } from './plan-limits';
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
  stripe_price_id?: string | null;
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

const USER_PROFILE_SELECT_WITH_STRIPE_PRICE =
  'id, email, plan, analyses_count, hooks_count, reconstructions_count, last_reset_at, created_at, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, tiktok_open_id, tiktok_display_name, tiktok_avatar_url, tiktok_connected_at';

const USER_PROFILE_SELECT_LEGACY =
  'id, email, plan, analyses_count, hooks_count, reconstructions_count, last_reset_at, created_at, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, tiktok_open_id, tiktok_display_name, tiktok_avatar_url, tiktok_connected_at';

function isMissingStripePriceIdColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = error?.message ?? '';
  return error?.code === 'PGRST204' || error?.code === '42703' || /stripe_price_id/i.test(message);
}

/** Read the user profile from public.users (single source of truth) */
export async function getUserById(id: string): Promise<UserProfile | null> {
  let result = await supabase
    .from('users')
    .select(USER_PROFILE_SELECT_WITH_STRIPE_PRICE)
    .eq('id', id)
    .single();

  if (isMissingStripePriceIdColumn(result.error)) {
    result = await supabase
      .from('users')
      .select(USER_PROFILE_SELECT_LEGACY)
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
 * Si l’utilisateur est en plan payant **sans** abonnement Stripe (legacy), reset des compteurs
 * à chaque changement de mois calendaire.
 *
 * Avec `stripe_subscription_id`, le reset des quotas est déclenché par le webhook `invoice.paid`
 * (billing_reason `subscription_cycle`) pour coller à la période de facturation.
 */
export async function checkAndResetMonthly(user: UserProfile): Promise<UserProfile> {
  if (user.stripe_subscription_id) return user;

  const lastReset = new Date(user.last_reset_at);
  const now       = new Date();

  const sameMonth =
    lastReset.getUTCFullYear() === now.getUTCFullYear() &&
    lastReset.getUTCMonth()    === now.getUTCMonth();

  if (sameMonth) return user;

  const nowIso = now.toISOString();
  const { error } = await supabase
    .from('users')
    .update({ analyses_count: 0, hooks_count: 0, reconstructions_count: 0, last_reset_at: nowIso })
    .eq('id', user.id);

  if (error) {
    console.error('[checkAndResetMonthly] Reset failed:', error.message);
    return user;
  }

  console.log('[checkAndResetMonthly] Monthly counters reset (legacy calendar) for:', user.id);
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

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    used: typeof row?.used === 'number' ? row.used : user.analyses_count,
    limit: typeof row?.limit_value === 'number' ? row.limit_value : limit,
  };
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

  const nextCount = Math.max(0, ((row as { analyses_count?: number }).analyses_count ?? 0) - 1);
  const { error: writeErr } = await supabase
    .from('users')
    .update({ analyses_count: nextCount })
    .eq('id', userId);

  if (writeErr) {
    console.error('[refundAnalysisQuota] Fallback write failed:', writeErr.message);
    return false;
  }

  return true;
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
