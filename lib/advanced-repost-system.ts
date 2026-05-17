import type { SmartRepostPipelineItem } from './smart-repost-pipeline';

export interface AdvancedRepostExperiment {
  id: string;
  variantType: 'watchtime' | 'comments' | 'emotion' | 'direct' | 'storytelling';
  hook: string;
  cta: string;
  format: string;
  trackingStatus: 'draft' | 'ready' | 'published' | 'waiting_results';
}

export interface AdvancedRepostSystem {
  variants: AdvancedRepostExperiment[];
  comparisonReady: boolean;
  trackingFields: string[];
}

export function advancedRepostSystem(pipelines: SmartRepostPipelineItem[]): AdvancedRepostSystem {
  const variants = pipelines.flatMap((pipeline) => ([
    { variantType: 'watchtime' as const, hook: pipeline.hooksAlternatifs[0] ?? 'Hook watchtime', cta: pipeline.ctaVariants[0] ?? 'Tu veux la suite ?', format: pipeline.versionWatchtime },
    { variantType: 'comments' as const, hook: pipeline.hooksAlternatifs[1] ?? 'Hook commentaires', cta: pipeline.ctaVariants[1] ?? 'Tu choisis A ou B ?', format: pipeline.versionCommentaires },
    { variantType: 'emotion' as const, hook: pipeline.hooksAlternatifs[2] ?? 'Hook emotionnel', cta: pipeline.ctaVariants[0] ?? 'Tu as deja vecu ca ?', format: pipeline.versionEmotionnelle },
  ]).map((variant, index) => ({
    id: `${pipeline.id}_${variant.variantType}_${index}`,
    ...variant,
    trackingStatus: 'ready' as const,
  })));

  return {
    variants,
    comparisonReady: variants.length >= 2,
    trackingFields: ['hook', 'cta', 'format', 'published_at', 'views', 'comments', 'shares', 'watchtime_proxy'],
  };
}
