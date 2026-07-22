import 'server-only';

import { PLAN_LIMITS } from '@/lib/plan-limits';
import { normalizePlan, type RawPlan } from '@/lib/plans';
import {
  ANALYSIS_PROFILES,
  getAnalysisProfileFromMetadata,
  type AnalysisProfile,
} from './analysis-profiles';
import { profileNormalEstimatedCostUsd } from './budget';

/** ECB reference rate published 2026-07-21: 1 EUR = 1.1418 USD. */
export const ANALYSIS_BUDGET_EUR_TO_USD = 1.1418;
export const ANALYSIS_BUDGET_FX_DATE = '2026-07-21';
/** Keeps 5% unspent so a static reference rate cannot consume the full EUR envelope. */
export const ANALYSIS_BUDGET_FX_SAFETY_FACTOR = 0.95;
export const COMMERCIAL_BUDGET_VERSION = 'commercial-analysis-budget-2026-07-22.2';
/** First commit carrying period-aware commercial accounting. */
export const COMMERCIAL_BUDGET_ACCOUNTING_STARTED_AT = '2026-07-22T12:35:30.000Z';

export interface CommercialAnalysisBudget {
  plan: 'free' | 'starter' | 'pro' | 'lifetime';
  periodBudgetEur: number;
  operationalBudgetUsd: number;
  targetAverageEur: number;
  quota: number;
  periodKind: 'lifetime' | 'monthly';
}

export interface CommercialBudgetState extends CommercialAnalysisBudget {
  committedUsd: number;
  remainingUsd: number;
  indeterminate: boolean;
  activeReservations: number;
  historicalNonAttributableJobs: number;
  historicalUnknownNonAttributableCalls: number;
}

interface BudgetJobRow {
  id: string;
  status: string;
  created_at: string;
  quota_state: string;
  source_metadata: Record<string, unknown> | null;
}

interface BudgetCallRow {
  job_id: string;
  operation: string;
  status: string;
  billing_status: string | null;
  estimated_cost_usd: number | string | null;
  replay_count: number | string | null;
}

export function commercialAnalysisBudget(plan: RawPlan): CommercialAnalysisBudget {
  const normalized = normalizePlan(plan);
  const canonical = normalized === 'starter'
    ? 'starter'
    : normalized === 'pro'
      ? 'pro'
      : normalized === 'lifetime'
        ? 'lifetime'
        : 'free';
  const periodBudgetEur = canonical === 'free' ? 0.3 : canonical === 'starter' ? 3 : 10;
  const targetAverageEur = canonical === 'pro' || canonical === 'lifetime' ? 0.067 : 0.1;
  return {
    plan: canonical,
    periodBudgetEur,
    operationalBudgetUsd: Number((
      periodBudgetEur * ANALYSIS_BUDGET_EUR_TO_USD * ANALYSIS_BUDGET_FX_SAFETY_FACTOR
    ).toFixed(8)),
    targetAverageEur,
    quota: PLAN_LIMITS[canonical] ?? PLAN_LIMITS.free,
    periodKind: canonical === 'free' ? 'lifetime' : 'monthly',
  };
}

export function commercialBudgetPeriodStart(input: {
  plan: RawPlan;
  createdAt: string;
  lastResetAt: string;
}): string {
  return normalizePlan(input.plan) === 'free' ? input.createdAt : input.lastResetAt;
}

function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function metadataCommercialBudgetVersion(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.commercialBudget;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const version = (value as { version?: unknown }).version;
  return typeof version === 'string' ? version : null;
}

function isHistoricalNonAttributableJob(job: BudgetJobRow): boolean {
  const createdAt = Date.parse(job.created_at);
  const accountingStartedAt = Date.parse(COMMERCIAL_BUDGET_ACCOUNTING_STARTED_AT);
  return job.status === 'failed'
    && job.quota_state === 'refunded'
    && Number.isFinite(createdAt)
    && createdAt < accountingStartedAt
    && metadataCommercialBudgetVersion(job.source_metadata) !== COMMERCIAL_BUDGET_VERSION;
}

function unknownCostMustBlock(call: BudgetCallRow): boolean {
  return call.status === 'succeeded'
    || call.billing_status === 'billable'
    || call.billing_status === 'unknown';
}

export function calculateCommercialCommitment(input: {
  jobs: readonly BudgetJobRow[];
  calls: readonly BudgetCallRow[];
  currentJobId?: string;
}): {
  committedUsd: number;
  indeterminate: boolean;
  activeReservations: number;
  historicalNonAttributableJobs: number;
  historicalUnknownNonAttributableCalls: number;
} {
  let committedUsd = 0;
  let indeterminate = false;
  let activeReservations = 0;
  let historicalNonAttributableJobs = 0;
  let historicalUnknownNonAttributableCalls = 0;
  const callsByJob = new Map<string, BudgetCallRow[]>();
  for (const call of input.calls) {
    if (call.operation === 'models.retrieve') continue;
    const rows = callsByJob.get(call.job_id) ?? [];
    rows.push(call);
    callsByJob.set(call.job_id, rows);
  }

  for (const job of input.jobs) {
    if (job.id === input.currentJobId) continue;
    const jobCalls = callsByJob.get(job.id) ?? [];
    if (isHistoricalNonAttributableJob(job)) {
      historicalNonAttributableJobs += 1;
      historicalUnknownNonAttributableCalls += jobCalls.filter((call) => (
        finiteNonNegative(call.estimated_cost_usd) === null
      )).length;
      continue;
    }
    const terminal = job.status === 'completed' || job.status === 'failed';
    if (!terminal) {
      const profile = getAnalysisProfileFromMetadata(job.source_metadata ?? {});
      committedUsd += profile.maxCostUsd;
      activeReservations += 1;
      if (jobCalls.some((call) => (
        call.billing_status !== 'non_billable'
        && finiteNonNegative(call.estimated_cost_usd) === null
        && unknownCostMustBlock(call)
      ))) {
        indeterminate = true;
      }
      continue;
    }
    for (const call of jobCalls) {
      if (call.billing_status === 'non_billable') continue;
      const cost = finiteNonNegative(call.estimated_cost_usd);
      if (cost === null) {
        if (unknownCostMustBlock(call)) {
          indeterminate = true;
        }
        continue;
      }
      const replays = Math.max(0, Math.round(finiteNonNegative(call.replay_count) ?? 0));
      committedUsd += cost * (1 + replays);
    }
  }
  return {
    committedUsd: Number(committedUsd.toFixed(8)),
    indeterminate,
    activeReservations,
    historicalNonAttributableJobs,
    historicalUnknownNonAttributableCalls,
  };
}

export function chooseProfileForCommercialBudget(input: {
  baseProfile: AnalysisProfile;
  state: CommercialBudgetState;
  analysesUsed: number;
}): AnalysisProfile {
  if (input.baseProfile.id === 'qa') return input.baseProfile;
  if (input.state.indeterminate || input.state.remainingUsd <= 0) return ANALYSIS_PROFILES.free;
  const remainingAnalyses = Math.max(1, input.state.quota - Math.max(0, input.analysesUsed));
  const allowancePerRemainingAnalysis = input.state.remainingUsd / remainingAnalyses;
  const normalCost = profileNormalEstimatedCostUsd(input.baseProfile, {
    includeConditionalCritique: false,
  });
  return allowancePerRemainingAnalysis + Number.EPSILON < normalCost
    ? ANALYSIS_PROFILES.free
    : input.baseProfile;
}

export function canReserveCommercialCost(input: {
  state: CommercialBudgetState;
  currentJobCommittedUsd: number;
  nextReservationUsd: number;
}): boolean {
  if (input.state.indeterminate) return false;
  return input.state.committedUsd
    + Math.max(0, input.currentJobCommittedUsd)
    + Math.max(0, input.nextReservationUsd)
    <= input.state.operationalBudgetUsd + Number.EPSILON;
}

export function commercialBudgetSnapshot(state: CommercialBudgetState, economic: boolean) {
  return {
    version: COMMERCIAL_BUDGET_VERSION,
    plan: state.plan,
    periodBudgetEur: state.periodBudgetEur,
    operationalBudgetUsd: state.operationalBudgetUsd,
    fxEurToUsd: ANALYSIS_BUDGET_EUR_TO_USD,
    fxDate: ANALYSIS_BUDGET_FX_DATE,
    fxSafetyFactor: ANALYSIS_BUDGET_FX_SAFETY_FACTOR,
    committedUsdAtSelection: state.committedUsd,
    historicalNonAttributableJobs: state.historicalNonAttributableJobs,
    historicalUnknownNonAttributableCalls: state.historicalUnknownNonAttributableCalls,
    mode: economic ? 'economic' : 'standard',
  };
}

export async function readCommercialBudgetState(input: {
  userId: string;
  plan: RawPlan;
  periodStart: string;
  currentJobId?: string;
}): Promise<CommercialBudgetState> {
  const { supabase } = await import('@/lib/supabase');
  const budget = commercialAnalysisBudget(input.plan);
  const jobsResult = await supabase
    .from('analysis_jobs')
    .select('id,status,created_at,quota_state,source_metadata')
    .eq('user_id', input.userId)
    .gte('created_at', input.periodStart)
    .limit(500);
  if (jobsResult.error) throw new Error('ANALYSIS_COMMERCIAL_BUDGET_READ_FAILED');
  const jobs = (jobsResult.data ?? []) as BudgetJobRow[];
  const jobIds = jobs.map((job) => job.id);
  let calls: BudgetCallRow[] = [];
  if (jobIds.length) {
    const callsResult = await supabase
      .from('analysis_provider_calls')
      .select('job_id,operation,status,billing_status,estimated_cost_usd,replay_count')
      .in('job_id', jobIds)
      .range(0, 4_999);
    if (callsResult.error) throw new Error('ANALYSIS_COMMERCIAL_BUDGET_READ_FAILED');
    calls = (callsResult.data ?? []) as BudgetCallRow[];
  }
  const commitment = calculateCommercialCommitment({
    jobs,
    calls,
    currentJobId: input.currentJobId,
  });
  return {
    ...budget,
    ...commitment,
    remainingUsd: Number(Math.max(0, budget.operationalBudgetUsd - commitment.committedUsd).toFixed(8)),
  };
}
