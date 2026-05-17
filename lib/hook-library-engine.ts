import type { RepostPriorityInput } from './repost-priority-engine';

export type HookLibraryTag = 'performant' | 'repost' | 'emotion' | 'commentaires' | 'watchtime';

export interface HookLibraryItem {
  id: string;
  hook: string;
  tags: HookLibraryTag[];
  favorite: boolean;
  group: string;
  score: number;
}

function tagsFor(hook: string): HookLibraryTag[] {
  const tags: HookLibraryTag[] = ['repost'];
  if (/\?|commente|avis|penses/i.test(hook)) tags.push('commentaires');
  if (/peur|honte|fier|emotion|j'ai/i.test(hook)) tags.push('emotion');
  if (/attends|preuve|resultat|avant/i.test(hook)) tags.push('watchtime');
  if (/stop|erreur|personne|jamais/i.test(hook)) tags.push('performant');
  return [...new Set(tags)];
}

export function buildHookLibrary(items: RepostPriorityInput[]): HookLibraryItem[] {
  const hooks = items.flatMap((item) => [
    item.result.repostVersion?.hook,
    ...(item.result.repostVersion?.hookVariants ?? []),
    ...(item.result.coachAnalysis?.hookVariants ?? []),
  ].filter(Boolean).map((hook) => ({ hook: hook as string, base: item.result.hook.score, group: item.id })));

  return [...new Map(hooks.map((item) => [item.hook, item])).values()].slice(0, 30).map((item, index) => ({
    id: `hook_library_${index + 1}`,
    hook: item.hook,
    tags: tagsFor(item.hook),
    favorite: index < 3,
    group: item.group,
    score: Math.min(100, item.base + (tagsFor(item.hook).includes('performant') ? 14 : 6)),
  }));
}
