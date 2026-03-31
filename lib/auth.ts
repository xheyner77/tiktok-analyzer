import { supabase } from './supabase';
import type { Plan } from './supabase';

export interface SessionPayload {
  userId: string;
  email: string;
}

// ── Plan limits ─────────────────────────────────────────────────────────────

/** Analyses per period (Free = lifetime; Pro/Elite = per calendar month) */
export const PLAN_LIMITS: Record<string, number> = {
  free:  3,
  pro:   50,
  elite: 300,
};

/** Hook generator quota per calendar month (0 = feature unavailable) */
export const HOOK_LIMITS: Record<string, number> = {
  free:  0,
  pro:   30,
  elite: 100,
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  plan: Plan;
  analyses_count: number;
  hooks_count: number;
  last_reset_at: string;
  created_at: string;
}

export type User = UserProfile;

// Emails that always get elite plan — no DB writes, no payment needed
const DEV_EMAILS = ['xheyner77@gmail.com'];

// ── Read ─────────────────────────────────────────────────────────────────────

/** Read the user profile from public.users (single source of truth) */
export async function getUserById(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, plan, analyses_count, hooks_count, last_reset_at, created_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const profile: UserProfile = {
    id:             data.id,
    email:          data.email,
    plan:           (data.plan as Plan) ?? 'free',
    analyses_count: (data.analyses_count as number) ?? 0,
    hooks_count:    (data.hooks_count    as number) ?? 0,
    last_reset_at:  data.last_reset_at   ?? new Date().toISOString(),
    created_at:     data.created_at,
  };

  // Dev override — forces elite plan without touching the DB
  if (DEV_EMAILS.includes(profile.email.toLowerCase())) {
    profile.plan           = 'elite';
    profile.analyses_count = 0;
    profile.hooks_count    = 0;
  }

  return profile;
}

// ── Monthly reset ─────────────────────────────────────────────────────────────

/**
 * If the user is on a paid plan and we've crossed a calendar-month boundary
 * since last_reset_at, reset analyses_count and hooks_count to 0.
 *
 * Free plan counters are lifetime quotas — never reset.
 *
 * Returns the (possibly updated) profile.
 */
export async function checkAndResetMonthly(user: UserProfile): Promise<UserProfile> {
  // Free plan: lifetime quota, never reset
  if (user.plan === 'free') return user;

  const lastReset = new Date(user.last_reset_at);
  const now       = new Date();

  const sameMonth =
    lastReset.getUTCFullYear() === now.getUTCFullYear() &&
    lastReset.getUTCMonth()    === now.getUTCMonth();

  if (sameMonth) return user;

  // Different calendar month — reset counters
  const nowIso = now.toISOString();
  const { error } = await supabase
    .from('users')
    .update({ analyses_count: 0, hooks_count: 0, last_reset_at: nowIso })
    .eq('id', user.id);

  if (error) {
    console.error('[checkAndResetMonthly] Reset failed:', error.message);
    return user;
  }

  console.log('[checkAndResetMonthly] Monthly counters reset for:', user.id);
  return { ...user, analyses_count: 0, hooks_count: 0, last_reset_at: nowIso };
}

// ── Increments ───────────────────────────────────────────────────────────────

/** Atomic increment of analyses_count */
export async function incrementAnalysesCount(userId: string): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('users')
    .select('analyses_count')
    .eq('id', userId)
    .single();

  if (fetchError || !current) {
    console.error('[incrementAnalysesCount] User not found:', userId);
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ analyses_count: current.analyses_count + 1 })
    .eq('id', userId);

  if (error) {
    console.error('[incrementAnalysesCount] Update failed:', error.message);
  }
}

/** Atomic increment of hooks_count */
export async function incrementHooksCount(userId: string): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('users')
    .select('hooks_count')
    .eq('id', userId)
    .single();

  if (fetchError || !current) {
    console.error('[incrementHooksCount] User not found:', userId);
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ hooks_count: current.hooks_count + 1 })
    .eq('id', userId);

  if (error) {
    console.error('[incrementHooksCount] Update failed:', error.message);
  }
}
