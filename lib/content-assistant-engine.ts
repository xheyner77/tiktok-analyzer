import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentTemplate } from './template-system';
import { contentTemplates } from './template-system';

export interface ContentAssistantSuggestion {
  type: 'idea' | 'script' | 'cta' | 'angle' | 'hook' | 'title' | 'caption' | 'repost';
  title: string;
  output: string;
}

export function contentAssistantEngine(items: RepostPriorityInput[], templates: ContentTemplate[] = contentTemplates): ContentAssistantSuggestion[] {
  const top = items[0]?.result;
  const hook = top?.repostVersion?.hook ?? 'Commence par le resultat le plus fort';
  return [
    { type: 'idea', title: 'Idee video', output: top?.coachAnalysis?.repostEngine.bestOpportunity?.title ?? 'Transformer une erreur recurrente en video courte.' },
    { type: 'hook', title: 'Hook', output: hook },
    { type: 'script', title: 'Script court', output: templates.find((template) => template.kind === 'repost_plan')?.structure.join(' / ') ?? 'Hook / preuve / CTA' },
    { type: 'cta', title: 'CTA', output: top?.repostVersion?.cta ?? 'Tu veux la version courte ?' },
    { type: 'caption', title: 'Caption', output: 'La partie que tout le monde rate est dans les 3 premieres secondes.' },
  ];
}
