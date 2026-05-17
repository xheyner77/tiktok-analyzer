import type { RepostVersion } from './types';

export type GrowthPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts';

export interface PlatformAdapter {
  platform: GrowthPlatform;
  label: string;
  maxRecommendedDurationSec: number;
  hookGuidance: string;
  adaptHook: (hook: string) => string;
  adaptRepostPlan: (plan: RepostVersion) => RepostVersion;
}

function adaptPlan(plan: RepostVersion, suffix: string): RepostVersion {
  return {
    ...plan,
    hook: `${plan.hook}`.slice(0, 84),
    onScreenText: plan.onScreenText.map((item) => item.slice(0, 52)),
    angle: `${plan.angle} ${suffix}`,
  };
}

export const platformAdapters: Record<GrowthPlatform, PlatformAdapter> = {
  tiktok: {
    platform: 'tiktok',
    label: 'TikTok',
    maxRecommendedDurationSec: 34,
    hookGuidance: 'Tension immediate, texte ecran fort, payoff rapide.',
    adaptHook: (hook) => hook,
    adaptRepostPlan: (plan) => adaptPlan(plan, 'Optimise pour le scroll TikTok et les commentaires.'),
  },
  instagram_reels: {
    platform: 'instagram_reels',
    label: 'Instagram Reels',
    maxRecommendedDurationSec: 30,
    hookGuidance: 'Hook plus visuel, promesse lisible sans son, rythme propre.',
    adaptHook: (hook) => hook.replace(/^STOP/i, 'Regarde'),
    adaptRepostPlan: (plan) => adaptPlan(plan, 'Adapte le texte ecran pour lecture silencieuse sur Reels.'),
  },
  youtube_shorts: {
    platform: 'youtube_shorts',
    label: 'YouTube Shorts',
    maxRecommendedDurationSec: 40,
    hookGuidance: 'Promesse claire, structure plus explicite, retention lineaire.',
    adaptHook: (hook) => hook.replace(/\.\.\.$/, ''),
    adaptRepostPlan: (plan) => adaptPlan(plan, 'Renforce la clarte du sujet pour Shorts.'),
  },
};
