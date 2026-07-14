import { NextRequest } from 'next/server';
import { start } from 'workflow/api';
import { checkAndResetMonthly, getUserById } from '@/lib/auth';
import { privateJson, rejectCrossSiteMutation } from '@/lib/api-route-security';
import { getSessionVerification } from '@/lib/session';
import {
  assertUploadedObject,
  claimJobWorkflowStart,
  getOwnedAnalysisJob,
  markJobFailed,
  removeInputObject,
  reserveJobQuota,
  setJobWorkflowRunId,
} from '@/lib/video-analysis/jobs';
import { toPublicAnalysisJob } from '@/lib/video-analysis/types';
import { runVideoAnalysisWorkflow } from '@/workflows/video-analysis';

export const runtime = 'nodejs';
export const maxDuration = 30;

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  const sessionResult = await getSessionVerification();
  if (sessionResult.status !== 'authenticated') {
    return privateJson(
      { error: sessionResult.status === 'unavailable' ? 'Session temporairement indisponible.' : 'Connexion requise.' },
      { status: sessionResult.status === 'unavailable' ? 503 : 401 },
    );
  }

  const { id } = await context.params;
  if (!validUuid(id)) return privateJson({ error: 'Analyse introuvable.' }, { status: 404 });

  const job = await getOwnedAnalysisJob(id, sessionResult.session.userId);
  if (!job) return privateJson({ error: 'Analyse introuvable.' }, { status: 404 });

  if (job.status !== 'uploading' && job.status !== 'queued') {
    return privateJson({ job: toPublicAnalysisJob(job), started: job.status !== 'failed' });
  }

  let workflowStarted = false;
  try {
    if (job.status === 'uploading') {
      await assertUploadedObject(job);

      const profile = await getUserById(sessionResult.session.userId);
      if (!profile) return privateJson({ error: 'Profil introuvable.' }, { status: 404 });
      await checkAndResetMonthly(profile);

      const quota = await reserveJobQuota(job);
      if (!quota.allowed) {
        await markJobFailed(
          job,
          'ANALYSIS_QUOTA_EXHAUSTED',
          'Ton quota d’analyses est atteint. La vidéo n’a pas été analysée.',
        );
        await removeInputObject(job);
        return privateJson(
          {
            error: 'Ton quota d’analyses est atteint.',
            quota: { used: quota.used, limit: quota.limit },
          },
          { status: 429 },
        );
      }
    } else if (job.quota_state !== 'reserved') {
      return privateJson(
        { error: 'Ce traitement ne peut pas être redémarré dans son état actuel.' },
        { status: 409 },
      );
    }

    const claim = await claimJobWorkflowStart(job.id, job.user_id);
    if (!claim) {
      const current = await getOwnedAnalysisJob(job.id, job.user_id);
      return privateJson({
        job: current ? toPublicAnalysisJob(current) : toPublicAnalysisJob(job),
        started: true,
      });
    }

    const run = await start(runVideoAnalysisWorkflow, [job.id]);
    workflowStarted = true;
    await setJobWorkflowRunId(job.id, job.user_id, claim, run.runId);
    const current = await getOwnedAnalysisJob(job.id, job.user_id);
    return privateJson({
      job: current ? toPublicAnalysisJob(current) : toPublicAnalysisJob(job),
      started: true,
    }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ANALYSIS_START_FAILED';
    if (workflowStarted) {
      // start() a déjà rendu le run durable. Ne jamais rembourser ni supprimer
      // son entrée si seule la liaison de suivi échoue : le workflow terminera
      // ou remboursera lui-même le job de façon atomique.
      console.error('[analysis-job] workflow_link_pending', { jobId: job.id });
      let current = job;
      try {
        current = (await getOwnedAnalysisJob(job.id, job.user_id)) ?? job;
      } catch {
        // La réponse reste honnête : le run est démarré, seul son identifiant
        // de suivi n'a pas pu être relu dans cette requête.
      }
      return privateJson(
        { job: toPublicAnalysisJob(current), started: true, trackingPending: true },
        { status: 202 },
      );
    }
    const isUploadError = code.startsWith('ANALYSIS_UPLOAD_');
    const uploadCanBeRetried = code === 'ANALYSIS_UPLOAD_NOT_FOUND';
    const uploadCheckUnavailable = code === 'ANALYSIS_UPLOAD_CHECK_FAILED';
    if (uploadCanBeRetried || uploadCheckUnavailable) {
      return privateJson(
        {
          error: uploadCanBeRetried
            ? 'La vidéo n’a pas encore été envoyée.'
            : 'La vérification de l\u2019envoi est temporairement indisponible.',
          quotaRestored: false,
          retryUpload: uploadCanBeRetried,
        },
        { status: uploadCanBeRetried ? 400 : 503 },
      );
    }
    let quotaRestored = false;
    try {
      await markJobFailed(
        job,
        isUploadError ? 'ANALYSIS_UPLOAD_INVALID' : 'ANALYSIS_START_FAILED',
        isUploadError
          ? 'Le fichier envoyé est incomplet ou ne correspond pas à la vidéo sélectionnée.'
          : 'Le traitement n’a pas pu démarrer.',
      );
      await removeInputObject(job);
      const failedJob = await getOwnedAnalysisJob(job.id, job.user_id);
      quotaRestored = failedJob?.quota_state === 'refunded';
    } catch {
      console.error('[analysis-job] start_failure_cleanup_failed', { jobId: job.id });
    }

    return privateJson(
      {
        error: isUploadError
          ? 'Le fichier envoyé est incomplet ou ne correspond pas à la vidéo sélectionnée.'
          : quotaRestored
            ? 'Le traitement n’a pas pu démarrer. Ton quota a été restauré.'
            : 'Le traitement n’a pas pu démarrer.',
        quotaRestored,
      },
      { status: isUploadError ? 422 : 503 },
    );
  }
}
