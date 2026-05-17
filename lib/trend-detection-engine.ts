import type { RepostPriorityInput } from './repost-priority-engine';

export interface TrendDetectionItem {
  id: string;
  type: 'hook' | 'format' | 'structure' | 'niche';
  title: string;
  velocity: number;
  confidence: 'faible' | 'moyenne' | 'elevee';
  source: 'creator_memory' | 'external_pending';
}

function clamp(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function trendDetectionEngine(items: RepostPriorityInput[]): TrendDetectionItem[] {
  const firstFormat = items[0]?.result.coachAnalysis?.patternLabel ?? 'Format dominant';
  const firstHook = items[0]?.result.repostVersion?.hook ?? 'Hook direct';
  return [
    {
      id: 'trend_hook',
      type: 'hook',
      title: firstHook,
      velocity: clamp(38 + items.length * 8),
      confidence: items.length >= 5 ? 'elevee' : items.length ? 'moyenne' : 'faible',
      source: items.length ? 'creator_memory' : 'external_pending',
    },
    {
      id: 'trend_format',
      type: 'format',
      title: firstFormat,
      velocity: clamp(34 + items.filter((item) => item.result.coachAnalysis?.patternLabel === firstFormat).length * 12),
      confidence: items.length >= 3 ? 'moyenne' : 'faible',
      source: items.length ? 'creator_memory' : 'external_pending',
    },
    {
      id: 'trend_structure',
      type: 'structure',
      title: 'Preuve avant explication',
      velocity: clamp(52 + items.filter((item) => item.result.coachAnalysis?.detectedProblems?.some((problem) => /preuve|payoff|promesse/i.test(problem.title))).length * 7),
      confidence: 'moyenne',
      source: items.length ? 'creator_memory' : 'external_pending',
    },
  ];
}
