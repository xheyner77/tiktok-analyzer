import type {
  ComputedScore,
  DeterministicScores,
  RubricAssessment,
  RubricCriterionId,
} from './schemas';

export const SCORE_DIMENSIONS = [
  'hook',
  'clarity',
  'rhythm',
  'visual',
  'audio',
  'structure',
  'credibility',
  'cta',
  'objectiveFit',
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

interface RubricCriterionDefinition {
  id: RubricCriterionId;
  label: string;
  dimension: ScoreDimension;
  weight: number;
}

export const VIRALYNZ_RUBRIC: readonly RubricCriterionDefinition[] = [
  { id: 'hook.first_frame_stakes', label: 'Enjeu lisible dès la première frame', dimension: 'hook', weight: 8 },
  { id: 'hook.first_three_seconds_promise', label: 'Promesse concrète dans les trois premières secondes', dimension: 'hook', weight: 7 },
  { id: 'clarity.single_promise', label: 'Une promesse principale identifiable', dimension: 'clarity', weight: 6 },
  { id: 'clarity.message_legibility', label: 'Message compréhensible sans interprétation', dimension: 'clarity', weight: 6 },
  { id: 'pacing.dead_air_control', label: 'Absence de temps mort mesurable', dimension: 'rhythm', weight: 6 },
  { id: 'pacing.scene_progression', label: 'Progression visuelle ou narrative', dimension: 'rhythm', weight: 6 },
  { id: 'visual.first_frame_readability', label: 'Première frame lisible sur mobile', dimension: 'visual', weight: 5 },
  { id: 'visual.composition_progression', label: 'Composition visuelle au service de la progression', dimension: 'visual', weight: 5 },
  { id: 'audio.voice_intelligibility', label: 'Voix intelligible quand une piste vocale existe', dimension: 'audio', weight: 4 },
  { id: 'audio.pause_and_level_control', label: 'Pauses et niveau audio maîtrisés', dimension: 'audio', weight: 4 },
  { id: 'structure.promise_to_payoff', label: 'Chemin direct de la promesse au payoff', dimension: 'structure', weight: 6 },
  { id: 'structure.segment_necessity', label: 'Chaque segment justifie sa présence', dimension: 'structure', weight: 6 },
  { id: 'credibility.proof_before_claim', label: 'La preuve arrive avant ou avec l’affirmation', dimension: 'credibility', weight: 5 },
  { id: 'credibility.claim_support', label: 'Les affirmations sont soutenues dans la vidéo', dimension: 'credibility', weight: 5 },
  { id: 'cta.aligned', label: 'CTA aligné sur l’objectif créateur', dimension: 'cta', weight: 4 },
  { id: 'cta.low_friction', label: 'CTA simple à exécuter', dimension: 'cta', weight: 4 },
  { id: 'objective_fit.primary_action', label: 'Action principale cohérente avec l’objectif', dimension: 'objectiveFit', weight: 7 },
  { id: 'objective_fit.audience_alignment', label: 'Niveau de discours adapté à l’audience', dimension: 'objectiveFit', weight: 6 },
] as const;

const STATUS_FACTOR: Record<RubricAssessment['status'], number> = {
  met: 1,
  partial: 0.5,
  not_met: 0,
  unavailable: 0,
};

const MIN_DIMENSION_COVERAGE = 0.5;
const MIN_OVERALL_COVERAGE = 0.6;

export class RubricContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RubricContractError';
  }
}

function roundRatio(value: number) {
  return Number(value.toFixed(4));
}

function confidenceFor(coverage: number): 'low' | 'medium' | 'high' {
  if (coverage >= 0.8) return 'high';
  if (coverage >= 0.6) return 'medium';
  return 'low';
}

function computeScore(input: {
  definitions: readonly RubricCriterionDefinition[];
  assessmentById: ReadonlyMap<RubricCriterionId, RubricAssessment>;
  minimumCoverage: number;
  unavailableReason: string;
}): ComputedScore {
  const maximum = input.definitions.reduce((sum, definition) => sum + definition.weight, 0);
  const assessed = input.definitions.filter(
    (definition) => input.assessmentById.get(definition.id)?.status !== 'unavailable',
  );
  const assessedMaximum = assessed.reduce((sum, definition) => sum + definition.weight, 0);
  const evidenceCoverage = maximum === 0 ? 0 : roundRatio(assessedMaximum / maximum);
  const criteria = input.definitions.map((definition) => {
    const assessment = input.assessmentById.get(definition.id);
    if (!assessment) {
      throw new RubricContractError(`Critère manquant : ${definition.id}`);
    }
    return {
      criterionId: definition.id,
      label: definition.label,
      weight: definition.weight,
      status: assessment.status,
      observation: assessment.observation,
      evidence: assessment.evidence,
    };
  });
  const assessments = input.definitions.map((definition) => input.assessmentById.get(definition.id)!);
  const transparency = {
    evidenceCoverage,
    confidence: confidenceFor(evidenceCoverage),
    criteria,
    observations: assessments.map((assessment) => assessment.observation),
    penalties: assessments.flatMap((assessment) => assessment.penalty ? [assessment.penalty] : []),
    positives: assessments.flatMap((assessment) => assessment.positive ? [assessment.positive] : []),
  };

  if (assessedMaximum === 0 || evidenceCoverage < input.minimumCoverage) {
    return {
      status: 'unavailable',
      reason: input.unavailableReason,
      ...transparency,
    };
  }

  const earned = assessed.reduce((sum, definition) => {
    const assessment = input.assessmentById.get(definition.id);
    return sum + definition.weight * STATUS_FACTOR[assessment?.status ?? 'unavailable'];
  }, 0);

  return {
    status: 'computed',
    value: Math.round((earned / assessedMaximum) * 100),
    ...transparency,
  };
}

function assessmentMap(assessments: readonly RubricAssessment[]) {
  const map = new Map<RubricCriterionId, RubricAssessment>();
  for (const assessment of assessments) {
    if (map.has(assessment.criterionId)) {
      throw new RubricContractError(`Critère dupliqué : ${assessment.criterionId}`);
    }
    map.set(assessment.criterionId, assessment);
  }

  const missing = VIRALYNZ_RUBRIC.filter((criterion) => !map.has(criterion.id));
  if (missing.length > 0) {
    throw new RubricContractError(
      `Critères manquants : ${missing.map((criterion) => criterion.id).join(', ')}`,
    );
  }
  return map;
}

export function computeDeterministicScores(
  assessments: readonly RubricAssessment[],
): DeterministicScores {
  const byId = assessmentMap(assessments);
  const dimensions = Object.fromEntries(SCORE_DIMENSIONS.map((dimension) => {
    const definitions = VIRALYNZ_RUBRIC.filter((criterion) => criterion.dimension === dimension);
    return [dimension, computeScore({
      definitions,
      assessmentById: byId,
      minimumCoverage: MIN_DIMENSION_COVERAGE,
      unavailableReason: `Preuves insuffisantes pour calculer le score ${dimension}.`,
    })];
  })) as Record<ScoreDimension, ComputedScore>;

  const overall = computeScore({
    definitions: VIRALYNZ_RUBRIC,
    assessmentById: byId,
    minimumCoverage: MIN_OVERALL_COVERAGE,
    unavailableReason: 'Couverture de preuves insuffisante pour calculer le score global.',
  });

  return {
    rubricVersion: 'viralynz-rubric-v1',
    ...dimensions,
    overall,
  };
}

function sameScore(left: ComputedScore, right: ComputedScore) {
  if (left.status !== right.status) return false;
  if (left.evidenceCoverage !== right.evidenceCoverage) return false;
  if (left.confidence !== right.confidence) return false;
  if (JSON.stringify(left.criteria) !== JSON.stringify(right.criteria)) return false;
  if (JSON.stringify(left.observations) !== JSON.stringify(right.observations)) return false;
  if (JSON.stringify(left.penalties) !== JSON.stringify(right.penalties)) return false;
  if (JSON.stringify(left.positives) !== JSON.stringify(right.positives)) return false;
  if (left.status === 'computed' && right.status === 'computed') {
    return left.value === right.value;
  }
  return true;
}

export function findScoreMismatches(
  assessments: readonly RubricAssessment[],
  claimedScores: DeterministicScores,
) {
  const expected = computeDeterministicScores(assessments);
  const mismatches: Array<ScoreDimension | 'overall'> = [];
  for (const dimension of SCORE_DIMENSIONS) {
    if (!sameScore(expected[dimension], claimedScores[dimension])) {
      mismatches.push(dimension);
    }
  }
  if (!sameScore(expected.overall, claimedScores.overall)) {
    mismatches.push('overall');
  }
  return { expected, mismatches };
}
