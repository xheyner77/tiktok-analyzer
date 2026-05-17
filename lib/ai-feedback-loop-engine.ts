import type { RepostPriorityInput } from './repost-priority-engine';
import type { PerformancePrediction } from './performance-prediction-engine';

export interface AIFeedbackLoopItem {
  videoId: string;
  flowState: 'published' | 'results_synced' | 'prediction_compared' | 'memory_updated' | 'recommendations_improved';
  predictionRealityGap?: number;
  learning: string;
}

export function aiFeedbackLoopEngine(items: RepostPriorityInput[], predictions: PerformancePrediction[]): AIFeedbackLoopItem[] {
  return items.map((item) => {
    const prediction = predictions.find((candidate) => candidate.videoId === item.id);
    const hasObserved = !!item.result.observedMetrics && Object.keys(item.result.observedMetrics).length > 0;
    const observedScore = item.result.observedPerformanceScore ?? item.result.viralityScore;
    const gap = prediction ? Math.abs(prediction.predictionScore - observedScore) : undefined;

    return {
      videoId: item.id,
      flowState: hasObserved ? 'recommendations_improved' : 'published',
      predictionRealityGap: hasObserved ? gap : undefined,
      learning: hasObserved
        ? `Prediction comparee aux resultats reels, memoire ajustee avec un ecart de ${Math.round(gap ?? 0)} pts.`
        : 'Resultats post-publication en attente: aucune conclusion inventee.',
    };
  });
}
