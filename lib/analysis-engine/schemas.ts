import { z } from 'zod';

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

const IdentifierSchema = z.string().trim().regex(IDENTIFIER_PATTERN);
const CleanTextSchema = z.string().trim().min(1).max(4_000);
const ShortTextSchema = z.string().trim().min(1).max(500);
const TimestampSchema = z.number().finite().min(0);
const RatioSchema = z.number().finite().min(0).max(1);
const PercentageSchema = z.number().finite().min(0).max(100);

export const EvidenceReferenceSchema = IdentifierSchema;

export const CreatorObjectiveSchema = z.enum([
  'retention',
  'views',
  'comments',
  'followers',
  'leads',
  'sales',
  'authority',
  'advertising',
  'clip',
  'other',
]);

export const CreatorContextSchema = z.object({
  version: z.literal('creator-context-v1'),
  objective: CreatorObjectiveSchema,
  objectiveDetails: z.string().trim().min(2).max(240).optional(),
  platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'other']),
  platformDetails: z.string().trim().min(2).max(120).optional(),
  niche: z.string().trim().min(2).max(120),
  audience: z.string().trim().min(2).max(240),
  audienceKnowledge: z.enum(['beginner', 'intermediate', 'expert', 'mixed']),
  format: z.enum([
    'facecam',
    'ugc',
    'clip',
    'demo',
    'storytelling',
    'advertising',
    'other',
  ]),
  formatDetails: z.string().trim().min(2).max(120).optional(),
  tone: z.string().trim().min(2).max(120),
  language: z.string().trim().regex(LANGUAGE_CODE_PATTERN),
  memoryConsent: z.boolean(),
  creatorNotes: z.string().trim().min(1).max(800).optional(),
}).strict().superRefine((context, refinement) => {
  if (context.objective === 'other' && !context.objectiveDetails) {
    refinement.addIssue({
      code: 'custom',
      path: ['objectiveDetails'],
      message: 'L’objectif personnalisé doit être précisé.',
    });
  }
  if (context.platform === 'other' && !context.platformDetails) {
    refinement.addIssue({
      code: 'custom',
      path: ['platformDetails'],
      message: 'La plateforme personnalisée doit être précisée.',
    });
  }
  if (context.format === 'other' && !context.formatDetails) {
    refinement.addIssue({
      code: 'custom',
      path: ['formatDetails'],
      message: 'Le format personnalisé doit être précisé.',
    });
  }
});

export const MediaTrackStatusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('present'),
    codec: z.string().trim().min(1).max(60),
  }).strict(),
  z.object({
    status: z.literal('absent'),
    verifiedBy: z.literal('ffmpeg'),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
  }).strict(),
]);

export const VideoMetadataSchema = z.object({
  version: z.literal('video-metadata-v1'),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  fileSizeBytes: z.number().int().positive(),
  durationSec: z.number().finite().positive().max(14_400),
  width: z.number().int().positive().max(16_384),
  height: z.number().int().positive().max(16_384),
  framesPerSecond: z.number().finite().positive().max(240),
  container: z.string().trim().min(1).max(60),
  videoCodec: z.string().trim().min(1).max(60),
  bitrateBitsPerSec: z.number().int().nonnegative().optional(),
  audioTrack: MediaTrackStatusSchema,
  probedAt: z.string().datetime({ offset: true }),
}).strict();

export const FrameEvidenceSchema = z.object({
  id: IdentifierSchema,
  timestampSec: TimestampSchema,
  artifactRef: z.string().trim().min(1).max(500),
  width: z.number().int().positive().max(16_384),
  height: z.number().int().positive().max(16_384),
  samplingReason: z.enum([
    'opening',
    'adaptive_interval',
    'scene_change',
    'silence_boundary',
    'transcript_boundary',
    'ending',
  ]),
  perceptualHash: z.string().trim().min(8).max(256).optional(),
  ocr: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('measured'),
      text: z.string().trim().max(1_000),
      confidence: RatioSchema,
      method: z.string().trim().min(1).max(120),
    }).strict(),
    z.object({
      status: z.literal('observed'),
      text: z.string().trim().max(1_000),
      confidence: z.enum(['low', 'medium', 'high']),
      method: z.string().trim().min(1).max(120),
    }).strict(),
    z.object({
      status: z.literal('unavailable'),
      reason: ShortTextSchema,
    }).strict(),
  ]),
}).strict();

export const LanguageDetectionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('measured'),
    code: z.string().trim().regex(LANGUAGE_CODE_PATTERN),
    confidence: RatioSchema.optional(),
    method: z.string().trim().min(1).max(120),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
  }).strict(),
]);

export const TranscriptWordSchema = z.object({
  id: IdentifierSchema,
  segmentId: IdentifierSchema,
  startSec: TimestampSchema,
  endSec: TimestampSchema,
  text: z.string().trim().min(1).max(160),
  confidence: RatioSchema.optional(),
  speaker: z.string().trim().min(1).max(80).optional(),
}).strict().refine((word) => word.endSec >= word.startSec, {
  message: 'La fin du mot doit être postérieure à son début.',
  path: ['endSec'],
});

export const TranscriptSegmentSchema = z.object({
  id: IdentifierSchema,
  startSec: TimestampSchema,
  endSec: TimestampSchema,
  text: z.string().trim().max(2_000),
  wordIds: z.array(IdentifierSchema).max(1_000),
  confidence: RatioSchema.optional(),
  uncertainty: z.enum(['low', 'medium', 'high']).optional(),
  confidenceMethod: z.string().trim().min(1).max(160).optional(),
  providerSignals: z.object({
    averageLogProbability: z.number().finite().max(0),
    noSpeechProbability: RatioSchema,
    compressionRatio: z.number().finite().nonnegative(),
  }).strict().optional(),
  speaker: z.string().trim().min(1).max(80).optional(),
}).strict().refine((segment) => segment.endSec >= segment.startSec, {
  message: 'La fin du segment doit être postérieure à son début.',
  path: ['endSec'],
});

export const TranscriptionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    source: z.enum(['openai', 'platform_captions', 'user_supplied']),
    model: z.string().trim().min(1).max(120),
    timingPrecision: z.enum(['word', 'segment', 'none']),
    raw: z.object({
      text: z.string().max(100_000),
      language: z.string().trim().max(40).optional(),
      providerRequestId: z.string().trim().min(1).max(200).optional(),
      confidence: RatioSchema.optional(),
      confidenceMethod: z.string().trim().min(1).max(160).optional(),
    }).strict(),
    normalized: z.object({
      text: z.string().max(100_000),
      language: LanguageDetectionSchema,
      segments: z.array(TranscriptSegmentSchema).max(10_000),
      words: z.array(TranscriptWordSchema).max(100_000),
    }).strict(),
    generatedAt: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reasonCode: z.enum([
      'no_audio_track',
      'no_speech_detected',
      'unsupported_audio',
      'provider_error',
      'consent_missing',
      'not_requested',
    ]),
    reason: ShortTextSchema,
  }).strict(),
]);

const UnavailableSignalSchema = z.object({
  status: z.literal('unavailable'),
  reasonCode: z.enum([
    'not_measurable',
    'missing_track',
    'insufficient_samples',
    'tool_error',
    'unsupported_format',
  ]),
  reason: ShortTextSchema,
}).strict();

function measuredNumberSignal<T extends z.ZodNumber>(value: T, unit: string) {
  return z.discriminatedUnion('status', [
    z.object({
      status: z.literal('measured'),
      id: IdentifierSchema,
      value,
      unit: z.literal(unit),
      method: z.string().trim().min(1).max(160),
      evidenceRefs: z.array(EvidenceReferenceSchema).max(200),
    }).strict(),
    UnavailableSignalSchema,
  ]);
}

export const PauseIntervalSchema = z.object({
  id: IdentifierSchema,
  startSec: TimestampSchema,
  endSec: TimestampSchema,
}).strict().refine((pause) => pause.endSec >= pause.startSec, {
  message: 'La fin de la pause doit être postérieure à son début.',
  path: ['endSec'],
});

export const PauseIntervalsSignalSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('measured'),
    id: IdentifierSchema,
    value: z.array(PauseIntervalSchema).max(10_000),
    unit: z.literal('seconds'),
    method: z.string().trim().min(1).max(160),
    evidenceRefs: z.array(EvidenceReferenceSchema).max(200),
  }).strict(),
  UnavailableSignalSchema,
]);

export const VoiceMusicBalanceSignalSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('measured'),
    id: IdentifierSchema,
    value: z.enum(['voice_dominant', 'music_dominant', 'balanced']),
    unit: z.literal('classification'),
    method: z.string().trim().min(1).max(160),
    evidenceRefs: z.array(EvidenceReferenceSchema).max(200),
  }).strict(),
  UnavailableSignalSchema,
]);

export const LoudnessTimelineSignalSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('measured'),
    id: IdentifierSchema,
    value: z.array(z.object({
      timestampSec: TimestampSchema,
      momentaryLufs: z.number().finite().min(-120).max(20),
    }).strict()).min(1).max(20_000),
    unit: z.literal('LUFS_momentary'),
    method: z.string().trim().min(1).max(160),
    evidenceRefs: z.array(EvidenceReferenceSchema).max(200),
  }).strict(),
  UnavailableSignalSchema,
]);

export const QualitativeAudioSignalSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('measured'),
    id: IdentifierSchema,
    value: z.enum(['not_observed', 'possible', 'observed']),
    unit: z.literal('classification'),
    method: z.string().trim().min(1).max(160),
    evidenceRefs: z.array(EvidenceReferenceSchema).max(200),
  }).strict(),
  UnavailableSignalSchema,
]);

export const AudioSignalsSchema = z.object({
  version: z.literal('audio-signals-v1'),
  integratedLoudness: measuredNumberSignal(z.number().finite().min(-100).max(10), 'LUFS'),
  truePeak: measuredNumberSignal(z.number().finite().min(-100).max(20), 'dBTP'),
  meanVolumeDb: measuredNumberSignal(z.number().finite().min(-100).max(20), 'dBFS'),
  peakVolumeDb: measuredNumberSignal(z.number().finite().min(-100).max(20), 'dBFS'),
  silenceRatio: measuredNumberSignal(RatioSchema, 'ratio'),
  speechRatio: measuredNumberSignal(RatioSchema, 'ratio'),
  speakingRateWpm: measuredNumberSignal(
    z.number().finite().nonnegative().max(2_000),
    'words_per_minute',
  ),
  averageSentenceLengthWords: measuredNumberSignal(
    z.number().finite().nonnegative().max(10_000),
    'words',
  ),
  wordDensityPerSecond: measuredNumberSignal(
    z.number().finite().nonnegative().max(1_000),
    'words_per_second',
  ),
  repeatedPhraseCount: measuredNumberSignal(
    z.number().int().nonnegative().max(100_000),
    'count',
  ),
  hesitationCount: measuredNumberSignal(
    z.number().int().nonnegative().max(100_000),
    'count',
  ),
  pauseIntervals: PauseIntervalsSignalSchema,
  voiceMusicBalance: VoiceMusicBalanceSignalSchema,
  initialSilenceDurationSec: measuredNumberSignal(z.number().finite().min(0).max(14_400), 'seconds').optional(),
  firstSpeechTimeSec: measuredNumberSignal(z.number().finite().min(0).max(14_400), 'seconds').optional(),
  loudnessTimeline: LoudnessTimelineSignalSchema.optional(),
  speechWindowLoudnessVariation: measuredNumberSignal(
    z.number().finite().min(0).max(120),
    'LUFS_stddev',
  ).optional(),
  nonSpeechLoudness: measuredNumberSignal(
    z.number().finite().min(-120).max(20),
    'LUFS_momentary_mean',
  ).optional(),
  saturationRisk: QualitativeAudioSignalSchema.optional(),
  backgroundNoise: QualitativeAudioSignalSchema.optional(),
  vocalEnergyVariation: QualitativeAudioSignalSchema.optional(),
}).strict();

export const VisualSignalsSchema = z.object({
  version: z.literal('visual-signals-v1'),
  averageLuma: measuredNumberSignal(z.number().finite().min(0).max(255), 'YAVG'),
  brightnessVariation: measuredNumberSignal(z.number().finite().min(0).max(255), 'YAVG_stddev'),
  blackFrameRatio: measuredNumberSignal(RatioSchema, 'ratio'),
  freezeRatio: measuredNumberSignal(RatioSchema, 'ratio'),
  sceneCutCount: measuredNumberSignal(z.number().int().nonnegative(), 'count'),
  cutsPerMinute: measuredNumberSignal(z.number().finite().nonnegative().max(10_000), 'count_per_minute'),
  motionIntensity: measuredNumberSignal(PercentageSchema, 'percent'),
  textCoverageRatio: measuredNumberSignal(RatioSchema, 'ratio'),
  facePresenceRatio: measuredNumberSignal(RatioSchema, 'ratio'),
}).strict();

export const ObservedMetricSchema = z.object({
  id: IdentifierSchema,
  key: z.enum([
    'views',
    'likes',
    'comments',
    'shares',
    'saves',
    'average_watch_time_seconds',
    'completion_rate',
    'engagement_rate',
  ]),
  value: z.number().finite().nonnegative(),
  unit: z.enum(['count', 'seconds', 'ratio']),
}).strict().superRefine((metric, context) => {
  const countKeys = new Set(['views', 'likes', 'comments', 'shares', 'saves']);
  if (countKeys.has(metric.key) && (metric.unit !== 'count' || !Number.isInteger(metric.value))) {
    context.addIssue({
      code: 'custom',
      path: ['value'],
      message: 'Une métrique de volume doit être un compteur entier.',
    });
  }
  if (metric.key === 'average_watch_time_seconds' && metric.unit !== 'seconds') {
    context.addIssue({
      code: 'custom',
      path: ['unit'],
      message: 'La durée moyenne de visionnage doit être exprimée en secondes.',
    });
  }
  if (['completion_rate', 'engagement_rate'].includes(metric.key)
    && (metric.unit !== 'ratio' || metric.value > 1)) {
    context.addIssue({
      code: 'custom',
      path: ['value'],
      message: 'Un taux doit être un ratio compris entre zéro et un.',
    });
  }
});

export const ObservedMetricsSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    source: z.enum(['tiktok_api', 'platform_export', 'user_verified']),
    sourceReference: z.string().trim().min(1).max(500),
    observedAt: z.string().datetime({ offset: true }),
    metrics: z.array(ObservedMetricSchema).min(1).max(100),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
  }).strict(),
]);

export const RetentionEvidenceSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    source: z.enum(['tiktok_api', 'platform_export']),
    sourceReference: z.string().trim().min(1).max(500),
    observedAt: z.string().datetime({ offset: true }),
    points: z.array(z.object({
      id: IdentifierSchema,
      timestampSec: TimestampSchema,
      retainedRatio: RatioSchema,
    }).strict()).min(2).max(10_000),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
  }).strict(),
]);

export const TimeRangeSchema = z.object({
  startSec: TimestampSchema,
  endSec: TimestampSchema,
}).strict().refine((range) => range.endSec >= range.startSec, {
  message: 'La fin doit être postérieure au début.',
  path: ['endSec'],
});

export const RecommendationTranscriptCitationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    segmentId: IdentifierSchema,
    quote: z.string().trim().min(1).max(500),
  }).strict(),
  z.object({
    status: z.literal('not_applicable'),
    reasonCode: z.enum([
      'no_transcript',
      'visual_only',
      'audio_only',
      'technical_only',
    ]),
    reason: ShortTextSchema,
  }).strict(),
]);

export const SpecialistFindingSchema = z.object({
  id: IdentifierSchema,
  claim: CleanTextSchema,
  implication: CleanTextSchema,
  decision: CleanTextSchema,
  severity: z.enum(['low', 'medium', 'high']),
  confidence: z.enum(['low', 'medium', 'high']),
  timeRange: TimeRangeSchema.nullable(),
  evidenceRefs: z.array(EvidenceReferenceSchema).min(1).max(100),
}).strict();

export const SpecialistDiagnosticSchema = z.object({
  id: IdentifierSchema,
  specialist: z.enum(['hook', 'script', 'audio', 'editing', 'storytelling', 'visual_text', 'cta']),
  summary: CleanTextSchema,
  findings: z.array(SpecialistFindingSchema).max(30),
  limitations: z.array(ShortTextSchema).max(20),
}).strict().superRefine((diagnostic, context) => {
  if (diagnostic.findings.length === 0 && diagnostic.limitations.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['limitations'],
      message: 'Un diagnostic sans constat doit expliquer pourquoi le signal est indisponible.',
    });
  }
});

export const CritiqueIssueSchema = z.object({
  id: IdentifierSchema,
  category: z.enum([
    'unsupported_claim',
    'invalid_evidence',
    'timestamp',
    'genericity',
    'contradiction',
    'retention_claim',
    'metric_integrity',
    'score_integrity',
  ]),
  severity: z.enum(['warning', 'error']),
  message: CleanTextSchema,
  targetIds: z.array(IdentifierSchema).max(100),
}).strict();

export const AnalysisCritiqueSchema = z.object({
  version: z.literal('analysis-critique-v1'),
  verdict: z.enum(['pass', 'revise', 'reject']),
  reviewedDiagnosticIds: z.array(IdentifierSchema).min(1).max(30),
  issues: z.array(CritiqueIssueSchema).max(100),
  contradictionsResolved: z.array(CleanTextSchema).max(30),
  limitations: z.array(ShortTextSchema).max(30),
}).strict();

export const RubricCriterionIdSchema = z.enum([
  'hook.first_frame_stakes',
  'hook.first_three_seconds_promise',
  'clarity.single_promise',
  'clarity.message_legibility',
  'pacing.dead_air_control',
  'pacing.scene_progression',
  'visual.first_frame_readability',
  'visual.composition_progression',
  'audio.voice_intelligibility',
  'audio.pause_and_level_control',
  'structure.promise_to_payoff',
  'structure.segment_necessity',
  'credibility.proof_before_claim',
  'credibility.claim_support',
  'cta.aligned',
  'cta.low_friction',
  'objective_fit.primary_action',
  'objective_fit.audience_alignment',
]);

export const RubricAssessmentSchema = z.object({
  criterionId: RubricCriterionIdSchema,
  status: z.enum(['met', 'partial', 'not_met', 'unavailable']),
  evidence: z.array(EvidenceReferenceSchema).max(100),
  observation: ShortTextSchema,
  positive: ShortTextSchema.nullable(),
  penalty: ShortTextSchema.nullable(),
}).strict().superRefine((assessment, context) => {
  if (assessment.status !== 'unavailable' && assessment.evidence.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['evidence'],
      message: 'Un critère évalué doit citer au moins une preuve.',
    });
  }
});

export const ScoreCriterionDetailSchema = z.object({
  criterionId: RubricCriterionIdSchema,
  label: z.string().trim().min(1).max(160),
  weight: z.number().int().positive().max(100),
  status: z.enum(['met', 'partial', 'not_met', 'unavailable']),
  observation: ShortTextSchema,
  evidence: z.array(EvidenceReferenceSchema).max(100),
}).strict();

const ScoreTransparencySchema = z.object({
  evidenceCoverage: RatioSchema,
  confidence: z.enum(['low', 'medium', 'high']),
  criteria: z.array(ScoreCriterionDetailSchema).min(1).max(20),
  observations: z.array(ShortTextSchema).min(1).max(30),
  penalties: z.array(ShortTextSchema).max(30),
  positives: z.array(ShortTextSchema).max(30),
}).strict();

export const ComputedScoreSchema = z.discriminatedUnion('status', [
  ScoreTransparencySchema.extend({
    status: z.literal('computed'),
    value: z.number().int().min(0).max(100),
  }).strict(),
  ScoreTransparencySchema.extend({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
  }).strict(),
]);

export const DeterministicScoresSchema = z.object({
  rubricVersion: z.literal('viralynz-rubric-v1'),
  hook: ComputedScoreSchema,
  clarity: ComputedScoreSchema,
  rhythm: ComputedScoreSchema,
  visual: ComputedScoreSchema,
  audio: ComputedScoreSchema,
  structure: ComputedScoreSchema,
  credibility: ComputedScoreSchema,
  cta: ComputedScoreSchema,
  objectiveFit: ComputedScoreSchema,
  overall: ComputedScoreSchema,
}).strict();

export const EvidenceObservationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    text: CleanTextSchema,
    evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
  }).strict(),
]);

export const TimelineSegmentSchema = z.object({
  id: IdentifierSchema,
  startTime: TimestampSchema,
  endTime: TimestampSchema,
  transcript: EvidenceObservationSchema,
  visualObservation: EvidenceObservationSchema,
  audioObservation: EvidenceObservationSchema,
  editingObservation: EvidenceObservationSchema,
  narrativeFunction: z.enum([
    'hook',
    'context',
    'problem',
    'promise',
    'tension',
    'proof',
    'explanation',
    'demonstration',
    'objection',
    'transition',
    'payoff',
    'cta',
    'dead_air',
    'redundant_information',
    'filler',
    'unknown',
  ]),
  observation: CleanTextSchema,
  diagnostic: CleanTextSchema,
  action: CleanTextSchema,
  objective: CreatorObjectiveSchema,
  objectiveFit: CleanTextSchema,
  example: CleanTextSchema,
  transcriptCitation: RecommendationTranscriptCitationSchema,
  nature: z.enum(['observed', 'inferred', 'mixed']),
  strengths: z.array(ShortTextSchema).max(20),
  problems: z.array(ShortTextSchema).max(20),
  recommendedAction: CleanTextSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
  confidence: z.enum(['low', 'medium', 'high']),
}).strict().refine((segment) => segment.endTime > segment.startTime, {
  message: 'Un segment de timeline doit avoir une durée positive.',
  path: ['endTime'],
});

export const EditingDecisionSchema = z.object({
  id: IdentifierSchema,
  type: z.enum(['cut', 'move', 'rewrite', 'keep', 'republish', 'test_v2']),
  instruction: CleanTextSchema,
  rationale: CleanTextSchema,
  timeRange: TimeRangeSchema.nullable(),
  evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
}).strict();

/**
 * Every user-facing recommendation is self-contained. A shared section-level
 * evidence array is not enough: the server validates this object's own range,
 * evidence, transcript citation (when relevant), objective and concrete example.
 */
export const GroundedRecommendationSchema = z.object({
  id: IdentifierSchema,
  timeRange: TimeRangeSchema,
  observation: CleanTextSchema,
  why: CleanTextSchema,
  objective: CreatorObjectiveSchema,
  objectiveFit: CleanTextSchema,
  text: CleanTextSchema,
  example: CleanTextSchema,
  supportingSourceIds: z.array(IdentifierSchema).min(1).max(20),
  transcriptCitation: RecommendationTranscriptCitationSchema,
  nature: z.enum([
    'measured_data',
    'visual_observation',
    'audio_observation',
    'transcript_observation',
    'editorial_inference',
    'mixed',
  ]),
  evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
  confidence: z.enum(['low', 'medium', 'high']),
}).strict();

/**
 * Exhaustive editorial coverage required by the product specification. IDs are
 * namespaced so a criterion cannot silently move to another UI section.
 */
export const ANALYSIS_SECTION_CRITERIA = {
  hook: [
    'hook.verbal_hook',
    'hook.visual_hook',
    'hook.audio_hook',
    'hook.first_frame',
    'hook.time_to_understanding',
    'hook.time_to_benefit',
    'hook.specificity',
    'hook.curiosity',
    'hook.cross_modal_consistency',
    'hook.exact_recommendation',
  ],
  script: [
    'script.clarity',
    'script.structure',
    'script.density',
    'script.repetitions',
    'script.credibility',
    'script.evidence',
    'script.progression',
    'script.payoff',
    'script.cta',
    'script.phrases_to_remove',
    'script.phrases_to_shorten',
    'script.phrases_to_rewrite',
  ],
  editing: [
    'editing.rhythm',
    'editing.cuts',
    'editing.shot_changes',
    'editing.b_roll',
    'editing.pattern_interrupts',
    'editing.dead_air',
    'editing.transitions',
    'editing.zooms',
    'editing.demonstrations',
    'editing.timestamped_recommendations',
  ],
  visual: [
    'visual.framing',
    'visual.lighting',
    'visual.composition',
    'visual.background',
    'visual.contrast',
    'visual.energy',
    'visual.camera_gaze',
    'visual.product_presence',
    'visual.readability',
    'visual.first_frame',
  ],
  textAndCaptions: [
    'text_and_captions.presence',
    'text_and_captions.readability',
    'text_and_captions.synchronization',
    'text_and_captions.size',
    'text_and_captions.contrast',
    'text_and_captions.length',
    'text_and_captions.hierarchy',
    'text_and_captions.safe_zones',
    'text_and_captions.unemphasized_key_words',
    'text_and_captions.errors',
  ],
  audio: [
    'audio.voice',
    'audio.delivery_rate',
    'audio.pauses',
    'audio.energy',
    'audio.music',
    'audio.noise',
    'audio.saturation',
    'audio.balance',
    'audio.problematic_moments',
  ],
  storytelling: [
    'storytelling.open_loop',
    'storytelling.tension',
    'storytelling.curiosity',
    'storytelling.progression',
    'storytelling.surprise',
    'storytelling.evidence',
    'storytelling.objection',
    'storytelling.payoff',
    'storytelling.cognitive_load',
    'storytelling.emotional_change',
  ],
  conversion: [
    'conversion.value_proposition',
    'conversion.evidence',
    'conversion.objection',
    'conversion.cta',
    'conversion.friction',
    'conversion.cta_timing',
    'conversion.objective_alignment',
  ],
} as const;

export type AnalysisSectionKey = keyof typeof ANALYSIS_SECTION_CRITERIA;
export type AnalysisSectionCriterionId = {
  [TSection in AnalysisSectionKey]: (typeof ANALYSIS_SECTION_CRITERIA)[TSection][number];
}[AnalysisSectionKey];

type AnalysisSectionCriterionOutput = {
  criterionId: AnalysisSectionCriterionId;
  status: 'observed' | 'not_observed' | 'unavailable';
  note: string;
  evidence: string[];
  timeRange: z.infer<typeof TimeRangeSchema> | null;
  confidence: 'low' | 'medium' | 'high';
};

type AnalysisSectionOutput = {
  section: AnalysisSectionKey;
  status: 'available';
  summary: string;
  strengths: string[];
  problems: string[];
  recommendations: Array<z.infer<typeof GroundedRecommendationSchema>>;
  evidence: string[];
  limitations: string[];
  criteria: AnalysisSectionCriterionOutput[];
} | {
  section: AnalysisSectionKey;
  status: 'unavailable';
  reason: string;
  limitations: string[];
  criteria: AnalysisSectionCriterionOutput[];
};

type NonEmptyStringTuple = readonly [string, ...string[]];

function createSectionCriterionSchema<const TCriteria extends NonEmptyStringTuple>(
  criterionIds: TCriteria,
) {
  return z.object({
    criterionId: z.enum(criterionIds),
    status: z.enum(['observed', 'not_observed', 'unavailable']),
    note: ShortTextSchema,
    evidence: z.array(EvidenceReferenceSchema).max(100),
    timeRange: TimeRangeSchema.nullable(),
    confidence: z.enum(['low', 'medium', 'high']),
  }).strict().superRefine((criterion, context) => {
    if (criterion.status === 'unavailable' && criterion.evidence.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: 'Un critere indisponible ne doit citer aucune preuve.',
      });
    }
    if (criterion.status !== 'unavailable' && criterion.evidence.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: 'Un critere observe ou non observe doit citer au moins une preuve.',
      });
    }
  });
}

function createAnalysisSectionSchema<
  const TSection extends AnalysisSectionKey,
  const TCriteria extends NonEmptyStringTuple,
>(section: TSection, criterionIds: TCriteria) {
  const criterionSchema = createSectionCriterionSchema(criterionIds);
  const criteriaSchema = z.array(criterionSchema).length(criterionIds.length).superRefine((criteria, context) => {
    const actualIds = criteria.map((criterion) => criterion.criterionId);
    const actualSet = new Set(actualIds);
    const expectedSet = new Set<string>(criterionIds);

    if (actualSet.size !== actualIds.length) {
      context.addIssue({
        code: 'custom',
        message: `La matrice ${section} contient un critere duplique.`,
      });
    }
    for (const expectedId of expectedSet) {
      if (!actualSet.has(expectedId)) {
        context.addIssue({
          code: 'custom',
          message: `Le critere obligatoire ${expectedId} manque dans la matrice ${section}.`,
        });
      }
    }
  });

  return z.discriminatedUnion('status', [
    z.object({
      section: z.literal(section),
      status: z.literal('available'),
      summary: CleanTextSchema,
      strengths: z.array(ShortTextSchema).max(30),
      problems: z.array(ShortTextSchema).max(30),
      recommendations: z.array(GroundedRecommendationSchema).max(30),
      evidence: z.array(EvidenceReferenceSchema).min(1).max(200),
      limitations: z.array(ShortTextSchema).max(30),
      criteria: criteriaSchema,
    }).strict().superRefine((value, context) => {
      if (value.criteria.every((criterion) => criterion.status === 'unavailable')) {
        context.addIssue({
          code: 'custom',
          path: ['criteria'],
          message: `La section ${section} doit etre indisponible si aucun critere n'est observable.`,
        });
      }
    }),
    z.object({
      section: z.literal(section),
      status: z.literal('unavailable'),
      reason: ShortTextSchema,
      limitations: z.array(ShortTextSchema).min(1).max(30),
      criteria: criteriaSchema,
    }).strict().superRefine((value, context) => {
      value.criteria.forEach((criterion, index) => {
        if (criterion.status !== 'unavailable') {
          context.addIssue({
            code: 'custom',
            path: ['criteria', index, 'status'],
            message: `Une section ${section} indisponible exige une matrice entierement indisponible.`,
          });
        }
      });
    }),
  ]);
}

function widenAnalysisSectionSchema<TSchema extends z.ZodType>(schema: TSchema) {
  return schema as unknown as z.ZodType<AnalysisSectionOutput>;
}

export const HookAnalysisSectionSchema = widenAnalysisSectionSchema(
  createAnalysisSectionSchema('hook', ANALYSIS_SECTION_CRITERIA.hook),
);
export const ScriptAnalysisSectionSchema = widenAnalysisSectionSchema(
  createAnalysisSectionSchema('script', ANALYSIS_SECTION_CRITERIA.script),
);
export const EditingAnalysisSectionSchema = widenAnalysisSectionSchema(
  createAnalysisSectionSchema('editing', ANALYSIS_SECTION_CRITERIA.editing),
);
export const VisualAnalysisSectionSchema = widenAnalysisSectionSchema(
  createAnalysisSectionSchema('visual', ANALYSIS_SECTION_CRITERIA.visual),
);
export const TextAndCaptionsAnalysisSectionSchema = widenAnalysisSectionSchema(createAnalysisSectionSchema(
  'textAndCaptions',
  ANALYSIS_SECTION_CRITERIA.textAndCaptions,
));
export const AudioAnalysisSectionSchema = widenAnalysisSectionSchema(
  createAnalysisSectionSchema('audio', ANALYSIS_SECTION_CRITERIA.audio),
);
export const StorytellingAnalysisSectionSchema = widenAnalysisSectionSchema(createAnalysisSectionSchema(
  'storytelling',
  ANALYSIS_SECTION_CRITERIA.storytelling,
));
export const ConversionAnalysisSectionSchema = widenAnalysisSectionSchema(createAnalysisSectionSchema(
  'conversion',
  ANALYSIS_SECTION_CRITERIA.conversion,
));

export const AnalysisSectionSchema = z.union([
  HookAnalysisSectionSchema,
  ScriptAnalysisSectionSchema,
  EditingAnalysisSectionSchema,
  VisualAnalysisSectionSchema,
  TextAndCaptionsAnalysisSectionSchema,
  AudioAnalysisSectionSchema,
  StorytellingAnalysisSectionSchema,
  ConversionAnalysisSectionSchema,
]);

export const StrategicSummarySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    diagnosis: CleanTextSchema,
    firstDecision: CleanTextSchema,
    whyNow: CleanTextSchema,
    evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
    limitations: z.array(ShortTextSchema).max(30),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
    limitations: z.array(ShortTextSchema).min(1).max(30),
  }).strict(),
]);

export const PrioritiesSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    critical: z.array(GroundedRecommendationSchema).min(1).max(10),
    important: z.array(GroundedRecommendationSchema).max(10),
    optimizations: z.array(GroundedRecommendationSchema).max(20),
    limitations: z.array(ShortTextSchema).max(30),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
    limitations: z.array(ShortTextSchema).min(1).max(30),
  }).strict(),
]);

export const CorrectionPlanStepSchema = z.object({
  id: IdentifierSchema,
  order: z.number().int().positive().max(100),
  observation: CleanTextSchema,
  action: CleanTextSchema,
  rationale: CleanTextSchema,
  objective: CreatorObjectiveSchema,
  objectiveFit: CleanTextSchema,
  example: CleanTextSchema,
  supportingSourceIds: z.array(IdentifierSchema).min(1).max(20),
  transcriptCitation: RecommendationTranscriptCitationSchema,
  nature: GroundedRecommendationSchema.shape.nature,
  timeRange: TimeRangeSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
  confidence: z.enum(['low', 'medium', 'high']),
}).strict();

export const CorrectionPlanSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    steps: z.array(CorrectionPlanStepSchema).min(1).max(100),
    limitations: z.array(ShortTextSchema).max(30),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
    limitations: z.array(ShortTextSchema).min(1).max(30),
  }).strict(),
]);

export const RewrittenScriptSchema = z.object({
  fullText: z.string().trim().min(1).max(20_000),
  segments: z.array(z.object({
    id: IdentifierSchema,
    purpose: z.enum(['hook', 'context', 'proof', 'explanation', 'payoff', 'cta']),
    text: CleanTextSchema,
  }).strict()).min(1).max(100),
}).strict();

export const ABTestSchema = z.object({
  id: IdentifierSchema,
  variable: z.enum(['hook', 'first_frame', 'pacing', 'proof', 'cta', 'caption']),
  versionA: CleanTextSchema,
  versionB: CleanTextSchema,
  successCriterion: CleanTextSchema,
  evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
}).strict();

export const ImprovedVersionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
    hooks: z.array(GroundedRecommendationSchema).length(3),
    bestHook: z.object({
      hookId: IdentifierSchema,
      why: CleanTextSchema,
      evidence: z.array(EvidenceReferenceSchema).min(1).max(100),
    }).strict(),
    fullRewrittenScript: RewrittenScriptSchema,
    editPlan: z.array(GroundedRecommendationSchema).min(1).max(100),
    shotList: z.array(GroundedRecommendationSchema).min(1).max(100),
    onScreenText: z.array(GroundedRecommendationSchema).max(100),
    effectsAndBRoll: z.array(GroundedRecommendationSchema).max(100),
    cta: GroundedRecommendationSchema,
    caption: GroundedRecommendationSchema,
    firstLine: GroundedRecommendationSchema,
    abTests: z.array(ABTestSchema).min(1).max(20),
    limitations: z.array(ShortTextSchema).max(30),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: ShortTextSchema,
    limitations: z.array(ShortTextSchema).min(1).max(30),
  }).strict(),
]);

export const FinalAnalysisResultSchema = z.object({
  version: z.literal('viralynz-analysis-v2'),
  schemaVersion: z.literal('2.0.0'),
  engineVersion: z.string().trim().min(1).max(120),
  analysisId: IdentifierSchema,
  generatedAt: z.string().datetime({ offset: true }),
  creatorContext: CreatorContextSchema,
  video: VideoMetadataSchema,
  evidence: z.object({
    frames: z.array(FrameEvidenceSchema).min(1).max(500),
    transcription: TranscriptionSchema,
    audioSignals: AudioSignalsSchema,
    visualSignals: VisualSignalsSchema,
    observedMetrics: ObservedMetricsSchema,
    retention: RetentionEvidenceSchema,
  }).strict(),
  specialists: z.array(SpecialistDiagnosticSchema).min(1).max(20),
  critique: AnalysisCritiqueSchema,
  strategicSummary: StrategicSummarySchema,
  hook: HookAnalysisSectionSchema,
  script: ScriptAnalysisSectionSchema,
  editing: EditingAnalysisSectionSchema,
  visual: VisualAnalysisSectionSchema,
  textAndCaptions: TextAndCaptionsAnalysisSectionSchema,
  audio: AudioAnalysisSectionSchema,
  storytelling: StorytellingAnalysisSectionSchema,
  conversion: ConversionAnalysisSectionSchema,
  timeline: z.array(TimelineSegmentSchema).min(1).max(500),
  priorities: PrioritiesSchema,
  correctionPlan: CorrectionPlanSchema,
  improvedVersion: ImprovedVersionSchema,
  rubric: z.object({
    version: z.literal('viralynz-rubric-v1'),
    assessments: z.array(RubricAssessmentSchema).length(18).superRefine((assessments, context) => {
      const ids = assessments.map((assessment) => assessment.criterionId);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: 'custom',
          message: 'Chaque critère de la rubrique doit apparaître exactement une fois.',
        });
      }
    }),
  }).strict(),
  scores: DeterministicScoresSchema,
}).strict();

export type CreatorContext = z.infer<typeof CreatorContextSchema>;
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;
export type FrameEvidence = z.infer<typeof FrameEvidenceSchema>;
export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type Transcription = z.infer<typeof TranscriptionSchema>;
export type AudioSignals = z.infer<typeof AudioSignalsSchema>;
export type VisualSignals = z.infer<typeof VisualSignalsSchema>;
export type ObservedMetrics = z.infer<typeof ObservedMetricsSchema>;
export type RetentionEvidence = z.infer<typeof RetentionEvidenceSchema>;
export type SpecialistFinding = z.infer<typeof SpecialistFindingSchema>;
export type SpecialistDiagnostic = z.infer<typeof SpecialistDiagnosticSchema>;
export type AnalysisCritique = z.infer<typeof AnalysisCritiqueSchema>;
export type RubricCriterionId = z.infer<typeof RubricCriterionIdSchema>;
export type RubricAssessment = z.infer<typeof RubricAssessmentSchema>;
export type ComputedScore = z.infer<typeof ComputedScoreSchema>;
export type DeterministicScores = z.infer<typeof DeterministicScoresSchema>;
export type TimelineSegment = z.infer<typeof TimelineSegmentSchema>;
export type EditingDecision = z.infer<typeof EditingDecisionSchema>;
export type AnalysisSection = z.infer<typeof AnalysisSectionSchema>;
export type AnalysisSectionCriterion = AnalysisSectionCriterionOutput;
export type StrategicSummary = z.infer<typeof StrategicSummarySchema>;
export type GroundedRecommendation = z.infer<typeof GroundedRecommendationSchema>;
export type Priorities = z.infer<typeof PrioritiesSchema>;
export type CorrectionPlan = z.infer<typeof CorrectionPlanSchema>;
export type ImprovedVersion = z.infer<typeof ImprovedVersionSchema>;
export type FinalAnalysisResult = z.infer<typeof FinalAnalysisResultSchema>;
