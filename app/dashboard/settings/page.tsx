import { redirect } from 'next/navigation';
import SettingsPageClient from '@/components/dashboard-v2/settings/SettingsPageClient';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { getStoredCreatorMemoryProfile } from '@/lib/creator-memory-store';
import { getDashboardData } from '@/lib/dashboard-data';
import { normalizePlan } from '@/lib/plans';
import { getSession } from '@/lib/session';
import { supabase, type Plan } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type ExpertModeRow = {
  enabled?: boolean;
  analysis_depth?: string;
  weight_profile?: Record<string, unknown>;
  updated_at?: string | null;
};

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

async function getExpertModeSettings(userId: string): Promise<ExpertModeRow | null> {
  const { data, error } = await supabase
    .from('expert_mode_settings')
    .select('enabled, analysis_depth, weight_profile, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[settings] expert mode settings unavailable:', error.message);
    return null;
  }

  return (data as ExpertModeRow | null) ?? null;
}

export default async function DashboardSettingsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/settings');
  }

  const [profile, dashboard] = await Promise.all([
    getUserById(session.userId),
    getDashboardData(),
  ]);

  const effectivePlan = normalizePlan(profile ? getEffectivePlan(profile) : dashboard.user.plan);
  const [memory, expertMode] = await Promise.all([
    getStoredCreatorMemoryProfile(session.userId, effectivePlan as Plan),
    getExpertModeSettings(session.userId),
  ]);
  const weightProfile = expertMode?.weight_profile ?? {};
  const memoryJson = memory?.memory;
  const remembered = [
    ...(memoryJson?.bestHookStyles ?? []).slice(0, 2),
    ...(memoryJson?.recurringPatterns ?? []).slice(0, 2),
    ...(memoryJson?.flopSignals ?? []).slice(0, 1),
  ].filter((item, index, arr) => item && arr.indexOf(item) === index);

  return (
    <SettingsPageClient
      account={{
        name: dashboard.user.name,
        email: dashboard.user.email,
        plan: effectivePlan,
        planLabel: dashboard.user.planLabel,
        createdAt: profile?.created_at ?? null,
        subscriptionStatus: profile?.subscription_status ?? null,
      }}
      tiktok={dashboard.tiktokConnection}
      memory={{
        active: Boolean(memory),
        summary: memory?.summary || memory?.memory.learningSummary || '',
        sourceAnalysisCount: memory?.sourceAnalysisCount ?? 0,
        updatedAt: memory?.updatedAt ?? null,
        remembered,
      }}
      expertMode={{
        exists: Boolean(expertMode),
        enabled: Boolean(expertMode?.enabled),
        analysisDepth: expertMode?.analysis_depth ?? 'standard',
        updatedAt: expertMode?.updated_at ?? null,
        weights: {
          hook: asNumber(weightProfile.hook, 32),
          retention: asNumber(weightProfile.retention, 34),
          cta: asNumber(weightProfile.cta, 18),
          payoff: asNumber(weightProfile.payoff, 16),
        },
      }}
    />
  );
}
