import { supabase } from './supabase';
import type { Plan } from './supabase';
import { HOOK_LIMITS, PLAN_LIMITS } from './plan-limits';
import { getEffectivePlan } from './stripe-billing';

export {
  HOOK_LIMITS,
  PLAN_LIMITS,
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
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
  /** Produit souscrit en base (peut rester pro/elite si impayé — voir subscription_status). */
  plan: Plan;
  analyses_count: number;
  hooks_count: number;
  last_reset_at: string;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
}

export type User = UserProfile;

/**
 * Optional local-only override: comma-separated emails that appear as Elite in the UI
 * without changing the DB. Use ONLY in .env.local for testing — never set in Vercel production.
 */
function isForceEliteEmail(email: string): boolean {
  const raw = process.env.DEV_FORCE_ELITE_EMAILS ?? '';
  if (!raw.trim()) return false;
  const set = new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  return set.has(email.toLowerCase());
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Read the user profile from public.users (single source of truth) */
export async function getUserById(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, plan, analyses_count, hooks_count, last_reset_at, created_at, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end'
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const profile: UserProfile = {
    id:                                data.id,
    email:                             data.email,
    plan:                              (data.plan as Plan) ?? 'free',
    analyses_count:                    (data.analyses_count as number) ?? 0,
    hooks_count:                       (data.hooks_count as number) ?? 0,
    last_reset_at:                     data.last_reset_at ?? new Date().toISOString(),
    created_at:                        data.created_at,
    stripe_customer_id:               (data.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id:           (data.stripe_subscription_id as string | null) ?? null,
    subscription_status:              (data.subscription_status as string | null) ?? null,
    subscription_current_period_end:  (data.subscription_current_period_end as string | null) ?? null,
    subscription_cancel_at_period_end: Boolean(data.subscription_cancel_at_period_end),
  };

  // Local dev only — keeps UI in sync with optional test override (empty by default)
  if (isForceEliteEmail(profile.email)) {
    profile.plan           = 'elite';
    profile.analyses_count = 0;
    profile.hooks_count    = 0;
  }

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
  if (user.plan === 'free') return user;
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
    .update({ analyses_count: 0, hooks_count: 0, last_reset_at: nowIso })
    .eq('id', user.id);

  if (error) {
    console.error('[checkAndResetMonthly] Reset failed:', error.message);
    return user;
  }

  console.log('[checkAndResetMonthly] Monthly counters reset (legacy calendar) for:', user.id);
  return { ...user, analyses_count: 0, hooks_count: 0, last_reset_at: nowIso };
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

// ── Increments ───────────────────────────────────────────────────────────────

/**
 * Atomically increments analyses_count using a server-side SQL function.
 * Avoids the read-then-write race condition that allows quota bypass under
 * concurrent requests.
 */
export async function incrementAnalysesCount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_analyses_count', { user_id: userId });
  if (error) {
    console.error('[incrementAnalysesCount] RPC failed:', error.message, '— userId:', userId);
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
  if (error) {
    console.error('[incrementHooksCount] RPC failed:', error.message, '— userId:', userId, 'amount:', safeAmount);
  }
}
