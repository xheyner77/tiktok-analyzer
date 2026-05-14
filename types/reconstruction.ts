import type { ReconstructionIAOutput, RepostVersion } from '@/lib/types';

export type ReconstructionSequenceType =
  | 'HOOK'
  | 'PAYOFF'
  | 'PROOF'
  | 'CTA'
  | 'PATTERN_INTERRUPT'
  | 'TRANSITION'
  | 'CONTEXT'
  | 'CORRECTION';

export type ReconstructionMove =
  | 'advance'
  | 'cut'
  | 'keep'
  | 'rewrite'
  | 'insert'
  | 'move_cta';

export interface ReconstructionIssue {
  title: string;
  description: string;
}

export interface ReconstructionSequence {
  id: string;
  start: string;
  end: string;
  type: ReconstructionSequenceType;
  title: string;
  recommendation: string;
  expectedImpact: string;
  retentionGoal: string;
  sourceIssue?: string;
  move?: ReconstructionMove;
}

export interface AlternativeHook {
  id: string;
  angle: 'curiosite' | 'preuve' | 'emotion' | 'erreur_frequente' | 'resultat_final' | 'autorite';
  hook: string;
  why: string;
  bestFor: string;
}

export interface OptimizedCTA {
  id: string;
  cta: string;
  why: string;
  optimalMoment: string;
  engagementGoal: string;
  commentGoal: string;
  watchTimeGoal: string;
}

export interface RetentionFix {
  id: string;
  timeRange: string;
  problem: string;
  fix: string;
  expectedImpact: string;
}

export interface PatternInterrupt {
  id: string;
  at: string;
  instruction: string;
  reason: string;
}

export interface AIReasoningItem {
  id: string;
  title: string;
  body: string;
  signal: string;
}

export interface RetentionPoint {
  id: string;
  time: string;
  current: number;
  optimized: number;
  type: 'baseline' | 'drop' | 'relaunch' | 'payoff' | 'cta';
  label: string;
}

export interface ReconstructionMetric {
  id: string;
  label: string;
  before: number;
  after: number;
  description: string;
}

export interface ReconstructionFlowStep {
  id:
    | 'structure_analysis'
    | 'drop_detection'
    | 'sequence_reconstruction'
    | 'hook_optimization'
    | 'cta_optimization'
    | 'retention_simulation'
    | 'final_structure';
  label: string;
  detail: string;
}

export interface ReconstructionPromptSuite {
  hookAnalysis: string;
  retentionAnalysis: string;
  ctaOptimization: string;
  structureReconstruction: string;
  patternInterruptGeneration: string;
  retentionSimulation: string;
}

export interface ReconstructionInput {
  niche: string;
  objective: string;
  durationSec: number;
  currentStructure: string[];
  drops: string[];
  hookScore: number;
  ctaScore: number;
  rhythm: string;
  contentType: string;
}

export interface ReconstructionPlan {
  retentionScore: number;
  optimizedRetentionScore: number;
  watchTimeScore: number;
  engagementScore: number;
  commentScore: number;
  mainIssue: ReconstructionIssue;
  optimizedStructure: ReconstructionSequence[];
  alternativeHooks: AlternativeHook[];
  optimizedCTAs: OptimizedCTA[];
  retentionFixes: RetentionFix[];
  patternInterrupts: PatternInterrupt[];
  aiReasoning: AIReasoningItem[];
  retentionSimulation: RetentionPoint[];
  metrics: ReconstructionMetric[];
  flow: ReconstructionFlowStep[];
  source: {
    legacy?: ReconstructionIAOutput;
    repost: RepostVersion;
  };
}
