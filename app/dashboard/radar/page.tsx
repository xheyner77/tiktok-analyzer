import { redirect } from 'next/navigation';
import TrendCommandCenter from '@/components/trends/TrendCommandCenter';
import { buildTrendOverview } from '@/lib/trends/recommendations';
import { getTrendSourceStatus, listTrendClusters } from '@/lib/trends/repository';
import { getSession } from '@/lib/session';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getTikTokDashboardState } from '@/lib/tiktok-accounts';

export const dynamic = 'force-dynamic';

export default async function DashboardRadarPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/radar');
  }

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  const [sourceStatus, clusters, tiktok] = await Promise.all([
    getTrendSourceStatus(),
    listTrendClusters({ limit: 10 }),
    getTikTokDashboardState(session.userId, plan),
  ]);

  const overview = buildTrendOverview({
    clusters,
    sourceStatus,
    totalRawItems: sourceStatus.totalRawItems,
    tiktokConnected: tiktok.active > 0,
  });

  return <TrendCommandCenter initialOverview={overview} />;
}
