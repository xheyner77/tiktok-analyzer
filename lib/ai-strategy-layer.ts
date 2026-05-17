import type { ContentStrategy } from './content-strategy-engine';
import type { PerformanceDNA } from './performance-dna-engine';

export interface AIStrategyLayer {
  stopDoing: string[];
  doubleDown: string[];
  repeatTopics: string[];
  avoidFormats: string[];
  postingFrequency: string;
  preferredStructures: string[];
}

export function aiStrategyLayer(strategy: ContentStrategy, dna: PerformanceDNA): AIStrategyLayer {
  return {
    stopDoing: strategy.fatigueSignals.length ? strategy.fatigueSignals.map((signal) => `Reduire: ${signal}`) : ['Arreter les intros explicatives trop longues'],
    doubleDown: dna.winningPatterns.length ? dna.winningPatterns : strategy.formatRecommendations,
    repeatTopics: strategy.contentClusters.map((cluster) => cluster.name).slice(0, 4),
    avoidFormats: dna.penaltyPatterns.slice(0, 4),
    postingFrequency: '3 a 5 tests courts par semaine avant conclusion.',
    preferredStructures: dna.contentDNA.slice(0, 5),
  };
}
