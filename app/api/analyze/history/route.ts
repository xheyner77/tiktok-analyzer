import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';
import { getAnalyses } from '@/lib/analyses';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ analyses: [], locked: true });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ analyses: [], locked: true });
    }

    const analyses = await getAnalyses(session.userId, user.plan);
    // Cap the dashboard preview to 30 for Pro and all rows for Elite.
    // getAnalyses() already limits to HISTORY_LIMITS[plan], so this is just
    // a dashboard-panel cap — never slice Elite below what the plan allows.
    const dashboardCap = user.plan === 'elite' ? analyses.length : Math.min(analyses.length, 30);
    return NextResponse.json({
      analyses: analyses.slice(0, dashboardCap),
      locked: user.plan === 'free',
      plan: user.plan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[analyze/history] Unexpected error:', message);
    return NextResponse.json({ analyses: [], locked: true }, { status: 500 });
  }
}
