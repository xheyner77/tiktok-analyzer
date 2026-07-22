export type AnalysisJobStatus =
  | 'uploading'
  | 'queued'
  | 'preprocessing'
  | 'transcribing'
  | 'visual_analysis'
  | 'audio_analysis'
  | 'segment_analysis'
  | 'synthesis'
  | 'validation'
  | 'completed'
  | 'failed';

export const ACTIVE_ANALYSIS_JOB_STATUSES = [
  'uploading',
  'queued',
  'preprocessing',
  'transcribing',
  'visual_analysis',
  'audio_analysis',
  'segment_analysis',
  'synthesis',
  'validation',
] as const satisfies readonly AnalysisJobStatus[];

export function isActiveAnalysisJobStatus(status: AnalysisJobStatus | null | undefined): boolean {
  return status !== null
    && status !== undefined
    && ACTIVE_ANALYSIS_JOB_STATUSES.includes(status as typeof ACTIVE_ANALYSIS_JOB_STATUSES[number]);
}

export function canCreateAnalysisJob(input: {
  isLoading: boolean;
  isRestoring: boolean;
  currentStatus?: AnalysisJobStatus | null;
}): boolean {
  return !input.isLoading && !input.isRestoring && !isActiveAnalysisJobStatus(input.currentStatus);
}

export type AnalysisJobQuotaState = 'not_reserved' | 'reserved' | 'consumed' | 'refunded';

export interface AnalysisJobRow {
  id: string;
  user_id: string;
  idempotency_key: string;
  status: AnalysisJobStatus;
  progress: number;
  current_step: string;
  storage_bucket: string;
  storage_path: string;
  original_file_name: string;
  content_type: string;
  size_bytes: number;
  creator_context: Record<string, unknown>;
  source_metadata: Record<string, unknown>;
  probe: unknown;
  transcript: unknown;
  technical_signals: unknown;
  cost_metrics: Record<string, unknown>;
  workflow_run_id: string | null;
  analysis_id: string | null;
  quota_state: AnalysisJobQuotaState;
  quota_used: number | null;
  quota_limit: number | null;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  upload_completed_at: string | null;
  quota_reserved_at: string | null;
  quota_period_started_at: string | null;
  cleanup_pending: boolean;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  updated_at: string;
}

export interface PublicAnalysisJob {
  id: string;
  status: AnalysisJobStatus;
  progress: number;
  currentStep: string;
  analysisId: string | null;
  quota: {
    state: AnalysisJobQuotaState;
    used: number | null;
    limit: number | null;
    restored: boolean;
  };
  error: null | { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisCostMetrics {
  videoDurationSeconds: number;
  inputBytes: number;
  audioBytes: number;
  frameCount: number;
  segmentCount: number;
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  estimatedCostScope: 'all_billable_provider_calls';
  missingPricingModels: string[];
  indeterminateBillingModels: string[];
  pricingCatalogVersion: string | null;
  providerDurationMs: number;
  billableProviderDurationMs: number;
  queueMs: number | null;
  elapsedPipelineMs: number | null;
  endToEndMs: number | null;
  stageDurationsMs: Record<string, number>;
  retries: number;
}

export function toPublicAnalysisJob(row: AnalysisJobRow): PublicAnalysisJob {
  return {
    id: row.id,
    status: row.status,
    progress: Math.max(0, Math.min(100, Math.round(row.progress))),
    currentStep: row.current_step,
    analysisId: row.analysis_id,
    quota: {
      state: row.quota_state,
      used: row.quota_used,
      limit: row.quota_limit,
      restored: row.quota_state === 'refunded',
    },
    error: row.error_code
      ? {
          code: row.error_code,
          message: row.error_message || 'Analyse interrompue. Ton quota a été restauré.',
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
