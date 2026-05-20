import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listTrendClusters } from '@/lib/trends/repository';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { clusterId?: string };
  if (!body.clusterId) return NextResponse.json({ error: 'clusterId requis.' }, { status: 400 });

  const cluster = (await listTrendClusters({ limit: 100 })).find((item) => item.id === body.clusterId);
  if (!cluster) return NextResponse.json({ error: 'Tendance introuvable.' }, { status: 404 });

  await supabase.from('trend_user_recommendations').insert({
    user_id: session.userId,
    cluster_id: cluster.id,
    verdict: cluster.recommendation.verdict,
    reason: cluster.recommendation.shortReason,
    recommended_hook: cluster.recommendation.recommendedHook,
    recommended_angle: cluster.recommendation.recommendedAngle,
    recommended_format: cluster.recommendation.recommendedFormat,
  });

  return NextResponse.json({ recommendation: cluster.recommendation });
}
