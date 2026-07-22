import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  AnalysisBudgetExceededError,
  assertAnalysisBudget,
  estimatedInputTokens,
} from '@/lib/video-analysis/budget';
import { ANALYSIS_PROFILES } from '@/lib/video-analysis/analysis-profiles';
import { VIDEO_ANALYSIS_BUDGET } from '@/lib/video-analysis/config';
import {
  estimateProviderUsageCost,
  readConfiguredPricingCatalog,
} from '@/lib/video-analysis/provider-ledger';

describe('budget strict du moteur video', () => {
  it('estime de facon conservative le texte et les images', () => {
    expect(estimatedInputTokens({
      promptCharacters: 2_000,
      imageCount: 2,
      maxOutputTokens: 100,
      stage: 'visual_analysis',
    })).toBe(4_000);
  });

  it('autorise les 10 frames basse resolution de la video A sous le budget QA', () => {
    const reservation = {
      promptCharacters: 4_000,
      imageCount: 10,
      imageDetail: 'low' as const,
      maxOutputTokens: 2_000,
      stage: 'visual_analysis',
      model: 'gpt-4o-mini',
    };
    expect(estimatedInputTokens(reservation)).toBe(30_330);
    expect(() => assertAnalysisBudget(
      { billableCalls: 1, inputTokens: 0, outputTokens: 0 },
      reservation,
      ANALYSIS_PROFILES.qa,
    )).not.toThrow();
  });

  it('refuse un payload visuel reellement trop grand', () => {
    expect(() => assertAnalysisBudget(
      { billableCalls: 1, inputTokens: 0, outputTokens: 0 },
      {
        promptCharacters: 8_000,
        imageCount: 10,
        imageDetail: 'low',
        maxOutputTokens: 2_000,
        stage: 'visual_analysis',
        model: 'gpt-4o-mini',
      },
      ANALYSIS_PROFILES.qa,
    )).toThrow('ANALYSIS_TOKEN_BUDGET_EXCEEDED:stage_input');
  });

  it('additionne une seule fois le texte et les images', () => {
    expect(estimatedInputTokens({
      promptCharacters: 4_000,
      imageCount: 10,
      imageDetail: 'low',
      maxOutputTokens: 2_000,
      stage: 'visual_analysis',
      model: 'gpt-4o-mini',
    })).toBe(28_330 + 2_000);
  });

  it.each([
    ['calls', { billableCalls: VIDEO_ANALYSIS_BUDGET.maxBillableCalls, inputTokens: 0, outputTokens: 0 }],
    ['input', { billableCalls: 0, inputTokens: VIDEO_ANALYSIS_BUDGET.maxInputTokens, outputTokens: 0 }],
    ['output', { billableCalls: 0, inputTokens: 0, outputTokens: VIDEO_ANALYSIS_BUDGET.maxOutputTokens }],
  ] as const)('bloque explicitement le plafond %s', (dimension, usage) => {
    try {
      assertAnalysisBudget(usage, {
        promptCharacters: 2,
        imageCount: 0,
        maxOutputTokens: 1,
        stage: 'synthesis',
      });
      throw new Error('BUDGET_SHOULD_HAVE_FAILED');
    } catch (error) {
      expect(error).toBeInstanceOf(AnalysisBudgetExceededError);
      expect((error as AnalysisBudgetExceededError).dimension).toBe(dimension);
    }
  });

  it('fournit un catalogue versionne par defaut et signale un modele inconnu', () => {
    delete process.env.OPENAI_MODEL_PRICING_JSON;
    const catalog = readConfiguredPricingCatalog();
    expect(catalog.version).toBe('openai-standard-2026-07-22');
    expect(estimateProviderUsageCost('gpt-4o', {
      kind: 'tokens',
      inputTokens: 1_000,
      cachedInputTokens: 500,
      outputTokens: 200,
      audioSeconds: null,
    }, catalog)).toMatchObject({ missingPricing: false, estimatedCostUsd: 0.003875 });
    expect(estimateProviderUsageCost('unknown-model', {
      kind: 'tokens',
      inputTokens: 1,
      cachedInputTokens: 0,
      outputTokens: 1,
      audioSeconds: null,
    }, catalog)).toMatchObject({ missingPricing: true, estimatedCostUsd: null });
  });
});
