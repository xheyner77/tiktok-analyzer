import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { syncTikTokAccountVideos } from '@/lib/tiktok-sync';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const { id } = await params;
  const result = await syncTikTokAccountVideos(session.userId, id);
  const status = result.ok ? 200 : result.status === 'skipped' ? 409 : 400;

  return NextResponse.json(result, { status });
}
