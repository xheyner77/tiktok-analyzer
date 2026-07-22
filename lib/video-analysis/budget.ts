import 'server-only';

import { VIDEO_ANALYSIS_BUDGET } from './config';

export interface AnalysisBudgetUsage {
  billableCalls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AnalysisBudgetReservation {
  promptCharacters: number;
  imageCount: number;
  maxOutputTokens: number;
  stage: string;
}

export class AnalysisBudgetExceededError extends Error {
  readonly dimension: 'calls' | 'input' | 'output' | 'specialist_input';

  constructor(dimension: AnalysisBudgetExceededError['dimension']) {
    super(`ANALYSIS_TOKEN_BUDGET_EXCEEDED:${dimension}`);
    this.name = 'AnalysisBudgetExceededError';
    this.dimension = dimension;
  }
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

export function estimatedInputTokens(reservation: AnalysisBudgetReservation): number {
  return Math.ceil(
    Math.max(0, reservation.promptCharacters)
      / VIDEO_ANALYSIS_BUDGET.promptCharactersPerEstimatedToken,
  ) + Math.max(0, reservation.imageCount) * VIDEO_ANALYSIS_BUDGET.estimatedTokensPerImage;
}

export function assertAnalysisBudget(
  usage: AnalysisBudgetUsage,
  reservation: AnalysisBudgetReservation,
): void {
  const estimate = estimatedInputTokens(reservation);
  if (usage.billableCalls + 1 > VIDEO_ANALYSIS_BUDGET.maxBillableCalls) {
    throw new AnalysisBudgetExceededError('calls');
  }
  if (usage.inputTokens + estimate > VIDEO_ANALYSIS_BUDGET.maxInputTokens) {
    throw new AnalysisBudgetExceededError('input');
  }
  if (usage.outputTokens + reservation.maxOutputTokens > VIDEO_ANALYSIS_BUDGET.maxOutputTokens) {
    throw new AnalysisBudgetExceededError('output');
  }
  if (
    reservation.stage === 'specialist_analysis'
    && estimate > VIDEO_ANALYSIS_BUDGET.maxSpecialistInputTokens
  ) {
    throw new AnalysisBudgetExceededError('specialist_input');
  }
}

export async function assertRemoteAnalysisBudget(input: {
  jobId: string;
  reservation: AnalysisBudgetReservation;
}): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase
    .from('analysis_provider_calls')
    .select('operation, status, billing_status, input_tokens, output_tokens')
    .eq('job_id', input.jobId);
  if (error) throw new Error('ANALYSIS_BUDGET_READ_FAILED');
  const rows = data ?? [];
  const billableSucceeded = rows.filter((row) => (
    row.operation !== 'models.retrieve'
    && row.status === 'succeeded'
    && row.billing_status === 'billable'
  ));
  assertAnalysisBudget({
    billableCalls: rows.filter((row) => row.operation !== 'models.retrieve').length,
    inputTokens: billableSucceeded.reduce(
      (sum, row) => sum + nonNegativeInteger(row.input_tokens),
      0,
    ),
    outputTokens: billableSucceeded.reduce(
      (sum, row) => sum + nonNegativeInteger(row.output_tokens),
      0,
    ),
  }, input.reservation);
}

