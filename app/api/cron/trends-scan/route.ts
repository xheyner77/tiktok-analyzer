import { NextRequest, NextResponse } from 'next/server';
import { runTrendScan } from '@/lib/trends/pipeline';
import { getDefaultTrendScanPayload } from '@/lib/trends/watchlist';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return bearer === secret || request.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runTrendScan(getDefaultTrendScanPayload(), null);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
