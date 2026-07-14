import 'server-only';

import {
  FinalAnalysisResultSchema,
  type FinalAnalysisResult,
} from '@/lib/analysis-engine/index';
import { supabase } from '@/lib/supabase';

function normalizeRecommendation(value: string): string {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function recommendationFingerprints(result: FinalAnalysisResult): Set<string> {
  const recommendations = [
    ...[
      result.hook,
      result.script,
      result.editing,
      result.visual,
      result.textAndCaptions,
      result.audio,
      result.storytelling,
      result.conversion,
    ].flatMap((section) => section.status === 'available' ? section.recommendations : []),
    ...(result.priorities.status === 'available'
      ? [
          ...result.priorities.critical,
          ...result.priorities.important,
          ...result.priorities.optimizations,
        ]
      : []),
    ...(result.improvedVersion.status === 'available'
      ? [
          ...result.improvedVersion.hooks,
          ...result.improvedVersion.editPlan,
          ...result.improvedVersion.shotList,
          ...result.improvedVersion.onScreenText,
          ...result.improvedVersion.effectsAndBRoll,
          result.improvedVersion.cta,
          result.improvedVersion.caption,
          result.improvedVersion.firstLine,
        ]
      : []),
  ];
  const fingerprints = recommendations.map((recommendation) => normalizeRecommendation([
    recommendation.observation,
    recommendation.text,
    recommendation.example,
  ].join('|')));
  if (result.correctionPlan.status === 'available') {
    fingerprints.push(...result.correctionPlan.steps.map((step) => normalizeRecommendation([
      step.observation,
      step.action,
      step.example,
    ].join('|'))));
  }
  fingerprints.push(...result.timeline.map((segment) => normalizeRecommendation([
    segment.observation,
    segment.recommendedAction,
    segment.example,
  ].join('|'))));
  return new Set(fingerprints.filter(Boolean));
}

export function crossVideoRecommendationSimilarity(
  current: FinalAnalysisResult,
  historical: FinalAnalysisResult,
): { overlap: number; compared: number; ratio: number } {
  const currentFingerprints = recommendationFingerprints(current);
  const historicalFingerprints = recommendationFingerprints(historical);
  const compared = Math.min(currentFingerprints.size, historicalFingerprints.size);
  if (compared === 0) return { overlap: 0, compared: 0, ratio: 0 };
  const overlap = [...currentFingerprints]
    .filter((fingerprint) => historicalFingerprints.has(fingerprint)).length;
  return { overlap, compared, ratio: overlap / compared };
}

export async function assertCrossVideoRecommendationsDistinct(input: {
  userId: string;
  current: FinalAnalysisResult;
  minimumCompared?: number;
  maximumDuplicateRatio?: number;
}): Promise<void> {
  const minimumCompared = Math.max(3, input.minimumCompared ?? 4);
  const maximumDuplicateRatio = Math.min(1, Math.max(0.5, input.maximumDuplicateRatio ?? 0.75));
  const { data, error } = await supabase
    .from('analyses')
    .select('id, analysis_schema_version, engine_result')
    .eq('user_id', input.userId)
    .eq('analysis_schema_version', '2.0.0')
    .neq('id', input.current.analysisId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw new Error('ANALYSIS_GENERICITY_HISTORY_UNAVAILABLE');

  for (const row of data ?? []) {
    const candidate = FinalAnalysisResultSchema.safeParse(
      (row as { engine_result?: unknown }).engine_result,
    );
    if (!candidate.success) continue;
    const similarity = crossVideoRecommendationSimilarity(input.current, candidate.data);
    if (similarity.compared >= minimumCompared && similarity.ratio >= maximumDuplicateRatio) {
      throw new Error('ANALYSIS_RECOMMENDATIONS_REPEATED_ACROSS_VIDEOS');
    }
  }
}
