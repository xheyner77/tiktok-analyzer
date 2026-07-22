import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

import { PUBLIC_PLANS } from '@/lib/public-plans';
import { ANALYSIS_PROFILES, analysisProfileSnapshot } from '@/lib/video-analysis/analysis-profiles';
import {
  calculateCommercialCommitment,
  canReserveCommercialCost,
  chooseProfileForCommercialBudget,
  commercialAnalysisBudget,
  commercialBudgetPeriodStart,
} from '@/lib/video-analysis/commercial-budget';

describe('budget commercial glissant des analyses vidéo', () => {
  const currentJob = (input: {
    id: string;
    status: string;
    quotaState?: string;
    sourceMetadata?: Record<string, unknown>;
  }) => ({
    id: input.id,
    status: input.status,
    created_at: '2026-07-22T13:00:00.000Z',
    quota_state: input.quotaState ?? 'consumed',
    source_metadata: input.sourceMetadata ?? {},
  });

  const historicalRefundedJob = (id: string) => ({
    id,
    status: 'failed',
    created_at: '2026-07-22T01:00:00.000Z',
    quota_state: 'refunded',
    source_metadata: {},
  });

  it('ne publie que les quatre offres canoniques', () => {
    expect(PUBLIC_PLANS.map((plan) => plan.id)).toEqual(['free', 'starter', 'pro', 'lifetime']);
    expect(PUBLIC_PLANS.some((plan) => ['creator', 'scale'].includes(plan.id))).toBe(false);
  });

  it('mappe les aliases historiques sans créer une offre', () => {
    expect(commercialAnalysisBudget('creator').plan).toBe('starter');
    expect(commercialAnalysisBudget('scale').plan).toBe('lifetime');
  });

  it('applique les enveloppes EUR avec marge FX', () => {
    expect(commercialAnalysisBudget('free')).toMatchObject({ periodBudgetEur: 0.3, quota: 3 });
    expect(commercialAnalysisBudget('starter')).toMatchObject({
      periodBudgetEur: 3, targetAverageEur: 0.1, operationalBudgetUsd: 3.25413, quota: 30,
    });
    expect(commercialAnalysisBudget('pro')).toMatchObject({
      periodBudgetEur: 10, targetAverageEur: 0.067, operationalBudgetUsd: 10.8471, quota: 150,
    });
    expect(commercialAnalysisBudget('lifetime')).toMatchObject({
      periodBudgetEur: 10, operationalBudgetUsd: 10.8471, quota: 150, periodKind: 'monthly',
    });
  });

  it('utilise created_at pour Free et la nouvelle fenêtre pour les plans mensuels et Lifetime', () => {
    expect(commercialBudgetPeriodStart({
      plan: 'free', createdAt: '2026-01-01T00:00:00Z', lastResetAt: '2026-07-01T00:00:00Z',
    })).toBe('2026-01-01T00:00:00Z');
    expect(commercialBudgetPeriodStart({
      plan: 'lifetime', createdAt: '2026-01-01T00:00:00Z', lastResetAt: '2026-07-01T00:00:00Z',
    })).toBe('2026-07-01T00:00:00Z');
  });

  it('compte un appel et ses rejeux exactement une fois', () => {
    const result = calculateCommercialCommitment({
      jobs: [currentJob({ id: 'done', status: 'completed' })],
      calls: [{
        job_id: 'done', operation: 'responses.parse', status: 'succeeded',
        billing_status: 'billable', estimated_cost_usd: 0.05, replay_count: 1,
      }],
    });
    expect(result).toEqual({
      committedUsd: 0.1,
      indeterminate: false,
      activeReservations: 0,
      historicalNonAttributableJobs: 0,
      historicalUnknownNonAttributableCalls: 0,
    });
  });

  it('réserve le plafond des autres jobs actifs contre les courses concurrentes', () => {
    const result = calculateCommercialCommitment({
      jobs: [currentJob({
        id: 'active', status: 'processing',
        sourceMetadata: { analysisProfile: analysisProfileSnapshot(ANALYSIS_PROFILES.pro) },
      })],
      calls: [],
      currentJobId: 'current',
    });
    expect(result).toMatchObject({ committedUsd: 0.18, indeterminate: false, activeReservations: 1 });
  });

  it('conserve un ancien coût inconnu sans l’imputer ni le convertir en zéro', () => {
    const call = {
      job_id: 'legacy', operation: 'responses.parse', status: 'failed',
      billing_status: 'unknown', estimated_cost_usd: null, replay_count: 0,
    };
    const result = calculateCommercialCommitment({
      jobs: [historicalRefundedJob('legacy')],
      calls: [call],
    });
    expect(call.estimated_cost_usd).toBeNull();
    expect(result).toEqual({
      committedUsd: 0,
      indeterminate: false,
      activeReservations: 0,
      historicalNonAttributableJobs: 1,
      historicalUnknownNonAttributableCalls: 1,
    });
  });

  it('exclut du budget courant un ancien job remboursé, y compris son coût connu', () => {
    const result = calculateCommercialCommitment({
      jobs: [historicalRefundedJob('legacy-refunded')],
      calls: [{
        job_id: 'legacy-refunded', operation: 'responses.parse', status: 'succeeded',
        billing_status: 'billable', estimated_cost_usd: 0.08, replay_count: 0,
      }],
    });
    expect(result.committedUsd).toBe(0);
    expect(result.indeterminate).toBe(false);
    expect(result.historicalNonAttributableJobs).toBe(1);
  });

  it('bloque toujours un job actif avec un coût fournisseur inconnu', () => {
    const result = calculateCommercialCommitment({
      jobs: [currentJob({
        id: 'active-unknown', status: 'processing', quotaState: 'reserved',
        sourceMetadata: { analysisProfile: analysisProfileSnapshot(ANALYSIS_PROFILES.qa) },
      })],
      calls: [{
        job_id: 'active-unknown', operation: 'responses.parse', status: 'failed',
        billing_status: 'unknown', estimated_cost_usd: null, replay_count: 0,
      }],
    });
    expect(result).toMatchObject({
      committedUsd: ANALYSIS_PROFILES.qa.maxCostUsd,
      indeterminate: true,
      activeReservations: 1,
    });
  });

  it('bloque un coût facturable indéterminé sur un job courant terminé', () => {
    expect(calculateCommercialCommitment({
      jobs: [currentJob({ id: 'done', status: 'failed', quotaState: 'refunded' })],
      calls: [{
        job_id: 'done', operation: 'responses.parse', status: 'failed',
        billing_status: 'unknown', estimated_cost_usd: null, replay_count: 0,
      }],
    }).indeterminate).toBe(true);
  });

  it('bascule vers le profil économique quand le budget restant par analyse est insuffisant', () => {
    const budget = commercialAnalysisBudget('pro');
    expect(chooseProfileForCommercialBudget({
      baseProfile: ANALYSIS_PROFILES.pro,
      analysesUsed: 140,
      state: {
        ...budget, committedUsd: 10.75, remainingUsd: 0.0971,
        indeterminate: false, activeReservations: 0,
        historicalNonAttributableJobs: 0, historicalUnknownNonAttributableCalls: 0,
      },
    }).id).toBe('free');
  });

  it('refuse avant appel le dépassement du budget cumulé', () => {
    const budget = commercialAnalysisBudget('starter');
    const state = {
      ...budget, committedUsd: 3.2, remainingUsd: 0.05413,
      indeterminate: false, activeReservations: 0,
      historicalNonAttributableJobs: 0, historicalUnknownNonAttributableCalls: 0,
    };
    expect(canReserveCommercialCost({
      state, currentJobCommittedUsd: 0.04, nextReservationUsd: 0.02,
    })).toBe(false);
    expect(canReserveCommercialCost({
      state: { ...state, indeterminate: true },
      currentJobCommittedUsd: 0, nextReservationUsd: 0,
    })).toBe(false);
  });

  it('conserve le profil Pro quand le coût soutenable reste compatible', () => {
    const budget = commercialAnalysisBudget('pro');
    expect(chooseProfileForCommercialBudget({
      baseProfile: ANALYSIS_PROFILES.pro,
      analysesUsed: 0,
      state: {
        ...budget, committedUsd: 0, remainingUsd: budget.operationalBudgetUsd,
        indeterminate: false, activeReservations: 0,
        historicalNonAttributableJobs: 0, historicalUnknownNonAttributableCalls: 0,
      },
    }).id).toBe('pro');
  });

  it('préserve les diagnostics essentiels dans le profil économique', () => {
    expect(ANALYSIS_PROFILES.free.specialists).toEqual(['hook', 'script', 'editing', 'cta']);
    expect(ANALYSIS_PROFILES.free.maxTimelineSegments).toBeGreaterThan(0);
  });

  it('aligne les helpers RPC Lifetime et scale sur les limites Pro', () => {
    const migration = readFileSync(join(
      process.cwd(),
      'supabase/migrations/20260722122627_enforce_canonical_lifetime_monthly_limits.sql',
    ), 'utf8');
    expect(migration).toContain("when p_plan = 'lifetime'");
    expect(migration).toContain("when p_plan = 'scale'");
    expect(migration).not.toContain('2147483647');
    expect(migration).toContain('revoke all on function public.quota_analysis_limit_for_plan');
    expect(migration).toContain('to service_role');
  });
});
