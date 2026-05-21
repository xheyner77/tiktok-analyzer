import { describe, expect, it } from 'vitest';
import { calculateMemoryScore, getMemoryPlanLimits } from '@/lib/memory/limits';
import { sanitizeExtractedFacts } from '@/lib/memory/quality';
import { isSimilarMemoryFact } from '@/lib/memory/similarity';

describe('memory backend limits', () => {
  it('keeps Free locked and does not allow memory learning', () => {
    const free = getMemoryPlanLimits('free');
    expect(free.canLearn).toBe(false);
    expect(free.maxActiveFacts).toBe(0);
    expect(free.retrievalLimit).toBe(0);
  });

  it('aligns Starter, Pro and Lifetime with current plan quotas', () => {
    const starter = getMemoryPlanLimits('starter');
    const pro = getMemoryPlanLimits('pro');
    const lifetime = getMemoryPlanLimits('lifetime');

    expect(starter.monthlyAnalysesLearned).toBe(30);
    expect(starter.factsPerAnalysis).toBe(5);
    expect(pro.monthlyAnalysesLearned).toBe(100);
    expect(pro.factsPerAnalysis).toBe(10);
    expect(pro.retrievalLimit).toBeGreaterThan(starter.retrievalLimit);
    expect(lifetime.monthlyAnalysesLearned).toBe(1000);
    expect(lifetime.maxActiveFacts).toBeGreaterThan(pro.maxActiveFacts);
  });

  it('treats legacy scale only as lifetime compatibility', () => {
    const legacy = getMemoryPlanLimits('scale');
    expect(legacy.plan).toBe('lifetime');
    expect(legacy.tier).toBe('permanent');
  });
});

describe('memory fact quality', () => {
  it('drops vague, low-confidence or evidence-free facts', () => {
    const facts = sanitizeExtractedFacts([
      {
        type: 'hook',
        title: 'Hook direct',
        content: 'Les hooks directs dans les deux premières secondes reviennent dans les recommandations.',
        evidence: 'L’analyse demande d’avancer le payoff et de couper l’intro.',
        confidenceScore: 72,
        importanceScore: 80,
      },
      {
        type: 'mistake',
        title: 'Générique',
        content: 'Améliorer le contenu.',
        evidence: 'Texte vague.',
        confidenceScore: 80,
        importanceScore: 80,
      },
      {
        type: 'format',
        title: 'Sans preuve',
        content: 'Le format facecam marche.',
        evidence: '',
        confidenceScore: 80,
        importanceScore: 80,
      },
      {
        type: 'cta',
        title: 'Confiance faible',
        content: 'Un CTA court est possible.',
        evidence: 'Signal faible.',
        confidenceScore: 20,
        importanceScore: 80,
      },
    ], 10);

    expect(facts).toHaveLength(1);
    expect(facts[0].type).toBe('hook');
  });

  it('detects similar facts for deduplication', () => {
    const incoming = {
      title: 'Intro trop longue',
      content: 'L’utilisateur commence souvent par une intro explicative trop longue.',
    };
    const existing = {
      title: 'Intro explicative longue',
      content: 'Le créateur commence souvent par une explication trop longue avant le payoff.',
    } as Parameters<typeof isSimilarMemoryFact>[1];

    expect(isSimilarMemoryFact(incoming, existing)).toBe(true);
  });

  it('memory score increases with learned analyses and active facts', () => {
    expect(calculateMemoryScore({ analysesLearned: 0, activeFactsCount: 0 })).toBeLessThan(
      calculateMemoryScore({ analysesLearned: 10, activeFactsCount: 20, averageConfidence: 80 })
    );
  });
});
