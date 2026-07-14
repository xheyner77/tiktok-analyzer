import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('réconciliation bornée des analyses abandonnées', () => {
  const jobs = readFileSync('lib/video-analysis/jobs.ts', 'utf8');
  const migration = readFileSync('supabase/migrations/20260713180000_video_analysis_jobs.sql', 'utf8');
  const route = readFileSync('app/api/cron/analysis-jobs-reconcile/route.ts', 'utf8');
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons?: Array<{ path?: string; schedule?: string }>;
  };

  it('couvre tous les états non terminaux avec une fenêtre de sûreté et une limite stricte', () => {
    for (const status of [
      'queued',
      'preprocessing',
      'transcribing',
      'visual_analysis',
      'audio_analysis',
      'segment_analysis',
      'synthesis',
      'validation',
    ]) expect(jobs).toContain(`'${status}'`);
    expect(jobs).toContain('DEFAULT_STALE_PROCESSING_AGE_MS = 6 * 60 * 60 * 1_000');
    expect(jobs).toContain('DEFAULT_STALE_UPLOAD_AGE_MS = 2 * 60 * 60 * 1_000');
    expect(jobs).toContain('DEFAULT_TERMINAL_CLEANUP_AGE_MS = 15 * 60 * 1_000');
    expect(jobs).toContain('Math.min(100, Math.floor(input.limit ?? 25))');
    expect(jobs).toContain(".eq('status', 'uploading')");
    expect(jobs).toContain(".lt('created_at', uploadCutoff)");
    expect(jobs).toContain(".lt('updated_at', cutoff)");
  });

  it('réalise un CAS en base et ne nettoie que si la transition stale a gagné la course', () => {
    const cleanup = jobs.slice(
      jobs.indexOf('async function failAndCleanStaleJob'),
      jobs.indexOf('async function cleanupExpiredProcessingJobsForUser'),
    );
    expect(cleanup).toContain("supabase.rpc('fail_stale_analysis_job'");
    expect(cleanup).toContain('p_expected_statuses: [job.status]');
    expect(cleanup).toContain('p_stale_before: staleBefore');
    expect(cleanup).toContain('if (!transitioned) return');
    expect(cleanup.indexOf('if (!transitioned) return')).toBeLessThan(
      cleanup.indexOf('removeInputObject(job, { strict: true })'),
    );
    expect(cleanup).toContain('removeAllJobArtifacts(job.id)');
    expect(cleanup).toContain("result.status === 'rejected'");

    const staleRpc = migration.slice(
      migration.indexOf('create or replace function public.fail_stale_analysis_job'),
      migration.indexOf('revoke all on function public.touch_analysis_job_updated_at'),
    );
    expect(staleRpc).toContain('for update;');
    expect(staleRpc).toContain('not (v_job.status = any(p_expected_statuses))');
    expect(staleRpc).toContain('v_stale_timestamp >= p_stale_before');
    expect(staleRpc.indexOf('v_stale_timestamp >= p_stale_before')).toBeLessThan(
      staleRpc.indexOf("status = 'failed'"),
    );
    expect(staleRpc).toContain('return query select true, v_refunded');
  });

  it('retente indépendamment le nettoyage des jobs terminaux sans supprimer les frames finales', () => {
    const terminalCleanup = jobs.slice(
      jobs.indexOf('export async function cleanupTerminalJobStorage'),
      jobs.indexOf('async function cleanupExpiredProcessingJobsForUser'),
    );
    expect(terminalCleanup).toContain('Promise.allSettled');
    expect(terminalCleanup).toContain("job.status === 'failed'");
    expect(terminalCleanup).toContain("listJobArtifacts(job.id, 'audio')");
    expect(terminalCleanup).toContain('removeAllJobArtifacts(job.id)');
    expect(terminalCleanup).toContain(".update({ cleanup_pending: false })");
    expect(jobs).toContain(".eq('cleanup_pending', true)");
    expect(jobs).toContain(".in('status', ['completed', 'failed'])");
    expect(migration).toContain('cleanup_pending boolean not null default true');
    const cleanupIndex = migration.slice(
      migration.indexOf('create index if not exists analysis_jobs_terminal_cleanup_idx'),
      migration.indexOf('create table if not exists public.analysis_artifacts'),
    );
    expect(cleanupIndex).toContain('on public.analysis_jobs (updated_at)');
    expect(cleanupIndex).toContain('where cleanup_pending = true');
    expect(cleanupIndex).toContain("status in ('completed', 'failed')");
  });

  it('indexe chaque clé étrangère non couverte pour les cascades et suppressions', () => {
    expect(migration).toContain('create index if not exists analysis_jobs_user_created_idx');
    expect(migration).toContain('create index if not exists analysis_jobs_analysis_id_idx');
    expect(migration).toContain('on public.analysis_jobs (analysis_id)');
    expect(migration).toContain('where analysis_id is not null');
    expect(migration).toContain('create index if not exists analysis_artifacts_job_time_idx');
    expect(migration).toContain('create index if not exists analysis_artifacts_user_id_idx');
    expect(migration).toContain('on public.analysis_artifacts (user_id)');
  });

  it('protège la route par CRON_SECRET et planifie une exécution quotidienne bornée', () => {
    expect(route).toContain('process.env.CRON_SECRET');
    expect(route).toContain("request.headers.get('authorization') === `Bearer ${secret}`");
    expect(route).toContain("return privateJson({ error: 'Non autorisé' }, { status: 401 })");
    expect(vercel.crons).toEqual([{
      path: '/api/cron/analysis-jobs-reconcile',
      schedule: '0 3 * * *',
    }]);
  });
});
