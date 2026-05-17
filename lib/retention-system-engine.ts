import type { RepostPriorityInput } from './repost-priority-engine';

export interface RetentionSystem {
  creatorProgression: string;
  repostSuccessTracking: string;
  performanceMilestones: string[];
  aiMemoryEvolution: string;
  returningReasons: string[];
}

export function buildRetentionSystem(items: RepostPriorityInput[]): RetentionSystem {
  const count = items.length;
  return {
    creatorProgression: count >= 5 ? 'Progression mesurable sur plusieurs analyses.' : 'Progression en initialisation.',
    repostSuccessTracking: 'Suivi pret via score avant/apres repost.',
    performanceMilestones: ['Premier repost pret', '3 hooks testes', 'Pattern recurrent confirme'],
    aiMemoryEvolution: count ? `Memoire IA nourrie par ${count} analyses.` : 'Memoire IA en attente de donnees.',
    returningReasons: ['Insight quotidien', 'Rappel repost', 'Hook a tester', 'Nouvelle opportunite detectee'],
  };
}
