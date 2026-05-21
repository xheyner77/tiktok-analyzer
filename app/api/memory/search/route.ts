import { NextRequest, NextResponse } from 'next/server';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getMemoryContextForUser } from '@/lib/memory/memory-context';
import type { MemoryTask } from '@/lib/memory/types';
import { getSession } from '@/lib/session';

const ALLOWED_TASKS: MemoryTask[] = ['analyze_video', 'generate_hook', 'generate_v2', 'dashboard_memory', 'radar_future'];

function normalizeTask(value: unknown): MemoryTask {
  return ALLOWED_TASKS.includes(value as MemoryTask) ? (value as MemoryTask) : 'dashboard_memory';
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const task = normalizeTask(body.task);
  const query = typeof body.query === 'string' ? body.query.slice(0, 400) : '';
  const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(20, Math.round(body.limit))) : undefined;
  const context = await getMemoryContextForUser({
    userId: session.userId,
    plan: getEffectivePlan(user),
    task,
    query,
    limit,
  });

  return NextResponse.json({
    enabled: context.enabled,
    tier: context.tier,
    profileSummary: context.profileSummary,
    facts: context.facts,
    warnings: context.warnings,
    commonMistakes: context.commonMistakes,
    v2Opportunities: context.v2Opportunities,
    recommendedStyleConstraints: context.recommendedStyleConstraints,
    prompt: context.prompt,
  });
}
