import type { RepostPriorityInput } from './repost-priority-engine';

export interface SmartRepostPipelineItem {
  id: string;
  hooksAlternatifs: string[];
  ctaVariants: string[];
  screenTextVariants: string[];
  versionWatchtime: string;
  versionCommentaires: string;
  versionEmotionnelle: string;
}

export function buildSmartRepostPipelines(items: RepostPriorityInput[]): SmartRepostPipelineItem[] {
  return items.filter((item) => item.result.coachAnalysis?.repostEngine.recommended).slice(0, 6).map((item) => {
    const repost = item.result.repostVersion;
    return {
      id: item.id,
      hooksAlternatifs: [...new Set([repost?.hook, ...(repost?.hookVariants ?? []), ...(item.result.coachAnalysis?.hookVariants ?? [])].filter(Boolean) as string[])].slice(0, 5),
      ctaVariants: [...new Set([repost?.cta, ...(item.result.coachAnalysis?.optimizedCtas ?? [])].filter(Boolean) as string[])].slice(0, 4),
      screenTextVariants: repost?.onScreenText?.slice(0, 4) ?? ['Promesse en premiere frame'],
      versionWatchtime: 'Avancer preuve/payoff avant 0:05 et garder une boucle ouverte.',
      versionCommentaires: 'Finir par une question binaire ou un mot-cle simple.',
      versionEmotionnelle: 'Transformer le probleme en consequence personnelle concrete.',
    };
  });
}
