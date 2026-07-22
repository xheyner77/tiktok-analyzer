import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  ANALYSIS_PROFILES,
  analysisProfileSnapshot,
  configuredProfileModels,
  getAnalysisProfileFromMetadata,
  resolveServerAnalysisProfile,
} from '@/lib/video-analysis/analysis-profiles';
import {
  AnalysisBudgetExceededError,
  assertAnalysisBudget,
  profileWorstCaseCostUsd,
  profileNormalEstimatedCostUsd,
} from '@/lib/video-analysis/budget';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('profils économiques du moteur vidéo', () => {
  it.each([
    ['free', 'free'], ['starter', 'starter'], ['creator', 'starter'],
    ['pro', 'pro'], ['lifetime', 'pro'], ['scale', 'pro'],
  ] as const)('sélectionne %s côté serveur comme %s', (plan, expected) => {
    expect(resolveServerAnalysisProfile({ plan, userId: 'user-1' }).id).toBe(expected);
  });

  it('réserve QA au seul compte allowlisté pendant la fenêtre autorisée', () => {
    const allowed = new Set(['qa-user']);
    expect(resolveServerAnalysisProfile({
      plan: 'free', userId: 'qa-user', qaEnabled: true,
      qaAllowedUserIds: allowed, qaExpiresAt: '2026-07-23T00:00:00Z',
      now: new Date('2026-07-22T12:00:00Z'),
    }).id).toBe('qa');
    expect(resolveServerAnalysisProfile({
      plan: 'pro', userId: 'other-user', qaEnabled: true,
      qaAllowedUserIds: allowed,
    }).id).toBe('pro');
    expect(resolveServerAnalysisProfile({
      plan: 'free', userId: 'qa-user', qaEnabled: true,
      qaAllowedUserIds: allowed, qaExpiresAt: '2026-07-21T00:00:00Z',
      now: new Date('2026-07-22T12:00:00Z'),
    }).id).toBe('free');
  });

  it('ignore toute tentative client d’élever un profil dans les métadonnées inconnues', () => {
    expect(getAnalysisProfileFromMetadata({ analysisProfile: { id: 'enterprise' } }).id).toBe('free');
    expect(analysisProfileSnapshot(ANALYSIS_PROFILES.qa)).toEqual({
      version: 'analysis-economics-2026-07-22.1', id: 'qa', maxCostUsd: 0.25,
    });
  });

  it('maintient chaque pire cas configuré sous le plafond économique', () => {
    for (const profile of Object.values(ANALYSIS_PROFILES)) {
      expect(profileWorstCaseCostUsd(profile)).toBeLessThanOrEqual(profile.maxCostUsd);
      expect(profileNormalEstimatedCostUsd(profile)).toBeLessThan(profileWorstCaseCostUsd(profile));
    }
  });

  it('refuse avant appel un modèle au tarif inconnu, y compris via variable serveur', () => {
    process.env.OPENAI_ANALYSIS_MODELS = 'modele-sans-tarif';
    const profile = ANALYSIS_PROFILES.free;
    expect(configuredProfileModels(profile, 'synthesis')).toEqual(['modele-sans-tarif']);
    expect(() => assertAnalysisBudget({ billableCalls: 0, inputTokens: 0, outputTokens: 0 }, {
      stage: 'synthesis', model: 'modele-sans-tarif', promptCharacters: 10,
      imageCount: 0, maxOutputTokens: 10,
    }, profile)).toThrowError(AnalysisBudgetExceededError);
    expect(() => assertAnalysisBudget({ billableCalls: 0, inputTokens: 0, outputTokens: 0 }, {
      stage: 'synthesis', model: 'modele-sans-tarif', promptCharacters: 10,
      imageCount: 0, maxOutputTokens: 10,
    }, profile)).toThrow('ANALYSIS_MODEL_PRICE_UNKNOWN');
  });

  it('bloque appels, sorties et coût avant dépassement', () => {
    const profile = ANALYSIS_PROFILES.free;
    expect(() => assertAnalysisBudget({
      billableCalls: profile.maxBillableCalls, inputTokens: 0, outputTokens: 0,
    }, {
      stage: 'synthesis', model: 'gpt-4o-mini', promptCharacters: 10,
      imageCount: 0, maxOutputTokens: 10,
    }, profile)).toThrow('ANALYSIS_TOKEN_BUDGET_EXCEEDED:calls');
    expect(() => assertAnalysisBudget({
      billableCalls: 0, inputTokens: 0, outputTokens: 0, reservedCostUsd: profile.maxCostUsd,
    }, {
      stage: 'synthesis', model: 'gpt-4o-mini', promptCharacters: 10,
      imageCount: 0, maxOutputTokens: 10,
    }, profile)).toThrow('ANALYSIS_FINANCIAL_BUDGET_EXCEEDED');
  });

  it('n’autorise aucun retry fournisseur payant et une seule réparation maximum', () => {
    for (const profile of Object.values(ANALYSIS_PROFILES)) {
      expect(profile.maxProviderRetries).toBe(0);
      expect(profile.maxRepairs).toBeLessThanOrEqual(1);
      expect(profile.singlePassTranscription).toBe(true);
    }
  });
});
