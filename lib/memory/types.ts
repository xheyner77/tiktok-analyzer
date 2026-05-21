import type { AnalysisResult } from '@/lib/types';

export type MemoryPlan = 'free' | 'starter' | 'pro' | 'lifetime';
export type MemoryTier = 'locked' | 'essential' | 'extended' | 'permanent';
export type MemoryStatus = 'empty' | 'learning' | 'patterns' | 'active' | 'advanced' | 'locked';

export type MemoryFactType =
  | 'hook'
  | 'mistake'
  | 'format'
  | 'cta'
  | 'retention'
  | 'v2'
  | 'style'
  | 'structure'
  | 'audience'
  | 'risk';

export type MemoryFactStatus = 'active' | 'archived' | 'consolidated' | 'ignored';
export type MemoryJobType = 'learn_from_analysis' | 'consolidate' | 'rebuild_profile';
export type MemoryJobStatus = 'pending' | 'running' | 'success' | 'failed';
export type MemoryTask = 'analyze_video' | 'generate_hook' | 'generate_v2' | 'dashboard_memory' | 'radar_future';
export type MemoryOperation = 'extraction' | 'embedding' | 'retrieval' | 'consolidation';

export interface CreatorMemoryProfile {
  id: string;
  user_id: string;
  plan: MemoryPlan;
  memory_tier: MemoryTier;
  memory_score: number;
  analyses_learned: number;
  active_facts_count: number;
  creator_style_summary: string | null;
  hook_style_summary: string | null;
  common_mistakes_summary: string | null;
  strongest_formats_summary: string | null;
  weak_patterns_summary: string | null;
  v2_opportunities_summary: string | null;
  last_learned_at: string | null;
  last_consolidated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorMemoryFact {
  id: string;
  user_id: string;
  analysis_id: string | null;
  source_video_id: string | null;
  type: MemoryFactType;
  title: string;
  content: string;
  evidence: string | null;
  confidence_score: number;
  importance_score: number;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  status: MemoryFactStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatorMemorySnapshot {
  id: string;
  user_id: string;
  plan: MemoryPlan;
  snapshot_type: 'weekly' | 'monthly' | 'consolidation' | 'milestone';
  title: string;
  summary: string;
  patterns: Record<string, unknown>;
  facts_included: number;
  created_at: string;
}

export interface CreatorMemoryJob {
  id: string;
  user_id: string;
  analysis_id: string | null;
  status: MemoryJobStatus;
  job_type: MemoryJobType;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface ExtractedMemoryFact {
  type: MemoryFactType;
  title: string;
  content: string;
  evidence: string;
  confidenceScore: number;
  importanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryProfileUpdates {
  creatorStyleSummary?: string;
  hookStyleSummary?: string;
  commonMistakesSummary?: string;
  strongestFormatsSummary?: string;
  weakPatternsSummary?: string;
  v2OpportunitiesSummary?: string;
}

export interface MemoryExtractionResult {
  facts: ExtractedMemoryFact[];
  profileUpdates: MemoryProfileUpdates;
}

export interface LearnFromAnalysisInput {
  userId: string;
  analysisId: string | null;
  analysisResult: AnalysisResult;
  videoMetadata?: {
    videoUrl?: string;
    transcript?: string;
    durationSec?: number;
    fileName?: string;
  };
  plan: string;
}

export interface MemoryContext {
  enabled: boolean;
  tier: MemoryTier;
  profileSummary: string;
  facts: CreatorMemoryFact[];
  warnings: string[];
  commonMistakes: string[];
  v2Opportunities: string[];
  recommendedStyleConstraints: string[];
  prompt: string;
}

export interface MemoryOverview {
  memoryTier: MemoryTier;
  tierLabel: string;
  memoryScore: number;
  analysesLearned: number;
  activeFactsCount: number;
  status: MemoryStatus;
  nextMilestone: {
    target: number;
    label: string;
    remaining: number;
  } | null;
  profile: MemoryProfileUpdates;
  topFacts: Record<MemoryFactType, CreatorMemoryFact[]>;
  locked: {
    memory: boolean;
    proSections: boolean;
    snapshots: boolean;
  };
  snapshots: CreatorMemorySnapshot[];
}
