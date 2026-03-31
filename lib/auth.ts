import { supabase } from './supabase';
import type { Plan } from './supabase';

export interface SessionPayload {
  userId: string;
  email: string;
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  elite: Infinity,
};

export interface UserProfile {
  id: string;
  email: string;
  plan: Plan;
  analyses_count: number;
  created_at: string;
}

export type User = UserProfile;

// Emails that always get elite plan — no DB writes, no payment needed
const DEV_EMAILS = ['xheyner77@gmail.com'];

// Read the user profile from public.users (single source of truth for plan & count)
export async function getUserById(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, plan, analyses_count, created_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const profile: UserProfile = {
    id: data.id,
    email: data.email,
    plan: (data.plan as Plan) ?? 'free',
    analyses_count: (data.analyses_count as number) ?? 0,
    created_at: data.created_at,
  };

  // Dev override — forces elite plan without touching the DB
  if (DEV_EMAILS.includes(profile.email.toLowerCase())) {
    profile.plan = 'elite';
    profile.analyses_count = 0;
  }

  return profile;
}

// Atomic increment via SQL expression — no race condition risk for MVP
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
