import type { RepostPriorityInput } from './repost-priority-engine';
import type { PerformanceDNA } from './performance-dna-engine';
import type { VideoDecision } from './video-decision-engine';

export interface AICoachAdvice {
  id: string;
  title: string;
  advice: string;
  level: 'strategic' | 'tactical' | 'warning';
}

export function aiContentCoachEngine(items: RepostPriorityInput[], dna: PerformanceDNA, decisions: VideoDecision[]): AICoachAdvice[] {
  const firstDecision = decisions[0];
  const recurring = dna.penaltyPatterns[0] ?? 'Tu expliques trop tot.';
  return [
    { id: 'coach_hook_tension', title: 'Tension opening', advice: recurring, level: 'warning' },
    { id: 'coach_proof', title: 'Preuve immediate', advice: dna.contentDNA[0] ? `Double ce pattern: ${dna.contentDNA[0]}.` : 'Montre la preuve avant le contexte.', level: 'strategic' },
    { id: 'coach_repost', title: 'Decision video', advice: firstDecision ? `Prochaine action: ${firstDecision.decision.replace(/_/g, ' ')}.` : 'Analyse une video pour obtenir une decision.', level: 'tactical' },
    { id: 'coach_series', title: 'Serie de contenu', advice: items.length >= 3 ? 'Transforme le meilleur cluster en serie de 3 videos.' : 'Des que 3 videos sont analysees, Viralynz detectera les series possibles.', level: 'strategic' },
  ];
}
