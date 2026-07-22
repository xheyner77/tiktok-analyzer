import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canCreateAnalysisJob, isActiveAnalysisJobStatus } from '@/lib/video-analysis/types';
import { publicAnalysisFailure } from '@/lib/video-analysis/public-errors';

describe('targeted active-job reload recovery', () => {
  it('restores the server job and resumes polling without creating a second job', () => {
    const client = readFileSync('components/analyzer/AnalyzerV2Client.tsx', 'utf8');
    const restoration = client.slice(
      client.indexOf('const restoreActiveJob = async () =>'),
      client.indexOf('const analyzeFromUpload = async () =>'),
    );

    expect(restoration).toContain("fetch('/api/analysis-jobs'");
    expect(restoration).toContain("method: 'GET'");
    expect(restoration).toContain('setAnalysisJob(data.job)');
    expect(restoration).toContain('setUploadClientStage(\'processing\')');
    expect(restoration).toContain('pollAnalysisJob(data.job.id, controller.signal)');
    expect(restoration).not.toContain("method: 'POST'");
  });

  it('blocks creation while restoration or the same server job is active', () => {
    expect(isActiveAnalysisJobStatus('preprocessing')).toBe(true);
    expect(canCreateAnalysisJob({ isLoading: false, isRestoring: true })).toBe(false);
    expect(canCreateAnalysisJob({ isLoading: false, isRestoring: false, currentStatus: 'preprocessing' })).toBe(false);
    expect(canCreateAnalysisJob({ isLoading: false, isRestoring: false, currentStatus: 'failed' })).toBe(true);
  });
});

describe('targeted preprocessing failure contract', () => {
  it('returns a useful public message and keeps quota refund on the terminal failure path', () => {
    const failure = publicAnalysisFailure(new Error('VIDEO_FRAME_COVERAGE_INCOMPLETE:internal stack detail'));
    const workflow = readFileSync('lib/video-analysis/workflow-steps.ts', 'utf8');
    const jobs = readFileSync('lib/video-analysis/jobs.ts', 'utf8');

    expect(failure).toEqual({
      code: 'VIDEO_FRAME_COVERAGE_INCOMPLETE',
      message: 'Impossible d’extraire suffisamment d’images de cette vidéo. Vérifie son format ou essaie de la réencoder. Ton quota n’a pas été consommé.',
    });
    expect(failure.message).not.toContain('stack');
    expect(workflow).toContain('await markJobFailed(job, descriptor.code, descriptor.message)');
    expect(jobs).toContain("supabase.rpc('fail_analysis_job'");
    expect(jobs).toContain("(row as { refunded?: unknown } | null)?.refunded === true");
  });
});
