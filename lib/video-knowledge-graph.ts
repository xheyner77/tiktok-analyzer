import type { RepostPriorityInput } from './repost-priority-engine';

export interface VideoKnowledgeGraph {
  reusablePatterns: string[];
  bestCombinations: string[];
  failurePatterns: string[];
  creatorGraphMemory: Array<{ from: string; relation: string; to: string }>;
}

export function buildVideoKnowledgeGraph(items: RepostPriorityInput[]): VideoKnowledgeGraph {
  const reusablePatterns = [...new Set(items.map((item) => item.result.coachAnalysis?.patternLabel).filter(Boolean) as string[])];
  const failurePatterns = [...new Set(items.flatMap((item) => item.result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? []))].slice(0, 6);
  const bestCombinations = items.slice(0, 5).map((item) => {
    const hook = item.result.repostVersion?.hook ?? 'Hook direct';
    const cta = item.result.repostVersion?.cta ?? 'CTA question';
    return `${item.result.coachAnalysis?.patternLabel ?? 'Format'} + ${hook.slice(0, 28)} + ${cta.slice(0, 28)}`;
  });

  return {
    reusablePatterns,
    bestCombinations,
    failurePatterns,
    creatorGraphMemory: [
      ...reusablePatterns.map((pattern) => ({ from: 'creator', relation: 'uses_format', to: pattern })),
      ...failurePatterns.map((failure) => ({ from: failure, relation: 'reduces', to: 'retention' })),
    ],
  };
}
