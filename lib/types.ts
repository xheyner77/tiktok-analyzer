import type { ReconstructionPlan as StructuredReconstructionPlan } from '@/types/reconstruction';

export type Rating = 'Excellent' | 'Bon' | 'Moyen' | 'Faible';
export type Priority = 'haute' | 'moyenne' | 'basse';
export type DiagnosticSeverity = 'critique' | 'important' | 'optimisation';
export type VideoPattern =
  | 'storytelling_lent'
  | 'video_informative'
  | 'facecam_tiktok'
  | 'playback_lipsync'
  | 'motivation'
  | 'ecommerce'
  | 'hook_agressif'
  | 'video_preuve'
  | 'video_emotionnelle'
  | 'tutoriel'
  | 'demo_produit'
  | 'avant_apres'
  | 'vlog_lifestyle'
  | 'gaming'
  | 'humour'
  | 'sans_parole'
  | 'montage_rapide';

export interface AnalysisSection {
  score: number;
  rating: Rating;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Improvement {
  priority: Priority;
  tip: string;
}

export interface AnalyzerContext {
  objective?: string;
  objectiveLabel?: string;
  niche?: string;
  nicheLabel?: string;
  fileName?: string;
  fileSizeMb?: number;
  status?: 'completed' | 'processing' | 'failed';
  verdictShort?: string;
  recommendations?: string[];
  validationWarnings?: string[];
  analysisMode?: 'vision' | 'metadata' | 'fallback' | 'demo';
  analysisModeLabel?: string;
  isFallback?: boolean;
  analysisConfidence?: {
    score: number;
    level: 'faible' | 'moyenne' | 'elevee';
    reasons: string[];
  };
  signalDisclosure?: {
    observedData: string[];
    aiHypotheses: string[];
    simulations: string[];
    previews: string[];
  };
  costEstimate?: {
    model: string;
    estimatedUsd: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  };
  quality?: {
    qualityScore: number;
    issues: string[];
    regeneratedSections: string[];
    modelUsed?: string;
    escalationTriggered?: boolean;
    estimatedAdditionalCostUsd?: number;
  };
}

export interface RepostVersion {
  hook: string;
  structure: string[];
  onScreenText: string[];
  cta: string;
  angle: string;
  hookVariants?: string[];
  shortVersion?: string;
  beforeAfter?: {
    before: string;
    after: string;
  };
}

export interface ViralSubScores {
  hook: number;
  retention: number;
  clarity: number;
  tension: number;
  cta: number;
  repostPotential: number;
  engagementPotential: number;
  rewatchPotential: number;
}

export interface DiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  explanation: string;
  impact: string;
  action: string;
  timecode?: string;
}

export interface StructuredDiagnostic {
  title: string;
  explanation: string;
  timestamp?: string;
  evidence: string;
  impact: string;
  fix: string;
  confidence: number;
}

export interface TikTokBenchmark {
  label: string;
  insight: string;
  delta: string;
}

export interface RepostEngine {
  recommended: boolean;
  estimatedGain: number;
  improvementProbability: number;
  priorityChanges: string[];
  scoreBefore: number;
  scoreAfter: number;
  repostPotentialCeiling?: number;
  dominantFailure?: {
    title: string;
    cause: string;
    evidence: string[];
    estimatedImpact: string;
    priorityFix: string;
  };
  bestOpportunity?: {
    title: string;
    why: string;
    action: string;
    expectedLift: string;
  };
}

export interface OptimizedStructureStep {
  start: string;
  end: string;
  type: 'HOOK' | 'PROOF' | 'ERROR' | 'CORRECTION' | 'CTA' | 'PATTERN_INTERRUPT' | 'CONTEXT' | 'PAYOFF';
  goal: string;
  recommendation: string;
  expectedImpact: string;
  sourceIssue?: string;
  move?: 'advance' | 'cut' | 'keep' | 'rewrite' | 'insert' | 'move_cta';
}

export interface ReconstructionIAOutput {
  optimizedStructure: OptimizedStructureStep[];
  alternativeHooks: {
    hook: string;
    why: string;
    bestFor: string;
  }[];
  ctaRecommendations: {
    cta: string;
    why: string;
  }[];
  optimizedCTAs?: {
    cta: string;
    why: string;
  }[];
  retentionFixes: {
    timeRange: string;
    problem: string;
    fix: string;
    expectedImpact: string;
  }[];
  cutsRecommended: {
    timeRange: string;
    reason: string;
    replacement?: string;
  }[];
  patternInterrupts: {
    at: string;
    instruction: string;
    reason: string;
  }[];
  recommendedOrder: string[];
  whyThisStructureWorks: {
    retentionLogic: string;
    viewerPsychology: string;
    changeJustification: string;
  };
  predictedImprovements: {
    retentionPotential: number;
    watchTimePotential: number;
    engagementPotential: number;
    commentPotential: number;
    label: string;
  };
  aiReasoning?: string[];
  createdAt?: string;
  planUsed?: 'pro' | 'lifetime' | 'scale';
  scaleVariants?: {
    name: string;
    optimizedStructure: OptimizedStructureStep[];
    predictedScore: number;
    bestFor: string;
  }[];
  structureComparison?: {
    label: string;
    score: number;
    tradeoff: string;
  }[];
  abHooks?: {
    variant: 'A' | 'B' | 'C';
    hook: string;
    hypothesis: string;
  }[];
  multiVersions?: {
    label: string;
    focus: string;
    recommendedOrder: string[];
  }[];
}

export interface ReconstructionQuotaState {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface ReconstructionAccessState {
  status: 'available' | 'locked' | 'quota_exceeded' | 'empty' | 'error';
  plan: 'free' | 'starter' | 'pro' | 'lifetime' | 'creator' | 'scale';
  quota: ReconstructionQuotaState;
  message?: string;
}

export type HookStyle =
  | 'curiosity'
  | 'storytelling'
  | 'authority'
  | 'emotion'
  | 'debate'
  | 'watchtime'
  | 'comments'
  | 'contrarian'
  | 'proof'
  | 'drama'
  | 'educational'
  | 'fomo'
  | 'controversial'
  | 'beginner_mistake'
  | 'secret'
  | 'stop_scrolling'
  | 'nobody_talks';

export type VideoFormat =
  | 'facecam'
  | 'texte_ecran'
  | 'storytelling'
  | 'tutoriel'
  | 'ecommerce'
  | 'humour'
  | 'playback_lipsync'
  | 'sans_parole'
  | 'gaming'
  | 'lifestyle'
  | 'motivation'
  | 'avant_apres';

export type HookObjective =
  | 'views'
  | 'watchtime'
  | 'comments'
  | 'clicks'
  | 'authority'
  | 'repost'
  | 'first_seconds';

export interface GeneratedHook {
  style: HookStyle;
  hook: string;
  whyItWorks: string;
  aggressiveness: number;
  difficulty?: number;
  emotionType?: string;
  objective?: 'views' | 'watchtime' | 'comments' | 'clicks' | 'authority';
  watchtimeScore?: number;
  commentScore?: number;
  curiosityScore?: number;
  emotionScore?: number;
  rawViralScore?: number;
  estimatedRetentionBoost: string;
  score: number;
  proOnly?: boolean;
}

export interface HookPack {
  id: string;
  title: string;
  style: HookStyle;
  format: VideoFormat;
  objective: HookObjective;
  spokenHook: string;
  onScreenText: string;
  firstFrame: string;
  visualAction: string;
  cameraDirection: string;
  cutTiming: string;
  deliveryTone: string;
  soundCue?: string;
  scriptOpening: {
    time: string;
    instruction: string;
  }[];
  whyItWorks: string;
  bestFor: string[];
  risk?: string;
  scores: {
    overall: number;
    scrollStop: number;
    curiosity: number;
    emotion: number;
    clarity: number;
    comments: number;
    watchtime: number;
  };
  aggression: number;
  difficulty: 'facile' | 'moyen' | 'avancé';
  source: 'openai' | 'local_fallback' | 'analysis_based';
}

export interface TimelineMarker {
  time: string;
  type: 'hook' | 'drop' | 'tension' | 'rewatch' | 'cta' | 'payoff';
  label: string;
  insight: string;
  severity: DiagnosticSeverity;
}

export interface ScoreBreakdownItem {
  label: string;
  score: number;
  weight: number;
  reason: string;
}

export type AnalysisPipelineStepStatus = 'pending' | 'running' | 'done' | 'warning' | 'failed';

export interface AnalysisPipelineStep {
  id: string;
  label: string;
  status: AnalysisPipelineStepStatus;
  microcopy: string;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  warning?: string;
  error?: string;
}

export interface AnalysisPipelineState {
  currentStep: string;
  progress: number;
  steps: AnalysisPipelineStep[];
  warnings: string[];
  signalsAvailable: string[];
  limitations: string[];
  startedAt: string;
  completedAt?: string;
}

export interface DetailedScoreItem {
  key:
    | 'openingScore'
    | 'hookScore'
    | 'clarityScore'
    | 'retentionScore'
    | 'visualEnergyScore'
    | 'pacingScore'
    | 'payoffScore'
    | 'ctaScore'
    | 'repostPotentialScore';
  label: string;
  value: number;
  reason: string;
  signalsUsed: string[];
  confidence: number;
}

export interface ViralynzMemory {
  recurrentWeaknesses: string[];
  favoritePatterns: string[];
  creatorEvolution: string;
  nextRecommendation: string;
}

export type HookSourceType =
  | 'vocal'
  | 'visuel'
  | 'texte_ecran'
  | 'emotionnel'
  | 'curiosite'
  | 'probleme'
  | 'preuve';

export interface HookSourceAnalysis {
  type: HookSourceType;
  strength: number;
  evidence: string;
  recommendation: string;
}

export interface VideoSegmentAnalysis {
  range: '0-1s' | '1-3s' | '3-5s' | '0-2s' | '2-5s' | '5-10s' | '10-20s' | 'fin';
  role: string;
  signalsUsed?: string[];
  onScreenText?: string;
  transcriptExcerpt?: string;
  tension: number;
  clarity: number;
  dropRisk: number;
  visualRhythm?: 'faible' | 'moyen' | 'eleve' | 'unknown';
  rewatchPotential: number;
  mainProblem: string;
  concreteCorrection?: string;
  recommendation: string;
}

export interface OpeningAnalysis {
  firstFrame: string;
  initialOnScreenText?: string;
  vocalHook?: string;
  promise: string;
  curiosity: number;
  emotion: number;
  proof: number;
  friction: number;
  clarity: number;
  stopScrollScore: number;
  recommendedAction: string;
  mainProblem: string;
  whyItBlocks: string;
  exactCorrection: string;
  newHook: string;
  newOnScreenText: string;
  recommendedFirstFrame: string;
  signalsUsed: string[];
  confidence: number;
}

export interface DetectedVideoFormat {
  primary: VideoPattern | 'autre_ambigu';
  secondary: VideoPattern[];
  confidence: number;
  level: 'faible' | 'moyenne' | 'élevée';
  reasons: string[];
  signalsUsed: string[];
  limitations: string[];
}

export interface AnalysisConfidence {
  score: number;
  level: 'faible' | 'moyenne' | 'élevée';
  reasons: string[];
  limitations: string[];
}

export interface TranscriptAnalysis {
  available: boolean;
  firstPhrase?: string;
  hookWordCount: number;
  avgWordsPerSentence: number;
  hasQuestion: boolean;
  hasCta: boolean;
  hasPromise: boolean;
  hasPayoff: boolean;
  hasPatternInterrupt: boolean;
  repetitionRate: number;
  energyScore: number;
  mentalFriction: number;
  weakWords: string[];
  strongWords: string[];
}

export interface VideoIntelligenceResult {
  metadata: {
    durationSec?: number;
    fileName?: string;
    fileSizeMb?: number;
    mimeType?: string;
    frameCount: number;
    estimatedAspectRatio?: 'vertical' | 'square' | 'horizontal' | 'unknown';
    source: 'upload_frames' | 'url_metadata' | 'fallback';
  };
  transcript: {
    available: boolean;
    text?: string;
    confidence: number;
    source: 'whisper' | 'provided' | 'none';
    limitations: string[];
  };
  frames: {
    sampled: boolean;
    count: number;
    timestamps: number[];
    quality: 'faible' | 'moyenne' | 'bonne';
    limitations: string[];
  };
  onScreenText: {
    available: boolean;
    text: string[];
    dominantText?: string;
    firstFrameText?: string;
    textDensity: number;
    confidence: number;
    source: 'vision_ocr' | 'not_available';
    limitations: string[];
  };
  visualSignals: {
    available: boolean;
    visualEnergy: number;
    motionEstimate: number;
    cutDensityEstimate: number;
    cutRhythm: 'faible' | 'moyen' | 'élevé' | 'unknown';
    facePresence: 'detected' | 'not_detected' | 'unknown';
    faceConfidence?: number;
    facecamLikely?: boolean;
    textDensityEstimate: number;
    limitations: string[];
  };
  audioSignals: {
    available: boolean;
    speechDetected: boolean;
    speechDensity: number;
    limitations: string[];
  };
  technicalSignals?: import('./proprietary-video-engine').ProprietaryVideoSignals;
  confidence: {
    score: number;
    level: 'faible' | 'moyenne' | 'élevée';
    signalsUsed: string[];
    missingSignals: string[];
  };
  limitations: string[];
}

export interface CoachAnalysis {
  videoPattern: VideoPattern;
  patternLabel: string;
  subScores: ViralSubScores;
  weightedScore: number;
  verdict: string;
  coachSummary: string;
  detectedProblems: DiagnosticItem[];
  criticalErrors: DiagnosticItem[];
  benchmarks: TikTokBenchmark[];
  hookVariants: string[];
  optimizedCtas: string[];
  priorityActions: {
    critical: string[];
    important: string[];
    optimization: string[];
  };
  repostEngine: RepostEngine;
  shareables?: {
    hookRoast: string;
    beforeAfterSnippet: string;
    tiktokCaption: string;
    screenshotTitle: string;
    viralAnalysisScript?: string;
    correctedHookSnippet?: string;
  };
  userProgress?: {
    estimatedImprovement: string;
    nextMilestone: string;
    progressSignal: string;
  };
  timeline?: TimelineMarker[];
  scoreBreakdown?: ScoreBreakdownItem[];
  detailedScores?: DetailedScoreItem[];
  openingAnalysis?: OpeningAnalysis;
  memory?: ViralynzMemory;
  formatConfidence?: AnalysisConfidence;
  transcriptAnalysis?: TranscriptAnalysis;
  hookSources?: HookSourceAnalysis[];
  dominantHookSource?: HookSourceType;
  videoSegments?: VideoSegmentAnalysis[];
  detectedVideoFormat?: DetectedVideoFormat;
  multimodalFusion?: {
    coherenceScore: number;
    level: 'forte' | 'moyenne' | 'faible' | 'contradictoire';
    summary: string;
    signals: string[];
    contradictions: string[];
  };
  engineMeta?: {
    version: string;
    preparedSignals: string[];
    fallbackMode?: 'transcript_first' | 'visual_prudent' | 'mixed';
  };
}

export interface AnalysisResult {
  /** Origine de l’analyse (lien TikTok vs fichier upload + vision) */
  analysisSource?: 'url' | 'vision_upload';
  viralityScore: number;
  structureScore?: number;
  observedPerformanceScore?: number;
  observedPerformanceLabel?: string;
  observedPerformanceEstimated?: boolean;
  overperformanceDetected?: boolean;
  observedStatsSource?: 'cache' | 'live_page' | 'live_oembed' | 'manual' | 'none';
  unavailableObservedStats?: string[];
  finalVerdict?: string;
  /** Analyse comparative — texte généré par l’IA (évite les paragraphes génériques du front) */
  comparativeInsight?: string;
  /** Action prioritaire — dérivée des faiblesses identifiées */
  comparativePriority?: string;
  observedMetrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  detectedVideoMeta?: {
    favorites?: number;
    durationSec?: number;
    authorUsername?: string;
    publishedAt?: string;
    caption?: string;
  };
  hook: AnalysisSection;
  editing: AnalysisSection;
  retention: AnalysisSection;
  improvements: Improvement[];
  analyzerMeta?: AnalyzerContext;
  repostVersion?: RepostVersion;
  reconstructionIA?: ReconstructionIAOutput;
  structuredReconstructionIA?: StructuredReconstructionPlan;
  reconstructionAccess?: ReconstructionAccessState;
  actionPlan?: string[];
  coachAnalysis?: CoachAnalysis;
  videoIntelligence?: VideoIntelligenceResult;
  structuredDiagnostics?: StructuredDiagnostic[];
  explainability?: import('./explainability-engine').AnalysisExplainability;
  strategy?: string;   // Advanced plan — personalized content strategy
  viralTips?: string[]; // Advanced plan — what top viral videos do in this niche
}
