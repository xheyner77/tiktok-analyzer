import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
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

    const tier = getEffectivePlan(user);
    const analyses = await getAnalyses(session.userId, tier);
    const dashboardCap = tier === 'elite' ? analyses.length : Math.min(analyses.length, 30);
    return NextResponse.json({
      analyses: analyses.slice(0, dashboardCap),
      locked: tier === 'free',
      plan: tier,
      billingPlan: user.plan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[analyze/history] Unexpected error:', message);
    return NextResponse.json({ analyses: [], locked: true }, { status: 500 });
  }
}
