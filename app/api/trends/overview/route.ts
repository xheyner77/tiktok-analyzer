import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTikTokDashboardState } from '@/lib/tiktok-accounts';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { buildTrendOverview } from '@/lib/trends/recommendations';
import { getTrendSourceStatus, listTrendClusters } from '@/lib/trends/repository';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  const [sourceStatus, clusters, tiktok] = await Promise.all([
    getTrendSourceStatus(),
    listTrendClusters({ limit: 10 }),
    getTikTokDashboardState(session.userId, plan),
  ]);

  return NextResponse.json(
    buildTrendOverview({
      clusters,
      sourceStatus,
      totalRawItems: sourceStatus.totalRawItems,
      tiktokConnected: tiktok.active > 0,
    }),
  );
}
