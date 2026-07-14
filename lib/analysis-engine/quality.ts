import type { FinalAnalysisResult, GroundedRecommendation } from './schemas';
import { FinalAnalysisResultSchema } from './schemas';
import { findScoreMismatches } from './rubric';

export type QualityIssueCode =
  | 'schema_invalid'
  | 'duplicate_id'
  | 'timestamp_out_of_bounds'
  | 'timestamp_order'
  | 'timeline_coverage'
  | 'evidence_reference'
  | 'transcript_integrity'
  | 'invalid_display_value'
  | 'unsupported_retention_claim'
  | 'unsupported_metric_claim'
  | 'generic_text'
  | 'recommendation_integrity'
  | 'score_mismatch'
  | 'critique_inconsistent'
  | 'sampling_coverage';

export interface QualityValidationIssue {
  code: QualityIssueCode;
  severity: 'warning' | 'error';
  message: string;
  path?: string;
  targetId?: string;
}

export interface QualityValidationReport {
  status: 'pass' | 'revise' | 'reject';
  validForPersistence: boolean;
  issues: QualityValidationIssue[];
  checkedEvidenceCount: number;
  checkedClaimCount: number;
}

interface ClaimRecord {
  targetId: string;
  text: string;
  evidenceRefs: readonly string[];
}

interface TemporalRange {
  startSec: number;
  endSec: number;
}

interface RecommendationEvidenceCatalog {
  frameIds: ReadonlySet<string>;
  transcriptIds: ReadonlySet<string>;
  transcriptSegments: ReadonlyMap<string, string>;
  audioMetricIds: ReadonlySet<string>;
  visualMetricIds: ReadonlySet<string>;
  measuredMetricIds: ReadonlySet<string>;
  temporalRanges: ReadonlyMap<string, readonly TemporalRange[]>;
}

interface MeasuredSignalLike {
  status: 'measured';
  id: string;
  evidenceRefs: string[];
}

type MetricKind =
  | 'integrated_loudness'
  | 'true_peak'
  | 'mean_volume_db'
  | 'peak_volume_db'
  | 'silence_ratio'
  | 'speech_ratio'
  | 'speaking_rate_wpm'
  | 'average_sentence_length_words'
  | 'word_density_per_second'
  | 'repeated_phrase_count'
  | 'hesitation_count'
  | 'pause_intervals'
  | 'voice_music_balance'
  | 'speech_window_loudness_variation'
  | 'non_speech_loudness'
  | 'average_luma'
  | 'brightness_variation'
  | 'black_frame_ratio'
  | 'freeze_ratio'
  | 'scene_cut_count'
  | 'cuts_per_minute'
  | 'motion_intensity'
  | 'text_coverage_ratio'
  | 'face_presence_ratio'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'average_watch_time_seconds'
  | 'completion_rate'
  | 'engagement_rate'
  | 'retention';

const INVALID_DISPLAY_PATTERN = /(?:\bundefined\b|\bnull\b|\bNaN\b|\[object Object\])/i;

const GENERIC_PHRASES = [
  'améliore le hook',
  'ameliore le hook',
  'le hook est faible',
  'rends la vidéo plus dynamique',
  'rends la video plus dynamique',
  'optimise ton contenu',
  'booste tes performances',
  'ajoute de la valeur',
  'sois plus engageant',
  'poste plus souvent',
  'utilise une ia puissante',
  'analyse avancée',
  'analyse avancee',
  'renforce ton ouverture',
  'renforce le debut',
  'attire davantage l attention',
  'capte l attention',
  'ajoute du dynamisme',
  'raccourcis la video',
  'utilise un cta plus fort',
  'ajoute des sous titres',
  'utilise de la musique tendance',
  'sois plus authentique',
] as const;

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}%\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORMALIZED_GENERIC_PHRASES = GENERIC_PHRASES.map(normalizeText);

export function findGenericPhrases(value: string) {
  const normalized = normalizeText(value);
  return NORMALIZED_GENERIC_PHRASES.filter((phrase) => normalized.includes(phrase));
}

export function containsObservedRetentionClaim(value: string) {
  const normalized = normalizeText(value);
  return [
    /\b(?:la|ta|votre|une) retention (?:chute|baisse|s effondre|decroche)/,
    /\b(?:les|des) (?:spectateurs|viewers|utilisateurs) (?:quittent|partent|abandonnent|decrochent)/,
    /\b(?:perte|perd) (?:de )?\d+(?:[.,]\d+)?\s*%/,
    /\b(?:taux de completion|watch time|duree moyenne de visionnage)\s*(?:est|de|:)?\s*\d/,
    /\bretention\s*(?:est|de|:)?\s*\d+(?:[.,]\d+)?\s*%/,
  ].some((pattern) => pattern.test(normalized));
}

function containsMeasuredMetricClaim(value: string) {
  const normalized = normalizeText(value);
  return [
    /\b\d+(?:[.,]\d+)?\s*(?:%|lufs\b|dbfs\b)/,
    /\b\d+(?:[.,]\d+)?\s*(?:vues?|likes?|commentaires?|partages?|sauvegardes?)\b/,
    /\b\d+(?:[.,]\d+)?\s*coupes?\s+par\s+minute\b/,
    /\b\d+(?:[.,]\d+)?\s*(?:mots?\s+(?:par|\/)\s+(?:minute|seconde|phrase)|repetitions?|hesitations?)\b/,
    /\b(?:watch time|duree moyenne de visionnage|taux de completion|taux d engagement)\s*(?:est|de|:)?\s*\d/,
  ].some((pattern) => pattern.test(normalized));
}

function metricKindsForClaim(value: string): MetricKind[] {
  const normalized = normalizeText(value);
  const matches: MetricKind[] = [];
  const rules: ReadonlyArray<[MetricKind, RegExp]> = [
    ['integrated_loudness', /\b(?:lufs|loudness|volume integre)\b/],
    ['true_peak', /\b(?:true peak|pic audio vrai)\b/],
    ['mean_volume_db', /\b(?:volume moyen|mean volume)\b/],
    ['peak_volume_db', /\b(?:volume maximal|peak volume)\b/],
    ['silence_ratio', /\b(?:silence|silencieux)\b/],
    ['speech_ratio', /\b(?:ratio de parole|densite de parole|temps parle)\b/],
    ['speaking_rate_wpm', /\b(?:debit verbal|mots?\s+(?:par|\/)\s+minute)\b/],
    ['average_sentence_length_words', /\b(?:longueur moyenne (?:des )?phrases?|mots?\s+(?:par|\/)\s+phrase)\b/],
    ['word_density_per_second', /\b(?:densite de mots?|mots?\s+(?:par|\/)\s+seconde)\b/],
    ['repeated_phrase_count', /\b(?:repetitions?|phrases? repetees?)\b/],
    ['hesitation_count', /\b(?:hesitations?|mots? parasites?)\b/],
    ['pause_intervals', /\bpauses?\b/],
    ['voice_music_balance', /\b(?:equilibre voix musique|musique couvre la voix)\b/],
    ['speech_window_loudness_variation', /\b(?:variation de loudness|variation d energie|energie vocale)\b/],
    ['non_speech_loudness', /\b(?:loudness hors parole|niveau hors parole|bruit de fond)\b/],
    ['average_luma', /\b(?:luma|luminosite)\b/],
    ['brightness_variation', /\b(?:variation de luminosite|ecart type yavg)\b/],
    ['black_frame_ratio', /\b(?:frames? noires?|ecran noir)\b/],
    ['freeze_ratio', /\b(?:image figee|freeze)\b/],
    ['scene_cut_count', /\b(?:nombre de coupes?|scene cuts?)\b/],
    ['cuts_per_minute', /\bcoupes?\s+par\s+minute\b/],
    ['motion_intensity', /\b(?:mouvement|motion)\b/],
    ['text_coverage_ratio', /\b(?:couverture du texte|surface de texte)\b/],
    ['face_presence_ratio', /\b(?:presence du visage|visage present)\b/],
    ['views', /\bvues?\b/],
    ['likes', /\blikes?\b/],
    ['comments', /\bcommentaires?\b/],
    ['shares', /\bpartages?\b/],
    ['saves', /\bsauvegardes?\b/],
    ['average_watch_time_seconds', /\b(?:watch time|duree moyenne de visionnage)\b/],
    ['completion_rate', /\btaux de completion\b/],
    ['engagement_rate', /\btaux d engagement\b/],
    ['retention', /\bretention\b/],
  ];
  for (const [kind, pattern] of rules) {
    if (pattern.test(normalized)) matches.push(kind);
  }
  return matches;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMeasuredSignal(value: unknown): value is MeasuredSignalLike {
  if (!isObject(value)) return false;
  return value.status === 'measured'
    && typeof value.id === 'string'
    && Array.isArray(value.evidenceRefs)
    && value.evidenceRefs.every((reference) => typeof reference === 'string');
}

function signalEntries(result: FinalAnalysisResult): MeasuredSignalLike[] {
  const candidates: unknown[] = [
    ...Object.values(result.evidence.audioSignals),
    ...Object.values(result.evidence.visualSignals),
  ];
  return candidates.filter(isMeasuredSignal);
}

function directSections(result: FinalAnalysisResult) {
  return [
    ['hook', result.hook],
    ['script', result.script],
    ['editing', result.editing],
    ['visual', result.visual],
    ['textAndCaptions', result.textAndCaptions],
    ['audio', result.audio],
    ['storytelling', result.storytelling],
    ['conversion', result.conversion],
  ] as const;
}

function groundedRecommendations(result: FinalAnalysisResult) {
  const entries: GroundedRecommendation[] = [];
  for (const [, section] of directSections(result)) {
    if (section.status === 'available') entries.push(...section.recommendations);
  }
  if (result.priorities.status === 'available') {
    for (const recommendation of [
      ...result.priorities.critical,
      ...result.priorities.important,
      ...result.priorities.optimizations,
    ]) {
      entries.push(recommendation);
    }
  }
  if (result.improvedVersion.status === 'available') {
    for (const recommendation of [
      ...result.improvedVersion.hooks,
      ...result.improvedVersion.editPlan,
      ...result.improvedVersion.shotList,
      ...result.improvedVersion.onScreenText,
      ...result.improvedVersion.effectsAndBRoll,
      result.improvedVersion.cta,
      result.improvedVersion.caption,
      result.improvedVersion.firstLine,
    ]) {
      entries.push(recommendation);
    }
  }
  return entries;
}

function generatedObjectIds(result: FinalAnalysisResult) {
  const ids = groundedRecommendations(result).map((recommendation) => recommendation.id);
  if (result.correctionPlan.status === 'available') {
    ids.push(...result.correctionPlan.steps.map((step) => step.id));
  }
  if (result.improvedVersion.status === 'available') {
    ids.push(
      ...result.improvedVersion.fullRewrittenScript.segments.map((segment) => segment.id),
      ...result.improvedVersion.abTests.map((test) => test.id),
    );
  }
  return ids;
}

function displayStrings(result: FinalAnalysisResult) {
  const values: Array<{ path: string; value: string }> = [];

  if (result.strategicSummary.status === 'available') {
    values.push(
      { path: 'strategicSummary.diagnosis', value: result.strategicSummary.diagnosis },
      { path: 'strategicSummary.firstDecision', value: result.strategicSummary.firstDecision },
      { path: 'strategicSummary.whyNow', value: result.strategicSummary.whyNow },
    );
  } else {
    values.push({ path: 'strategicSummary.reason', value: result.strategicSummary.reason });
  }
  result.strategicSummary.limitations.forEach((value, index) => values.push({
    path: `strategicSummary.limitations.${index}`,
    value,
  }));

  for (const [name, section] of directSections(result)) {
    if (section.status === 'available') {
      values.push({ path: `${name}.summary`, value: section.summary });
      section.strengths.forEach((value, index) => values.push({ path: `${name}.strengths.${index}`, value }));
      section.problems.forEach((value, index) => values.push({ path: `${name}.problems.${index}`, value }));
    } else {
      values.push({ path: `${name}.reason`, value: section.reason });
    }
    section.limitations.forEach((value, index) => values.push({ path: `${name}.limitations.${index}`, value }));
    section.criteria.forEach((criterion, index) => values.push({
      path: `${name}.criteria.${index}.note`,
      value: criterion.note,
    }));
  }

  for (const diagnostic of result.specialists) {
    values.push({ path: `specialists.${diagnostic.id}.summary`, value: diagnostic.summary });
    diagnostic.limitations.forEach((value, index) => values.push({
      path: `specialists.${diagnostic.id}.limitations.${index}`,
      value,
    }));
    for (const finding of diagnostic.findings) {
      values.push(
        { path: `findings.${finding.id}.claim`, value: finding.claim },
        { path: `findings.${finding.id}.implication`, value: finding.implication },
        { path: `findings.${finding.id}.decision`, value: finding.decision },
      );
    }
  }

  for (const segment of result.timeline) {
    values.push(
      { path: `timeline.${segment.id}.observation`, value: segment.observation },
      { path: `timeline.${segment.id}.diagnostic`, value: segment.diagnostic },
      { path: `timeline.${segment.id}.action`, value: segment.action },
      { path: `timeline.${segment.id}.objectiveFit`, value: segment.objectiveFit },
      { path: `timeline.${segment.id}.example`, value: segment.example },
      { path: `timeline.${segment.id}.recommendedAction`, value: segment.recommendedAction },
    );
    segment.strengths.forEach((value, index) => values.push({ path: `timeline.${segment.id}.strengths.${index}`, value }));
    segment.problems.forEach((value, index) => values.push({ path: `timeline.${segment.id}.problems.${index}`, value }));
    for (const [name, observation] of [
      ['transcript', segment.transcript],
      ['visualObservation', segment.visualObservation],
      ['audioObservation', segment.audioObservation],
      ['editingObservation', segment.editingObservation],
    ] as const) {
      values.push({
        path: `timeline.${segment.id}.${name}`,
        value: observation.status === 'available' ? observation.text : observation.reason,
      });
    }
  }

  for (const recommendation of groundedRecommendations(result)) {
    values.push({ path: `recommendations.${recommendation.id}.observation`, value: recommendation.observation });
    values.push({ path: `recommendations.${recommendation.id}.text`, value: recommendation.text });
    values.push({ path: `recommendations.${recommendation.id}.why`, value: recommendation.why });
    values.push({ path: `recommendations.${recommendation.id}.objectiveFit`, value: recommendation.objectiveFit });
    values.push({ path: `recommendations.${recommendation.id}.example`, value: recommendation.example });
    values.push({
      path: `recommendations.${recommendation.id}.transcriptCitation`,
      value: recommendation.transcriptCitation.status === 'available'
        ? recommendation.transcriptCitation.quote
        : recommendation.transcriptCitation.reason,
    });
  }
  if (result.correctionPlan.status === 'available') {
    for (const step of result.correctionPlan.steps) {
      values.push({ path: `correctionPlan.${step.id}.action`, value: step.action });
      values.push({ path: `correctionPlan.${step.id}.observation`, value: step.observation });
      values.push({ path: `correctionPlan.${step.id}.rationale`, value: step.rationale });
      values.push({ path: `correctionPlan.${step.id}.objectiveFit`, value: step.objectiveFit });
      values.push({ path: `correctionPlan.${step.id}.example`, value: step.example });
    }
  }
  if (result.improvedVersion.status === 'available') {
    values.push({ path: 'improvedVersion.bestHook.why', value: result.improvedVersion.bestHook.why });
    values.push({ path: 'improvedVersion.fullRewrittenScript.fullText', value: result.improvedVersion.fullRewrittenScript.fullText });
    result.improvedVersion.fullRewrittenScript.segments.forEach((segment) => values.push({
      path: `improvedVersion.fullRewrittenScript.${segment.id}`,
      value: segment.text,
    }));
    result.improvedVersion.abTests.forEach((test) => values.push(
      { path: `improvedVersion.abTests.${test.id}.versionA`, value: test.versionA },
      { path: `improvedVersion.abTests.${test.id}.versionB`, value: test.versionB },
      { path: `improvedVersion.abTests.${test.id}.successCriterion`, value: test.successCriterion },
    ));
  }
  for (const [name, container] of [
    ['priorities', result.priorities],
    ['correctionPlan', result.correctionPlan],
    ['improvedVersion', result.improvedVersion],
  ] as const) {
    if (container.status === 'unavailable') {
      values.push({ path: `${name}.reason`, value: container.reason });
    }
    container.limitations.forEach((value, index) => values.push({
      path: `${name}.limitations.${index}`,
      value,
    }));
  }

  result.critique.issues.forEach((issue) => values.push({
    path: `critique.issues.${issue.id}`,
    value: issue.message,
  }));
  result.critique.contradictionsResolved.forEach((value, index) => values.push({
    path: `critique.contradictionsResolved.${index}`,
    value,
  }));
  result.critique.limitations.forEach((value, index) => values.push({
    path: `critique.limitations.${index}`,
    value,
  }));

  result.rubric.assessments.forEach((assessment) => {
    values.push({ path: `rubric.${assessment.criterionId}.observation`, value: assessment.observation });
    if (assessment.positive) values.push({ path: `rubric.${assessment.criterionId}.positive`, value: assessment.positive });
    if (assessment.penalty) values.push({ path: `rubric.${assessment.criterionId}.penalty`, value: assessment.penalty });
  });

  return values;
}

function claimRecords(result: FinalAnalysisResult): ClaimRecord[] {
  const records: ClaimRecord[] = [];
  if (result.strategicSummary.status === 'available') {
    records.push({
      targetId: result.analysisId,
      text: `${result.strategicSummary.diagnosis} ${result.strategicSummary.firstDecision} ${result.strategicSummary.whyNow}`,
      evidenceRefs: result.strategicSummary.evidence,
    });
  }

  for (const [name, section] of directSections(result)) {
    if (section.status === 'available') {
      records.push({
        targetId: `section:${name}`,
        text: [section.summary, ...section.strengths, ...section.problems].join(' '),
        evidenceRefs: section.evidence,
      });
    }
    section.criteria.forEach((criterion) => records.push({
      targetId: criterion.criterionId,
      text: criterion.note,
      evidenceRefs: criterion.evidence,
    }));
  }

  for (const diagnostic of result.specialists) {
    records.push({
      targetId: diagnostic.id,
      text: diagnostic.summary,
      evidenceRefs: Array.from(new Set(diagnostic.findings.flatMap((finding) => finding.evidenceRefs))),
    });
    for (const finding of diagnostic.findings) {
      records.push({
        targetId: finding.id,
        text: `${finding.claim} ${finding.implication} ${finding.decision}`,
        evidenceRefs: finding.evidenceRefs,
      });
    }
  }

  for (const segment of result.timeline) {
    const observationEvidence = [
      segment.transcript,
      segment.visualObservation,
      segment.audioObservation,
      segment.editingObservation,
    ].flatMap((observation) => observation.status === 'available' ? observation.evidence : []);
    records.push({
      targetId: segment.id,
      text: [
        segment.observation,
        segment.diagnostic,
        segment.action,
        segment.objectiveFit,
        segment.example,
        segment.recommendedAction,
        ...segment.strengths,
        ...segment.problems,
      ].join(' '),
      evidenceRefs: [...segment.evidence, ...observationEvidence],
    });
  }

  for (const recommendation of groundedRecommendations(result)) {
    records.push({
      targetId: recommendation.id,
      text: `${recommendation.observation} ${recommendation.why} ${recommendation.objectiveFit} ${recommendation.text} ${recommendation.example}`,
      evidenceRefs: recommendation.evidence,
    });
  }
  if (result.correctionPlan.status === 'available') {
    result.correctionPlan.steps.forEach((step) => records.push({
      targetId: step.id,
      text: `${step.observation} ${step.rationale} ${step.objectiveFit} ${step.action} ${step.example}`,
      evidenceRefs: step.evidence,
    }));
  }
  const improvedVersion = result.improvedVersion;
  if (improvedVersion.status === 'available') {
    const selectedHook = improvedVersion.hooks.find((hook) => (
      hook.id === improvedVersion.bestHook.hookId
    ));
    records.push({
      targetId: 'improvedVersion.bestHook',
      text: `${selectedHook?.text ?? ''} ${improvedVersion.bestHook.why}`,
      evidenceRefs: improvedVersion.bestHook.evidence,
    });
    improvedVersion.abTests.forEach((test) => records.push({
      targetId: test.id,
      text: `${test.versionA} ${test.versionB} ${test.successCriterion}`,
      evidenceRefs: test.evidence,
    }));
  }

  return records;
}

function addDuplicateIssues(ids: readonly string[], issues: QualityValidationIssue[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      issues.push({
        code: 'duplicate_id',
        severity: 'error',
        targetId: id,
        message: `Identifiant dupliqué : ${id}.`,
      });
    }
    seen.add(id);
  }
}

function checkRange(input: {
  startSec: number;
  endSec: number;
  durationSec: number;
  path: string;
  targetId?: string;
  issues: QualityValidationIssue[];
}) {
  const tolerance = 0.075;
  if (input.startSec < 0 || input.endSec < input.startSec || input.endSec > input.durationSec + tolerance) {
    input.issues.push({
      code: 'timestamp_out_of_bounds',
      severity: 'error',
      path: input.path,
      targetId: input.targetId,
      message: `Timecode ${input.startSec}-${input.endSec}s hors de la durée ${input.durationSec}s.`,
    });
  }
}

function checkOrdered(
  items: readonly { startSec: number }[],
  path: string,
  issues: QualityValidationIssue[],
) {
  for (let index = 1; index < items.length; index += 1) {
    if (items[index].startSec < items[index - 1].startSec) {
      issues.push({
        code: 'timestamp_order',
        severity: 'error',
        path,
        message: 'Les timecodes ne sont pas triés dans l’ordre chronologique.',
      });
      return;
    }
  }
}

function collectEvidence(result: FinalAnalysisResult) {
  const evidenceIds: string[] = result.evidence.frames.map((frame) => frame.id);
  const metricIds = new Set<string>();
  const metricIdsByKind = new Map<MetricKind, Set<string>>();
  const frameIds = new Set(result.evidence.frames.map((frame) => frame.id));
  const transcriptIds = new Set<string>();
  const transcriptSegments = new Map<string, string>();
  const audioMetricIds = new Set<string>();
  const visualMetricIds = new Set<string>();
  const measuredMetricIds = new Set<string>();
  const temporalRanges = new Map<string, TemporalRange[]>();
  const addTemporalRange = (id: string, range: TemporalRange) => {
    const ranges = temporalRanges.get(id) ?? [];
    ranges.push(range);
    temporalRanges.set(id, ranges);
  };
  result.evidence.frames.forEach((frame) => addTemporalRange(frame.id, {
    startSec: frame.timestampSec,
    endSec: frame.timestampSec,
  }));
  const addMetric = (kind: MetricKind, id: string) => {
    metricIds.add(id);
    measuredMetricIds.add(id);
    const ids = metricIdsByKind.get(kind) ?? new Set<string>();
    ids.add(id);
    metricIdsByKind.set(kind, ids);
  };

  if (result.evidence.transcription.status === 'available') {
    for (const segment of result.evidence.transcription.normalized.segments) {
      evidenceIds.push(segment.id);
      transcriptIds.add(segment.id);
      transcriptSegments.set(segment.id, segment.text);
      addTemporalRange(segment.id, { startSec: segment.startSec, endSec: segment.endSec });
    }
    for (const word of result.evidence.transcription.normalized.words) {
      evidenceIds.push(word.id);
      transcriptIds.add(word.id);
      addTemporalRange(word.id, { startSec: word.startSec, endSec: word.endSec });
    }
  }

  const audioSignals = Object.values(result.evidence.audioSignals)
    .flatMap<MeasuredSignalLike>((value) => isMeasuredSignal(value) ? [value] : []);
  const visualSignals = Object.values(result.evidence.visualSignals)
    .flatMap<MeasuredSignalLike>((value) => isMeasuredSignal(value) ? [value] : []);
  for (const signal of [...audioSignals, ...visualSignals]) {
    evidenceIds.push(signal.id);
    metricIds.add(signal.id);
    measuredMetricIds.add(signal.id);
    const referencedRanges = signal.evidenceRefs.flatMap((reference) => temporalRanges.get(reference) ?? []);
    for (const range of referencedRanges) addTemporalRange(signal.id, range);
  }
  audioSignals.forEach((signal) => audioMetricIds.add(signal.id));
  visualSignals.forEach((signal) => visualMetricIds.add(signal.id));
  const signalKinds: ReadonlyArray<[MetricKind, unknown]> = [
    ['integrated_loudness', result.evidence.audioSignals.integratedLoudness],
    ['true_peak', result.evidence.audioSignals.truePeak],
    ['mean_volume_db', result.evidence.audioSignals.meanVolumeDb],
    ['peak_volume_db', result.evidence.audioSignals.peakVolumeDb],
    ['silence_ratio', result.evidence.audioSignals.silenceRatio],
    ['speech_ratio', result.evidence.audioSignals.speechRatio],
    ['speaking_rate_wpm', result.evidence.audioSignals.speakingRateWpm],
    ['average_sentence_length_words', result.evidence.audioSignals.averageSentenceLengthWords],
    ['word_density_per_second', result.evidence.audioSignals.wordDensityPerSecond],
    ['repeated_phrase_count', result.evidence.audioSignals.repeatedPhraseCount],
    ['hesitation_count', result.evidence.audioSignals.hesitationCount],
    ['pause_intervals', result.evidence.audioSignals.pauseIntervals],
    ['voice_music_balance', result.evidence.audioSignals.voiceMusicBalance],
    ['speech_window_loudness_variation', result.evidence.audioSignals.speechWindowLoudnessVariation],
    ['non_speech_loudness', result.evidence.audioSignals.nonSpeechLoudness],
    ['average_luma', result.evidence.visualSignals.averageLuma],
    ['brightness_variation', result.evidence.visualSignals.brightnessVariation],
    ['black_frame_ratio', result.evidence.visualSignals.blackFrameRatio],
    ['freeze_ratio', result.evidence.visualSignals.freezeRatio],
    ['scene_cut_count', result.evidence.visualSignals.sceneCutCount],
    ['cuts_per_minute', result.evidence.visualSignals.cutsPerMinute],
    ['motion_intensity', result.evidence.visualSignals.motionIntensity],
    ['text_coverage_ratio', result.evidence.visualSignals.textCoverageRatio],
    ['face_presence_ratio', result.evidence.visualSignals.facePresenceRatio],
  ];
  for (const [kind, signal] of signalKinds) {
    if (isMeasuredSignal(signal)) addMetric(kind, signal.id);
  }
  if (result.evidence.audioSignals.pauseIntervals.status === 'measured') {
    for (const pause of result.evidence.audioSignals.pauseIntervals.value) {
      evidenceIds.push(pause.id);
      audioMetricIds.add(pause.id);
      measuredMetricIds.add(pause.id);
      addTemporalRange(pause.id, { startSec: pause.startSec, endSec: pause.endSec });
    }
  }
  if (result.evidence.observedMetrics.status === 'available') {
    for (const metric of result.evidence.observedMetrics.metrics) {
      evidenceIds.push(metric.id);
      addMetric(metric.key, metric.id);
    }
  }

  const retentionIds = new Set<string>();
  if (result.evidence.retention.status === 'available') {
    for (const point of result.evidence.retention.points) {
      evidenceIds.push(point.id);
      addMetric('retention', point.id);
      retentionIds.add(point.id);
      addTemporalRange(point.id, { startSec: point.timestampSec, endSec: point.timestampSec });
    }
  }

  return {
    evidenceIds,
    evidenceSet: new Set(evidenceIds),
    metricIds,
    metricIdsByKind,
    retentionIds,
    recommendationCatalog: {
      frameIds,
      transcriptIds,
      transcriptSegments,
      audioMetricIds,
      visualMetricIds,
      measuredMetricIds,
      temporalRanges,
    } satisfies RecommendationEvidenceCatalog,
  };
}

function validateReferences(
  result: FinalAnalysisResult,
  evidenceSet: ReadonlySet<string>,
  issues: QualityValidationIssue[],
) {
  const references: Array<{ targetId: string; values: readonly string[] }> = [];
  if (result.strategicSummary.status === 'available') {
    references.push({ targetId: result.analysisId, values: result.strategicSummary.evidence });
  }
  for (const [name, section] of directSections(result)) {
    if (section.status === 'available') {
      references.push({ targetId: `section:${name}`, values: section.evidence });
    }
    section.criteria.forEach((criterion) => references.push({
      targetId: criterion.criterionId,
      values: criterion.evidence,
    }));
  }

  for (const signal of signalEntries(result)) {
    references.push({ targetId: signal.id, values: signal.evidenceRefs });
  }
  for (const diagnostic of result.specialists) {
    diagnostic.findings.forEach((finding) => references.push({
      targetId: finding.id,
      values: finding.evidenceRefs,
    }));
  }
  result.timeline.forEach((segment) => references.push({
    targetId: segment.id,
    values: segment.evidence,
  }));
  for (const segment of result.timeline) {
    for (const observation of [
      segment.transcript,
      segment.visualObservation,
      segment.audioObservation,
      segment.editingObservation,
    ]) {
      if (observation.status === 'available') {
        references.push({ targetId: segment.id, values: observation.evidence });
      }
    }
  }
  groundedRecommendations(result).forEach((recommendation) => references.push({
    targetId: recommendation.id,
    values: recommendation.evidence,
  }));
  if (result.correctionPlan.status === 'available') {
    result.correctionPlan.steps.forEach((step) => references.push({
      targetId: step.id,
      values: step.evidence,
    }));
  }
  if (result.improvedVersion.status === 'available') {
    references.push({
      targetId: 'improvedVersion.bestHook',
      values: result.improvedVersion.bestHook.evidence,
    });
    result.improvedVersion.abTests.forEach((test) => references.push({
      targetId: test.id,
      values: test.evidence,
    }));
  }
  result.rubric.assessments.forEach((assessment) => references.push({
    targetId: assessment.criterionId,
    values: assessment.evidence,
  }));

  for (const reference of references) {
    for (const value of reference.values) {
      if (!evidenceSet.has(value)) {
        issues.push({
          code: 'evidence_reference',
          severity: 'error',
          targetId: reference.targetId,
          message: `La preuve ${value} n’existe pas dans le catalogue de l’analyse.`,
        });
      }
    }
  }
}

function validateTranscript(
  result: FinalAnalysisResult,
  issues: QualityValidationIssue[],
) {
  const transcription = result.evidence.transcription;
  if (transcription.status !== 'available') return;

  const { segments, words, text } = transcription.normalized;
  const segmentIds = new Set(segments.map((segment) => segment.id));
  const wordIds = new Set(words.map((word) => word.id));
  addDuplicateIssues([...segmentIds, ...wordIds], issues);

  if (text.trim() && transcription.timingPrecision === 'word' && words.length === 0) {
    issues.push({
      code: 'transcript_integrity',
      severity: 'error',
      path: 'evidence.transcription.normalized.words',
      message: 'La précision mot est annoncée sans aucun mot horodaté.',
    });
  }
  if (text.trim() && transcription.timingPrecision !== 'none' && segments.length === 0) {
    issues.push({
      code: 'transcript_integrity',
      severity: 'error',
      path: 'evidence.transcription.normalized.segments',
      message: 'Le transcript contient du texte sans segment horodaté.',
    });
  }

  for (const segment of segments) {
    for (const wordId of segment.wordIds) {
      if (!wordIds.has(wordId)) {
        issues.push({
          code: 'transcript_integrity',
          severity: 'error',
          targetId: segment.id,
          message: `Le mot ${wordId} référencé par le segment n’existe pas.`,
        });
      }
    }
  }

  for (const word of words) {
    if (!segmentIds.has(word.segmentId)) {
      issues.push({
        code: 'transcript_integrity',
        severity: 'error',
        targetId: word.id,
        message: `Le segment ${word.segmentId} du mot n’existe pas.`,
      });
    }
  }

  checkOrdered(segments, 'evidence.transcription.normalized.segments', issues);
  checkOrdered(words, 'evidence.transcription.normalized.words', issues);
}

function validateTimestamps(
  result: FinalAnalysisResult,
  issues: QualityValidationIssue[],
) {
  const durationSec = result.video.durationSec;
  for (const frame of result.evidence.frames) {
    checkRange({
      startSec: frame.timestampSec,
      endSec: frame.timestampSec,
      durationSec,
      path: `evidence.frames.${frame.id}.timestampSec`,
      targetId: frame.id,
      issues,
    });
  }

  const transcription = result.evidence.transcription;
  if (transcription.status === 'available') {
    for (const segment of transcription.normalized.segments) {
      checkRange({ ...segment, durationSec, path: `transcript.segments.${segment.id}`, targetId: segment.id, issues });
    }
    for (const word of transcription.normalized.words) {
      checkRange({ ...word, durationSec, path: `transcript.words.${word.id}`, targetId: word.id, issues });
    }
  }

  if (result.evidence.audioSignals.pauseIntervals.status === 'measured') {
    for (const pause of result.evidence.audioSignals.pauseIntervals.value) {
      checkRange({ ...pause, durationSec, path: `audio.pauseIntervals.${pause.id}`, targetId: pause.id, issues });
    }
    checkOrdered(result.evidence.audioSignals.pauseIntervals.value, 'audio.pauseIntervals', issues);
  }

  if (result.evidence.retention.status === 'available') {
    for (const point of result.evidence.retention.points) {
      checkRange({
        startSec: point.timestampSec,
        endSec: point.timestampSec,
        durationSec,
        path: `retention.points.${point.id}`,
        targetId: point.id,
        issues,
      });
    }
    checkOrdered(
      result.evidence.retention.points.map((point) => ({ startSec: point.timestampSec })),
      'retention.points',
      issues,
    );
  }

  for (const diagnostic of result.specialists) {
    for (const finding of diagnostic.findings) {
      if (finding.timeRange) {
        checkRange({ ...finding.timeRange, durationSec, path: `findings.${finding.id}.timeRange`, targetId: finding.id, issues });
      }
    }
  }
  for (const segment of result.timeline) {
    checkRange({
      startSec: segment.startTime,
      endSec: segment.endTime,
      durationSec,
      path: `timeline.${segment.id}`,
      targetId: segment.id,
      issues,
    });
  }
  for (const [name, section] of directSections(result)) {
    section.criteria.forEach((criterion, index) => {
      if (!criterion.timeRange) return;
      checkRange({
        ...criterion.timeRange,
        durationSec,
        path: `${name}.criteria.${index}.timeRange`,
        targetId: criterion.criterionId,
        issues,
      });
    });
  }
  for (const recommendation of groundedRecommendations(result)) {
    checkRange({
      ...recommendation.timeRange,
      durationSec,
      path: `recommendations.${recommendation.id}.timeRange`,
      targetId: recommendation.id,
      issues,
    });
  }
  if (result.correctionPlan.status === 'available') {
    for (const step of result.correctionPlan.steps) {
      checkRange({
        ...step.timeRange,
        durationSec,
        path: `correctionPlan.${step.id}.timeRange`,
        targetId: step.id,
        issues,
      });
    }
  }
}

interface ActionableRecommendationLike {
  id: string;
  timeRange: TemporalRange;
  observation: string;
  why: string;
  objective: FinalAnalysisResult['creatorContext']['objective'];
  objectiveFit: string;
  text: string;
  example: string;
  supportingSourceIds: readonly string[];
  transcriptCitation: GroundedRecommendation['transcriptCitation'];
  nature: GroundedRecommendation['nature'];
  evidence: readonly string[];
}

function recommendationCategoryCount(
  recommendation: ActionableRecommendationLike,
  catalog: RecommendationEvidenceCatalog,
): number {
  const categories = new Set<string>();
  if (recommendation.evidence.some((id) => catalog.frameIds.has(id))) categories.add('visual');
  if (recommendation.evidence.some((id) => catalog.transcriptIds.has(id))) categories.add('transcript');
  if (recommendation.evidence.some((id) => catalog.audioMetricIds.has(id))) categories.add('audio');
  if (recommendation.evidence.some((id) => catalog.visualMetricIds.has(id))) categories.add('visual');
  if (recommendation.evidence.some((id) => catalog.measuredMetricIds.has(id))) categories.add('measured');
  return categories.size;
}

function recommendationNatureMatchesEvidence(
  recommendation: ActionableRecommendationLike,
  catalog: RecommendationEvidenceCatalog,
): boolean {
  switch (recommendation.nature) {
    case 'measured_data':
      return recommendation.evidence.some((id) => catalog.measuredMetricIds.has(id));
    case 'visual_observation':
      return recommendation.evidence.some((id) => catalog.frameIds.has(id) || catalog.visualMetricIds.has(id));
    case 'audio_observation':
      return recommendation.evidence.some((id) => catalog.audioMetricIds.has(id));
    case 'transcript_observation':
      return recommendation.evidence.some((id) => catalog.transcriptIds.has(id));
    case 'mixed':
      return recommendationCategoryCount(recommendation, catalog) >= 2;
    case 'editorial_inference':
      return recommendation.evidence.length > 0;
  }
}

function recommendationHasTemporalEvidence(
  recommendation: ActionableRecommendationLike,
  catalog: RecommendationEvidenceCatalog,
): boolean {
  const tolerance = 0.075;
  return recommendation.evidence.some((id) => (
    catalog.temporalRanges.get(id) ?? []
  ).some((range) => (
    range.endSec >= recommendation.timeRange.startSec - tolerance
    && range.startSec <= recommendation.timeRange.endSec + tolerance
  )));
}

const SUPPORT_STOP_WORDS = new Set([
  'avec', 'cette', 'dans', 'depuis', 'elle', 'entre', 'pour', 'plus', 'sans', 'sont',
  'tout', 'toute', 'vers', 'video', 'frame', 'segment', 'debut', 'actuel', 'actuelle',
]);

function supportTokens(value: string): Set<string> {
  return new Set(normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !SUPPORT_STOP_WORDS.has(token)));
}

function validateRecommendationSupport(
  recommendation: ActionableRecommendationLike,
  result: FinalAnalysisResult,
): boolean {
  const sources = new Map<string, { text: string; evidence: readonly string[] }>();
  for (const diagnostic of result.specialists) {
    for (const finding of diagnostic.findings) {
      sources.set(finding.id, {
        text: `${finding.claim} ${finding.implication}`,
        evidence: finding.evidenceRefs,
      });
    }
  }
  for (const segment of result.timeline) {
    sources.set(segment.id, {
      text: `${segment.observation} ${segment.diagnostic} ${segment.problems.join(' ')}`,
      evidence: segment.evidence,
    });
  }

  const observationTokens = supportTokens(recommendation.observation);
  return recommendation.supportingSourceIds.some((sourceId) => {
    const source = sources.get(sourceId);
    if (!source) return false;
    const evidenceOverlap = recommendation.evidence.some((id) => source.evidence.includes(id));
    const sourceTokens = supportTokens(source.text);
    const semanticOverlap = [...observationTokens].filter((token) => sourceTokens.has(token)).length >= 2;
    return evidenceOverlap && semanticOverlap;
  });
}

function validateRecommendationIntegrity(
  result: FinalAnalysisResult,
  catalog: RecommendationEvidenceCatalog,
  issues: QualityValidationIssue[],
) {
  const recommendations: ActionableRecommendationLike[] = [...groundedRecommendations(result)];
  const improvedVersion = result.improvedVersion;
  if (improvedVersion.status === 'available') {
    const selectedHook = improvedVersion.hooks.find((hook) => (
      hook.id === improvedVersion.bestHook.hookId
    ));
    if (
      !selectedHook
      || improvedVersion.bestHook.evidence.some((id) => !selectedHook.evidence.includes(id))
    ) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: 'improvedVersion.bestHook',
        message: 'Le meilleur hook doit désigner l’une des trois variantes et reprendre uniquement ses preuves.',
      });
    }
  }
  if (result.correctionPlan.status === 'available') {
    recommendations.push(...result.correctionPlan.steps.map((step) => ({
      id: step.id,
      timeRange: step.timeRange,
      observation: step.observation,
      why: step.rationale,
      objective: step.objective,
      objectiveFit: step.objectiveFit,
      text: step.action,
      example: step.example,
      supportingSourceIds: step.supportingSourceIds,
      transcriptCitation: step.transcriptCitation,
      nature: step.nature,
      evidence: step.evidence,
    })));
  }

  const fingerprints = new Map<string, string>();
  for (const recommendation of recommendations) {
    if (recommendation.objective !== result.creatorContext.objective) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: `La recommandation vise ${recommendation.objective} au lieu de l’objectif ${result.creatorContext.objective}.`,
      });
    }
    if (!recommendationNatureMatchesEvidence(recommendation, catalog)) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: `La nature ${recommendation.nature} ne correspond pas aux preuves citées.`,
      });
    }
    if (!recommendationHasTemporalEvidence(recommendation, catalog)) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: 'La plage temporelle ne recoupe aucune preuve temporelle citée.',
      });
    }
    if (!validateRecommendationSupport(recommendation, result)) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: 'La recommandation ne recoupe aucun constat spécialiste ou segment de timeline compatible.',
      });
    }

    if (recommendation.transcriptCitation.status === 'available') {
      const source = catalog.transcriptSegments.get(recommendation.transcriptCitation.segmentId);
      const quote = normalizeText(recommendation.transcriptCitation.quote);
      if (
        !source
        || !recommendation.evidence.includes(recommendation.transcriptCitation.segmentId)
        || quote.length === 0
        || !normalizeText(source).includes(quote)
      ) {
        issues.push({
          code: 'recommendation_integrity',
          severity: 'error',
          targetId: recommendation.id,
          message: 'La citation transcript n’est pas une citation exacte d’un segment cité.',
        });
      }
    } else if (
      recommendation.nature === 'transcript_observation'
      || recommendation.evidence.some((id) => catalog.transcriptIds.has(id))
    ) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: 'Une recommandation fondée sur le transcript doit citer le passage exact.',
      });
    }

    if (normalizeText(recommendation.text) === normalizeText(recommendation.example)) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: 'L’exemple doit concrétiser l’action, pas la répéter mot pour mot.',
      });
    }
    const generic = findGenericPhrases([
      recommendation.observation,
      recommendation.why,
      recommendation.objectiveFit,
      recommendation.text,
      recommendation.example,
    ].join(' '));
    if (generic.length > 0) {
      issues.push({
        code: 'generic_text',
        severity: 'error',
        targetId: recommendation.id,
        message: `Recommandation générique détectée : « ${generic.join(' », « ')} ».`,
      });
    }

    const fingerprint = normalizeText(`${recommendation.observation}|${recommendation.text}|${recommendation.example}`);
    const previous = fingerprints.get(fingerprint);
    if (previous && previous !== recommendation.id) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: recommendation.id,
        message: `Recommandation dupliquée avec ${previous}.`,
      });
    } else {
      fingerprints.set(fingerprint, recommendation.id);
    }
  }

  for (const segment of result.timeline) {
    if (segment.objective !== result.creatorContext.objective) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: segment.id,
        message: 'L’action timeline ne vise pas l’objectif choisi pour l’analyse.',
      });
    }
    if (segment.transcriptCitation.status === 'available') {
      const source = catalog.transcriptSegments.get(segment.transcriptCitation.segmentId);
      if (
        !source
        || !segment.evidence.includes(segment.transcriptCitation.segmentId)
        || !normalizeText(source).includes(normalizeText(segment.transcriptCitation.quote))
      ) {
        issues.push({
          code: 'recommendation_integrity',
          severity: 'error',
          targetId: segment.id,
          message: 'La citation de l’action timeline ne correspond pas au transcript cité.',
        });
      }
    } else if (segment.evidence.some((id) => catalog.transcriptIds.has(id))) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: segment.id,
        message: 'Une action timeline fondée sur le transcript doit citer le passage exact.',
      });
    }
    if (normalizeText(segment.recommendedAction) === normalizeText(segment.example)) {
      issues.push({
        code: 'recommendation_integrity',
        severity: 'error',
        targetId: segment.id,
        message: 'L’exemple timeline doit concrétiser la recommandation sans la répéter.',
      });
    }
    const generic = findGenericPhrases([
      segment.observation,
      segment.diagnostic,
      segment.objectiveFit,
      segment.action,
      segment.recommendedAction,
      segment.example,
    ].join(' '));
    if (generic.length > 0) {
      issues.push({
        code: 'generic_text',
        severity: 'error',
        targetId: segment.id,
        message: `Action timeline générique détectée : « ${generic.join(' », « ')} ».`,
      });
    }
  }
}

function validateTimeline(
  result: FinalAnalysisResult,
  issues: QualityValidationIssue[],
) {
  const tolerance = 0.075;
  const timeline = result.timeline;
  checkOrdered(timeline.map((segment) => ({ startSec: segment.startTime })), 'timeline', issues);

  if (timeline[0].startTime > tolerance) {
    issues.push({
      code: 'timeline_coverage',
      severity: 'error',
      path: 'timeline.0.startTime',
      message: 'La timeline ne couvre pas le début de la vidéo.',
    });
  }
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1];
    const current = timeline[index];
    const delta = current.startTime - previous.endTime;
    if (delta > tolerance) {
      issues.push({
        code: 'timeline_coverage',
        severity: 'error',
        targetId: current.id,
        message: `Trou de ${delta.toFixed(3)}s dans la timeline avant ${current.id}.`,
      });
    } else if (delta < -tolerance) {
      issues.push({
        code: 'timeline_coverage',
        severity: 'error',
        targetId: current.id,
        message: `Chevauchement de ${Math.abs(delta).toFixed(3)}s dans la timeline avant ${current.id}.`,
      });
    }
  }
  const last = timeline[timeline.length - 1];
  if (last.endTime < result.video.durationSec - tolerance) {
    issues.push({
      code: 'timeline_coverage',
      severity: 'error',
      targetId: last.id,
      message: 'La timeline ne couvre pas la fin de la vidéo.',
    });
  }

  const frameTimes = result.evidence.frames.map((frame) => frame.timestampSec).sort((left, right) => left - right);
  const firstFrame = frameTimes[0];
  const lastFrame = frameTimes[frameTimes.length - 1];
  if (firstFrame > 0.5) {
    issues.push({
      code: 'sampling_coverage',
      severity: 'warning',
      message: `La première preuve visuelle arrive à ${firstFrame}s.`,
    });
  }
  const endingTolerance = Math.max(0.5, result.video.durationSec * 0.05);
  if (lastFrame < result.video.durationSec - endingTolerance) {
    issues.push({
      code: 'sampling_coverage',
      severity: 'warning',
      message: `La dernière preuve visuelle (${lastFrame}s) ne couvre pas la fin de la vidéo.`,
    });
  }
}

function validateClaims(
  result: FinalAnalysisResult,
  metricIds: ReadonlySet<string>,
  metricIdsByKind: ReadonlyMap<MetricKind, ReadonlySet<string>>,
  retentionIds: ReadonlySet<string>,
  issues: QualityValidationIssue[],
) {
  const records = claimRecords(result);
  for (const record of records) {
    const generic = findGenericPhrases(record.text);
    if (generic.length > 0) {
      issues.push({
        code: 'generic_text',
        severity: 'warning',
        targetId: record.targetId,
        message: `Texte générique détecté : « ${generic.join(' », « ')} ».`,
      });
    }

    if (containsObservedRetentionClaim(record.text)) {
      const retentionAvailable = result.evidence.retention.status === 'available';
      const retentionReferenced = record.evidenceRefs.some((reference) => retentionIds.has(reference));
      if (!retentionAvailable || !retentionReferenced) {
        issues.push({
          code: 'unsupported_retention_claim',
          severity: 'error',
          targetId: record.targetId,
          message: 'Affirmation de rétention réelle sans courbe plateforme horodatée et citée.',
        });
      }
    }

    if (containsMeasuredMetricClaim(record.text)) {
      const kinds = metricKindsForClaim(record.text);
      const acceptableIds = kinds.length > 0
        ? new Set(kinds.flatMap((kind) => Array.from(metricIdsByKind.get(kind) ?? [])))
        : new Set<string>();
      const hasCorrespondingReference = record.evidenceRefs.some((reference) => acceptableIds.has(reference));
      const hasOnlyUnclassifiedMetricReference = kinds.length === 0
        && record.evidenceRefs.some((reference) => metricIds.has(reference));
      if (!hasCorrespondingReference || hasOnlyUnclassifiedMetricReference) {
        issues.push({
          code: 'unsupported_metric_claim',
          severity: 'error',
          targetId: record.targetId,
          message: kinds.length === 0
            ? 'Métrique chiffrée impossible à relier à un signal mesuré nommé.'
            : 'Métrique chiffrée sans mesure correspondante citée.',
        });
      }
    }
  }
  return records.length;
}

export function validateAnalysisQuality(candidate: unknown): QualityValidationReport {
  const parsed = FinalAnalysisResultSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      status: 'reject',
      validForPersistence: false,
      checkedEvidenceCount: 0,
      checkedClaimCount: 0,
      issues: parsed.error.issues.slice(0, 50).map((issue) => ({
        code: 'schema_invalid',
        severity: 'error',
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const result = parsed.data;
  const issues: QualityValidationIssue[] = [];
  const {
    evidenceIds,
    evidenceSet,
    metricIds,
    metricIdsByKind,
    retentionIds,
    recommendationCatalog,
  } = collectEvidence(result);
  addDuplicateIssues(evidenceIds, issues);
  addDuplicateIssues([
    result.analysisId,
    ...result.specialists.map((diagnostic) => diagnostic.id),
    ...result.specialists.flatMap((diagnostic) => diagnostic.findings.map((finding) => finding.id)),
    ...result.timeline.map((segment) => segment.id),
    ...generatedObjectIds(result),
  ], issues);

  validateReferences(result, evidenceSet, issues);
  validateTranscript(result, issues);
  validateTimestamps(result, issues);
  validateTimeline(result, issues);
  validateRecommendationIntegrity(result, recommendationCatalog, issues);

  for (const display of displayStrings(result)) {
    if (INVALID_DISPLAY_PATTERN.test(display.value)) {
      issues.push({
        code: 'invalid_display_value',
        severity: 'error',
        path: display.path,
        message: 'Valeur technique interdite dans un texte affichable.',
      });
    }
  }

  const checkedClaimCount = validateClaims(result, metricIds, metricIdsByKind, retentionIds, issues);

  try {
    const scoreCheck = findScoreMismatches(result.rubric.assessments, result.scores);
    for (const mismatch of scoreCheck.mismatches) {
      issues.push({
        code: 'score_mismatch',
        severity: 'error',
        path: `scores.${mismatch}`,
        message: `Le score ${mismatch} ne correspond pas à la rubrique déterministe.`,
      });
    }
  } catch (error) {
    issues.push({
      code: 'score_mismatch',
      severity: 'error',
      path: 'rubric.assessments',
      message: error instanceof Error ? error.message : 'Rubrique déterministe invalide.',
    });
  }

  const diagnosticIds = new Set(result.specialists.map((diagnostic) => diagnostic.id));
  const reviewedDiagnosticIds = new Set(result.critique.reviewedDiagnosticIds);
  const targetIds = new Set([
    result.analysisId,
    ...evidenceIds,
    ...directSections(result).map(([name]) => `section:${name}`),
    ...result.specialists.map((diagnostic) => diagnostic.id),
    ...result.specialists.flatMap((diagnostic) => diagnostic.findings.map((finding) => finding.id)),
    ...result.timeline.map((segment) => segment.id),
    ...generatedObjectIds(result),
    ...(result.improvedVersion.status === 'available' ? ['improvedVersion.bestHook'] : []),
  ]);
  for (const reviewedId of result.critique.reviewedDiagnosticIds) {
    if (!diagnosticIds.has(reviewedId)) {
      issues.push({
        code: 'evidence_reference',
        severity: 'error',
        targetId: reviewedId,
        message: `Le diagnostic critiqué ${reviewedId} n’existe pas.`,
      });
    }
  }
  for (const diagnosticId of diagnosticIds) {
    if (!reviewedDiagnosticIds.has(diagnosticId)) {
      issues.push({
        code: 'critique_inconsistent',
        severity: 'error',
        targetId: diagnosticId,
        message: `Le diagnostic ${diagnosticId} n’a pas été couvert par la critique croisée.`,
      });
    }
  }
  for (const issue of result.critique.issues) {
    for (const targetId of issue.targetIds) {
      if (!targetIds.has(targetId)) {
        issues.push({
          code: 'evidence_reference',
          severity: 'error',
          targetId: issue.id,
          message: `La cible de critique ${targetId} n’existe pas.`,
        });
      }
    }
  }
  if (result.critique.issues.some((issue) => issue.severity === 'error')) {
    issues.push({
      code: 'critique_inconsistent',
      severity: 'error',
      path: 'critique.verdict',
      message: 'Une analyse ne peut pas être persistée avec une erreur de critique non résolue.',
    });
  }

  const hasError = issues.some((issue) => issue.severity === 'error');
  const status = hasError ? 'reject' : issues.length > 0 ? 'revise' : 'pass';
  return {
    status,
    validForPersistence: status === 'pass',
    issues,
    checkedEvidenceCount: evidenceIds.length,
    checkedClaimCount,
  };
}
