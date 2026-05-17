import type { AIExperiment } from './ai-experiment-engine';

export interface ExperimentGroup {
  id: string;
  type: AIExperiment['type'];
  variants: string[];
  performanceTracking: string[];
  bestVariantSuggestion: string;
}

export function contentExperimentationSystem(experiments: AIExperiment[]): ExperimentGroup[] {
  return experiments.map((experiment) => ({
    id: `group_${experiment.id}`,
    type: experiment.type,
    variants: [experiment.test, `${experiment.test} - version plus directe`, `${experiment.test} - version plus emotionnelle`],
    performanceTracking: ['prediction_score', 'hook_score', 'comment_potential', 'watchtime_potential'],
    bestVariantSuggestion: experiment.successSignal,
  }));
}
