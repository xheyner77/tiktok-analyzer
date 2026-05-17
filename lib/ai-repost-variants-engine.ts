import type { RepostPriorityInput } from './repost-priority-engine';

export interface AIRepostVariant {
  id: string;
  videoId: string;
  type: 'emotionnelle' | 'watchtime' | 'commentaires' | 'agressive' | 'clean' | 'ultra_tiktok';
  hook: string;
  screenText: string;
  timing: string;
  cta: string;
  angle: string;
  estimatedScore: number;
}

const variants: AIRepostVariant['type'][] = ['emotionnelle', 'watchtime', 'commentaires', 'agressive', 'clean', 'ultra_tiktok'];

export function aiRepostVariantsEngine(items: RepostPriorityInput[]): AIRepostVariant[] {
  return items.filter((item) => item.result.coachAnalysis?.repostEngine.recommended).flatMap((item) => {
    const baseHook = item.result.repostVersion?.hook ?? item.result.coachAnalysis?.hookVariants?.[0] ?? 'Regarde ce detail';
    const baseScore = item.result.coachAnalysis?.repostEngine.scoreAfter ?? item.result.viralityScore + 8;
    return variants.map((type, index) => ({
      id: `${item.id}_${type}`,
      videoId: item.id,
      type,
      hook: type === 'agressive' ? `STOP. ${baseHook}` : type === 'commentaires' ? 'Tu ferais quoi a ma place ?' : baseHook,
      screenText: item.result.repostVersion?.onScreenText?.[index % Math.max(1, item.result.repostVersion.onScreenText.length)] ?? 'La preuve avant le contexte',
      timing: index < 2 ? '0-3s tension, 3-8s preuve, fin CTA' : '0-2s hook, 2-6s payoff, 6-15s correction',
      cta: type === 'commentaires' ? 'Tu choisis quelle version ?' : item.result.repostVersion?.cta ?? 'Tu veux la suite ?',
      angle: type.replace(/_/g, ' '),
      estimatedScore: Math.min(100, Math.round(baseScore + index * 2 - (type === 'clean' ? 1 : 0))),
    }));
  });
}
