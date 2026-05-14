import type {
  AnalysisResult,
  DiagnosticItem,
  RepostVersion,
  ScoreBreakdownItem,
  StructuredDiagnostic,
  ViralSubScores,
  VideoIntelligenceResult,
} from '../types';
import type { AnalysisEngineContext } from '../analysis-engine';

export type BrainModuleName =
  | 'hook_analyzer'
  | 'retention_analyzer'
  | 'cta_analyzer'
  | 'repost_strategist'
  | 'creator_memory_engine';

export type BrainConfidenceLevel = 'low' | 'medium' | 'high';

export interface BrainInput {
  result: AnalysisResult;
  context: AnalysisEngineContext;
  videoIntelligence?: VideoIntelligenceResult;
  transcript: string;
  firstWords: string;
  onScreenText: string[];
  creatorMemoryContext?: string;
}

export interface BrainEvidence {
  signal: string;
  value: string;
}

export interface BrainDiagnostic extends StructuredDiagnostic {
  id: string;
  severity: DiagnosticItem['severity'];
  module: BrainModuleName;
}

export interface BrainModuleResult {
  module: BrainModuleName;
  score: number;
  confidence: number;
  confidenceLevel: BrainConfidenceLevel;
  diagnostics: BrainDiagnostic[];
  evidence: BrainEvidence[];
  fallbackUsed: boolean;
}

export interface HookAnalyzerResult extends BrainModuleResult {
  module: 'hook_analyzer';
  scrollRisk: 'low' | 'medium' | 'high';
  detectedHook: string;
  payoffTiming: 'early' | 'mid' | 'late' | 'unknown';
  corrections: string[];
}

export interface RetentionAnalyzerResult extends BrainModuleResult {
  module: 'retention_analyzer';
  dropMoments: Array<{
    timestamp: string;
    reason: string;
    confidence: number;
  }>;
  rhythm: 'slow' | 'balanced' | 'dense' | 'unknown';
  weakMoments: string[];
}

export interface CtaAnalyzerResult extends BrainModuleResult {
  module: 'cta_analyzer';
  timing: 'early' | 'mid' | 'late' | 'missing' | 'unknown';
  clarity: 'clear' | 'generic' | 'missing' | 'unknown';
  engagementForce: 'low' | 'medium' | 'high';
  optimizedCta: string;
}

export interface RepostStrategistResult extends BrainModuleResult {
  module: 'repost_strategist';
  version: RepostVersion;
  orderedMoves: string[];
  repostPotential: number;
}

export interface CreatorMemoryEngineResult extends BrainModuleResult {
  module: 'creator_memory_engine';
  recurringPatterns: string[];
  personalizationNotes: string[];
}

export interface BrainScoreBreakdown {
  hookScore: number;
  retentionScore: number;
  ctaScore: number;
  clarityScore: number;
  repostPotential: number;
  globalScore: number;
  verdict: string;
  reasons: string[];
  uiBreakdown: ScoreBreakdownItem[];
  subScores: ViralSubScores;
}

export interface ViralynzBrainResult {
  input: BrainInput;
  hook: HookAnalyzerResult;
  retention: RetentionAnalyzerResult;
  cta: CtaAnalyzerResult;
  repost: RepostStrategistResult;
  memory: CreatorMemoryEngineResult;
  scoring: BrainScoreBreakdown;
  diagnostics: BrainDiagnostic[];
  engineMeta: {
    version: 'viralynz-brain-v1';
    modules: BrainModuleName[];
    strictJsonContracts: boolean;
    fallbackMode: 'local_structured' | 'ai_validated' | 'mixed';
  };
}
