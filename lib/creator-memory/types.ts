import type { AnalysisResult } from '@/lib/types';

export type CreatorMemoryLevelLabel = 'Nouveau' | 'En apprentissage' | 'Personnalise' | 'Avance' | 'Memoire mature';

export type CreatorMemoryInsightType =
  | 'hook_pattern'
  | 'retention_pattern'
  | 'editing_pattern'
  | 'cta_pattern'
  | 'topic_pattern'
  | 'voice_pattern'
  | 'format_pattern'
  | 'experiment';

export interface CreatorMemoryLearning {
  type: CreatorMemoryInsightType;
  insight: string;
  evidence: string;
  confidence: number;
}

export interface CreatorMemoryInsights {
  new_learnings: CreatorMemoryLearning[];
  creator_profile_updates: {
    niche?: string;
    audience_profile?: string;
    creator_voice?: string;
    content_style?: string;
    hook_style?: string;
    editing_style?: string;
    cta_style?: string;
  };
  winning_patterns: string[];
  weak_patterns: string[];
  recurring_mistakes: string[];
  winning_hooks: string[];
  losing_hooks: string[];
  retention_patterns: string[];
  topic_patterns: string[];
  vocabulary_patterns: string[];
  pacing_patterns: string[];
  format_preferences: string[];
  next_experiments: string[];
  do_more_of: string[];
  avoid_doing: string[];
}

export interface CreatorMemoryRecord {
  id?: string;
  user_id: string;
  version: number;
  memory_level: number;
  confidence_score: number;
  total_analyses_learned_from: number;
  last_analysis_id: string | null;
  last_learned_at: string | null;
  profile_summary: string;
  niche: string;
  audience_profile: string;
  creator_voice: string;
  content_style: string;
  hook_style: string;
  editing_style: string;
  cta_style: string;
  strongest_patterns: string[];
  weakest_patterns: string[];
  recurring_mistakes: string[];
  winning_hooks: string[];
  losing_hooks: string[];
  retention_patterns: string[];
  topic_patterns: string[];
  vocabulary_patterns: string[];
  pacing_patterns: string[];
  format_preferences: string[];
  do_more_of: string[];
  avoid_doing: string[];
  next_experiments: string[];
  raw_memory_json: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface CreatorMemoryEventRecord {
  id: string;
  user_id: string;
  analysis_id: string | null;
  event_type: string;
  extracted_insights_json: CreatorMemoryInsights;
  memory_before_summary: string;
  memory_after_summary: string;
  confidence_delta: number;
  created_at: string;
}

export interface MemoryAnalysisSource {
  userId: string;
  analysisId: string | null;
  result: AnalysisResult;
  transcript?: string;
  videoUrl?: string;
}
