import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APIConnectionError, APIConnectionTimeoutError, RateLimitError } from 'openai';
import { RetryableError } from 'workflow';

vi.mock('server-only', () => ({}));

import {
  deterministicProviderAttemptId,
  estimateProviderUsageCost,
  inferProviderLedgerContext,
  providerUsageFromUnknown,
  readConfiguredPricingCatalog,
  summarizeProviderCallRows,
  type ProviderLedgerContext,
  type ProviderLedgerRow,
} from '@/lib/video-analysis/provider-ledger';
import {
  probeModelAvailability,
  ProviderRecordedFailureError,
  shouldFallbackToNextModel,
  withProviderRetry,
  type ModelProbeDependencies,
  type ProviderLedgerDriver,
} from '@/lib/video-analysis/openai-client';
import { getVideoAnalysisModelConfig } from '@/lib/video-analysis/config';

function ledgerRow(overrides: Partial<ProviderLedgerRow> = {}): ProviderLedgerRow {
  return {
    attempt_id: crypto.randomUUID(),
    job_id: '11111111-1111-4111-8111-111111111111',
    call_key: '11111111-1111-4111-8111-111111111111:visual-batch-01',
    stage: 'visual_analysis',
    operation: 'responses.parse',
    provider: 'openai',
    model: 'model-token',
    status: 'succeeded',
    billing_status: 'billable',
    usage_kind: 'tokens',
    fallback_index: 0,
    retry_index: 0,
    input_tokens: 1_000,
    output_tokens: 500,
    cached_input_tokens: 0,
    audio_seconds: null,
    price_catalog_version: 'catalog-2026-07-13',
    estimated_cost_usd: 0.003,
    error_code: null,
    retryable: null,
    fallback_allowed: null,
    started_at: '2026-07-13T10:00:03.000Z',
    ended_at: '2026-07-13T10:00:03.100Z',
    wall_ms: 100,
    provider_duration_ms: 80,
    replay_count: 0,
    replay_failed_count: 0,
    replay_provider_duration_ms: 0,
    ...overrides,
  };
}

describe('catalogue de prix fournisseur versionne', () => {
  afterEach(() => {
    delete process.env.OPENAI_MODEL_PRICING_JSON;
    delete process.env.OPENAI_MODEL_PRICING_VERSION;
  });

  it('calcule separement les tokens caches et les secondes audio', () => {
    process.env.OPENAI_MODEL_PRICING_JSON = JSON.stringify({
      version: 'catalog-2026-07-13',
      models: {
        'model-token': {
          billingUnit: 'tokens',
          inputUsdPerMillion: 2,
          cachedInputUsdPerMillion: 0.5,
          outputUsdPerMillion: 4,
        },
        'model-audio': {
          billingUnit: 'audio_seconds',
          audioUsdPerMinute: 0.006,
        },
      },
    });
    const catalog = readConfiguredPricingCatalog();

    expect(estimateProviderUsageCost('model-token', {
      kind: 'tokens',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cachedInputTokens: 200_000,
      audioSeconds: null,
    }, catalog)).toMatchObject({
      priceCatalogVersion: 'catalog-2026-07-13',
      estimatedCostUsd: 3.7,
      missingPricing: false,
    });
    expect(estimateProviderUsageCost('model-audio', {
      kind: 'audio_seconds',
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      audioSeconds: 120,
    }, catalog).estimatedCostUsd).toBe(0.012);
  });

  it('retourne null sans version, modele ou tarif de cache requis', () => {
    process.env.OPENAI_MODEL_PRICING_JSON = JSON.stringify({
      'model-token': { inputUsdPerMillion: 2, outputUsdPerMillion: 4 },
    });
    const usage = {
      kind: 'tokens' as const,
      inputTokens: 100,
      outputTokens: 50,
      cachedInputTokens: 10,
      audioSeconds: null,
    };
    expect(estimateProviderUsageCost('model-token', usage).estimatedCostUsd).toBeNull();

    process.env.OPENAI_MODEL_PRICING_VERSION = 'catalog-v1';
    expect(estimateProviderUsageCost('model-token', usage).estimatedCostUsd).toBeNull();
    expect(estimateProviderUsageCost('modele-absent', usage).estimatedCostUsd).toBeNull();
  });

  it('normalise une usage token ou duree sans inventer la valeur absente', () => {
    expect(providerUsageFromUnknown({
      type: 'tokens',
      input_tokens: 120,
      output_tokens: 40,
      input_tokens_details: { cached_tokens: 20 },
    }, 12)).toEqual({
      kind: 'tokens',
      inputTokens: 120,
      outputTokens: 40,
      cachedInputTokens: 20,
      audioSeconds: 12,
    });
    expect(providerUsageFromUnknown({ type: 'duration', seconds: 8.25 })).toEqual({
      kind: 'audio_seconds',
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      audioSeconds: 8.25,
    });
    expect(providerUsageFromUnknown(undefined)).toMatchObject({ kind: 'unknown', audioSeconds: null });
  });
});

describe('rollup complet du ledger', () => {
  const timing = {
    createdAt: '2026-07-13T10:00:00.000Z',
    queuedAt: '2026-07-13T10:00:01.000Z',
    startedAt: '2026-07-13T10:00:03.000Z',
    terminalAt: '2026-07-13T10:00:08.000Z',
    stageWallDurationsMs: { visualAnalysis: 900 },
  };

  it('separe wall time, temps fournisseur, retries, fallbacks et probes', () => {
    const rows = [
      ledgerRow(),
      ledgerRow({
        attempt_id: crypto.randomUUID(),
        retry_index: 1,
        status: 'failed',
        billing_status: 'non_billable',
        usage_kind: 'none',
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: 0,
        error_code: 'HTTP_429',
        provider_duration_ms: 20,
      }),
      ledgerRow({
        attempt_id: crypto.randomUUID(),
        call_key: '11111111-1111-4111-8111-111111111111:model-probe:model-token',
        operation: 'models.retrieve',
        billing_status: 'non_billable',
        usage_kind: 'none',
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: 0,
        provider_duration_ms: 10,
      }),
      ledgerRow({
        attempt_id: crypto.randomUUID(),
        fallback_index: 1,
        estimated_cost_usd: 0.001,
        provider_duration_ms: 30,
      }),
    ];
    const result = summarizeProviderCallRows(rows, timing);

    expect(result).toMatchObject({
      scope: 'all_billable_provider_calls',
      providerCalls: 3,
      providerProbeCalls: 1,
      succeededCalls: 2,
      failedCalls: 1,
      retries: 1,
      fallbacks: 1,
      providerDurationMs: 140,
      billableProviderDurationMs: 110,
      stageWallDurationsMs: { visualAnalysis: 900 },
      queueMs: 2_000,
      elapsedPipelineMs: 5_000,
      endToEndMs: 8_000,
      estimatedCostUsd: 0.004,
      missingPricingModels: [],
    });
  });

  it('force le total a null et nomme chaque modele incomplet ou indetermine', () => {
    const result = summarizeProviderCallRows([
      ledgerRow(),
      ledgerRow({
        attempt_id: crypto.randomUUID(),
        model: 'model-sans-prix',
        estimated_cost_usd: null,
        price_catalog_version: 'catalog-2026-07-13',
      }),
      ledgerRow({
        attempt_id: crypto.randomUUID(),
        model: 'model-timeout',
        status: 'failed',
        billing_status: 'unknown',
        usage_kind: 'unknown',
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: 'APICONNECTIONERROR',
      }),
    ], timing);

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.missingPricingModels).toEqual(['model-sans-prix']);
    expect(result.indeterminateBillingModels).toEqual(['model-timeout']);
  });
});

describe('fallback fournisseur apres epuisement des retries', () => {
  afterEach(() => {
    delete process.env.OPENAI_SPECIALIST_MODELS;
  });

  it('priorise le modele leger pour les appels specialistes longs', () => {
    expect(getVideoAnalysisModelConfig().specialistCandidates).toEqual(['gpt-4o-mini', 'gpt-4o']);
  });

  it('respecte une liste specialiste explicitement configuree', () => {
    process.env.OPENAI_SPECIALIST_MODELS = 'model-specialiste-a,model-specialiste-b';

    expect(getVideoAnalysisModelConfig().specialistCandidates).toEqual([
      'model-specialiste-a',
      'model-specialiste-b',
    ]);
  });

  it('essaie le modele suivant apres une erreur transitoire du modele courant', () => {
    expect(shouldFallbackToNextModel(new APIConnectionError({ message: 'transient' }))).toBe(true);
    expect(shouldFallbackToNextModel(new APIConnectionTimeoutError({ message: 'timeout' }))).toBe(true);
    expect(shouldFallbackToNextModel(new RateLimitError(
      429,
      { error: { code: 'rate_limit_exceeded' } },
      'rate limited',
      new Headers(),
    ))).toBe(true);
  });

  it('conserve le caractere rejouable d un echec deja inscrit dans le ledger', () => {
    const error = new ProviderRecordedFailureError('RATE_LIMIT_EXCEEDED', true, false);

    expect(error.retryable).toBe(true);
    expect(error.fallbackAllowed).toBe(false);
    expect(shouldFallbackToNextModel(error)).toBe(true);
  });

  it('ne masque pas une erreur fatale sans fallback autorise', () => {
    expect(shouldFallbackToNextModel(new Error('INVALID_PROVIDER_RESPONSE'))).toBe(false);
    expect(shouldFallbackToNextModel(
      new ProviderRecordedFailureError('INVALID_PROVIDER_RESPONSE', false, false),
    )).toBe(false);
  });
});

describe('replay apres retry partiellement termine', () => {
  it('conserve retry0 en echec et retry1 seul succes facturable au replay', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111';
    const context = inferProviderLedgerContext({
      idempotencyKey: `${jobId}:visual-batch-replay`,
      operation: 'responses.parse',
      model: 'model-token',
      fallbackIndex: 0,
      billable: true,
    });
    if (!context) throw new Error('Contexte ledger invalide');

    type Entry = {
      status: 'started' | 'failed' | 'succeeded';
      retryable: boolean | null;
      fallbackAllowed: boolean | null;
      errorCode: string | null;
      replays: number;
    };
    const entries = new Map<number, Entry>();
    const finishCalls: Array<{ retry: number; status: string }> = [];
    const driver: ProviderLedgerDriver = {
      begin: async (ledgerContext, retryIndex) => {
        const entry = entries.get(retryIndex) ?? {
          status: 'started' as const,
          retryable: null,
          fallbackAllowed: null,
          errorCode: null,
          replays: 0,
        };
        entries.set(retryIndex, entry);
        return {
          attemptId: deterministicProviderAttemptId(ledgerContext, retryIndex),
          leaseOwner: crypto.randomUUID(),
          leaseExpiresAt: '2026-07-13T10:02:00.000Z',
          leaseAcquired: true,
          reclaimedExpiredLease: false,
          replayLeaseExpiresAt: entry.status === 'succeeded'
            ? '2026-07-13T10:02:00.000Z'
            : null,
          replayLeaseAcquired: entry.status === 'succeeded',
          reclaimedExpiredReplayLease: false,
          context: ledgerContext,
          retryIndex,
          startedAt: '2026-07-13T10:00:00.000Z',
          startedAtMs: Date.parse('2026-07-13T10:00:00.000Z'),
          existingStatus: entry.status,
          existingRetryable: entry.retryable,
          existingFallbackAllowed: entry.fallbackAllowed,
          existingErrorCode: entry.errorCode,
        };
      },
      finish: async (input) => {
        const entry = entries.get(input.handle.retryIndex);
        if (!entry || entry.status !== 'started') throw new Error('Transition terminale invalide');
        entry.status = input.status;
        entry.retryable = input.retryable ?? null;
        entry.fallbackAllowed = input.fallbackAllowed ?? null;
        entry.errorCode = input.errorCode ?? null;
        finishCalls.push({ retry: input.handle.retryIndex, status: input.status });
      },
      recordReplay: async ({ handle }) => {
        const entry = entries.get(handle.retryIndex);
        if (!entry || entry.status !== 'succeeded') throw new Error('Replay sans succes existant');
        entry.replays += 1;
      },
    };

    let firstCall = true;
    const firstOperation = vi.fn(async () => {
      if (firstCall) {
        firstCall = false;
        throw new APIConnectionError({ message: 'transient' });
      }
      return { ok: true };
    });
    const first = await withProviderRetry(firstOperation, {
      ledger: context,
      ledgerDriver: driver,
      sleep: async () => undefined,
    });
    expect(first.retries).toBe(1);
    expect(entries.get(0)?.status).toBe('failed');
    expect(entries.get(1)?.status).toBe('succeeded');

    const replayOperation = vi.fn(async () => ({ ok: true }));
    const replay = await withProviderRetry(replayOperation, {
      ledger: context,
      ledgerDriver: driver,
      sleep: async () => undefined,
    });

    expect(replay.retries).toBe(1);
    expect(replayOperation).toHaveBeenCalledTimes(1);
    expect(finishCalls).toEqual([
      { retry: 0, status: 'failed' },
      { retry: 1, status: 'succeeded' },
    ]);
    expect(entries.get(0)).toMatchObject({ status: 'failed', replays: 0 });
    expect(entries.get(1)).toMatchObject({ status: 'succeeded', replays: 1 });

    const rollup = summarizeProviderCallRows([
      ledgerRow({
        retry_index: 0,
        status: 'failed',
        billing_status: 'unknown',
        usage_kind: 'unknown',
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        error_code: 'APICONNECTIONERROR',
        retryable: true,
        fallback_allowed: false,
      }),
      ledgerRow({
        attempt_id: crypto.randomUUID(),
        retry_index: 1,
        replay_count: 1,
        replay_provider_duration_ms: 12,
      }),
    ]);
    expect(rollup.succeededCalls).toBe(1);
    expect(rollup.billableSucceededCalls).toBe(1);
    expect(rollup.failedCalls).toBe(1);
    expect(rollup.providerReplayCalls).toBe(1);
    expect(rollup.estimatedCostUsd).toBeNull();
    expect(rollup.indeterminateBillingModels).toContain('model-token');
  });

  it('autorise un seul appel actif pour deux workers sur la meme tentative', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111';
    const context = inferProviderLedgerContext({
      idempotencyKey: `${jobId}:visual-batch-concurrent`,
      operation: 'responses.parse',
      model: 'model-token',
      fallbackIndex: 0,
      billable: true,
    });
    if (!context) throw new Error('Contexte ledger invalide');

    let leased = false;
    let releaseOperation: () => void = () => undefined;
    const operationGate = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });
    let signalStarted: (() => void) | null = null;
    const operationStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const operation = vi.fn(async () => {
      signalStarted?.();
      await operationGate;
      return { ok: true };
    });
    const driver: ProviderLedgerDriver = {
      begin: async (ledgerContext, retryIndex) => ({
        attemptId: deterministicProviderAttemptId(ledgerContext, retryIndex),
        leaseOwner: crypto.randomUUID(),
        leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        leaseAcquired: !leased,
        reclaimedExpiredLease: false,
        replayLeaseExpiresAt: null,
        replayLeaseAcquired: false,
        reclaimedExpiredReplayLease: false,
        context: ledgerContext,
        retryIndex,
        startedAt: new Date().toISOString(),
        startedAtMs: Date.now(),
        existingStatus: 'started',
        existingRetryable: null,
        existingFallbackAllowed: null,
        existingErrorCode: null,
      }),
      finish: async () => undefined,
      recordReplay: async () => undefined,
    };

    const first = withProviderRetry(operation, { ledger: context, ledgerDriver: driver });
    leased = true;
    await operationStarted;
    const second = withProviderRetry(operation, { ledger: context, ledgerDriver: driver });

    await expect(second).rejects.toThrow('PROVIDER_ATTEMPT_LEASE_ACTIVE');
    expect(operation).toHaveBeenCalledTimes(1);
    releaseOperation();
    await expect(first).resolves.toMatchObject({ value: { ok: true } });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('autorise un seul replay actif cross-worker pour une tentative deja reussie', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111';
    const context = inferProviderLedgerContext({
      idempotencyKey: `${jobId}:visual-batch-replay-concurrent`,
      operation: 'responses.parse',
      model: 'model-token',
      fallbackIndex: 0,
      billable: true,
    });
    if (!context) throw new Error('Contexte ledger invalide');

    let replayLeased = false;
    let releaseOperation: () => void = () => undefined;
    const operationGate = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });
    let signalStarted: (() => void) | null = null;
    const operationStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const operation = vi.fn(async () => {
      signalStarted?.();
      await operationGate;
      return { replayed: true };
    });
    const driver: ProviderLedgerDriver = {
      begin: async (ledgerContext, retryIndex) => ({
        attemptId: deterministicProviderAttemptId(ledgerContext, retryIndex),
        leaseOwner: crypto.randomUUID(),
        leaseExpiresAt: null,
        leaseAcquired: false,
        reclaimedExpiredLease: false,
        replayLeaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        replayLeaseAcquired: !replayLeased,
        reclaimedExpiredReplayLease: false,
        context: ledgerContext,
        retryIndex,
        startedAt: new Date().toISOString(),
        startedAtMs: Date.now(),
        existingStatus: 'succeeded',
        existingRetryable: null,
        existingFallbackAllowed: null,
        existingErrorCode: null,
      }),
      finish: async () => undefined,
      recordReplay: async () => undefined,
    };

    const first = withProviderRetry(operation, { ledger: context, ledgerDriver: driver });
    replayLeased = true;
    await operationStarted;
    const secondError = await withProviderRetry(operation, {
      ledger: context,
      ledgerDriver: driver,
    }).then(() => null, (error: unknown) => error);

    expect(RetryableError.is(secondError)).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);
    releaseOperation();
    await expect(first).resolves.toMatchObject({ value: { replayed: true } });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('propage une perte de lease a la finalisation comme erreur rejouable', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111';
    const context = inferProviderLedgerContext({
      idempotencyKey: `${jobId}:visual-batch-finish-lease-loss`,
      operation: 'responses.parse',
      model: 'model-token',
      billable: true,
    });
    if (!context) throw new Error('Contexte ledger invalide');
    const driver: ProviderLedgerDriver = {
      begin: async (ledgerContext, retryIndex) => ({
        attemptId: deterministicProviderAttemptId(ledgerContext, retryIndex),
        leaseOwner: crypto.randomUUID(),
        leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        leaseAcquired: true,
        reclaimedExpiredLease: false,
        replayLeaseExpiresAt: null,
        replayLeaseAcquired: false,
        reclaimedExpiredReplayLease: false,
        context: ledgerContext,
        retryIndex,
        startedAt: new Date().toISOString(),
        startedAtMs: Date.now(),
        existingStatus: 'started',
        existingRetryable: null,
        existingFallbackAllowed: null,
        existingErrorCode: null,
      }),
      finish: async () => {
        throw new RetryableError('PROVIDER_ATTEMPT_LEASE_LOST', { retryAfter: '1s' });
      },
      recordReplay: async () => undefined,
    };

    const error = await withProviderRetry(async () => ({ ok: true }), {
      ledger: context,
      ledgerDriver: driver,
    }).then(() => null, (reason: unknown) => reason);
    expect(RetryableError.is(error)).toBe(true);
  });

  it('ne transforme pas une finalisation rejouable du probe modele en second echec', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111';
    const context = inferProviderLedgerContext({
      idempotencyKey: `${jobId}:model-probe-finalization`,
      operation: 'responses.parse',
      model: 'model-token',
      billable: true,
    });
    if (!context) throw new Error('Contexte ledger invalide');
    const finish = vi.fn(async (_input: Parameters<ModelProbeDependencies['finish']>[0]) => {
      throw new RetryableError('PROVIDER_ATTEMPT_LEASE_LOST', { retryAfter: '1s' });
    });
    const begin = vi.fn(async (ledgerContext: ProviderLedgerContext, retryIndex: number) => ({
      attemptId: deterministicProviderAttemptId(ledgerContext, retryIndex),
      leaseOwner: crypto.randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      leaseAcquired: true,
      reclaimedExpiredLease: false,
      replayLeaseExpiresAt: null,
      replayLeaseAcquired: false,
      reclaimedExpiredReplayLease: false,
      context: ledgerContext,
      retryIndex,
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      existingStatus: 'started' as const,
      existingRetryable: null,
      existingFallbackAllowed: null,
      existingErrorCode: null,
    }));

    const error = await probeModelAvailability('model-token', context, {
      retrieve: async () => ({ id: 'model-token' }),
      begin,
      finish,
    }).then(() => null, (reason: unknown) => reason);

    expect(RetryableError.is(error)).toBe(true);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]?.[0]).toMatchObject({ status: 'succeeded' });
  });
});

describe('persistance durable sans contenu utilisateur', () => {
  it('verrouille une tentative logique, active RLS et reserve la table au service role', () => {
    const migration = readFileSync(join(
      process.cwd(),
      'supabase/migrations/20260713204033_analysis_provider_call_ledger.sql',
    ), 'utf8');
    const tableBody = migration.match(/create table public\.analysis_provider_calls \(([\s\S]*?)\n\);/u)?.[1] ?? '';
    const ledgerSource = readFileSync(join(process.cwd(), 'lib/video-analysis/provider-ledger.ts'), 'utf8');

    expect(migration).toContain('unique (job_id, call_key, fallback_index, retry_index)');
    expect(migration).toContain('alter table public.analysis_provider_calls enable row level security');
    expect(migration).toContain('revoke all on table public.analysis_provider_calls from public, anon, authenticated');
    expect(migration).not.toContain('grant select on table public.analysis_provider_calls to authenticated');
    expect(migration).toContain('record_analysis_provider_replay');
    expect(migration).toContain('claim_analysis_provider_attempt');
    expect(migration).toContain('for update');
    expect(migration).toContain('lease_expires_at <= pg_catalog.now()');
    expect(migration).toContain('replay_count = provider_call.replay_count + case when v_reclaimed then 1 else 0 end');
    expect(migration).toContain('replay_lease_expires_at <= pg_catalog.now()');
    expect(migration).toContain('and replay_lease_owner = p_lease_owner');
    expect(migration).toContain("and status = 'succeeded'");
    expect(ledgerSource).toContain(".eq('status', 'started')");
    expect(ledgerSource).toContain(".eq('lease_owner', input.handle.leaseOwner)");
    expect(ledgerSource).toContain("new RetryableError('PROVIDER_ATTEMPT_LEASE_LOST'");
    expect(ledgerSource).not.toContain(".neq('status', 'succeeded')");
    expect(tableBody).not.toMatch(/\b(?:prompt|response|transcript|signed_url|api_key|secret)\b/iu);
  });

  it('produit une identite stable par modele, fallback et retry', () => {
    const first = inferProviderLedgerContext({
      idempotencyKey: '11111111-1111-4111-8111-111111111111:visual-batch-01',
      operation: 'responses.parse',
      model: 'model-a',
      fallbackIndex: 0,
      billable: true,
    });
    const otherModel = inferProviderLedgerContext({
      idempotencyKey: '11111111-1111-4111-8111-111111111111:visual-batch-01',
      operation: 'responses.parse',
      model: 'model-b',
      fallbackIndex: 1,
      billable: true,
    });
    if (!first || !otherModel) throw new Error('Contexte ledger invalide');

    expect(deterministicProviderAttemptId(first, 0)).toBe(deterministicProviderAttemptId(first, 0));
    expect(deterministicProviderAttemptId(first, 0)).not.toBe(deterministicProviderAttemptId(first, 1));
    expect(deterministicProviderAttemptId(first, 0)).not.toBe(deterministicProviderAttemptId(otherModel, 0));
  });

  it('instrumente les appels directs, les alignements et les chemins succes/echec avant rethrow', () => {
    const openaiClient = readFileSync(join(process.cwd(), 'lib/video-analysis/openai-client.ts'), 'utf8');
    const transcription = readFileSync(join(process.cwd(), 'lib/video-analysis/transcription.ts'), 'utf8');
    const workflow = readFileSync(join(process.cwd(), 'lib/video-analysis/workflow-steps.ts'), 'utf8');

    expect(openaiClient).toContain("status: 'failed'");
    expect(openaiClient).toContain("status: 'succeeded'");
    expect(openaiClient).toContain('RetryableError.is(error)');
    const terminalRetryDecision = openaiClient.indexOf(
      'if (!isRetryable(error) || retries >= maxRetries)',
    );
    expect(openaiClient.lastIndexOf('await driver.finish({', terminalRetryDecision))
      .toBeGreaterThan(openaiClient.indexOf('export async function withProviderRetry'));
    expect(transcription.match(/operation: 'audio\.transcriptions\.create'/gu)?.length).toBeGreaterThanOrEqual(2);
    expect(transcription).toContain("const alignmentCandidates = [...new Set([config.transcriptionAlignment, 'whisper-1'])]");
    expect(transcription).toContain('fallbackIndex: candidateIndex');
    expect(transcription).toContain('audioDurationSeconds');
    expect(workflow).toContain('buildProviderCostRollup(job, preliminaryCostMetrics)');
    expect(workflow).toContain('persistProviderCostRollup(failedJob, failedCostMetrics)');
  });
});
