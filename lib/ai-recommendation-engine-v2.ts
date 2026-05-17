import type { RepostPriorityInput } from './repost-priority-engine';
import { contentPrioritizationAI } from './content-prioritization-ai';

export interface AIRecommendationV2 {
  id: string;
  title: string;
  priority: 'haute' | 'moyenne' | 'basse';
  confidence: number;
  estimatedImpact: number;
  estimatedEffort: number;
  action: string;
}

export function aiRecommendationEngineV2(items: RepostPriorityInput[]): AIRecommendationV2[] {
  return contentPrioritizationAI(items).slice(0, 6).map((decision, index) => ({
    id: `rec_v2_${decision.id}`,
    title: decision.label,
    priority: index < 2 ? 'haute' : index < 4 ? 'moyenne' : 'basse',
    confidence: decision.decision === 'abandonner' ? 52 : 74,
    estimatedImpact: decision.decision === 'repost_immediatement' ? 30 : decision.decision === 'meilleur_hook' ? 22 : 14,
    estimatedEffort: decision.effort === 'faible' ? 24 : decision.effort === 'moyen' ? 52 : 78,
    action: decision.nextAction,
  }));
}
