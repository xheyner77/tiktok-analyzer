import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { saveRepostFeedback, type FeedbackLevel } from '@/lib/repost-feedback-engine';

function bool(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function feedbackLevel(value: unknown): FeedbackLevel | undefined {
  return value === 'worse' || value === 'same' || value === 'better' || value === 'unknown' ? value : undefined;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').replace(/[<>]/g, '').trim()).filter(Boolean).slice(0, 12);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const reposted = bool(body.reposted);
    if (reposted === undefined) {
      return NextResponse.json({ error: 'Champ reposted requis' }, { status: 400 });
    }

    const satisfaction = typeof body.satisfaction === 'number' && Number.isFinite(body.satisfaction)
      ? Math.max(0, Math.min(100, Math.round(body.satisfaction)))
      : undefined;

    const saved = await saveRepostFeedback({
      userId: session.userId,
      analysisId: typeof body.analysisId === 'string' ? body.analysisId : null,
      videoId: typeof body.videoId === 'string' ? body.videoId : undefined,
      reposted,
      hookBetter: bool(body.hookBetter),
      retentionBetter: feedbackLevel(body.retentionBetter),
      engagementBetter: feedbackLevel(body.engagementBetter),
      performedBetter: feedbackLevel(body.performedBetter),
      useful: bool(body.useful),
      satisfaction,
      appliedRecommendations: stringList(body.appliedRecommendations),
      ignoredRecommendations: stringList(body.ignoredRecommendations),
      patternKeys: stringList(body.patternKeys),
    });

    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    console.error('[repost-feedback] error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
