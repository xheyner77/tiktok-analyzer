import { describe, expect, it, vi } from 'vitest';
import {
  QUALITY_DIMENSION_IDS,
  compareAnalysisVersions,
  evaluateAnalysisCandidate,
  type AnalysisEvaluationCandidate,
  type EvaluationContext,
  type VideoAnalysisQualityFixture,
} from '@/lib/video-analysis/quality-evaluation';
import {
  VIDEO_ANALYSIS_QUALITY_FIXTURES,
  getVideoAnalysisQualityFixture,
} from '@/tests/fixtures/video-analysis-quality-fixtures';

const REQUIRED_SCENARIOS = [
  'absence-cta',
  'bon-hook-mauvais-payoff',
  'clip',
  'facecam',
  'longue',
  'mauvais-hook-contenu-fort',
  'mauvais-son',
  'montage-rapide',
  'multilingue',
  'plan-fixe',
  'produit',
  'sans-parole',
  'silence-initial',
  'storytelling',
  'texte-illisible',
  'tres-courte',
  'ugc',
] as const;

function strongCandidate(fixture: VideoAnalysisQualityFixture): AnalysisEvaluationCandidate {
  const claims = fixture.expectedObservations.map((observation) => ({
    id: `claim-${observation.id}`,
    text: observation.statement,
    nature: 'observed' as const,
    evidenceRefs: observation.evidenceRefs,
    timeRange: observation.timeRange,
  }));
  return {
    id: `strong-${fixture.id}`,
    context: fixture.context,
    summary: `Décisions de montage spécifiques pour le scénario synthétique ${fixture.label}.`,
    claims,
    recommendations: fixture.expectedObservations.map((observation) => ({
      id: `recommendation-${observation.id}`,
      text: observation.recommendedDecision,
      why: `Cette décision répond directement à l’observation ${observation.id} et reste limitée aux preuves citées.`,
      evidenceRefs: observation.evidenceRefs,
      linkedClaimIds: [`claim-${observation.id}`],
    })),
    timeline: [{
      id: `timeline-${fixture.id}`,
      startSec: 0,
      endSec: fixture.durationSec,
      evidenceRefs: fixture.evidenceRefs,
    }],
  };
}

function mismatchedContext(context: EvaluationContext): EvaluationContext {
  return {
    ...context,
    objective: 'objectif générique sans rapport',
  };
}

function weakInventedCandidate(fixture: VideoAnalysisQualityFixture): AnalysisEvaluationCandidate {
  const repeatedRecommendation = {
    text: 'Optimise ton contenu et améliore le hook.',
    why: 'Optimise ton contenu et améliore le hook.',
    evidenceRefs: ['preuve-inventee'],
    linkedClaimIds: ['claim-inconnu'],
  };
  return {
    id: `weak-${fixture.id}`,
    context: mismatchedContext(fixture.context),
    summary: 'Optimise ton contenu et améliore le hook.',
    claims: [{
      id: 'claim-retention-inventee',
      text: 'La rétention chute à 50 % et la vidéo atteint 10000 vues.',
      nature: 'observed',
      evidenceRefs: ['preuve-inventee'],
      timeRange: { startSec: fixture.durationSec + 1, endSec: fixture.durationSec + 10 },
    }],
    recommendations: [
      { id: 'generic-1', ...repeatedRecommendation },
      { id: 'generic-2', ...repeatedRecommendation },
    ],
    timeline: [{
      id: 'timeline-partielle',
      startSec: 0,
      endSec: fixture.durationSec / 2,
      evidenceRefs: ['preuve-inventee'],
    }],
  };
}

describe('catalogue QA de l’analyse vidéo', () => {
  it('couvre les 17 scénarios demandés sans doublon', () => {
    expect(VIDEO_ANALYSIS_QUALITY_FIXTURES).toHaveLength(REQUIRED_SCENARIOS.length);
    expect([...new Set(VIDEO_ANALYSIS_QUALITY_FIXTURES.map((fixture) => fixture.id))].sort())
      .toEqual([...REQUIRED_SCENARIOS].sort());
  });

  it('déclare pour chaque fixture une source synthétique autorisée, un contexte, des attentes et des interdits', () => {
    for (const fixture of VIDEO_ANALYSIS_QUALITY_FIXTURES) {
      expect(fixture.source).toBe('synthetic_qa_fixture');
      expect(fixture.usageAuthorization).toBe('synthetic_no_personal_data');
      expect(fixture.durationSec).toBeGreaterThan(0);
      expect(Object.values(fixture.context).every((value) => value.trim().length > 0)).toBe(true);
      expect(fixture.evidenceRefs.length).toBeGreaterThan(0);
      expect(new Set(fixture.evidenceRefs).size).toBe(fixture.evidenceRefs.length);
      expect(fixture.expectedObservations.length).toBeGreaterThanOrEqual(2);
      expect(fixture.forbiddenSignals.length).toBeGreaterThanOrEqual(2);
      expect(fixture.measuredSignals).toEqual({ retention: false, platformMetrics: false });

      for (const observation of fixture.expectedObservations) {
        expect(observation.statement.length).toBeGreaterThan(20);
        expect(observation.recommendedDecision.length).toBeGreaterThan(20);
        expect(observation.keywords.length).toBeGreaterThanOrEqual(observation.minimumKeywordMatches);
        expect(observation.evidenceRefs.length).toBeGreaterThan(0);
        expect(observation.evidenceRefs.every((reference) => fixture.evidenceRefs.includes(reference))).toBe(true);
        expect(observation.timeRange.startSec).toBeGreaterThanOrEqual(0);
        expect(observation.timeRange.endSec).toBeGreaterThanOrEqual(observation.timeRange.startSec);
        expect(observation.timeRange.endSec).toBeLessThanOrEqual(fixture.durationSec);
      }
      for (const signal of fixture.forbiddenSignals) {
        expect(signal.reason.length).toBeGreaterThan(20);
        expect(signal.patterns.length).toBeGreaterThan(0);
        for (const pattern of signal.patterns) {
          expect(() => new RegExp(pattern, 'iu')).not.toThrow();
        }
      }
    }
  });

  it('encode les limites propres aux cas sans parole, texte illisible, multilingue et plan fixe', () => {
    expect(getVideoAnalysisQualityFixture('sans-parole')?.forbiddenSignals.map((signal) => signal.id))
      .toContain('silent-no-transcript');
    expect(getVideoAnalysisQualityFixture('texte-illisible')?.forbiddenSignals.map((signal) => signal.id))
      .toContain('illegible-no-ocr-content');
    expect(getVideoAnalysisQualityFixture('multilingue')?.forbiddenSignals.map((signal) => signal.id))
      .toContain('multi-no-monolingual-claim');
    expect(getVideoAnalysisQualityFixture('plan-fixe')?.forbiddenSignals.map((signal) => signal.id))
      .toContain('static-no-boredom-claim');
  });
});

describe('évaluation déterministe de qualité', () => {
  it('valide sur chaque scénario la couverture, les timecodes et les références de preuve', () => {
    for (const fixture of VIDEO_ANALYSIS_QUALITY_FIXTURES) {
      const evaluation = evaluateAnalysisCandidate(fixture, strongCandidate(fixture));
      expect(evaluation.matchedObservationIds.sort()).toEqual(
        fixture.expectedObservations.map((observation) => observation.id).sort(),
      );
      expect(evaluation.timelineCoverageRatio).toBe(1);
      expect(evaluation.issues.filter((issue) => [
        'expected_observation_missing',
        'unknown_evidence',
        'weak_evidence',
        'timestamp_out_of_bounds',
        'timeline_gap',
        'generic_advice',
        'unsupported_retention',
        'unsupported_platform_metric',
      ].includes(issue.code))).toEqual([]);
      expect(evaluation.dimensions.accuracy).toBe(100);
      expect(evaluation.dimensions.coverage).toBe(100);
      expect(evaluation.dimensions.absenceOfInvention).toBe(100);
    }
  });

  it('détecte ensemble trou de timeline, timecode invalide, fausse preuve, texte générique et fausse rétention', () => {
    const fixture = getVideoAnalysisQualityFixture('bon-hook-mauvais-payoff');
    if (!fixture) throw new Error('Fixture bon-hook-mauvais-payoff absente');
    const evaluation = evaluateAnalysisCandidate(fixture, weakInventedCandidate(fixture));
    const codes = new Set(evaluation.issues.map((issue) => issue.code));

    const expectedCodes = [
      'expected_observation_missing',
      'unknown_evidence',
      'timestamp_out_of_bounds',
      'timeline_gap',
      'generic_advice',
      'unsupported_retention',
      'unsupported_platform_metric',
      'recommendation_unlinked',
      'goal_mismatch',
      'repetition',
    ] as const;
    for (const code of expectedCodes) expect(codes).toContain(code);
    expect(evaluation.dimensions.absenceOfInvention).toBe(0);
    expect(evaluation.timelineCoverageRatio).toBe(0.5);
  });

  it('compare deux versions sur les huit dimensions demandées et choisit la version étayée', () => {
    for (const fixture of VIDEO_ANALYSIS_QUALITY_FIXTURES) {
      const comparison = compareAnalysisVersions(
        fixture,
        strongCandidate(fixture),
        weakInventedCandidate(fixture),
      );
      expect(Object.keys(comparison.dimensions).sort()).toEqual([...QUALITY_DIMENSION_IDS].sort());
      expect(comparison.winner).toBe('versionA');
      for (const dimension of QUALITY_DIMENSION_IDS) {
        expect(comparison.dimensions[dimension].winner, `${fixture.id}: ${dimension}`).toBe('versionA');
        expect(comparison.dimensions[dimension].delta).toBeLessThan(0);
      }
    }
  });

  it('reste pur, synchrone et reproductible sans aucun appel réseau', () => {
    const fixture = getVideoAnalysisQualityFixture('facecam');
    if (!fixture) throw new Error('Fixture facecam absente');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const first = compareAnalysisVersions(
      fixture,
      strongCandidate(fixture),
      weakInventedCandidate(fixture),
    );
    const second = compareAnalysisVersions(
      fixture,
      strongCandidate(fixture),
      weakInventedCandidate(fixture),
    );

    expect(second).toEqual(first);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
