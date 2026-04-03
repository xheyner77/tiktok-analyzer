import { supabase } from './supabase';
import type { Plan } from './supabase';
import type { AnalysisResult } from './types';
import { HISTORY_LIMITS } from './plan-limits';

export { HISTORY_LIMITS };

export interface AnalysisRow {
  id: string;
  user_id: string;
  video_url: string;
  result: AnalysisResult;
  created_at: string;
}

// Save an analysis result — always persisted so upgrading users see past history
export async function saveAnalysis(
  userId: string,
  videoUrl: string,
  result: AnalysisResult
): Promise<void> {
  const { error } = await supabase.from('analyses').insert({
    user_id: userId,
    video_url: videoUrl,
    result,
  });

  if (error) {
    console.error('[saveAnalysis] Error:', error.message, error.code);
  }
}

// Fetch user's analyses — returns [] for free plan (no history access)
export async function getAnalyses(
  userId: string,
  plan: Plan
): Promise<AnalysisRow[]> {
  const limit = HISTORY_LIMITS[plan] ?? 0;

  if (limit === 0) return [];

  let query = supabase
    .from('analyses')
    .select('id, user_id, video_url, result, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (limit !== Infinity) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getAnalyses] Error:', error.message);
    return [];
  }

  return (data ?? []) as AnalysisRow[];
}
