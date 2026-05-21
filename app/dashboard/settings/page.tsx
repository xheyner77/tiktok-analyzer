import { redirect } from 'next/navigation';
import SettingsPageClient from '@/components/dashboard-v2/settings/SettingsPageClient';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard-data';
import { normalizePlan } from '@/lib/plans';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

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

  return (
    <SettingsPageClient
      account={{
        name: dashboard.user.name,
        email: dashboard.user.email,
        plan: effectivePlan,
        planLabel: dashboard.user.planLabel,
        createdAt: profile?.created_at ?? null,
        subscriptionStatus: profile?.subscription_status ?? null,
        quotaUsed: dashboard.user.quotaUsed,
        quotaLimit: dashboard.user.quotaLimit,
      }}
      tiktok={dashboard.tiktokConnection}
    />
  );
}
