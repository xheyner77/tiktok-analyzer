import { containsObservedRetentionClaim, findGenericPhrases } from '@/lib/analysis-engine/quality';

export const QUALITY_DIMENSION_IDS = [
  'specificity',
  'accuracy',
  'coverage',
  'utility',
  'feasibility',
  'absenceOfInvention',
  'goalCoherence',
  'nonRepetition',
] as const;

export type QualityDimensionId = (typeof QUALITY_DIMENSION_IDS)[number];

export interface EvaluationContext {
  objective: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  format: string;
  niche: string;
  audience: string;
  language: string;
}

export interface ExpectedObservation {
  id: string;
  statement: string;
  keywords: string[];
  minimumKeywordMatches: number;
  evidenceRefs: string[];
  timeRange: { startSec: number; endSec: number };
  recommendedDecision: string;
}

export interface ForbiddenSignal {
  id: string;
  reason: string;
  patterns: string[];
}

export interface VideoAnalysisQualityFixture {
  id: string;
  label: string;
  source: 'synthetic_qa_fixture';
  usageAuthorization: 'synthetic_no_personal_data';
  durationSec: number;
  context: EvaluationContext;
  evidenceRefs: string[];
  expectedObservations: ExpectedObservation[];
  forbiddenSignals: ForbiddenSignal[];
  measuredSignals: {
    retention: boolean;
    platformMetrics: boolean;
  };
}

export interface EvaluationClaim {
  id: string;
  text: string;
  nature: 'observed' | 'inferred';
  evidenceRefs: string[];
  timeRange: { startSec: number; endSec: number };
}

export interface EvaluationRecommendation {
  id: string;
  text: string;
  why: string;
  evidenceRefs: string[];
  linkedClaimIds: string[];
}

export interface EvaluationTimelineSegment {
  id: string;
  startSec: number;
  endSec: number;
  evidenceRefs: string[];
}

export interface AnalysisEvaluationCandidate {
  id: string;
  context: EvaluationContext;
  summary: string;
  claims: EvaluationClaim[];
  recommendations: EvaluationRecommendation[];
  timeline: EvaluationTimelineSegment[];
}

export type EvaluationIssueCode =
  | 'expected_observation_missing'
  | 'forbidden_signal'
  | 'unknown_evidence'
  | 'weak_evidence'
  | 'timestamp_out_of_bounds'
  | 'timeline_gap'
  | 'generic_advice'
  | 'unsupported_retention'
  | 'unsupported_platform_metric'
  | 'recommendation_unlinked'
  | 'goal_mismatch'
  | 'repetition';

export interface EvaluationIssue {
  code: EvaluationIssueCode;
  message: string;
  targetId?: string;
}

export interface CandidateQualityEvaluation {
  candidateId: string;
  overall: number;
  dimensions: Record<QualityDimensionId, number>;
  issues: EvaluationIssue[];
  matchedObservationIds: string[];
  timelineCoverageRatio: number;
}

export interface ComparativeQualityEvaluation {
  versionA: CandidateQualityEvaluation;
  versionB: CandidateQualityEvaluation;
  winner: 'versionA' | 'versionB' | 'tie';
  dimensions: Record<QualityDimensionId, {
    versionA: number;
    versionB: number;
    delta: number;
    winner: 'versionA' | 'versionB' | 'tie';
  }>;
}

const CONCRETE_ACTION_PATTERN = /\b(?:coupe|avance|raccourcis|réécris|reecris|garde|supprime|déplace|deplace|affiche|ajoute|retire|remplace|montre|ouvre|termine|synchronise|baisse|augmente|sépare|separe|teste|republie|conserve|enchaîne|enchaine|cadre|sous-titre|sous-titre)\b/iu;
const GENERIC_PATTERN = /\b(?:optimise ton contenu|booste tes performances|améliore le hook|ameliore le hook|rends la vidéo plus dynamique|rends la video plus dynamique|sois plus engageant|ajoute de la valeur)\b/iu;
const PLATFORM_METRIC_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:%\s*(?:d['’]engagement|de complétion|de completion)|vues?|likes?|commentaires?|partages?|sauvegardes?)\b/iu;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(value: string) {
  const normalized = normalizeText(value);
  return normalized.length === 0 ? 0 : normalized.split(' ').length;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 1 : numerator / denominator;
}

function intersects(first: readonly string[], second: readonly string[]) {
  const right = new Set(second);
  return first.some((value) => right.has(value));
}

function rangeOverlaps(
  first: { startSec: number; endSec: number },
  second: { startSec: number; endSec: number },
) {
  return first.startSec <= second.endSec && first.endSec >= second.startSec;
}

function validRange(range: { startSec: number; endSec: number }, durationSec: number) {
  return Number.isFinite(range.startSec)
    && Number.isFinite(range.endSec)
    && range.startSec >= 0
    && range.endSec >= range.startSec
    && range.endSec <= durationSec + 0.075;
}

function observationMatchesClaim(observation: ExpectedObservation, claim: EvaluationClaim) {
  const normalized = normalizeText(claim.text);
  const keywordMatches = observation.keywords
    .map(normalizeText)
    .filter((keyword) => normalized.includes(keyword)).length;
  return keywordMatches >= observation.minimumKeywordMatches
    && intersects(observation.evidenceRefs, claim.evidenceRefs)
    && rangeOverlaps(observation.timeRange, claim.timeRange);
}

function timelineCoverage(
  timeline: readonly EvaluationTimelineSegment[],
  durationSec: number,
) {
  if (durationSec <= 0 || timeline.length === 0) return 0;
  const ranges = timeline
    .filter((segment) => validRange(segment, durationSec) && segment.endSec > segment.startSec)
    .map((segment) => ({
      startSec: Math.max(0, segment.startSec),
      endSec: Math.min(durationSec, segment.endSec),
    }))
    .sort((left, right) => left.startSec - right.startSec);
  if (ranges.length === 0) return 0;

  let covered = 0;
  let currentStart = ranges[0].startSec;
  let currentEnd = ranges[0].endSec;
  for (const range of ranges.slice(1)) {
    if (range.startSec <= currentEnd + 0.075) {
      currentEnd = Math.max(currentEnd, range.endSec);
    } else {
      covered += currentEnd - currentStart;
      currentStart = range.startSec;
      currentEnd = range.endSec;
    }
  }
  covered += currentEnd - currentStart;
  return Math.max(0, Math.min(1, covered / durationSec));
}

function knownEvidenceRatio(candidate: AnalysisEvaluationCandidate, knownEvidence: Set<string>) {
  const references = [
    ...candidate.claims.flatMap((claim) => claim.evidenceRefs),
    ...candidate.recommendations.flatMap((recommendation) => recommendation.evidenceRefs),
    ...candidate.timeline.flatMap((segment) => segment.evidenceRefs),
  ];
  return ratio(references.filter((reference) => knownEvidence.has(reference)).length, references.length);
}

function contextSimilarity(expected: EvaluationContext, actual: EvaluationContext) {
  const fields: Array<keyof EvaluationContext> = [
    'objective',
    'platform',
    'format',
    'niche',
    'audience',
    'language',
  ];
  return ratio(
    fields.filter((field) => normalizeText(expected[field]) === normalizeText(actual[field])).length,
    fields.length,
  );
}

function allCandidateTexts(candidate: AnalysisEvaluationCandidate) {
  return [
    candidate.summary,
    ...candidate.claims.map((claim) => claim.text),
    ...candidate.recommendations.flatMap((recommendation) => [recommendation.text, recommendation.why]),
  ];
}

function repeatedTextRatio(candidate: AnalysisEvaluationCandidate) {
  const normalized = allCandidateTexts(candidate)
    .map(normalizeText)
    .filter((value) => value.length > 0);
  return ratio(new Set(normalized).size, normalized.length);
}

function hasGenericAdvice(value: string) {
  return GENERIC_PATTERN.test(value) || findGenericPhrases(value).length > 0;
}

export function evaluateAnalysisCandidate(
  fixture: VideoAnalysisQualityFixture,
  candidate: AnalysisEvaluationCandidate,
): CandidateQualityEvaluation {
  const issues: EvaluationIssue[] = [];
  const knownEvidence = new Set(fixture.evidenceRefs);
  const matchedObservationIds: string[] = [];
  const matchedClaims = new Set<string>();

  for (const observation of fixture.expectedObservations) {
    const match = candidate.claims.find((claim) => observationMatchesClaim(observation, claim));
    if (match) {
      matchedObservationIds.push(observation.id);
      matchedClaims.add(match.id);
    } else {
      issues.push({
        code: 'expected_observation_missing',
        targetId: observation.id,
        message: `L'observation attendue « ${observation.statement} » n'est pas couverte avec ses preuves et son timecode.`,
      });
    }
  }

  for (const claim of candidate.claims) {
    if (!validRange(claim.timeRange, fixture.durationSec)) {
      issues.push({
        code: 'timestamp_out_of_bounds',
        targetId: claim.id,
        message: `Le timecode ${claim.timeRange.startSec}-${claim.timeRange.endSec}s sort de la vidéo.`,
      });
    }
    if (claim.evidenceRefs.length === 0) {
      issues.push({
        code: 'weak_evidence',
        targetId: claim.id,
        message: 'Une affirmation factuelle ne cite aucune preuve.',
      });
    }
  }

  for (const [targetId, references] of [
    ...candidate.claims.map((claim) => [claim.id, claim.evidenceRefs] as const),
    ...candidate.recommendations.map((recommendation) => [recommendation.id, recommendation.evidenceRefs] as const),
    ...candidate.timeline.map((segment) => [segment.id, segment.evidenceRefs] as const),
  ]) {
    for (const reference of references) {
      if (!knownEvidence.has(reference)) {
        issues.push({
          code: 'unknown_evidence',
          targetId,
          message: `La preuve ${reference} n'existe pas dans la fixture autorisée.`,
        });
      }
    }
  }

  const claimIds = new Set(candidate.claims.map((claim) => claim.id));
  for (const recommendation of candidate.recommendations) {
    if (
      recommendation.linkedClaimIds.length === 0
      || recommendation.linkedClaimIds.some((id) => !claimIds.has(id))
      || recommendation.evidenceRefs.length === 0
    ) {
      issues.push({
        code: 'recommendation_unlinked',
        targetId: recommendation.id,
        message: "La décision n'est pas reliée à une observation et à une preuve connues.",
      });
    }
    if (hasGenericAdvice(`${recommendation.text} ${recommendation.why}`)) {
      issues.push({
        code: 'generic_advice',
        targetId: recommendation.id,
        message: 'La recommandation emploie une formulation générique interdite.',
      });
    }
  }

  for (const segment of candidate.timeline) {
    if (!validRange(segment, fixture.durationSec)) {
      issues.push({
        code: 'timestamp_out_of_bounds',
        targetId: segment.id,
        message: `Le segment ${segment.startSec}-${segment.endSec}s sort de la vidéo.`,
      });
    }
  }

  const coverageRatio = timelineCoverage(candidate.timeline, fixture.durationSec);
  if (coverageRatio < 0.999) {
    issues.push({
      code: 'timeline_gap',
      message: `La timeline ne couvre que ${(coverageRatio * 100).toFixed(1)} % de la durée.`,
    });
  }

  const combinedText = allCandidateTexts(candidate).join('\n');
  for (const signal of fixture.forbiddenSignals) {
    if (signal.patterns.some((pattern) => new RegExp(pattern, 'iu').test(combinedText))) {
      issues.push({
        code: 'forbidden_signal',
        targetId: signal.id,
        message: signal.reason,
      });
    }
  }
  if (!fixture.measuredSignals.retention && containsObservedRetentionClaim(combinedText)) {
    issues.push({
      code: 'unsupported_retention',
      message: 'Une rétention observée est affirmée sans courbe plateforme.',
    });
  }
  if (!fixture.measuredSignals.platformMetrics && PLATFORM_METRIC_PATTERN.test(combinedText)) {
    issues.push({
      code: 'unsupported_platform_metric',
      message: 'Une métrique plateforme est affirmée sans export vérifié.',
    });
  }

  const similarity = contextSimilarity(fixture.context, candidate.context);
  if (similarity < 1) {
    issues.push({
      code: 'goal_mismatch',
      message: 'La réponse ne respecte pas tout le contexte créateur de la fixture.',
    });
  }

  const uniqueness = repeatedTextRatio(candidate);
  if (uniqueness < 0.8) {
    issues.push({
      code: 'repetition',
      message: 'La réponse répète les mêmes formulations au lieu de hiérarchiser les décisions.',
    });
  }

  const expectedCoverage = ratio(matchedObservationIds.length, fixture.expectedObservations.length);
  const referencesKnown = knownEvidenceRatio(candidate, knownEvidence);
  const validClaimRanges = ratio(
    candidate.claims.filter((claim) => validRange(claim.timeRange, fixture.durationSec)).length,
    candidate.claims.length,
  );
  const claimSpecificity = ratio(
    candidate.claims.filter((claim) => wordCount(claim.text) >= 7 && claim.evidenceRefs.length > 0).length,
    candidate.claims.length,
  );
  const recommendationSpecificity = ratio(
    candidate.recommendations.filter((recommendation) => (
      wordCount(recommendation.text) >= 6
      && CONCRETE_ACTION_PATTERN.test(recommendation.text)
      && recommendation.evidenceRefs.length > 0
    )).length,
    candidate.recommendations.length,
  );
  const linkedRecommendations = ratio(
    candidate.recommendations.filter((recommendation) => (
      recommendation.linkedClaimIds.length > 0
      && recommendation.linkedClaimIds.every((id) => claimIds.has(id))
      && recommendation.evidenceRefs.length > 0
    )).length,
    candidate.recommendations.length,
  );
  const implementableRecommendations = ratio(
    candidate.recommendations.filter((recommendation) => (
      CONCRETE_ACTION_PATTERN.test(recommendation.text)
      && wordCount(recommendation.text) >= 4
      && wordCount(recommendation.text) <= 32
    )).length,
    candidate.recommendations.length,
  );
  const genericCount = candidate.recommendations
    .filter((recommendation) => hasGenericAdvice(`${recommendation.text} ${recommendation.why}`)).length;
  const inventionIssueCount = issues.filter((issue) => [
    'forbidden_signal',
    'unknown_evidence',
    'unsupported_retention',
    'unsupported_platform_metric',
  ].includes(issue.code)).length;

  const dimensions: Record<QualityDimensionId, number> = {
    specificity: clampScore((claimSpecificity * 0.45 + recommendationSpecificity * 0.55) * 100 - genericCount * 20),
    accuracy: clampScore((expectedCoverage * 0.6 + referencesKnown * 0.2 + validClaimRanges * 0.2) * 100 - inventionIssueCount * 8),
    coverage: clampScore((expectedCoverage * 0.65 + coverageRatio * 0.35) * 100),
    utility: clampScore((linkedRecommendations * 0.45 + recommendationSpecificity * 0.4 + similarity * 0.15) * 100 - genericCount * 20),
    feasibility: clampScore((implementableRecommendations * 0.8 + referencesKnown * 0.2) * 100 - genericCount * 15),
    absenceOfInvention: clampScore(100 - inventionIssueCount * 28 - issues.filter((issue) => issue.code === 'weak_evidence').length * 12),
    goalCoherence: clampScore(similarity * 100),
    nonRepetition: clampScore(uniqueness * 100),
  };
  const overall = clampScore(
    QUALITY_DIMENSION_IDS.reduce((total, dimension) => total + dimensions[dimension], 0)
      / QUALITY_DIMENSION_IDS.length,
  );

  return {
    candidateId: candidate.id,
    overall,
    dimensions,
    issues,
    matchedObservationIds,
    timelineCoverageRatio: coverageRatio,
  };
}

export function compareAnalysisVersions(
  fixture: VideoAnalysisQualityFixture,
  versionA: AnalysisEvaluationCandidate,
  versionB: AnalysisEvaluationCandidate,
): ComparativeQualityEvaluation {
  const evaluationA = evaluateAnalysisCandidate(fixture, versionA);
  const evaluationB = evaluateAnalysisCandidate(fixture, versionB);
  const dimensions = Object.fromEntries(QUALITY_DIMENSION_IDS.map((dimension) => {
    const scoreA = evaluationA.dimensions[dimension];
    const scoreB = evaluationB.dimensions[dimension];
    return [dimension, {
      versionA: scoreA,
      versionB: scoreB,
      delta: scoreB - scoreA,
      winner: scoreA === scoreB ? 'tie' : scoreA > scoreB ? 'versionA' : 'versionB',
    }];
  })) as ComparativeQualityEvaluation['dimensions'];

  return {
    versionA: evaluationA,
    versionB: evaluationB,
    winner: evaluationA.overall === evaluationB.overall
      ? 'tie'
      : evaluationA.overall > evaluationB.overall
        ? 'versionA'
        : 'versionB',
    dimensions,
  };
}
