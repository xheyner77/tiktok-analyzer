import type { PerformancePrediction } from './performance-prediction-engine';
import type { VideoReasoning } from './advanced-video-reasoning';

export interface ContentSuccessPrediction {
  videoId: string;
  watchtime: number;
  comments: number;
  repost: number;
  shares: number;
  retention: number;
  flopRisk: number;
  confidence: number;
  reasons: string[];
  limitingFactors: string[];
  strongFactors: string[];
}

export function contentSuccessPrediction(predictions: PerformancePrediction[], reasoning: VideoReasoning[]): ContentSuccessPrediction[] {
  return predictions.map((prediction) => {
    const reason = reasoning.find((item) => item.videoId === prediction.videoId);
    return {
      videoId: prediction.videoId,
      watchtime: prediction.watchtimePotential,
      comments: prediction.commentPotential,
      repost: prediction.repostPotential,
      shares: prediction.sharePotential,
      retention: Math.max(1, Math.min(100, Math.round((prediction.watchtimePotential + (100 - prediction.dropRisk)) / 2))),
      flopRisk: prediction.dropRisk,
      confidence: prediction.confidence,
      reasons: prediction.strengths,
      limitingFactors: reason?.limitingFactors ?? prediction.weaknesses,
      strongFactors: prediction.strengths,
    };
  });
}
