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
    return NextResponse.json({
      analyses: analyses.slice(0, 12),
      locked: user.plan === 'free',
      plan: user.plan,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[analyze/history] Unexpected error:', message);
    return NextResponse.json({ analyses: [], locked: true }, { status: 500 });
  }
}
