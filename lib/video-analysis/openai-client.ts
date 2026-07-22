import 'server-only';
import OpenAI, { APIConnectionError, APIError, RateLimitError } from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ResponseInputContent } from 'openai/resources/responses/responses';
import type { z } from 'zod';
import { RetryableError } from 'workflow';
import { VIDEO_ANALYSIS_LIMITS } from './config';
import { assertRemoteAnalysisBudget, type AnalysisBudgetReservation } from './budget';
import {
  beginProviderAttempt,
  estimateProviderUsageCost,
  finishProviderAttempt,
  inferProviderLedgerContext,
  providerUsageFromUnknown,
  recordProviderReplay,
  type ProviderAttemptHandle,
  type ProviderBillingStatus,
  type ProviderLedgerContext,
  type ProviderUsageSnapshot,
} from './provider-ledger';

let openAIClient: OpenAI | null = null;
const modelAvailability = new Map<string, Promise<boolean>>();

export function getVideoOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY_MISSING');
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey,
      maxRetries: 0,
      timeout: VIDEO_ANALYSIS_LIMITS.providerTimeoutMs,
    });
  }
  return openAIClient;
}

function isRetryable(error: unknown): boolean {
  return error instanceof RateLimitError
    || error instanceof APIConnectionError
    || (error instanceof APIError && [408, 409, 429, 500, 502, 503, 504].includes(error.status));
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProviderRetryOptions<T> {
  ledger?: ProviderLedgerContext | null;
  usage?: (value: T) => ProviderUsageSnapshot;
  maxRetries?: number;
  /** Injectable only to make retry accounting deterministic in unit tests. */
  sleep?: (milliseconds: number) => Promise<void>;
  /** Injectable ledger I/O used by the replay regression test. */
  ledgerDriver?: ProviderLedgerDriver;
  /** Full pessimistic reservation checked before every provider attempt/replay. */
  budgetReservation?: AnalysisBudgetReservation;
}

type FinishProviderAttemptInput = Parameters<typeof finishProviderAttempt>[0];
type RecordProviderReplayInput = Parameters<typeof recordProviderReplay>[0];

export interface ProviderLedgerDriver {
  begin: (context: ProviderLedgerContext, retryIndex: number) => Promise<ProviderAttemptHandle>;
  finish: (input: FinishProviderAttemptInput) => Promise<void>;
  recordReplay: (input: RecordProviderReplayInput) => Promise<void>;
}

export interface ModelProbeDependencies {
  retrieve: (model: string) => Promise<{ id: string }>;
  begin: (
    context: ProviderLedgerContext,
    retryIndex: number,
    claimReplay?: boolean,
  ) => Promise<ProviderAttemptHandle>;
  finish: (input: FinishProviderAttemptInput) => Promise<void>;
}

const DEFAULT_LEDGER_DRIVER: ProviderLedgerDriver = {
  begin: beginProviderAttempt,
  finish: finishProviderAttempt,
  recordReplay: recordProviderReplay,
};

export class ProviderRecordedFailureError extends Error {
  readonly retryable: boolean;
  readonly fallbackAllowed: boolean;

  constructor(code: string | null, retryable: boolean, fallbackAllowed: boolean) {
    super(`PROVIDER_RECORDED_FAILURE:${code ?? 'UNKNOWN'}`);
    this.name = 'ProviderRecordedFailureError';
    this.retryable = retryable;
    this.fallbackAllowed = fallbackAllowed;
  }
}

export function shouldFallbackToNextModel(error: unknown): boolean {
  return isModelFallbackError(error)
    || isRetryable(error)
    || (
      error instanceof ProviderRecordedFailureError
      && (error.fallbackAllowed || error.retryable)
    );
}

function assertProviderAttemptLease(handle: ProviderAttemptHandle | null): void {
  if (!handle || handle.existingStatus !== 'started' || handle.leaseAcquired) return;
  const expiresAtMs = handle.leaseExpiresAt ? Date.parse(handle.leaseExpiresAt) : Number.NaN;
  const remainingSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(1, Math.min(1_800, Math.ceil((expiresAtMs - Date.now()) / 1_000)))
    : 5;
  throw new RetryableError('PROVIDER_ATTEMPT_LEASE_ACTIVE', {
    retryAfter: `${remainingSeconds}s`,
  });
}

function assertProviderReplayLease(handle: ProviderAttemptHandle): void {
  if (handle.existingStatus !== 'succeeded' || handle.replayLeaseAcquired) return;
  const expiresAtMs = handle.replayLeaseExpiresAt
    ? Date.parse(handle.replayLeaseExpiresAt)
    : Number.NaN;
  const remainingSeconds = Number.isFinite(expiresAtMs)
    ? Math.max(1, Math.min(1_800, Math.ceil((expiresAtMs - Date.now()) / 1_000)))
    : 5;
  throw new RetryableError('PROVIDER_REPLAY_LEASE_ACTIVE', {
    retryAfter: `${remainingSeconds}s`,
  });
}

function providerErrorCode(error: unknown): string {
  if (error instanceof APIError) {
    return String(error.code || error.type || (error.status ? `HTTP_${error.status}` : error.name));
  }
  return error instanceof Error ? error.name : 'UNKNOWN_PROVIDER_ERROR';
}

function failureBillingStatus(error: unknown): ProviderBillingStatus {
  if (error instanceof APIError) {
    return [400, 401, 403, 404, 422, 429].includes(Number(error.status))
      ? 'non_billable'
      : 'unknown';
  }
  return 'unknown';
}

function isModelFallbackError(error: unknown): boolean {
  return error instanceof APIError && [400, 403, 404].includes(Number(error.status));
}

export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  options: ProviderRetryOptions<T> = {},
): Promise<{
  value: T;
  retries: number;
  providerDurationMs: number;
}> {
  let retries = 0;
  let providerDurationMs = 0;
  const maxRetries = options.maxRetries ?? VIDEO_ANALYSIS_LIMITS.maxRetriesPerProviderCall;
  const driver = options.ledgerDriver ?? DEFAULT_LEDGER_DRIVER;
  while (true) {
    if (options.ledger && options.budgetReservation && !options.ledgerDriver) {
      await assertRemoteAnalysisBudget({
        jobId: options.ledger.jobId,
        reservation: options.budgetReservation,
      });
    }
    const handle = options.ledger
      ? await driver.begin(options.ledger, retries)
      : null;

    assertProviderAttemptLease(handle);

    if (handle?.existingStatus === 'failed') {
      if (handle.existingRetryable === true && retries < maxRetries) {
        retries += 1;
        continue;
      }
      throw new ProviderRecordedFailureError(
        handle.existingErrorCode,
        handle.existingRetryable === true,
        handle.existingFallbackAllowed === true,
      );
    }

    if (handle?.existingStatus === 'succeeded') {
      let replayRetries = 0;
      let replayHandle = handle;
      while (true) {
        assertProviderReplayLease(replayHandle);
        if (options.ledger && options.budgetReservation && !options.ledgerDriver) {
          await assertRemoteAnalysisBudget({
            jobId: options.ledger.jobId,
            reservation: options.budgetReservation,
          });
        }
        const replayStartedAt = Date.now();
        let value: T;
        try {
          value = await operation();
        } catch (error) {
          const replayDurationMs = Date.now() - replayStartedAt;
          providerDurationMs += replayDurationMs;
          await driver.recordReplay({
            handle: replayHandle,
            succeeded: false,
            providerDurationMs: replayDurationMs,
          });
          if (!isRetryable(error) || replayRetries >= maxRetries) throw error;
          const backoff = Math.min(8_000, 750 * 2 ** replayRetries);
          replayRetries += 1;
          await (options.sleep ?? delay)(backoff);
          replayHandle = options.ledger
            ? await driver.begin(options.ledger, retries)
            : replayHandle;
          assertProviderAttemptLease(replayHandle);
          continue;
        }
        const replayDurationMs = Date.now() - replayStartedAt;
        providerDurationMs += replayDurationMs;
        await driver.recordReplay({
          handle: replayHandle,
          succeeded: true,
          providerDurationMs: replayDurationMs,
        });
        return { value, retries: retries + replayRetries, providerDurationMs };
      }
    }

    const providerStartedAt = Date.now();
    let value: T;
    try {
      value = await operation();
    } catch (error) {
      const attemptDurationMs = Date.now() - providerStartedAt;
      providerDurationMs += attemptDurationMs;
      if (handle) {
        await driver.finish({
          handle,
          status: 'failed',
          billingStatus: failureBillingStatus(error),
          providerDurationMs: attemptDurationMs,
          errorCode: providerErrorCode(error),
          retryable: isRetryable(error),
          fallbackAllowed: isModelFallbackError(error),
        });
      }
      if (!isRetryable(error) || retries >= maxRetries) throw error;
      const retryAfter = error instanceof APIError ? Number(error.headers?.get('retry-after')) : Number.NaN;
      const backoff = Number.isFinite(retryAfter)
        ? Math.min(10_000, Math.max(500, retryAfter * 1_000))
        : Math.min(8_000, 750 * 2 ** retries);
      retries += 1;
      await (options.sleep ?? delay)(backoff);
      continue;
    }

    const attemptDurationMs = Date.now() - providerStartedAt;
    providerDurationMs += attemptDurationMs;
    if (handle) {
      let usage: ProviderUsageSnapshot;
      try {
        usage = options.usage?.(value) ?? providerUsageFromUnknown(undefined);
      } catch {
        usage = providerUsageFromUnknown(undefined);
      }
      await driver.finish({
        handle,
        status: 'succeeded',
        billingStatus: handle.context.billable ? 'billable' : 'non_billable',
        usage,
        providerDurationMs: attemptDurationMs,
      });
    }
    return { value, retries, providerDurationMs };
  }
}

export async function probeModelAvailability(
  model: string,
  ledger: ProviderLedgerContext | null = null,
  dependencies: Partial<ModelProbeDependencies> = {},
): Promise<boolean> {
  const retrieve = dependencies.retrieve
    ?? ((candidate: string) => getVideoOpenAIClient().models.retrieve(candidate, { timeout: 10_000 }));
  const begin = dependencies.begin ?? beginProviderAttempt;
  const finish = dependencies.finish ?? finishProviderAttempt;
  const probeLedger = ledger
    ? {
        ...ledger,
        callKey: `${ledger.callKey}:model-probe:${model}`.slice(0, 240),
        operation: 'models.retrieve',
        model,
        billable: false,
      }
    : null;
  const handle = probeLedger ? await begin(probeLedger, 0, false) : null;
  assertProviderAttemptLease(handle);
  if (handle?.existingStatus === 'succeeded') return true;
  if (handle?.existingStatus === 'failed') {
    return handle.existingFallbackAllowed === true ? false : true;
  }
  const startedAt = Date.now();
  let response: { id: string };
  try {
    response = await retrieve(model);
  } catch (error) {
    if (RetryableError.is(error)) throw error;
    if (handle) {
      await finish({
        handle,
        status: 'failed',
        billingStatus: 'non_billable',
        providerDurationMs: Date.now() - startedAt,
        errorCode: providerErrorCode(error),
        retryable: isRetryable(error),
        fallbackAllowed: isModelFallbackError(error),
      });
    }
    if (error instanceof APIError && [400, 403, 404].includes(error.status)) return false;
    // A transient model-list failure must not prevent the actual request from
    // trying the configured model. The request itself still has fallbacks.
    return true;
  }

  const matches = response.id === model;
  if (handle) {
    await finish({
      handle,
      status: matches ? 'succeeded' : 'failed',
      billingStatus: 'non_billable',
      ...(matches
        ? {
            usage: {
              kind: 'none' as const,
              inputTokens: null,
              outputTokens: null,
              cachedInputTokens: null,
              audioSeconds: null,
            },
          }
        : {
            errorCode: 'MODEL_ID_MISMATCH',
            retryable: false,
            fallbackAllowed: true,
          }),
      providerDurationMs: Date.now() - startedAt,
    });
  }
  return matches;
}

/* c8 ignore start -- compatibility alias kept local to the availability cache. */
async function canRetrieveModel(
  model: string,
  ledger: ProviderLedgerContext | null = null,
): Promise<boolean> {
  return probeModelAvailability(model, ledger);
}
/* c8 ignore stop */

export async function resolveAvailableModel(
  candidates: readonly string[],
  ledger: ProviderLedgerContext | null = null,
): Promise<string> {
  for (const model of [...new Set(candidates.filter(Boolean))]) {
    let availability = modelAvailability.get(model);
    if (!availability) {
      availability = canRetrieveModel(model, ledger);
      modelAvailability.set(model, availability);
    }
    try {
      if (await availability) return model;
    } catch (error) {
      if (modelAvailability.get(model) === availability) modelAvailability.delete(model);
      throw error;
    }
  }
  throw new Error('OPENAI_MODEL_UNAVAILABLE');
}

export interface StructuredCallMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  durationMs: number;
  providerDurationMs: number;
}

export async function parseStructuredResponse<Schema extends z.ZodType>(input: {
  candidates: readonly string[];
  schema: Schema;
  schemaName: string;
  instructions: string;
  prompt: string;
  images?: Array<{ dataUrl: string; detail?: 'low' | 'high' | 'auto' }>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  idempotencyKey?: string;
}): Promise<{ value: z.infer<Schema>; metrics: StructuredCallMetrics }> {
  const client = getVideoOpenAIClient();
  const candidates = [...new Set(input.candidates.filter(Boolean))];
  let lastError: unknown;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    const ledger = inferProviderLedgerContext({
      idempotencyKey: input.idempotencyKey,
      operation: 'responses.parse',
      model: candidate,
      fallbackIndex: candidateIndex,
      billable: true,
    });
    let available: string | null = null;
    try {
      available = await resolveAvailableModel([candidate], ledger);
    } catch (error) {
      if (
        RetryableError.is(error)
        || (error instanceof Error && error.message.startsWith('PROVIDER_LEDGER_'))
      ) throw error;
    }
    if (!available) continue;

    const content: ResponseInputContent[] = [
      { type: 'input_text', text: input.prompt },
      ...(input.images ?? []).map((image): ResponseInputContent => ({
        type: 'input_image',
        image_url: image.dataUrl,
        detail: image.detail ?? 'high',
      })),
    ];
    const startedAt = Date.now();

    try {
      const request = await withProviderRetry(
        () => client.responses.parse(
          {
            model: available,
            instructions: input.instructions,
            input: [{ role: 'user', content }],
            text: { format: zodTextFormat(input.schema, input.schemaName) },
            max_output_tokens: input.maxOutputTokens ?? 8_000,
            store: false,
          },
          {
            ...(input.idempotencyKey
              ? { idempotencyKey: `${input.idempotencyKey}:${available}`.slice(0, 240) }
              : {}),
            ...(input.timeoutMs ? { timeout: input.timeoutMs } : {}),
          },
        ),
        {
          ledger: ledger ? { ...ledger, model: available } : null,
          usage: (response) => providerUsageFromUnknown(response.usage),
          maxRetries: input.maxRetries,
          budgetReservation: ledger ? {
            promptCharacters: input.prompt.length + input.instructions.length,
            imageCount: input.images?.length ?? 0,
            maxOutputTokens: input.maxOutputTokens ?? 8_000,
            stage: ledger.stage,
            model: available,
          } : undefined,
        },
      );
      const parsed = request.value.output_parsed;
      if (parsed === null) throw new Error('OPENAI_STRUCTURED_OUTPUT_EMPTY');
      return {
        value: input.schema.parse(parsed),
        metrics: {
          model: available,
          inputTokens: request.value.usage?.input_tokens ?? 0,
          outputTokens: request.value.usage?.output_tokens ?? 0,
          retries: request.retries,
          durationMs: Date.now() - startedAt,
          providerDurationMs: request.providerDurationMs,
        },
      };
    } catch (error) {
      lastError = error;
      if (!shouldFallbackToNextModel(error)) throw error;
      modelAvailability.set(candidate, Promise.resolve(false));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OPENAI_MODEL_UNAVAILABLE');
}

/** Returns null rather than publishing a stale or invented provider price. */
export function estimateConfiguredModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  return estimateProviderUsageCost(model, {
    kind: 'tokens',
    inputTokens: Math.max(0, Math.round(inputTokens)),
    outputTokens: Math.max(0, Math.round(outputTokens)),
    cachedInputTokens: null,
    audioSeconds: null,
  }).estimatedCostUsd;
}
