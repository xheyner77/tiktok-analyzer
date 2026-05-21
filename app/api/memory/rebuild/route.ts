import { NextResponse } from 'next/server';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { consolidateMemoryForUser } from '@/lib/memory/consolidate-memory';
import { createMemoryJob } from '@/lib/memory/repository';
import { getMemoryPlanLimits } from '@/lib/memory/limits';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const plan = getEffectivePlan(user);
  const limits = getMemoryPlanLimits(plan);
  if (!limits.canRebuild) {
    return NextResponse.json({ error: 'Reconstruction mémoire réservée aux plans Pro et Lifetime.' }, { status: 403 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('creator_memory_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('job_type', 'rebuild_profile')
    .gte('created_at', oneHourAgo);

  if ((count ?? 0) >= 1) {
    return NextResponse.json({ error: 'Reconstruction déjà demandée récemment.' }, { status: 429 });
  }

  const job = await createMemoryJob({ userId: session.userId, jobType: 'rebuild_profile' });
  const rebuilt = await consolidateMemoryForUser({ userId: session.userId, plan, force: true });

  return NextResponse.json({ ok: rebuilt, jobId: job?.id ?? null });
}
