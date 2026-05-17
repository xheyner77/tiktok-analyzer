import type { RepostPriorityInput } from './repost-priority-engine';

export interface CreatorEvolutionTracking {
  hookEvolution: number;
  watchtimeImprovement: number;
  ctaImprovement: number;
  structureImprovement: number;
  monthlyProgress: string;
  summary: string;
}

function delta(values: number[]) {
  if (values.length < 2) return 0;
  return Math.round(values[0] - values[values.length - 1]);
}

export function creatorEvolutionTracking(items: RepostPriorityInput[]): CreatorEvolutionTracking {
  const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const hookEvolution = delta(sorted.map((item) => item.result.hook.score));
  const watchtimeImprovement = delta(sorted.map((item) => item.result.coachAnalysis?.subScores.rewatchPotential ?? item.result.retention.score));
  const ctaImprovement = delta(sorted.map((item) => item.result.coachAnalysis?.subScores.cta ?? item.result.viralityScore));
  const structureImprovement = delta(sorted.map((item) => item.result.structureScore ?? item.result.viralityScore));

  return {
    hookEvolution,
    watchtimeImprovement,
    ctaImprovement,
    structureImprovement,
    monthlyProgress: items.length >= 4 ? 'Progression mensuelle mesurable.' : 'Progression mensuelle en attente de plus de videos.',
    summary: `Hooks ${hookEvolution >= 0 ? '+' : ''}${hookEvolution}, watchtime ${watchtimeImprovement >= 0 ? '+' : ''}${watchtimeImprovement}, CTA ${ctaImprovement >= 0 ? '+' : ''}${ctaImprovement}.`,
  };
}
