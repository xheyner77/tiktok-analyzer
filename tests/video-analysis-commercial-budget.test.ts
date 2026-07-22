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
      jobs: [{ id: 'done', status: 'completed', source_metadata: {} }],
      calls: [{
        job_id: 'done', operation: 'responses.parse', status: 'succeeded',
        billing_status: 'billable', estimated_cost_usd: 0.05, replay_count: 1,
      }],
    });
    expect(result).toEqual({ committedUsd: 0.1, indeterminate: false, activeReservations: 0 });
  });

  it('réserve le plafond des autres jobs actifs contre les courses concurrentes', () => {
    const result = calculateCommercialCommitment({
      jobs: [{
        id: 'active', status: 'processing',
        source_metadata: { analysisProfile: analysisProfileSnapshot(ANALYSIS_PROFILES.pro) },
      }],
      calls: [],
      currentJobId: 'current',
    });
    expect(result).toEqual({ committedUsd: 0.18, indeterminate: false, activeReservations: 1 });
  });

  it('bloque un coût facturable indéterminé', () => {
    expect(calculateCommercialCommitment({
      jobs: [{ id: 'done', status: 'failed', source_metadata: {} }],
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
      },
    }).id).toBe('free');
  });

  it('refuse avant appel le dépassement du budget cumulé', () => {
    const budget = commercialAnalysisBudget('starter');
    const state = {
      ...budget, committedUsd: 3.2, remainingUsd: 0.05413,
      indeterminate: false, activeReservations: 0,
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
