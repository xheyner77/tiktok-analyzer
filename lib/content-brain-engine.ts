import type { RepostPriorityInput } from './repost-priority-engine';

export interface ContentBrain {
  patternLinks: Array<{ from: string; relation: string; to: string; strength: number }>;
  winningStructures: string[];
  weakStructures: string[];
  creatorHabits: string[];
  audienceHabits: string[];
  reasoningSummary: string;
}

function clamp(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function contentBrainEngine(items: RepostPriorityInput[]): ContentBrain {
  const patterns = [...new Set(items.map((item) => item.result.coachAnalysis?.patternLabel).filter(Boolean) as string[])];
  const hooks = [...new Set(items.flatMap((item) => [item.result.repostVersion?.hook, ...(item.result.coachAnalysis?.hookVariants ?? [])]).filter(Boolean) as string[])];
  const ctas = [...new Set(items.flatMap((item) => [item.result.repostVersion?.cta, ...(item.result.coachAnalysis?.optimizedCtas ?? [])]).filter(Boolean) as string[])];
  const weak = [...new Set(items.flatMap((item) => item.result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? []))];
  const avgRetention = items.length ? items.reduce((sum, item) => sum + item.result.retention.score, 0) / items.length : 0;

  return {
    patternLinks: [
      ...patterns.slice(0, 4).map((pattern) => ({ from: 'creator', relation: 'uses_format', to: pattern, strength: clamp(58 + items.filter((item) => item.result.coachAnalysis?.patternLabel === pattern).length * 12) })),
      ...hooks.slice(0, 4).map((hook) => ({ from: hook, relation: 'drives', to: 'hook_attention', strength: clamp(62 + hook.length < 52 ? 8 : 0) })),
      ...ctas.slice(0, 3).map((cta) => ({ from: cta, relation: 'drives', to: 'comments', strength: /\?/.test(cta) ? 78 : 58 })),
    ],
    winningStructures: items.filter((item) => item.result.viralityScore >= 70).flatMap((item) => item.result.repostVersion?.structure ?? []).slice(0, 6),
    weakStructures: weak.slice(0, 6),
    creatorHabits: [
      hooks.length ? 'Recycle des angles de hook recurrent.' : 'Hooks encore peu documentes.',
      patterns[0] ? `Format dominant: ${patterns[0]}.` : 'Format dominant en attente.',
    ],
    audienceHabits: [
      avgRetention >= 68 ? 'Audience sensible aux payoffs rapides.' : 'Audience probablement perdue avant le payoff.',
      ctas.some((cta) => /\?/.test(cta)) ? 'Les questions sont deja presentes dans les CTA forts.' : 'Tester plus de CTA questions.',
    ],
    reasoningSummary: items.length ? 'Le brain relie hooks, formats, CTA, structures et scores depuis les analyses sauvegardees.' : 'Content Brain pret, en attente de donnees reelles.',
  };
}
