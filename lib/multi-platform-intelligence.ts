import type { GrowthPlatform, PlatformAdapter } from './platform-adapters';

export interface PlatformContentRecommendation {
  platform: GrowthPlatform;
  hookRule: string;
  pacingRule: string;
  ctaRule: string;
  structureRule: string;
}

export function multiPlatformIntelligence(adapters: Record<GrowthPlatform, PlatformAdapter>): PlatformContentRecommendation[] {
  return Object.values(adapters).map((adapter) => ({
    platform: adapter.platform,
    hookRule: adapter.hookGuidance,
    pacingRule: adapter.platform === 'tiktok' ? 'Rupture rapide et payoff visible.' : adapter.platform === 'instagram_reels' ? 'Pacing clean, lisible sans son.' : 'Retention lineaire et sujet explicite.',
    ctaRule: adapter.platform === 'tiktok' ? 'Question/comment bait propre.' : adapter.platform === 'instagram_reels' ? 'CTA doux sauvegarde/partage.' : 'CTA clair vers suite ou commentaire.',
    structureRule: adapter.platform === 'youtube_shorts' ? 'Intro plus explicite, valeur directe.' : 'Tension puis preuve puis CTA.',
  }));
}
