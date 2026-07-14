import { NextRequest } from 'next/server';
import { privateJson } from '@/lib/api-route-security';
import { reconcileStaleAnalysisJobs } from '@/lib/video-analysis/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

async function reconcile(request: NextRequest) {
  if (!isAuthorized(request)) {
    return privateJson({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    return privateJson(await reconcileStaleAnalysisJobs());
  } catch (error) {
    console.error('[analysis-job-reconcile] failed', {
      code: error instanceof Error ? error.message.slice(0, 120) : 'UNKNOWN',
    });
    return privateJson({ error: 'Réconciliation temporairement indisponible.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return reconcile(request);
}

export async function POST(request: NextRequest) {
  return reconcile(request);
}
