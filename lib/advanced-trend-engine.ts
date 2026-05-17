import type { TrendIntelligence } from './trend-intelligence-engine';
import type { TrendDetectionItem } from './trend-detection-engine';

export interface AdvancedTrendEngine {
  hooks: string[];
  formats: string[];
  pacing: string[];
  ctas: string[];
  niche: string[];
  momentum: Array<{ title: string; velocity: number; direction: 'up' | 'flat' | 'down' }>;
}

export function advancedTrendEngine(intelligence: TrendIntelligence, detections: TrendDetectionItem[]): AdvancedTrendEngine {
  return {
    hooks: intelligence.trendingHooks,
    formats: intelligence.trendingFormats,
    pacing: intelligence.trendingPacing,
    ctas: intelligence.trendingCtas,
    niche: intelligence.nicheOpportunities,
    momentum: detections.map((trend) => ({
      title: trend.title,
      velocity: trend.velocity,
      direction: trend.velocity >= 70 ? 'up' : trend.velocity >= 45 ? 'flat' : 'down',
    })),
  };
}
