import type { RepostPriorityInput } from './repost-priority-engine';

export interface HookTestVariant {
  id: string;
  hook: string;
  status: 'favori' | 'a_tester' | 'teste';
  score: number;
  memorySignal: string;
}

export interface HookTestGroup {
  id: string;
  videoId: string;
  title: string;
  variants: HookTestVariant[];
  winnerId?: string;
}

function scoreHook(hook: string, baseScore: number) {
  const upper = hook.toUpperCase();
  const tension = /(STOP|ERREUR|PERSONNE|JAMAIS|PREUVE|RESULTAT|POURQUOI|\?)/.test(upper) ? 12 : 0;
  const shortBonus = hook.length <= 52 ? 8 : hook.length <= 74 ? 3 : -5;
  return Math.max(1, Math.min(100, Math.round(baseScore + tension + shortBonus)));
}

export function buildHookTestGroups(items: RepostPriorityInput[]): HookTestGroup[] {
  return items.slice(0, 6).map((item) => {
    const hooks = [
      item.result.repostVersion?.hook,
      ...(item.result.repostVersion?.hookVariants ?? []),
      ...(item.result.coachAnalysis?.hookVariants ?? []),
    ].filter(Boolean) as string[];
    const uniqueHooks = [...new Set(hooks)].slice(0, 5);
    const variants = uniqueHooks.map((hook, index) => ({
      id: `${item.id}-hook-${index + 1}`,
      hook,
      status: index === 0 ? 'favori' as const : 'a_tester' as const,
      score: scoreHook(hook, item.result.hook.score),
      memorySignal: /[?]/.test(hook) ? 'Question ouverte' : /STOP|ERREUR|PERSONNE|JAMAIS/i.test(hook) ? 'Tension directe' : 'Variante de packaging',
    }));
    const winner = [...variants].sort((a, b) => b.score - a.score)[0];
    return {
      id: `${item.id}-hook-tests`,
      videoId: item.id,
      title: item.result.coachAnalysis?.verdict ?? 'Test hooks',
      variants,
      winnerId: winner?.id,
    };
  });
}
