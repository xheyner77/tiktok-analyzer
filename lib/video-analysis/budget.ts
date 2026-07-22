import 'server-only';

import {
  ANALYSIS_PROFILES,
  getAnalysisProfileFromMetadata,
  type AnalysisBudgetStage,
  type AnalysisProfile,
} from './analysis-profiles';
import {
  estimateProviderUsageCost,
  readConfiguredPricingCatalog,
  type ProviderUsageSnapshot,
} from './provider-ledger';

const PROMPT_CHARACTERS_PER_TOKEN = 2;
const ESTIMATED_TOKENS_PER_IMAGE = 1_500;

export interface AnalysisBudgetUsage {
  billableCalls: number;
  inputTokens: number;
  outputTokens: number;
  reservedCostUsd?: number;
  stageCalls?: Partial<Record<AnalysisBudgetStage, number>>;
}

export interface AnalysisBudgetReservation {
  promptCharacters: number;
  imageCount: number;
  maxOutputTokens: number;
  stage: string;
  model?: string;
  audioSeconds?: number;
}

export class AnalysisBudgetExceededError extends Error {
  readonly dimension: 'calls' | 'input' | 'output' | 'stage_calls' | 'stage_input' | 'stage_output' | 'audio' | 'cost' | 'period_cost' | 'unknown_pricing';

  constructor(dimension: AnalysisBudgetExceededError['dimension']) {
    super(dimension === 'unknown_pricing'
      ? 'ANALYSIS_MODEL_PRICE_UNKNOWN'
      : dimension === 'period_cost'
        ? 'ANALYSIS_PERIOD_BUDGET_EXCEEDED'
        : dimension === 'cost'
        ? 'ANALYSIS_FINANCIAL_BUDGET_EXCEEDED'
        : `ANALYSIS_TOKEN_BUDGET_EXCEEDED:${dimension}`);
    this.name = 'AnalysisBudgetExceededError';
    this.dimension = dimension;
  }
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function isBudgetStage(value: string): value is AnalysisBudgetStage {
  return value in ANALYSIS_PROFILES.free.stages;
}

export function estimatedInputTokens(reservation: AnalysisBudgetReservation): number {
  return Math.ceil(Math.max(0, reservation.promptCharacters) / PROMPT_CHARACTERS_PER_TOKEN)
    + Math.max(0, reservation.imageCount) * ESTIMATED_TOKENS_PER_IMAGE;
}

export function worstCaseReservationCostUsd(
  reservation: AnalysisBudgetReservation,
  profile: AnalysisProfile,
): number {
  if (!isBudgetStage(reservation.stage)) throw new AnalysisBudgetExceededError('stage_calls');
  const stage = profile.stages[reservation.stage];
  const model = reservation.model?.trim() || stage.models[0];
  const usage: ProviderUsageSnapshot = reservation.audioSeconds
    ? {
        kind: 'audio_seconds', inputTokens: null, outputTokens: null,
        cachedInputTokens: null, audioSeconds: reservation.audioSeconds,
      }
    : {
        kind: 'tokens', inputTokens: estimatedInputTokens(reservation),
        outputTokens: Math.max(0, reservation.maxOutputTokens), cachedInputTokens: 0,
        audioSeconds: null,
      };
  const calculated = estimateProviderUsageCost(model, usage, readConfiguredPricingCatalog());
  if (calculated.missingPricing || calculated.estimatedCostUsd === null) {
    throw new AnalysisBudgetExceededError('unknown_pricing');
  }
  return calculated.estimatedCostUsd;
}

export function assertAnalysisBudget(
  usage: AnalysisBudgetUsage,
  reservation: AnalysisBudgetReservation,
  profile: AnalysisProfile = ANALYSIS_PROFILES.free,
): void {
  if (!isBudgetStage(reservation.stage)) throw new AnalysisBudgetExceededError('stage_calls');
  const stage = profile.stages[reservation.stage];
  const estimate = estimatedInputTokens(reservation);
  if ((usage.stageCalls?.[reservation.stage] ?? 0) + 1 > stage.maxCalls) {
    throw new AnalysisBudgetExceededError('stage_calls');
  }
  if (usage.billableCalls + 1 > profile.maxBillableCalls) throw new AnalysisBudgetExceededError('calls');
  if (estimate > stage.maxInputTokensPerCall) throw new AnalysisBudgetExceededError('stage_input');
  if (reservation.maxOutputTokens > stage.maxOutputTokensPerCall) throw new AnalysisBudgetExceededError('stage_output');
  if ((reservation.audioSeconds ?? 0) > stage.maxAudioSecondsPerCall) throw new AnalysisBudgetExceededError('audio');
  if (usage.inputTokens + estimate > profile.maxInputTokens) throw new AnalysisBudgetExceededError('input');
  if (usage.outputTokens + reservation.maxOutputTokens > profile.maxOutputTokens) throw new AnalysisBudgetExceededError('output');
  const callCost = worstCaseReservationCostUsd(reservation, profile);
  if ((usage.reservedCostUsd ?? 0) + callCost > profile.maxCostUsd + Number.EPSILON) {
    throw new AnalysisBudgetExceededError('cost');
  }
}

export function profileWorstCaseCostUsd(profile: AnalysisProfile): number {
  return Number(Object.entries(profile.stages).reduce((total, [stageName, stage]) => {
    if (!stage.maxCalls) return total;
    const reservation: AnalysisBudgetReservation = {
      stage: stageName,
      model: stage.models[0],
      promptCharacters: stage.maxInputTokensPerCall * PROMPT_CHARACTERS_PER_TOKEN,
      imageCount: 0,
      maxOutputTokens: stage.maxOutputTokensPerCall,
      audioSeconds: stage.maxAudioSecondsPerCall || undefined,
    };
    return total + worstCaseReservationCostUsd(reservation, profile) * stage.maxCalls;
  }, 0).toFixed(8));
}

/** Planning estimate only: 50% of reserved input, 35% of output, 10% repair rate. */
export function profileNormalEstimatedCostUsd(
  profile: AnalysisProfile,
  options: { includeConditionalCritique?: boolean } = {},
): number {
  return Number(Object.entries(profile.stages).reduce((total, [stageName, stage]) => {
    if (!stage.maxCalls) return total;
    if (stageName === 'synthesis_critique' && options.includeConditionalCritique === false) {
      return total;
    }
    const repairProbability = stageName === 'synthesis_repair' ? 0.1 : 1;
    const reservation: AnalysisBudgetReservation = {
      stage: stageName,
      model: stage.models[0],
      promptCharacters: Math.floor(stage.maxInputTokensPerCall * PROMPT_CHARACTERS_PER_TOKEN * 0.5),
      imageCount: 0,
      maxOutputTokens: Math.floor(stage.maxOutputTokensPerCall * 0.35),
      audioSeconds: stage.maxAudioSecondsPerCall || undefined,
    };
    return total + worstCaseReservationCostUsd(reservation, profile)
      * stage.maxCalls * repairProbability;
  }, 0).toFixed(8));
}

export async function assertRemoteAnalysisBudget(input: {
  jobId: string;
  reservation: AnalysisBudgetReservation;
}): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const [jobResult, callsResult] = await Promise.all([
    supabase.from('analysis_jobs').select('user_id,source_metadata,cost_metrics').eq('id', input.jobId).single(),
    supabase.from('analysis_provider_calls')
      .select('operation,stage,model,status,billing_status,input_tokens,output_tokens,replay_count')
      .eq('job_id', input.jobId),
  ]);
  if (jobResult.error || !jobResult.data || callsResult.error) throw new Error('ANALYSIS_BUDGET_READ_FAILED');
  const profile = getAnalysisProfileFromMetadata(
    (jobResult.data.source_metadata ?? {}) as Record<string, unknown>,
  );
  const rows = callsResult.data ?? [];
  const billableRows = rows.filter((row) => row.operation !== 'models.retrieve');
  const succeeded = billableRows.filter((row) => row.status === 'succeeded' && row.billing_status === 'billable');
  const stageCalls: Partial<Record<AnalysisBudgetStage, number>> = {};
  let reservedCostUsd = 0;
  for (const row of billableRows) {
    if (!isBudgetStage(row.stage)) continue;
    const multiplier = 1 + nonNegativeInteger(row.replay_count);
    stageCalls[row.stage] = (stageCalls[row.stage] ?? 0) + multiplier;
    const stage = profile.stages[row.stage];
    reservedCostUsd += worstCaseReservationCostUsd({
      stage: row.stage,
      model: row.model,
      promptCharacters: stage.maxInputTokensPerCall * PROMPT_CHARACTERS_PER_TOKEN,
      imageCount: 0,
      maxOutputTokens: stage.maxOutputTokensPerCall,
      audioSeconds: stage.maxAudioSecondsPerCall || undefined,
    }, profile) * multiplier;
  }
  try {
    const userResult = await supabase
      .from('users')
      .select('plan,last_reset_at,created_at')
      .eq('id', jobResult.data.user_id)
      .single();
    if (userResult.error || !userResult.data) throw new Error('ANALYSIS_COMMERCIAL_BUDGET_READ_FAILED');
    const {
      canReserveCommercialCost,
      commercialBudgetPeriodStart,
      readCommercialBudgetState,
    } = await import('./commercial-budget');
    const commercial = await readCommercialBudgetState({
      userId: jobResult.data.user_id,
      plan: userResult.data.plan,
      periodStart: commercialBudgetPeriodStart({
        plan: userResult.data.plan,
        createdAt: userResult.data.created_at,
        lastResetAt: userResult.data.last_reset_at,
      }),
      currentJobId: input.jobId,
    });
    const nextCost = worstCaseReservationCostUsd(input.reservation, profile);
    if (!canReserveCommercialCost({
      state: commercial,
      currentJobCommittedUsd: reservedCostUsd,
      nextReservationUsd: nextCost,
    })) {
      throw new AnalysisBudgetExceededError('period_cost');
    }
    assertAnalysisBudget({
      billableCalls: billableRows.reduce((sum, row) => sum + 1 + nonNegativeInteger(row.replay_count), 0),
      inputTokens: succeeded.reduce((sum, row) => sum + nonNegativeInteger(row.input_tokens), 0),
      outputTokens: succeeded.reduce((sum, row) => sum + nonNegativeInteger(row.output_tokens), 0),
      reservedCostUsd,
      stageCalls,
    }, input.reservation, profile);
  } catch (error) {
    if (error instanceof AnalysisBudgetExceededError) {
      const previous = (jobResult.data.cost_metrics ?? {}) as Record<string, unknown>;
      await supabase.from('analysis_jobs').update({ cost_metrics: {
        ...previous,
        budgetStopReason: error.message,
        budgetStopStage: input.reservation.stage,
        budgetStoppedAt: new Date().toISOString(),
      } }).eq('id', input.jobId);
    }
    throw error;
  }
}
