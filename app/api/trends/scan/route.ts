import { NextRequest, NextResponse } from 'next/server';
import { canAccessTrendRadar } from '@/lib/feature-access';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { runTrendScan } from '@/lib/trends/pipeline';
import { getDefaultTrendScanPayload } from '@/lib/trends/watchlist';
import type { TrendScanPayload } from '@/lib/trends/types';

function asPayload(value: unknown): TrendScanPayload {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const fallback = getDefaultTrendScanPayload();
  return {
    niches: Array.isArray(record.niches) ? record.niches.map(String) as TrendScanPayload['niches'] : fallback.niches,
    countries: Array.isArray(record.countries) ? record.countries.map(String) : fallback.countries,
    keywords: Array.isArray(record.keywords) ? record.keywords.map(String) : fallback.keywords,
    force: Boolean(record.force),
  };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  if (!canAccessTrendRadar(plan)) {
    return NextResponse.json({ error: 'Le scan manuel Radar est reserve aux plans Pro et Scale.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runTrendScan(asPayload(body), session.userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan impossible.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
