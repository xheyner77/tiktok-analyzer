export const ENGINE_VERSIONS = {
  engine: 'viralynz-brain-v1',
  scoring: 'weighted-scoring-v1',
  rules: 'explainability-rules-v1',
  prompt: 'strict-json-v2',
} as const;

export const SIGNAL_WEIGHTS = {
  global: {
    hook_score_weight: 0.2,
    retention_score_weight: 0.2,
    cta_score_weight: 0.2,
    clarity_score_weight: 0.2,
    repost_potential_weight: 0.2,
  },
  hook: {
    payoff_delay_weight: -4,
    proof_hook_weight: 3,
    descriptive_intro_weight: -3,
    tension_weight: 3,
    question_weight: 1,
    first_frame_text_weight: 1,
  },
  retention: {
    slow_rhythm_weight: -4,
    overload_weight: -2,
    static_segment_weight: -3,
    visual_density_weight: 2,
    pattern_interrupt_weight: 2,
  },
  cta: {
    missing_cta_weight: -7,
    generic_cta_weight: -3,
    cta_position_weight: 2,
    question_cta_weight: 2,
  },
  confidence: {
    transcript_weight: 0.25,
    ocr_weight: 0.18,
    frame_sampling_weight: 0.18,
    creator_memory_weight: 0.12,
    feedback_learning_weight: 0.12,
    missing_signal_penalty: -0.08,
  },
} as const;

export type SignalWeights = typeof SIGNAL_WEIGHTS;
