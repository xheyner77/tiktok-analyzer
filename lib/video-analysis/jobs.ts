import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import {
  listJobArtifacts,
  removeAllJobArtifacts,
  removeArtifact,
} from './artifacts';
import {
  buildInputStoragePath,
  isOwnedInputStorageLocation,
  matchesIdempotentUpload,
  parseAnalysisCompletionId,
  pickJobStageValues,
  sanitizeOriginalFileName,
} from './job-guards';
import { ACTIVE_ANALYSIS_JOB_STATUSES, type AnalysisJobRow, type AnalysisJobStatus } from './types';
import { reconcileExpiredProviderAttempts } from './provider-ledger';

const JOB_COLUMNS = [
  'id',
  'user_id',
  'idempotency_key',
  'status',
  'progress',
  'current_step',
  'storage_bucket',
  'storage_path',
  'original_file_name',
  'content_type',
  'size_bytes',
  'creator_context',
  'source_metadata',
  'probe',
  'transcript',
  'technical_signals',
  'cost_metrics',
  'workflow_run_id',
  'analysis_id',
  'quota_state',
  'quota_used',
  'quota_limit',
  'attempts',
  'error_code',
  'error_message',
  'created_at',
  'upload_completed_at',
  'quota_reserved_at',
  'quota_period_started_at',
  'cleanup_pending',
  'started_at',
  'completed_at',
  'failed_at',
  'updated_at',
].join(', ');

export { sanitizeOriginalFileName } from './job-guards';

function asJobRow(value: unknown): AnalysisJobRow {
  return value as AnalysisJobRow;
}

async function cleanupExpiredUploadJobs(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - DEFAULT_STALE_UPLOAD_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'uploading')
    .lt('created_at', cutoff)
    .limit(10);
  if (error) throw new Error('ANALYSIS_STALE_UPLOAD_READ_FAILED');

  for (const value of data ?? []) {
    const staleJob = asJobRow(value);
    await failAndCleanStaleJob(staleJob, cutoff);
  }
}

const STALE_PROCESSING_STATUSES: AnalysisJobStatus[] = [
  'queued',
  'preprocessing',
  'transcribing',
  'visual_analysis',
  'audio_analysis',
  'segment_analysis',
  'synthesis',
  'validation',
];

const DEFAULT_STALE_PROCESSING_AGE_MS = 6 * 60 * 60 * 1_000;
const DEFAULT_STALE_UPLOAD_AGE_MS = 2 * 60 * 60 * 1_000;
const DEFAULT_TERMINAL_CLEANUP_AGE_MS = 15 * 60 * 1_000;

async function failAndCleanStaleJob(
  job: AnalysisJobRow,
  staleBefore: string,
): Promise<{ transitioned: boolean; refunded: boolean; cleanupErrors: number }> {
  const uploadExpired = job.status === 'uploading';
  if (job.status === 'completed' || job.status === 'failed') {
    return { transitioned: false, refunded: false, cleanupErrors: 0 };
  }
  const { data, error } = await supabase.rpc('fail_stale_analysis_job', {
    p_job_id: job.id,
    p_user_id: job.user_id,
    p_expected_statuses: [job.status],
    p_stale_before: staleBefore,
    p_error_code: uploadExpired ? 'ANALYSIS_UPLOAD_EXPIRED' : 'ANALYSIS_PROCESSING_EXPIRED',
    p_error_message: uploadExpired
      ? 'L’envoi privé a expiré avant le démarrage de l’analyse.'
      : 'Le traitement a dépassé sa fenêtre de reprise. Ton quota a été restauré.',
  });
  if (error) throw new Error('ANALYSIS_STALE_TRANSITION_FAILED');
  const row = Array.isArray(data) ? data[0] : data;
  const transitioned = (row as { transitioned?: unknown } | null)?.transitioned === true;
  const refunded = (row as { refunded?: unknown } | null)?.refunded === true;
  if (!transitioned) return { transitioned: false, refunded: false, cleanupErrors: 0 };
  const cleanupErrors = await cleanupTerminalJobStorage({
    ...job,
    status: 'failed',
    cleanup_pending: true,
  });
  return { transitioned: true, refunded, cleanupErrors };
}

export async function cleanupTerminalJobStorage(job: AnalysisJobRow): Promise<number> {
  if (job.status !== 'completed' && job.status !== 'failed') {
    throw new Error('ANALYSIS_TERMINAL_CLEANUP_STATUS_INVALID');
  }

  const cleanupArtifacts = async (): Promise<number> => {
    if (job.status === 'failed') {
      await removeAllJobArtifacts(job.id);
      return 0;
    }
    const audioArtifacts = await listJobArtifacts(job.id, 'audio');
    const results = await Promise.allSettled(audioArtifacts.map((artifact) => removeArtifact(artifact)));
    return results.filter((result) => result.status === 'rejected').length;
  };
  const [inputResult, artifactResult] = await Promise.allSettled([
    removeInputObject(job, { strict: true }),
    cleanupArtifacts(),
  ]);
  const cleanupErrors = (inputResult.status === 'rejected' ? 1 : 0)
    + (artifactResult.status === 'rejected' ? 1 : artifactResult.value);
  if (cleanupErrors > 0) return cleanupErrors;

  const { data, error } = await supabase
    .from('analysis_jobs')
    .update({ cleanup_pending: false })
    .eq('id', job.id)
    .eq('user_id', job.user_id)
    .in('status', ['completed', 'failed'])
    .select('id')
    .maybeSingle();
  return error || !data ? 1 : 0;
}

async function cleanupExpiredProcessingJobsForUser(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - DEFAULT_STALE_PROCESSING_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('user_id', userId)
    .in('status', STALE_PROCESSING_STATUSES)
    .lt('updated_at', cutoff)
    .limit(10);
  if (error) throw new Error('ANALYSIS_STALE_PROCESSING_READ_FAILED');

  for (const value of data ?? []) {
    await failAndCleanStaleJob(asJobRow(value), cutoff);
  }
}

async function cleanupPendingTerminalJobsForUser(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - DEFAULT_TERMINAL_CLEANUP_AGE_MS).toISOString();
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('user_id', userId)
    .eq('cleanup_pending', true)
    .in('status', ['completed', 'failed'])
    .lt('updated_at', cutoff)
    .limit(10);
  if (error) throw new Error('ANALYSIS_TERMINAL_CLEANUP_READ_FAILED');
  for (const value of data ?? []) {
    await cleanupTerminalJobStorage(asJobRow(value));
  }
}

export async function reconcileStaleAnalysisJobs(input: {
  nowMs?: number;
  staleAfterMs?: number;
  limit?: number;
} = {}): Promise<{
  examined: number;
  failed: number;
  refunded: number;
  cleanupErrors: number;
  providerAttemptsFinalized: number;
}> {
  const nowMs = input.nowMs ?? Date.now();
  const staleAfterMs = Math.max(DEFAULT_STALE_PROCESSING_AGE_MS, input.staleAfterMs ?? DEFAULT_STALE_PROCESSING_AGE_MS);
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));
  const providerAttemptsFinalized = await reconcileExpiredProviderAttempts(limit);
  const cutoff = new Date(nowMs - staleAfterMs).toISOString();
  const uploadCutoff = new Date(nowMs - DEFAULT_STALE_UPLOAD_AGE_MS).toISOString();
  const terminalCleanupCutoff = new Date(nowMs - DEFAULT_TERMINAL_CLEANUP_AGE_MS).toISOString();
  const staleUploads = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('status', 'uploading')
    .lt('created_at', uploadCutoff)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (staleUploads.error) throw new Error('ANALYSIS_STALE_UPLOAD_READ_FAILED');

  const staleProcessing = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .in('status', STALE_PROCESSING_STATUSES)
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (staleProcessing.error) throw new Error('ANALYSIS_STALE_PROCESSING_READ_FAILED');

  const pendingTerminalCleanup = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('cleanup_pending', true)
    .in('status', ['completed', 'failed'])
    .lt('updated_at', terminalCleanupCutoff)
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (pendingTerminalCleanup.error) throw new Error('ANALYSIS_TERMINAL_CLEANUP_READ_FAILED');

  const staleJobs = [
    ...(staleUploads.data ?? []),
    ...(staleProcessing.data ?? []),
  ]
    .map(asJobRow)
    .sort((left, right) => Date.parse(left.updated_at) - Date.parse(right.updated_at))
    .slice(0, limit);

  let failed = 0;
  let refunded = 0;
  let cleanupErrors = 0;
  for (const staleJob of staleJobs) {
    try {
      const result = await failAndCleanStaleJob(
        staleJob,
        staleJob.status === 'uploading' ? uploadCutoff : cutoff,
      );
      if (result.transitioned) failed += 1;
      if (result.refunded) refunded += 1;
      cleanupErrors += result.cleanupErrors;
    } catch {
      cleanupErrors += 1;
    }
  }
  const terminalJobs = (pendingTerminalCleanup.data ?? []).map(asJobRow).slice(0, limit);
  for (const terminalJob of terminalJobs) {
    try {
      cleanupErrors += await cleanupTerminalJobStorage(terminalJob);
    } catch {
      cleanupErrors += 1;
    }
  }
  return {
    examined: staleJobs.length + terminalJobs.length,
    failed,
    refunded,
    cleanupErrors,
    providerAttemptsFinalized,
  };
}

export async function getOwnedAnalysisJob(jobId: string, userId: string): Promise<AnalysisJobRow | null> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[analysis-job] read_failed', { code: error.code });
    throw new Error('ANALYSIS_JOB_READ_FAILED');
  }
  return data ? asJobRow(data) : null;
}

export async function getLatestActiveAnalysisJob(userId: string): Promise<AnalysisJobRow | null> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('user_id', userId)
    .in('status', [...ACTIVE_ANALYSIS_JOB_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[analysis-job] active_read_failed', { code: error.code });
    throw new Error('ANALYSIS_ACTIVE_JOB_READ_FAILED');
  }
  return data ? asJobRow(data) : null;
}

export async function getAnalysisJobForWorkflow(jobId: string): Promise<AnalysisJobRow> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .single();

  if (error || !data) {
    console.error('[analysis-job] workflow_read_failed', { jobId, code: error?.code ?? 'missing' });
    throw new Error('ANALYSIS_JOB_NOT_FOUND');
  }
  return asJobRow(data);
}

export async function createOrReuseUploadJob(input: {
  userId: string;
  idempotencyKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  creatorContext: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
}): Promise<{ job: AnalysisJobRow; uploadToken: string | null; reused: boolean }> {
  const existing = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('user_id', input.userId)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing.error) {
    console.error('[analysis-job] idempotency_read_failed', { code: existing.error.code });
    throw new Error('ANALYSIS_JOB_CREATE_FAILED');
  }

  let job: AnalysisJobRow;
  let reused = Boolean(existing.data);

  if (existing.data) {
    job = asJobRow(existing.data);
    if (!matchesIdempotentUpload(job, input)) {
      throw new Error('ANALYSIS_IDEMPOTENCY_CONFLICT');
    }
  } else {
    await cleanupExpiredUploadJobs(input.userId);
    await cleanupExpiredProcessingJobsForUser(input.userId);
    await cleanupPendingTerminalJobsForUser(input.userId);
    const jobId = randomUUID();
    const originalFileName = sanitizeOriginalFileName(input.fileName);
    const storagePath = buildInputStoragePath({
      userId: input.userId,
      jobId,
      fileName: originalFileName,
      contentType: input.contentType,
    });
    const inserted = await supabase
      .from('analysis_jobs')
      .insert({
        id: jobId,
        user_id: input.userId,
        idempotency_key: input.idempotencyKey,
        storage_path: storagePath,
        original_file_name: originalFileName,
        content_type: input.contentType,
        size_bytes: input.sizeBytes,
        creator_context: input.creatorContext,
        source_metadata: input.sourceMetadata ?? {},
      })
      .select(JOB_COLUMNS)
      .single();

    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === '23505') {
        const winner = await getJobByIdempotencyKey(input.userId, input.idempotencyKey);
        if (!winner) throw new Error('ANALYSIS_JOB_CREATE_FAILED');
        job = winner;
        reused = true;
        if (!matchesIdempotentUpload(job, input)) {
          throw new Error('ANALYSIS_IDEMPOTENCY_CONFLICT');
        }
      } else {
        if (inserted.error?.message?.includes('analysis_job_active_limit')) {
          const winner = await getJobByIdempotencyKey(input.userId, input.idempotencyKey);
          if (!winner) throw new Error('ANALYSIS_ACTIVE_JOB_LIMIT');
          if (!matchesIdempotentUpload(winner, input)) {
            throw new Error('ANALYSIS_IDEMPOTENCY_CONFLICT');
          }
          job = winner;
          reused = true;
        } else {
          console.error('[analysis-job] create_failed', { code: inserted.error?.code ?? 'missing' });
          throw new Error('ANALYSIS_JOB_CREATE_FAILED');
        }
      }
    } else {
      job = asJobRow(inserted.data);
    }
  }

  if (job.status !== 'uploading') {
    return { job, uploadToken: null, reused };
  }

  if (!isOwnedInputStorageLocation({
    userId: job.user_id,
    jobId: job.id,
    bucket: job.storage_bucket,
    path: job.storage_path,
  })) {
    throw new Error('ANALYSIS_STORAGE_LOCATION_INVALID');
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(job.storage_bucket)
    .createSignedUploadUrl(job.storage_path, { upsert: false });

  if (signedError || !signed?.token) {
    console.error('[analysis-job] signed_upload_failed', {
      jobId: job.id,
      name: signedError?.name ?? 'MissingToken',
    });
    throw new Error('ANALYSIS_UPLOAD_TOKEN_FAILED');
  }

  return { job, uploadToken: signed.token, reused };
}

async function getJobByIdempotencyKey(userId: string, key: string): Promise<AnalysisJobRow | null> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('user_id', userId)
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) return null;
  return data ? asJobRow(data) : null;
}

export async function assertUploadedObject(job: AnalysisJobRow): Promise<void> {
  if (!isOwnedInputStorageLocation({
    userId: job.user_id,
    jobId: job.id,
    bucket: job.storage_bucket,
    path: job.storage_path,
  })) {
    throw new Error('ANALYSIS_UPLOAD_LOCATION_MISMATCH');
  }
  const { data, error } = await supabase.storage.from(job.storage_bucket).info(job.storage_path);
  if (error) {
    const details = error as unknown as { status?: unknown; statusCode?: unknown };
    const status = Number(details.statusCode ?? details.status);
    if (status === 404) throw new Error('ANALYSIS_UPLOAD_NOT_FOUND');
    throw new Error('ANALYSIS_UPLOAD_CHECK_FAILED');
  }
  if (!data) throw new Error('ANALYSIS_UPLOAD_NOT_FOUND');

  const actualSize = typeof data.size === 'number' ? data.size : Number(data.size);
  if (!Number.isFinite(actualSize) || actualSize !== job.size_bytes) {
    throw new Error('ANALYSIS_UPLOAD_SIZE_MISMATCH');
  }
  const actualType = typeof data.metadata?.mimetype === 'string' ? data.metadata.mimetype : null;
  if (actualType && actualType !== job.content_type) {
    throw new Error('ANALYSIS_UPLOAD_TYPE_MISMATCH');
  }
}

export async function reserveJobQuota(job: AnalysisJobRow): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  state: string;
}> {
  const { data, error } = await supabase.rpc('reserve_analysis_job_quota', {
    p_job_id: job.id,
    p_user_id: job.user_id,
  });
  if (error) {
    console.error('[analysis-job] reserve_quota_failed', { jobId: job.id, code: error.code });
    throw new Error('ANALYSIS_QUOTA_RESERVATION_FAILED');
  }
  const row = Array.isArray(data) ? data[0] : data;
  const value = row as { allowed?: unknown; used?: unknown; limit_value?: unknown; quota_state?: unknown } | null;
  return {
    allowed: value?.allowed === true,
    used: Number(value?.used) || 0,
    limit: Number(value?.limit_value) || 0,
    state: typeof value?.quota_state === 'string' ? value.quota_state : 'unknown',
  };
}

export async function claimJobWorkflowStart(jobId: string, userId: string): Promise<string | null> {
  const claim = `starting:${randomUUID()}`;
  const { data, error } = await supabase.rpc('claim_analysis_job_workflow_start', {
    p_job_id: jobId,
    p_user_id: userId,
    p_claim: claim,
  });
  if (error) throw new Error('ANALYSIS_WORKFLOW_CLAIM_FAILED');
  return data === true ? claim : null;
}

export async function setJobWorkflowRunId(jobId: string, userId: string, claim: string, runId: string): Promise<void> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .update({ workflow_run_id: runId })
    .eq('id', jobId)
    .eq('user_id', userId)
    .eq('workflow_run_id', claim)
    .select('id')
    .maybeSingle();
  if (error || !data) throw new Error('ANALYSIS_WORKFLOW_LINK_FAILED');
}

export async function updateJobStage(input: {
  jobId: string;
  status: Exclude<AnalysisJobStatus, 'completed' | 'failed' | 'uploading'>;
  progress: number;
  values?: Record<string, unknown>;
}): Promise<void> {
  const progress = Math.max(0, Math.min(99, Math.round(input.progress)));
  const values = pickJobStageValues(input.values);
  const { data, error } = await supabase
    .from('analysis_jobs')
    .update({
      status: input.status,
      current_step: input.status,
      progress,
      started_at: input.status === 'preprocessing' ? new Date().toISOString() : undefined,
      ...values,
    })
    .eq('id', input.jobId)
    .not('status', 'in', '(completed,failed)')
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.error('[analysis-job] stage_update_failed', { jobId: input.jobId, code: error?.code ?? 'terminal' });
    throw new Error(error ? 'ANALYSIS_JOB_UPDATE_FAILED' : 'ANALYSIS_JOB_TERMINAL');
  }
}

export async function markJobFailed(job: AnalysisJobRow, code: string, message: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fail_analysis_job', {
    p_job_id: job.id,
    p_user_id: job.user_id,
    p_error_code: code,
    p_error_message: message,
  });
  if (error) {
    console.error('[analysis-job] terminal_failure_write_failed', { jobId: job.id, code: error.code });
    throw new Error('ANALYSIS_FAILURE_PERSIST_FAILED');
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { refunded?: unknown } | null)?.refunded === true;
}

export interface CompleteAnalysisJobInput {
  jobId: string;
  userId: string;
  videoUrl: string;
  legacyResult: Record<string, unknown>;
  engineResult: Record<string, unknown>;
  schemaVersion: string;
  promptVersion: string;
  pipelineVersion: string;
  modelVersion: string;
}

export async function completeAnalysisJob(input: CompleteAnalysisJobInput): Promise<string> {
  const versions = [
    input.schemaVersion,
    input.promptVersion,
    input.pipelineVersion,
    input.modelVersion,
  ];
  if (!input.videoUrl.trim() || versions.some((version) => !version.trim())) {
    throw new Error('ANALYSIS_COMPLETION_METADATA_INVALID');
  }
  if (input.engineResult.analysisId !== input.jobId) {
    throw new Error('ANALYSIS_COMPLETION_IDENTITY_MISMATCH');
  }

  const { data, error } = await supabase.rpc('complete_analysis_job', {
    p_job_id: input.jobId,
    p_user_id: input.userId,
    p_video_url: input.videoUrl,
    p_legacy_result: input.legacyResult,
    p_engine_result: input.engineResult,
    p_schema_version: input.schemaVersion,
    p_prompt_version: input.promptVersion,
    p_pipeline_version: input.pipelineVersion,
    p_model_version: input.modelVersion,
  });
  if (error) {
    console.error('[analysis-job] completion_failed', { jobId: input.jobId, code: error.code });
    throw new Error('ANALYSIS_COMPLETION_PERSIST_FAILED');
  }

  return parseAnalysisCompletionId(data);
}

export async function recordCompletedJobMemoryOutcome(input: {
  jobId: string;
  userId: string;
  costMetrics: Record<string, unknown>;
}): Promise<void> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .update({ cost_metrics: input.costMetrics })
    .eq('id', input.jobId)
    .eq('user_id', input.userId)
    .eq('status', 'completed')
    .select('id')
    .maybeSingle();
  if (error || !data) {
    console.warn('[analysis-job] memory_outcome_write_failed', {
      jobId: input.jobId,
      code: error?.code ?? 'completed_job_missing',
    });
    throw new Error('ANALYSIS_MEMORY_OUTCOME_WRITE_FAILED');
  }
}

export async function removeInputObject(
  job: Pick<AnalysisJobRow, 'storage_bucket' | 'storage_path' | 'id' | 'user_id'>,
  options: { strict?: boolean } = {},
): Promise<void> {
  if (!isOwnedInputStorageLocation({
    userId: job.user_id,
    jobId: job.id,
    bucket: job.storage_bucket,
    path: job.storage_path,
  })) {
    throw new Error('ANALYSIS_STORAGE_LOCATION_INVALID');
  }
  const { error } = await supabase.storage.from(job.storage_bucket).remove([job.storage_path]);
  if (error) {
    console.warn('[analysis-job] input_cleanup_failed', { jobId: job.id, name: error.name });
    if (options.strict) throw new Error('ANALYSIS_INPUT_CLEANUP_FAILED');
  }
}

export async function createInputSignedUrl(job: AnalysisJobRow, expiresIn = 300): Promise<string> {
  if (!isOwnedInputStorageLocation({
    userId: job.user_id,
    jobId: job.id,
    bucket: job.storage_bucket,
    path: job.storage_path,
  })) {
    throw new Error('ANALYSIS_STORAGE_LOCATION_INVALID');
  }
  const { data, error } = await supabase.storage
    .from(job.storage_bucket)
    .createSignedUrl(job.storage_path, expiresIn);
  if (error || !data?.signedUrl) throw new Error('ANALYSIS_INPUT_URL_FAILED');
  return data.signedUrl;
}

export async function incrementJobAttempts(jobId: string): Promise<void> {
  const current = await getAnalysisJobForWorkflow(jobId);
  const { error } = await supabase
    .from('analysis_jobs')
    .update({ attempts: current.attempts + 1 })
    .eq('id', jobId);
  if (error) throw new Error('ANALYSIS_JOB_UPDATE_FAILED');
}
