import type { RepostPriorityInput } from './repost-priority-engine';
import { scoreRepostPriority } from './repost-priority-engine';
import type { AdvancedVideoSignals } from './advanced-video-signals';

export interface PerformancePrediction {
  videoId: string;
  predictionScore: number;
  confidence: number;
  watchtimePotential: number;
  commentPotential: number;
  sharePotential: number;
  dropRisk: number;
  repostPotential: number;
  rawViralPotential: number;
  strengths: string[];
  weaknesses: string[];
  limitingFactor: string;
  disclaimer: string;
}

function clamp(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function performancePredictionEngine(items: RepostPriorityInput[], signals: AdvancedVideoSignals[] = []): PerformancePrediction[] {
  return items.map((item) => {
    const priority = scoreRepostPriority(item);
    const signal = signals.find((candidate) => candidate.videoId === item.id);
    const sub = item.result.coachAnalysis?.subScores;
    const watchtimePotential = clamp((sub?.rewatchPotential ?? item.result.retention.score) + (signal?.pacingAnalysis.includes('exploitable') ? 5 : -3));
    const commentPotential = clamp(priority.commentPotential);
    const sharePotential = clamp((item.result.viralityScore + (sub?.clarity ?? item.result.hook.score)) / 2);
    const dropRisk = clamp(100 - item.result.retention.score + (item.result.hook.score < 60 ? 12 : 0));
    const repostPotential = priority.repostScore;
    const rawViralPotential = clamp(item.result.viralityScore * 0.36 + watchtimePotential * 0.24 + commentPotential * 0.18 + sharePotential * 0.12 + repostPotential * 0.1);
    const predictionScore = clamp(rawViralPotential - dropRisk * 0.12);
    const confidence = clamp((item.result.coachAnalysis?.formatConfidence?.score ?? item.result.videoIntelligence?.confidence.score ?? 54) + (item.result.observedMetrics ? 12 : 0));
    const limitingFactor = item.result.hook.score < item.result.retention.score
      ? 'Hook trop lent ou pas assez tendu'
      : item.result.retention.score < 62
        ? 'Risque de drop avant le payoff'
        : commentPotential < 62
          ? 'CTA trop faible'
          : 'Distribution et preuve sociale encore inconnues';

    return {
      videoId: item.id,
      predictionScore,
      confidence,
      watchtimePotential,
      commentPotential,
      sharePotential,
      dropRisk,
      repostPotential,
      rawViralPotential,
      strengths: [priority.label, item.result.coachAnalysis?.patternLabel ?? 'Format exploitable'].filter(Boolean),
      weaknesses: [limitingFactor, item.result.coachAnalysis?.detectedProblems?.[0]?.title].filter(Boolean) as string[],
      limitingFactor,
      disclaimer: 'Prediction prudente: Viralynz estime un potentiel, pas une garantie virale.',
    };
  });
}
