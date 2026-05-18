import { redirect } from 'next/navigation';
import SupportPageClient from '@/components/dashboard-v2/support/SupportPageClient';
import { getUserById } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard-data';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardSupportPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/support');
  }

  const [dashboard, profile] = await Promise.all([
    getDashboardData(),
    getUserById(session.userId),
  ]);

  return (
    <SupportPageClient
      context={{
        email: dashboard.user.email,
        planLabel: dashboard.user.planLabel,
        quotaUsed: dashboard.user.quotaUsed,
        quotaLimit: dashboard.user.quotaLimit,
        tiktokConnected: dashboard.tiktokConnection.connected,
        tiktokDisplayName: dashboard.tiktokConnection.displayName,
        tiktokModeLabel: dashboard.tiktokConnection.modeLabel,
        tiktokScopes: dashboard.tiktokConnection.scopes,
        billingStatus: profile?.subscription_status ?? null,
        hasLatestAnalysis: dashboard.states.hasLatestAnalysis,
        latestAnalysisTitle: dashboard.latestVideo.title,
        latestAnalysisDate: dashboard.latestVideo.date,
      }}
    />
  );
}
