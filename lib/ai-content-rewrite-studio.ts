import type { RewritePack } from './ai-rewrite-engine';

export interface RewriteStudioProject {
  id: string;
  videoId: string;
  modes: string[];
  hooks: string[];
  openings: string[];
  ctas: string[];
  textOverlays: string[];
  structures: string[][];
  captions: string[];
  transitions: string[];
  storytelling: string[];
}

export function aiContentRewriteStudio(rewrites: RewritePack[]): RewriteStudioProject[] {
  const byVideo = new Map<string, RewritePack[]>();
  for (const rewrite of rewrites) byVideo.set(rewrite.videoId, [...(byVideo.get(rewrite.videoId) ?? []), rewrite]);
  return [...byVideo.entries()].map(([videoId, packs]) => ({
    id: `rewrite_studio_${videoId}`,
    videoId,
    modes: packs.map((pack) => pack.mode),
    hooks: packs.map((pack) => pack.hook),
    openings: [...new Set(packs.map((pack) => pack.opening))],
    ctas: [...new Set(packs.map((pack) => pack.cta))],
    textOverlays: [...new Set(packs.flatMap((pack) => pack.textOverlays))],
    structures: packs.map((pack) => pack.structure),
    captions: [...new Set(packs.map((pack) => pack.caption))],
    transitions: ['Cut proof before context', 'Zoom on key claim', 'Pattern interrupt at 0:05'],
    storytelling: ['Before', 'Mistake', 'Consequence', 'Correction'],
  }));
}
