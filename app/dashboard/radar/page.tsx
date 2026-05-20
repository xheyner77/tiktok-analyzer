import { redirect } from 'next/navigation';
import TrendRadarPageClient from '@/components/dashboard-v2/radar/TrendRadarPageClient';
import { buildTrendRadarModel } from '@/lib/trends/trend-recommendations';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardRadarPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/radar');
  }

  return <TrendRadarPageClient model={buildTrendRadarModel()} />;
}
