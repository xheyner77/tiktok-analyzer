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
  reconstruction: AnalysisResult['reconstructionIA'] | null;
  reconstruction_created_at: string | null;
  reconstruction_plan_used: string | null;
  created_at: string;
}

// Save an analysis result — always persisted so upgrading users see past history
export async function saveAnalysis(
  userId: string,
  videoUrl: string,
  result: AnalysisResult
): Promise<string | null> {
  const { data, error } = await supabase
    .from('analyses')
    .insert({
      user_id: userId,
      video_url: videoUrl,
      result,
      reconstruction: result.reconstructionIA ?? null,
      reconstruction_created_at: result.reconstructionIA?.createdAt ?? null,
      reconstruction_plan_used: result.reconstructionIA?.planUsed ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[saveAnalysis] Error:', error.message, error.code);
    return null;
  }

  return (data as { id?: string } | null)?.id ?? null;
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
    .select('id, user_id, video_url, result, reconstruction, reconstruction_created_at, reconstruction_plan_used, created_at')
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

// Dashboard V2 can show a single locked preview for Free users without unlocking history.
export async function getLatestAnalysisPreview(userId: string): Promise<AnalysisRow | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select('id, user_id, video_url, result, reconstruction, reconstruction_created_at, reconstruction_plan_used, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getLatestAnalysisPreview] Error:', error.message);
    return null;
  }

  return (data as AnalysisRow | null) ?? null;
}

// Internal memory feed for the analyzer engine. This does not unlock history UI for Free users.
export async function getRecentAnalysesForMemory(userId: string, limit = 5): Promise<AnalysisResult[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('result')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getRecentAnalysesForMemory] Error:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (row as { result?: AnalysisResult }).result)
    .filter(Boolean) as AnalysisResult[];
}
