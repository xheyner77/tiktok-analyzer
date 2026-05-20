import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getLastTrendScanJob } from '@/lib/trends/repository';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });
  const job = await getLastTrendScanJob();
  return NextResponse.json(job ?? { status: 'idle', itemsFetched: 0, clustersCreated: 0, error: null });
}
