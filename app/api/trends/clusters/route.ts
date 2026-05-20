import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listTrendClusters } from '@/lib/trends/repository';
import type { TrendClusterFilters, TrendStage, TrendVerdict } from '@/lib/trends/types';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const filters: TrendClusterFilters = {
    niche: params.get('niche') ?? undefined,
    country: params.get('country') ?? undefined,
    stage: (params.get('stage') as TrendStage | null) ?? undefined,
    verdict: (params.get('verdict') as TrendVerdict | null) ?? undefined,
    sort: (params.get('sort') as TrendClusterFilters['sort'] | null) ?? 'score',
    limit: Number(params.get('limit') ?? 10),
  };

  return NextResponse.json({ clusters: await listTrendClusters(filters) });
}
