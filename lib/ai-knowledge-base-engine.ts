import type { ContentMemoryGraph } from './content-memory-graph';
import type { AIStrategyLayer } from './ai-strategy-layer';

export interface AIKnowledgeBase {
  reusablePatterns: string[];
  winningHooks: string[];
  winningStrategies: string[];
  effectiveStructures: string[];
  antiPatterns: string[];
}

export function aiKnowledgeBaseEngine(graph: ContentMemoryGraph, strategy: AIStrategyLayer): AIKnowledgeBase {
  return {
    reusablePatterns: graph.repeatedPatterns,
    winningHooks: graph.resultHooks,
    winningStrategies: strategy.doubleDown,
    effectiveStructures: graph.recurringStructures,
    antiPatterns: [...strategy.stopDoing, ...graph.fatigueFormats.map((format) => `Fatigue possible: ${format}`)],
  };
}
