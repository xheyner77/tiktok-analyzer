import type { RepostPriorityInput } from './repost-priority-engine';
import type { PerformancePrediction } from './performance-prediction-engine';
import { scoreRepostPriority } from './repost-priority-engine';

export type VideoDecisionType = 'poster_maintenant' | 'retravailler_hook' | 'raccourcir' | 'format_court' | 'abandonner' | 'repost_immediat' | 'garder_plus_tard';

export interface VideoDecision {
  videoId: string;
  decision: VideoDecisionType;
  reason: string;
  confidence: number;
  estimatedEffort: number;
  estimatedImpact: number;
}

export function videoDecisionEngine(items: RepostPriorityInput[], predictions: PerformancePrediction[]): VideoDecision[] {
  return items.map((item) => {
    const priority = scoreRepostPriority(item);
    const prediction = predictions.find((candidate) => candidate.videoId === item.id);
    const duration = item.result.detectedVideoMeta?.durationSec ?? item.result.videoIntelligence?.metadata.durationSec ?? 0;
    const decision: VideoDecisionType = priority.repostScore >= 78
      ? 'repost_immediat'
      : item.result.hook.score < 62
        ? 'retravailler_hook'
        : duration > 35
          ? 'raccourcir'
          : (prediction?.dropRisk ?? 0) > 72
            ? 'format_court'
            : item.result.viralityScore < 42
              ? 'abandonner'
              : item.result.viralityScore >= 78
                ? 'poster_maintenant'
                : 'garder_plus_tard';

    return {
      videoId: item.id,
      decision,
      reason: priority.reason,
      confidence: prediction?.confidence ?? priority.confidence,
      estimatedEffort: priority.correctionDifficulty,
      estimatedImpact: prediction?.predictionScore ?? priority.repostScore,
    };
  });
}
