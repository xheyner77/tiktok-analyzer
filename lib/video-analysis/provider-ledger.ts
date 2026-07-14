import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { RetryableError } from 'workflow';
import { VIDEO_ANALYSIS_LIMITS } from './config';
import type { AnalysisJobRow } from './types';

export type ProviderCallStatus = 'started' | 'succeeded' | 'failed';
export type ProviderBillingStatus = 'billable' | 'non_billable' | 'unknown';
export type ProviderUsageKind = 'tokens' | 'audio_seconds' | 'none' | 'unknown';

export interface ProviderUsageSnapshot {
  kind: ProviderUsageKind;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  audioSeconds: number | null;
}

export interface ProviderLedgerContext {
  jobId: string;
  callKey: string;
  stage: string;
  operation: string;
  model: string;
  fallbackIndex?: number;
  billable: boolean;
}

export interface ProviderAttemptHandle {
  attemptId: string;
  leaseOwner: string;
  leaseExpiresAt: string | null;
  leaseAcquired: boolean;
  reclaimedExpiredLease: boolean;
  replayLeaseExpiresAt: string | null;
  replayLeaseAcquired: boolean;
  reclaimedExpiredReplayLease: boolean;
  context: ProviderLedgerContext;
  retryIndex: number;
  startedAt: string;
  startedAtMs: number;
  existingStatus: ProviderCallStatus;
  existingRetryable: boolean | null;
  existingFallbackAllowed: boolean | null;
  existingErrorCode: string | null;
}

const PROVIDER_ATTEMPT_LEASE_SECONDS = Math.max(
  30,
  Math.ceil(VIDEO_ANALYSIS_LIMITS.providerTimeoutMs / 1_000) + 60,
);

export interface ProviderLedgerRow {
  id?: number;
  attempt_id: string;
  job_id: string;
  call_key: string;
  stage: string;
  operation: string;
  provider: string;
  model: string;
  status: ProviderCallStatus;
  billing_status: ProviderBillingStatus;
  usage_kind: ProviderUsageKind;
  fallback_index: number;
  retry_index: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_input_tokens: number | null;
  audio_seconds: number | string | null;
  price_catalog_version: string | null;
  estimated_cost_usd: number | string | null;
  error_code: string | null;
  retryable: boolean | null;
  fallback_allowed: boolean | null;
  started_at: string;
  ended_at: string | null;
  wall_ms: number | null;
  provider_duration_ms: number | null;
  replay_count: number;
  replay_failed_count: number;
  replay_provider_duration_ms: number | string;
}

export interface ModelPricing {
  billingUnit: 'tokens' | 'audio_seconds';
  inputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  cachedInputUsdPerMillion?: number;
  audioUsdPerMinute?: number;
}

export interface ProviderPricingCatalog {
  version: string | null;
  models: Record<string, ModelPricing>;
}

export interface ProviderCostCalculation {
  priceCatalogVersion: string | null;
  estimatedCostUsd: number | null;
  missingPricing: boolean;
}

export interface ProviderTimingInput {
  createdAt?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  terminalAt?: string | null;
  nowMs?: number;
  stageWallDurationsMs?: Record<string, number>;
}

export interface ProviderCostSummary {
  schemaVersion: 'provider-ledger-v1';
  scope: 'all_billable_provider_calls';
  providerCalls: number;
  providerProbeCalls: number;
  providerReplayCalls: number;
  failedReplayCalls: number;
  succeededCalls: number;
  billableSucceededCalls: number;
  failedCalls: number;
  pendingCalls: number;
  retries: number;
  fallbacks: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  audioSeconds: number;
  providerDurationMs: number;
  replayProviderDurationMs: number;
  billableProviderDurationMs: number;
  stageProviderDurationsMs: Record<string, number>;
  stageWallDurationsMs: Record<string, number>;
  queueMs: number | null;
  elapsedPipelineMs: number | null;
  endToEndMs: number | null;
  pricingCatalogVersion: string | null;
  pricingCatalogVersions: string[];
  estimatedCostUsd: number | null;
  missingPricingModels: string[];
  indeterminateBillingModels: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function boundedInteger(value: unknown): number | null {
  const parsed = finiteNonNegative(value);
  return parsed === null ? null : Math.round(parsed);
}

function operationalValue(value: string, fallback: string, maxLength: number): string {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength);
  return safe || fallback;
}

export function deterministicProviderAttemptId(
  context: ProviderLedgerContext,
  retryIndex: number,
): string {
  const hex = createHash('sha256')
    .update(context.jobId)
    .update('\0')
    .update(context.callKey)
    .update('\0')
    .update(String(context.fallbackIndex ?? 0))
    .update('\0')
    .update(String(retryIndex))
    .digest('hex')
    .slice(0, 32)
    .split('');
  // RFC 4122-compatible deterministic UUID: version 5 + RFC variant bits.
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function elapsed(start: number | null, end: number | null): number | null {
  if (start === null || end === null || end < start) return null;
  return Math.round(end - start);
}

function pricingNumber(row: Record<string, unknown>, key: string): number | undefined {
  const value = finiteNonNegative(row[key]);
  return value === null ? undefined : value;
}

function parseModelPricing(value: unknown): ModelPricing | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const inputUsdPerMillion = pricingNumber(row, 'inputUsdPerMillion');
  const outputUsdPerMillion = pricingNumber(row, 'outputUsdPerMillion');
  const cachedInputUsdPerMillion = pricingNumber(row, 'cachedInputUsdPerMillion');
  const audioUsdPerMinute = pricingNumber(row, 'audioUsdPerMinute');
  const explicitUnit = row.billingUnit;
  const billingUnit = explicitUnit === 'tokens' || explicitUnit === 'audio_seconds'
    ? explicitUnit
    : audioUsdPerMinute !== undefined
      && inputUsdPerMillion === undefined
      && outputUsdPerMillion === undefined
      ? 'audio_seconds'
      : 'tokens';

  if (billingUnit === 'tokens' && (inputUsdPerMillion === undefined || outputUsdPerMillion === undefined)) {
    return null;
  }
  if (billingUnit === 'audio_seconds' && audioUsdPerMinute === undefined) return null;
  return {
    billingUnit,
    ...(inputUsdPerMillion === undefined ? {} : { inputUsdPerMillion }),
    ...(outputUsdPerMillion === undefined ? {} : { outputUsdPerMillion }),
    ...(cachedInputUsdPerMillion === undefined ? {} : { cachedInputUsdPerMillion }),
    ...(audioUsdPerMinute === undefined ? {} : { audioUsdPerMinute }),
  };
}

/**
 * Expected shape:
 * { "version": "2026-07-13", "models": { "gpt-4o": { ... } } }
 *
 * A legacy direct model map is still parsed, but it is only considered
 * versioned when OPENAI_MODEL_PRICING_VERSION is also configured.
 */
export function readConfiguredPricingCatalog(): ProviderPricingCatalog {
  const raw = process.env.OPENAI_MODEL_PRICING_JSON;
  if (!raw) return { version: null, models: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { version: null, models: {} };
    }
    const root = parsed as Record<string, unknown>;
    const nestedModels = root.models && typeof root.models === 'object' && !Array.isArray(root.models)
      ? root.models as Record<string, unknown>
      : null;
    const rawModels = nestedModels ?? root;
    const configuredVersion = nestedModels ? root.version : process.env.OPENAI_MODEL_PRICING_VERSION;
    const version = typeof configuredVersion === 'string' && configuredVersion.trim()
      ? configuredVersion.trim().slice(0, 80)
      : null;
    const models: Record<string, ModelPricing> = {};
    for (const [model, value] of Object.entries(rawModels)) {
      if (!model.trim() || model === 'version' || model === 'models') continue;
      const pricing = parseModelPricing(value);
      if (pricing) models[model.trim()] = pricing;
    }
    return { version, models };
  } catch {
    return { version: null, models: {} };
  }
}

export function providerUsageFromUnknown(
  value: unknown,
  fallbackAudioSeconds?: number,
): ProviderUsageSnapshot {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const inputTokens = boundedInteger(row.input_tokens ?? row.prompt_tokens);
  const outputTokens = boundedInteger(row.output_tokens ?? row.completion_tokens);
  const details = row.input_tokens_details && typeof row.input_tokens_details === 'object'
    ? row.input_tokens_details as Record<string, unknown>
    : row.input_token_details && typeof row.input_token_details === 'object'
      ? row.input_token_details as Record<string, unknown>
      : {};
  const cachedInputTokens = boundedInteger(details.cached_tokens);
  const reportedSeconds = finiteNonNegative(row.seconds ?? row.duration);
  const audioSeconds = reportedSeconds ?? finiteNonNegative(fallbackAudioSeconds);
  const tokenUsageReported = row.type === 'tokens'
    || 'input_tokens' in row
    || 'output_tokens' in row
    || 'prompt_tokens' in row
    || 'completion_tokens' in row;

  return {
    kind: tokenUsageReported ? 'tokens' : audioSeconds !== null ? 'audio_seconds' : 'unknown',
    inputTokens,
    outputTokens,
    cachedInputTokens,
    audioSeconds,
  };
}

export function estimateProviderUsageCost(
  model: string,
  usage: ProviderUsageSnapshot,
  catalog: ProviderPricingCatalog = readConfiguredPricingCatalog(),
): ProviderCostCalculation {
  const pricing = catalog.models[model];
  if (!catalog.version || !pricing) {
    return {
      priceCatalogVersion: catalog.version,
      estimatedCostUsd: null,
      missingPricing: true,
    };
  }

  if (pricing.billingUnit === 'audio_seconds') {
    if (usage.audioSeconds === null || pricing.audioUsdPerMinute === undefined) {
      return { priceCatalogVersion: catalog.version, estimatedCostUsd: null, missingPricing: true };
    }
    return {
      priceCatalogVersion: catalog.version,
      estimatedCostUsd: Number(((usage.audioSeconds / 60) * pricing.audioUsdPerMinute).toFixed(8)),
      missingPricing: false,
    };
  }

  if (
    usage.kind !== 'tokens'
    || usage.inputTokens === null
    || usage.outputTokens === null
    || pricing.inputUsdPerMillion === undefined
    || pricing.outputUsdPerMillion === undefined
  ) {
    return { priceCatalogVersion: catalog.version, estimatedCostUsd: null, missingPricing: true };
  }
  const cached = usage.cachedInputTokens ?? 0;
  if (cached > usage.inputTokens || (cached > 0 && pricing.cachedInputUsdPerMillion === undefined)) {
    return { priceCatalogVersion: catalog.version, estimatedCostUsd: null, missingPricing: true };
  }
  const regularInput = usage.inputTokens - cached;
  const cost = (regularInput / 1_000_000) * pricing.inputUsdPerMillion
    + (cached / 1_000_000) * (pricing.cachedInputUsdPerMillion ?? pricing.inputUsdPerMillion)
    + (usage.outputTokens / 1_000_000) * pricing.outputUsdPerMillion;
  return {
    priceCatalogVersion: catalog.version,
    estimatedCostUsd: Number(cost.toFixed(8)),
    missingPricing: false,
  };
}

export function inferProviderLedgerContext(input: {
  idempotencyKey?: string;
  operation: string;
  model: string;
  fallbackIndex?: number;
  billable: boolean;
}): ProviderLedgerContext | null {
  const key = input.idempotencyKey?.trim();
  if (!key) return null;
  const jobId = key.split(':', 1)[0];
  if (!UUID_PATTERN.test(jobId)) return null;
  const lower = key.toLowerCase();
  const stage = lower.includes(':visual-')
    ? 'visual_analysis'
    : lower.includes(':specialist:')
      ? 'specialist_analysis'
      : lower.includes(':timeline:')
        ? 'timeline_analysis'
        : lower.includes(':transcript') || lower.includes(':alignment')
          ? 'transcription'
          : lower.includes(':critique:') || lower.includes(':synthesis')
            ? 'synthesis'
            : 'provider';
  return {
    jobId,
    // Include operation and model so a reordered fallback list cannot reuse a
    // previous model's logical ledger slot.
    callKey: `${key.slice(0, 170)}:${operationalValue(input.operation, 'provider.call', 32)}:${input.model.slice(0, 32)}`
      .slice(0, 240),
    stage,
    operation: operationalValue(input.operation, 'provider.call', 120),
    model: input.model.slice(0, 120),
    fallbackIndex: Math.max(0, Math.round(input.fallbackIndex ?? 0)),
    billable: input.billable,
  };
}

async function getAdminClient() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

export async function beginProviderAttempt(
  context: ProviderLedgerContext,
  retryIndex: number,
  claimReplay = true,
): Promise<ProviderAttemptHandle> {
  if (!UUID_PATTERN.test(context.jobId)) throw new Error('PROVIDER_LEDGER_JOB_ID_INVALID');
  const startedAtMs = Date.now();
  const retry = Math.max(0, Math.round(retryIndex));
  const leaseOwner = randomUUID();
  const handle: ProviderAttemptHandle = {
    attemptId: deterministicProviderAttemptId(context, retry),
    leaseOwner,
    leaseExpiresAt: null,
    leaseAcquired: false,
    reclaimedExpiredLease: false,
    replayLeaseExpiresAt: null,
    replayLeaseAcquired: false,
    reclaimedExpiredReplayLease: false,
    context: {
      ...context,
      callKey: context.callKey.slice(0, 240),
      stage: operationalValue(context.stage, 'provider', 80),
      operation: operationalValue(context.operation, 'provider.call', 120),
      model: context.model.slice(0, 120),
    },
    retryIndex: retry,
    startedAt: new Date(startedAtMs).toISOString(),
    startedAtMs,
    existingStatus: 'started',
    existingRetryable: null,
    existingFallbackAllowed: null,
    existingErrorCode: null,
  };
  const client = await getAdminClient();
  const { data, error } = await client.rpc('claim_analysis_provider_attempt', {
    p_attempt_id: handle.attemptId,
    p_job_id: handle.context.jobId,
    p_call_key: handle.context.callKey,
    p_stage: handle.context.stage,
    p_operation: handle.context.operation,
    p_provider: 'openai',
    p_model: handle.context.model,
    p_billing_status: handle.context.billable ? 'unknown' : 'non_billable',
    p_usage_kind: handle.context.billable ? 'unknown' : 'none',
    p_fallback_index: Math.max(0, Math.round(handle.context.fallbackIndex ?? 0)),
    p_retry_index: handle.retryIndex,
    p_started_at: handle.startedAt,
    p_lease_owner: leaseOwner,
    p_lease_seconds: PROVIDER_ATTEMPT_LEASE_SECONDS,
    p_claim_replay: claimReplay,
  });
  if (error) throw new Error('PROVIDER_LEDGER_START_PERSIST_FAILED');
  const claimed = (Array.isArray(data) ? data[0] : data) as {
    attempt_id?: unknown;
    started_at?: unknown;
    status?: unknown;
    retryable?: unknown;
    fallback_allowed?: unknown;
    error_code?: unknown;
    lease_acquired?: unknown;
    lease_expires_at?: unknown;
    reclaimed_expired_lease?: unknown;
    replay_lease_acquired?: unknown;
    replay_lease_expires_at?: unknown;
    reclaimed_expired_replay_lease?: unknown;
  } | null;
  if (
    !claimed
    || typeof claimed.attempt_id !== 'string'
    || typeof claimed.started_at !== 'string'
    || !['started', 'succeeded', 'failed'].includes(String(claimed.status))
  ) {
    throw new Error('PROVIDER_LEDGER_START_READ_FAILED');
  }
  handle.attemptId = claimed.attempt_id;
  handle.startedAt = claimed.started_at;
  handle.startedAtMs = Date.parse(handle.startedAt);
  handle.existingStatus = claimed.status as ProviderCallStatus;
  handle.existingRetryable = typeof claimed.retryable === 'boolean'
    ? claimed.retryable
    : null;
  handle.existingFallbackAllowed = typeof claimed.fallback_allowed === 'boolean'
    ? claimed.fallback_allowed
    : null;
  handle.existingErrorCode = typeof claimed.error_code === 'string'
    ? claimed.error_code
    : null;
  handle.leaseAcquired = claimed.lease_acquired === true;
  handle.leaseExpiresAt = typeof claimed.lease_expires_at === 'string'
    ? claimed.lease_expires_at
    : null;
  handle.reclaimedExpiredLease = claimed.reclaimed_expired_lease === true;
  handle.replayLeaseAcquired = claimed.replay_lease_acquired === true;
  handle.replayLeaseExpiresAt = typeof claimed.replay_lease_expires_at === 'string'
    ? claimed.replay_lease_expires_at
    : null;
  handle.reclaimedExpiredReplayLease = claimed.reclaimed_expired_replay_lease === true;
  return handle;
}

export async function finishProviderAttempt(input: {
  handle: ProviderAttemptHandle;
  status: Exclude<ProviderCallStatus, 'started'>;
  billingStatus: ProviderBillingStatus;
  usage?: ProviderUsageSnapshot;
  providerDurationMs: number;
  errorCode?: string | null;
  retryable?: boolean | null;
  fallbackAllowed?: boolean | null;
}): Promise<void> {
  if (!input.handle.leaseAcquired) {
    throw new RetryableError('PROVIDER_ATTEMPT_LEASE_LOST', { retryAfter: '1s' });
  }
  const endedAtMs = Date.now();
  const usage = input.usage ?? {
    kind: input.billingStatus === 'non_billable' ? 'none' : 'unknown',
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    audioSeconds: null,
  } satisfies ProviderUsageSnapshot;
  const cost = input.status === 'succeeded' && input.billingStatus === 'billable'
    ? estimateProviderUsageCost(input.handle.context.model, usage)
    : {
        priceCatalogVersion: readConfiguredPricingCatalog().version,
        estimatedCostUsd: input.billingStatus === 'non_billable' ? 0 : null,
        missingPricing: input.billingStatus !== 'non_billable',
      };
  const client = await getAdminClient();
  const { data, error } = await client
    .from('analysis_provider_calls')
    .update({
      status: input.status,
      billing_status: input.billingStatus,
      usage_kind: usage.kind,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      audio_seconds: usage.audioSeconds,
      price_catalog_version: cost.priceCatalogVersion,
      estimated_cost_usd: cost.estimatedCostUsd,
      error_code: input.errorCode
        ? operationalValue(input.errorCode, 'provider_error', 120).toUpperCase()
        : null,
      retryable: input.status === 'failed' ? input.retryable ?? false : null,
      fallback_allowed: input.status === 'failed' ? input.fallbackAllowed ?? false : null,
      ended_at: new Date(endedAtMs).toISOString(),
      wall_ms: Math.max(0, Math.round(endedAtMs - input.handle.startedAtMs)),
      provider_duration_ms: Math.max(0, Math.round(input.providerDurationMs)),
      lease_owner: null,
      lease_expires_at: null,
      finalized_by: input.handle.leaseOwner,
      updated_at: new Date(endedAtMs).toISOString(),
    })
    .eq('job_id', input.handle.context.jobId)
    .eq('attempt_id', input.handle.attemptId)
    .eq('status', 'started')
    .eq('lease_owner', input.handle.leaseOwner)
    .select('attempt_id')
    .maybeSingle();
  if (error) {
    throw new RetryableError('PROVIDER_LEDGER_FINISH_PERSIST_FAILED', { retryAfter: '2s' });
  }
  if (!data) {
    const existing = await client
      .from('analysis_provider_calls')
      .select('status, finalized_by')
      .eq('job_id', input.handle.context.jobId)
      .eq('attempt_id', input.handle.attemptId)
      .maybeSingle();
    if (
      existing.error
      || existing.data?.status !== input.status
      || existing.data?.finalized_by !== input.handle.leaseOwner
    ) {
      throw new RetryableError('PROVIDER_ATTEMPT_LEASE_LOST', { retryAfter: '1s' });
    }
  }
}

export async function recordProviderReplay(input: {
  handle: ProviderAttemptHandle;
  succeeded: boolean;
  providerDurationMs: number;
}): Promise<void> {
  if (input.handle.existingStatus !== 'succeeded') {
    throw new Error('PROVIDER_LEDGER_REPLAY_STATE_INVALID');
  }
  if (!input.handle.replayLeaseAcquired) {
    throw new RetryableError('PROVIDER_REPLAY_LEASE_ACTIVE', { retryAfter: '1s' });
  }
  const client = await getAdminClient();
  const { data, error } = await client.rpc('record_analysis_provider_replay', {
    p_job_id: input.handle.context.jobId,
    p_attempt_id: input.handle.attemptId,
    p_lease_owner: input.handle.leaseOwner,
    p_succeeded: input.succeeded,
    p_provider_duration_ms: Math.max(0, Math.round(input.providerDurationMs)),
  });
  if (error || data !== true) {
    throw new RetryableError('PROVIDER_REPLAY_LEASE_LOST', { retryAfter: '1s' });
  }
}

function numberMetric(row: ProviderLedgerRow, key: keyof ProviderLedgerRow): number {
  return finiteNonNegative(row[key]) ?? 0;
}

function sumByStage(rows: ProviderLedgerRow[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.stage] = (result[row.stage] ?? 0)
      + numberMetric(row, 'provider_duration_ms')
      + numberMetric(row, 'replay_provider_duration_ms');
  }
  return result;
}

export function summarizeProviderCallRows(
  rows: ProviderLedgerRow[],
  timing: ProviderTimingInput = {},
): ProviderCostSummary {
  const providerCalls = rows.filter((row) => row.operation !== 'models.retrieve');
  const probeCalls = rows.filter((row) => row.operation === 'models.retrieve');
  const succeeded = providerCalls.filter((row) => row.status === 'succeeded');
  const failed = providerCalls.filter((row) => row.status === 'failed');
  const pending = providerCalls.filter((row) => row.status === 'started');
  const billableSucceeded = succeeded.filter((row) => row.billing_status === 'billable');
  const indeterminate = providerCalls.filter((row) => (
    row.status === 'started'
    || row.billing_status === 'unknown'
    || numberMetric(row, 'replay_count') > 0
  ));
  const missingCost = billableSucceeded.filter((row) => finiteNonNegative(row.estimated_cost_usd) === null);
  const missingPricingModels = [...new Set(missingCost.map((row) => row.model))].sort();
  const indeterminateBillingModels = [...new Set(indeterminate.map((row) => row.model))].sort();
  const pricingCatalogVersions = [...new Set(
    billableSucceeded
      .map((row) => row.price_catalog_version)
      .filter((value): value is string => Boolean(value)),
  )].sort();
  const costComplete = indeterminate.length === 0
    && missingCost.length === 0
    && billableSucceeded.every((row) => Boolean(row.price_catalog_version));
  const createdAt = parseDateMs(timing.createdAt);
  const queuedAt = parseDateMs(timing.queuedAt) ?? createdAt;
  const startedAt = parseDateMs(timing.startedAt);
  const terminalAt = parseDateMs(timing.terminalAt) ?? (timing.nowMs ?? Date.now());
  const replayProviderDurationMs = rows.reduce(
    (sum, row) => sum + numberMetric(row, 'replay_provider_duration_ms'),
    0,
  );

  return {
    schemaVersion: 'provider-ledger-v1',
    scope: 'all_billable_provider_calls',
    providerCalls: providerCalls.length,
    providerProbeCalls: probeCalls.length,
    providerReplayCalls: providerCalls.reduce((sum, row) => sum + numberMetric(row, 'replay_count'), 0),
    failedReplayCalls: providerCalls.reduce((sum, row) => sum + numberMetric(row, 'replay_failed_count'), 0),
    succeededCalls: succeeded.length,
    billableSucceededCalls: billableSucceeded.length,
    failedCalls: failed.length,
    pendingCalls: pending.length,
    retries: providerCalls.filter((row) => row.retry_index > 0).length,
    fallbacks: providerCalls.filter((row) => row.fallback_index > 0 && row.retry_index === 0).length,
    inputTokens: billableSucceeded.reduce((sum, row) => sum + numberMetric(row, 'input_tokens'), 0),
    outputTokens: billableSucceeded.reduce((sum, row) => sum + numberMetric(row, 'output_tokens'), 0),
    cachedInputTokens: billableSucceeded.reduce((sum, row) => sum + numberMetric(row, 'cached_input_tokens'), 0),
    audioSeconds: billableSucceeded.reduce((sum, row) => sum + numberMetric(row, 'audio_seconds'), 0),
    providerDurationMs: rows.reduce((sum, row) => sum + numberMetric(row, 'provider_duration_ms'), 0)
      + replayProviderDurationMs,
    replayProviderDurationMs,
    billableProviderDurationMs: billableSucceeded
      .reduce((sum, row) => sum + numberMetric(row, 'provider_duration_ms'), 0),
    stageProviderDurationsMs: sumByStage(rows),
    stageWallDurationsMs: timing.stageWallDurationsMs ?? {},
    queueMs: elapsed(queuedAt, startedAt),
    elapsedPipelineMs: elapsed(startedAt, terminalAt),
    endToEndMs: elapsed(createdAt, terminalAt),
    pricingCatalogVersion: pricingCatalogVersions.length === 1 ? pricingCatalogVersions[0] : null,
    pricingCatalogVersions,
    estimatedCostUsd: costComplete
      ? Number(billableSucceeded
          .reduce((sum, row) => sum + (finiteNonNegative(row.estimated_cost_usd) ?? 0), 0)
          .toFixed(8))
      : null,
    missingPricingModels,
    indeterminateBillingModels,
  };
}

const LEDGER_COLUMNS = [
  'id',
  'attempt_id',
  'job_id',
  'call_key',
  'stage',
  'operation',
  'provider',
  'model',
  'status',
  'billing_status',
  'usage_kind',
  'fallback_index',
  'retry_index',
  'input_tokens',
  'output_tokens',
  'cached_input_tokens',
  'audio_seconds',
  'price_catalog_version',
  'estimated_cost_usd',
  'error_code',
  'retryable',
  'fallback_allowed',
  'started_at',
  'ended_at',
  'wall_ms',
  'provider_duration_ms',
  'replay_count',
  'replay_failed_count',
  'replay_provider_duration_ms',
].join(', ');

function stageWallDurations(value: Record<string, unknown>): Record<string, number> {
  const nested = value.stageDurationsMs;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return {};
  return Object.fromEntries(Object.entries(nested).flatMap(([key, raw]) => {
    const duration = boundedInteger(raw);
    return duration === null ? [] : [[key, duration]];
  }));
}

export async function buildProviderCostRollup(
  job: AnalysisJobRow,
  costMetrics: Record<string, unknown> = job.cost_metrics,
  nowMs = Date.now(),
): Promise<Record<string, unknown>> {
  const client = await getAdminClient();
  const { data, error } = await client
    .from('analysis_provider_calls')
    .select(LEDGER_COLUMNS)
    .eq('job_id', job.id)
    .order('started_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error('PROVIDER_LEDGER_READ_FAILED');
  const rows = (data ?? []) as unknown as ProviderLedgerRow[];
  const summary = summarizeProviderCallRows(rows, {
    createdAt: job.created_at,
    queuedAt: job.quota_reserved_at ?? job.upload_completed_at ?? job.created_at,
    startedAt: job.started_at,
    terminalAt: job.completed_at ?? job.failed_at,
    nowMs,
    stageWallDurationsMs: stageWallDurations(costMetrics),
  });
  return {
    providerCalls: summary.providerCalls,
    inputTokens: summary.inputTokens,
    outputTokens: summary.outputTokens,
    retries: summary.retries,
    estimatedCostUsd: summary.estimatedCostUsd,
    estimatedCostScope: summary.scope,
    missingPricingModels: summary.missingPricingModels,
    indeterminateBillingModels: summary.indeterminateBillingModels,
    pricingCatalogVersion: summary.pricingCatalogVersion,
    pricingCatalogVersions: summary.pricingCatalogVersions,
    providerDurationMs: summary.providerDurationMs,
    providerReplayCalls: summary.providerReplayCalls,
    failedReplayCalls: summary.failedReplayCalls,
    replayProviderDurationMs: summary.replayProviderDurationMs,
    billableProviderDurationMs: summary.billableProviderDurationMs,
    queueMs: summary.queueMs,
    elapsedPipelineMs: summary.elapsedPipelineMs,
    endToEndMs: summary.endToEndMs,
    providerLedger: summary,
  };
}

export async function persistProviderCostRollup(
  job: AnalysisJobRow,
  costMetrics: Record<string, unknown> = job.cost_metrics,
): Promise<Record<string, unknown>> {
  const rollup = await buildProviderCostRollup(job, costMetrics);
  const merged = { ...costMetrics, ...rollup };
  const client = await getAdminClient();
  const { error } = await client
    .from('analysis_jobs')
    .update({ cost_metrics: merged })
    .eq('id', job.id)
    .eq('user_id', job.user_id);
  if (error) throw new Error('PROVIDER_LEDGER_ROLLUP_PERSIST_FAILED');
  return merged;
}
