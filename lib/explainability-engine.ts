import type { AnalysisResult, DiagnosticItem, StructuredDiagnostic } from './types';
import type { ViralynzBrainResult } from './viralynz-brain';
import { ENGINE_VERSIONS, SIGNAL_WEIGHTS } from './scoring-weights';

export interface ExplainabilitySignal {
  key: string;
  value: string | number | boolean | null;
  weight: number;
  contribution: number;
  source: string;
  confidence: number;
}

export interface ExplainabilityRule {
  id: string;
  label: string;
  triggered: boolean;
  impact: number;
  evidence: string;
}

export interface ScoreExplanation {
  scoreKey: 'hook' | 'retention' | 'cta' | 'clarity' | 'repostPotential' | 'global';
  score: number;
  baseScore: number;
  signals: ExplainabilitySignal[];
  rules: ExplainabilityRule[];
  reasons: string[];
  confidence: number;
}

export interface AnalysisExplainability {
  engineVersion: string;
  scoringVersion: string;
  promptVersion: string;
  rulesVersion: string;
  deterministic: boolean;
  replayKey: string;
  signalWeights: typeof SIGNAL_WEIGHTS;
  scoreExplanations: ScoreExplanation[];
  diagnosticExplanations: Array<{
    title: string;
    why: string;
    triggeredBy: string[];
    impact: string;
    confidence: number;
  }>;
  limitations: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function confidenceFromSignals(result: AnalysisResult, extra = 0) {
  const vi = result.videoIntelligence;
  const base =
    (vi?.transcript.available ? SIGNAL_WEIGHTS.confidence.transcript_weight : SIGNAL_WEIGHTS.confidence.missing_signal_penalty)
    + (vi?.onScreenText.available ? SIGNAL_WEIGHTS.confidence.ocr_weight : SIGNAL_WEIGHTS.confidence.missing_signal_penalty)
    + (vi?.frames.sampled ? SIGNAL_WEIGHTS.confidence.frame_sampling_weight : SIGNAL_WEIGHTS.confidence.missing_signal_penalty)
    + extra;
  return Math.max(0.18, Math.min(0.94, 0.48 + base));
}

function signal(key: string, value: ExplainabilitySignal['value'], weight: number, contribution: number, source: string, confidence: number): ExplainabilitySignal {
  return { key, value, weight, contribution, source, confidence };
}

function rule(id: string, label: string, triggered: boolean, impact: number, evidence: string): ExplainabilityRule {
  return { id, label, triggered, impact: triggered ? impact : 0, evidence };
}

function hookExplanation(result: AnalysisResult, brain: ViralynzBrainResult): ScoreExplanation {
  const technical = result.videoIntelligence?.technicalSignals;
  const payoffDelay = technical?.structure.timeToPayoffSec ?? null;
  const hookType = brain.hook.detectedHook;
  const rules = [
    rule('payoff_delay', 'Payoff tardif', typeof payoffDelay === 'number' && payoffDelay > 4, SIGNAL_WEIGHTS.hook.payoff_delay_weight, payoffDelay ? `Payoff estime a ${payoffDelay}s.` : 'Payoff non detecte.'),
    rule('proof_hook', 'Hook preuve', /preuve|resultat|avant|test/i.test(hookType), SIGNAL_WEIGHTS.hook.proof_hook_weight, brain.hook.detectedHook),
    rule('descriptive_intro', 'Intro descriptive', brain.hook.detectedHook.split(/\s+/).length > 18, SIGNAL_WEIGHTS.hook.descriptive_intro_weight, `${brain.hook.detectedHook.split(/\s+/).length} mots dans le hook.`),
    rule('tension_signal', 'Tension forte', brain.hook.scrollRisk === 'low', SIGNAL_WEIGHTS.hook.tension_weight, `Scroll risk: ${brain.hook.scrollRisk}.`),
  ];
  return {
    scoreKey: 'hook',
    score: brain.scoring.subScores.hook,
    baseScore: 55,
    signals: [
      signal('payoff_position', payoffDelay, SIGNAL_WEIGHTS.hook.payoff_delay_weight, rules[0].impact, 'technicalSignals.structure.timeToPayoffSec', brain.hook.confidence),
      signal('detected_hook', brain.hook.detectedHook, SIGNAL_WEIGHTS.hook.proof_hook_weight, rules[1].impact, 'hook_analyzer', brain.hook.confidence),
      signal('scroll_risk', brain.hook.scrollRisk, SIGNAL_WEIGHTS.hook.tension_weight, rules[3].impact, 'hook_analyzer', brain.hook.confidence),
    ],
    rules,
    reasons: brain.hook.diagnostics.map((item) => item.fix).slice(0, 3),
    confidence: brain.hook.confidence,
  };
}

function retentionExplanation(result: AnalysisResult, brain: ViralynzBrainResult): ScoreExplanation {
  const technical = result.videoIntelligence?.technicalSignals;
  const avgShot = technical?.visual.avgShotDurationSec ?? null;
  const density = technical?.visual.visualDensity ?? result.videoIntelligence?.visualSignals.textDensityEstimate ?? 0;
  const interrupts = technical?.visual.patternInterrupts.length ?? 0;
  const rules = [
    rule('slow_rhythm', 'Rythme visuel lent', brain.retention.rhythm === 'slow', SIGNAL_WEIGHTS.retention.slow_rhythm_weight, `Rythme: ${brain.retention.rhythm}.`),
    rule('static_segment', 'Segment statique long', typeof avgShot === 'number' && avgShot > 4.5, SIGNAL_WEIGHTS.retention.static_segment_weight, avgShot ? `Plan moyen estime ${avgShot}s.` : 'Signal plan indisponible.'),
    rule('visual_density', 'Densite visuelle utile', density >= 60, SIGNAL_WEIGHTS.retention.visual_density_weight, `Densite visuelle ${density}/100.`),
    rule('pattern_interrupt', 'Pattern interrupts', interrupts >= 2, SIGNAL_WEIGHTS.retention.pattern_interrupt_weight, `${interrupts} ruptures detectees.`),
  ];
  return {
    scoreKey: 'retention',
    score: brain.scoring.subScores.retention,
    baseScore: 55,
    signals: [
      signal('avg_shot_duration', avgShot, SIGNAL_WEIGHTS.retention.static_segment_weight, rules[1].impact, 'technicalSignals.visual', brain.retention.confidence),
      signal('visual_density', density, SIGNAL_WEIGHTS.retention.visual_density_weight, rules[2].impact, 'technicalSignals.visual', brain.retention.confidence),
      signal('pattern_interrupts', interrupts, SIGNAL_WEIGHTS.retention.pattern_interrupt_weight, rules[3].impact, 'technicalSignals.visual', brain.retention.confidence),
    ],
    rules,
    reasons: brain.retention.diagnostics.map((item) => item.fix).slice(0, 3),
    confidence: brain.retention.confidence,
  };
}

function ctaExplanation(brain: ViralynzBrainResult): ScoreExplanation {
  const rules = [
    rule('missing_cta', 'CTA absent', brain.cta.timing === 'missing', SIGNAL_WEIGHTS.cta.missing_cta_weight, `Timing CTA: ${brain.cta.timing}.`),
    rule('generic_cta', 'CTA generique', brain.cta.clarity === 'generic', SIGNAL_WEIGHTS.cta.generic_cta_weight, `Clarte CTA: ${brain.cta.clarity}.`),
    rule('question_cta', 'CTA question', brain.cta.clarity === 'clear' && brain.cta.optimizedCta.includes('?'), SIGNAL_WEIGHTS.cta.question_cta_weight, brain.cta.optimizedCta),
    rule('cta_position', 'CTA bien place', brain.cta.timing === 'late', SIGNAL_WEIGHTS.cta.cta_position_weight, `Position: ${brain.cta.timing}.`),
  ];
  return {
    scoreKey: 'cta',
    score: brain.scoring.subScores.cta,
    baseScore: 55,
    signals: [
      signal('cta_timing', brain.cta.timing, SIGNAL_WEIGHTS.cta.cta_position_weight, rules[3].impact, 'cta_analyzer', brain.cta.confidence),
      signal('cta_clarity', brain.cta.clarity, SIGNAL_WEIGHTS.cta.generic_cta_weight, rules[1].impact, 'cta_analyzer', brain.cta.confidence),
      signal('optimized_cta', brain.cta.optimizedCta, SIGNAL_WEIGHTS.cta.question_cta_weight, rules[2].impact, 'cta_analyzer', brain.cta.confidence),
    ],
    rules,
    reasons: brain.cta.diagnostics.map((item) => item.fix).slice(0, 3),
    confidence: brain.cta.confidence,
  };
}

function globalExplanation(result: AnalysisResult, brain: ViralynzBrainResult): ScoreExplanation {
  const weights = SIGNAL_WEIGHTS.global;
  const subs = brain.scoring.subScores;
  const signals = [
    signal('hook', subs.hook, weights.hook_score_weight, subs.hook * weights.hook_score_weight, 'viralynz-brain.scoring', brain.hook.confidence),
    signal('retention', subs.retention, weights.retention_score_weight, subs.retention * weights.retention_score_weight, 'viralynz-brain.scoring', brain.retention.confidence),
    signal('cta', subs.cta, weights.cta_score_weight, subs.cta * weights.cta_score_weight, 'viralynz-brain.scoring', brain.cta.confidence),
    signal('clarity', subs.clarity, weights.clarity_score_weight, subs.clarity * weights.clarity_score_weight, 'viralynz-brain.scoring', confidenceFromSignals(result)),
    signal('repostPotential', subs.repostPotential, weights.repost_potential_weight, subs.repostPotential * weights.repost_potential_weight, 'viralynz-brain.scoring', brain.repost.confidence),
  ];
  return {
    scoreKey: 'global',
    score: brain.scoring.globalScore,
    baseScore: 50,
    signals,
    rules: [],
    reasons: brain.scoring.reasons,
    confidence: Math.round((signals.reduce((sum, item) => sum + item.confidence, 0) / signals.length) * 100) / 100,
  };
}

function diagnosticExplanation(item: StructuredDiagnostic | DiagnosticItem) {
  const title = 'title' in item ? item.title : 'Diagnostic';
  const evidence = 'evidence' in item ? item.evidence : item.impact;
  const fix = 'fix' in item ? item.fix : item.action;
  const confidence = 'confidence' in item ? item.confidence : item.severity === 'critique' ? 0.78 : item.severity === 'important' ? 0.64 : 0.52;
  return {
    title,
    why: evidence,
    triggeredBy: [evidence].filter(Boolean),
    impact: 'impact' in item ? item.impact : fix,
    confidence,
  };
}

export function buildAnalysisExplainability(result: AnalysisResult, brain: ViralynzBrainResult): AnalysisExplainability {
  const technical = result.videoIntelligence?.technicalSignals;
  const replayPayload = JSON.stringify({
    video: result.detectedVideoMeta ?? result.analyzerMeta,
    technical,
    transcript: result.videoIntelligence?.transcript.text?.slice(0, 240),
    scores: brain.scoring.subScores,
    versions: ENGINE_VERSIONS,
  });
  const diagnostics = [
    ...(result.structuredDiagnostics ?? []),
    ...(result.coachAnalysis?.detectedProblems ?? []),
  ].slice(0, 10);
  return {
    engineVersion: ENGINE_VERSIONS.engine,
    scoringVersion: ENGINE_VERSIONS.scoring,
    promptVersion: ENGINE_VERSIONS.prompt,
    rulesVersion: ENGINE_VERSIONS.rules,
    deterministic: true,
    replayKey: hash(replayPayload),
    signalWeights: SIGNAL_WEIGHTS,
    scoreExplanations: [
      hookExplanation(result, brain),
      retentionExplanation(result, brain),
      ctaExplanation(brain),
      {
        scoreKey: 'clarity',
        score: brain.scoring.subScores.clarity,
        baseScore: 55,
        signals: [
          signal('hook_clarity', brain.scoring.subScores.hook, 0.35, brain.scoring.subScores.hook * 0.35, 'weighted-scoring-v1', brain.hook.confidence),
          signal('retention_clarity', brain.scoring.subScores.retention, 0.25, brain.scoring.subScores.retention * 0.25, 'weighted-scoring-v1', brain.retention.confidence),
          signal('cta_clarity', brain.scoring.subScores.cta, 0.2, brain.scoring.subScores.cta * 0.2, 'weighted-scoring-v1', brain.cta.confidence),
        ],
        rules: [],
        reasons: ['Combine hook, retention et CTA pour estimer la comprehension probable.'],
        confidence: confidenceFromSignals(result),
      },
      {
        scoreKey: 'repostPotential',
        score: brain.scoring.subScores.repostPotential,
        baseScore: 55,
        signals: brain.repost.evidence.map((item) => signal(item.signal, item.value, 0.2, brain.scoring.subScores.repostPotential * 0.2, 'repost_strategist', brain.repost.confidence)),
        rules: brain.repost.diagnostics.map((item) => rule(item.id, item.title, true, 4, item.evidence)),
        reasons: brain.repost.orderedMoves,
        confidence: brain.repost.confidence,
      },
      globalExplanation(result, brain),
    ],
    diagnosticExplanations: diagnostics.map(diagnosticExplanation),
    limitations: [
      ...(result.videoIntelligence?.limitations ?? []),
      ...(technical?.antiHallucination.missingSignals.map((missing) => `Signal manquant: ${missing}`) ?? []),
      'Les benchmarks sont internes et structurels, pas des statistiques TikTok reelles sauf donnees explicitement fournies.',
    ].slice(0, 10),
  };
}
