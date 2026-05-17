import type { RepostPriorityInput } from './repost-priority-engine';

export type RewriteMode = 'plus_tiktok' | 'plus_emotionnel' | 'plus_watchtime' | 'plus_commentaires' | 'plus_direct' | 'plus_storytelling';

export interface RewritePack {
  videoId: string;
  mode: RewriteMode;
  hook: string;
  cta: string;
  opening: string;
  structure: string[];
  textOverlays: string[];
  caption: string;
}

function baseHook(item: RepostPriorityInput) {
  return item.result.repostVersion?.hook ?? item.result.coachAnalysis?.hookVariants?.[0] ?? 'Regarde ce detail avant de continuer';
}

function baseCta(item: RepostPriorityInput) {
  return item.result.repostVersion?.cta ?? item.result.coachAnalysis?.optimizedCtas?.[0] ?? 'Tu veux la version courte ?';
}

export function aiRewriteEngine(items: RepostPriorityInput[]): RewritePack[] {
  const modes: RewriteMode[] = ['plus_tiktok', 'plus_emotionnel', 'plus_watchtime', 'plus_commentaires', 'plus_direct', 'plus_storytelling'];
  return items.slice(0, 4).flatMap((item) => modes.map((mode) => {
    const hook = baseHook(item);
    const cta = baseCta(item);
    const prefix = {
      plus_tiktok: 'STOP',
      plus_emotionnel: "J'ai compris ca trop tard:",
      plus_watchtime: 'Attends la preuve avant de juger:',
      plus_commentaires: 'Tu ferais quoi ici ?',
      plus_direct: 'Le probleme est simple:',
      plus_storytelling: 'Au debut je pensais que ca marchait...',
    }[mode];
    return {
      videoId: item.id,
      mode,
      hook: mode === 'plus_commentaires' ? prefix : `${prefix} ${hook}`.slice(0, 96),
      cta: mode === 'plus_commentaires' ? 'Tu es plutot A ou B ? Reponds en commentaire.' : cta,
      opening: '0-3s: montrer la consequence avant le contexte.',
      structure: item.result.repostVersion?.structure ?? ['Hook', 'Preuve', 'Correction', 'CTA'],
      textOverlays: item.result.repostVersion?.onScreenText ?? ['La preuve arrive maintenant', 'A corriger avant repost'],
      caption: 'Le vrai levier est dans les premieres secondes.',
    };
  }));
}
