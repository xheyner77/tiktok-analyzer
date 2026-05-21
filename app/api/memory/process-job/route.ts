import { NextRequest, NextResponse } from 'next/server';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getPendingMemoryJob } from '@/lib/memory/repository';
import { processMemoryJob } from '@/lib/memory/extract-job';
import { getSession } from '@/lib/session';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.MEMORY_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const serverAuthorized = isAuthorized(request);

  if (!session && !serverAuthorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const jobId = typeof body.jobId === 'string' ? body.jobId : undefined;
  const job = await getPendingMemoryJob(jobId);

  if (!job) {
    return NextResponse.json({ ok: true, processed: false, reason: 'no_pending_job' });
  }

  if (session && job.user_id !== session.userId && !serverAuthorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const user = await getUserById(job.user_id);
  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
  }

  const result = await processMemoryJob(job, getEffectivePlan(user));
  return NextResponse.json({ ok: result.ok, processed: true, jobId: job.id, factsCreated: result.factsCreated ?? 0, error: result.error });
}
