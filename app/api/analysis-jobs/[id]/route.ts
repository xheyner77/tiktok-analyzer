import { NextRequest } from 'next/server';
import { privateJson } from '@/lib/api-route-security';
import { getSessionVerification } from '@/lib/session';
import { getOwnedAnalysisJob } from '@/lib/video-analysis/jobs';
import { toPublicAnalysisJob } from '@/lib/video-analysis/types';

export const runtime = 'nodejs';

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const sessionResult = await getSessionVerification();
  if (sessionResult.status !== 'authenticated') {
    return privateJson(
      { error: sessionResult.status === 'unavailable' ? 'Session temporairement indisponible.' : 'Connexion requise.' },
      { status: sessionResult.status === 'unavailable' ? 503 : 401 },
    );
  }

  const { id } = await context.params;
  if (!validUuid(id)) return privateJson({ error: 'Analyse introuvable.' }, { status: 404 });

  try {
    const job = await getOwnedAnalysisJob(id, sessionResult.session.userId);
    if (!job) return privateJson({ error: 'Analyse introuvable.' }, { status: 404 });
    return privateJson({ job: toPublicAnalysisJob(job) });
  } catch {
    return privateJson({ error: 'État de l’analyse temporairement indisponible.' }, { status: 503 });
  }
}
