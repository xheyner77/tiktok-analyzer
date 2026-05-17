import type { CreatorProfile } from './creator-profile-engine';
import type { RepostPriorityInput } from './repost-priority-engine';

export interface AICreatorProfile {
  dominantStyle: string;
  dominantRhythm: string;
  dominantHooks: string[];
  performingFormats: string[];
  recurringWeaknesses: string[];
  evolution: string;
  strengths: string[];
  weaknesses: string[];
  strategicRecommendations: string[];
}

export function aiCreatorProfileEngine(items: RepostPriorityInput[], profile: CreatorProfile): AICreatorProfile {
  return {
    dominantStyle: profile.storytellingTypes[0] ?? 'Preuve rapide',
    dominantRhythm: profile.bestRhythms[0] ?? 'Rupture visuelle a 0:05',
    dominantHooks: profile.bestHooks.slice(0, 5),
    performingFormats: profile.performingFormats,
    recurringWeaknesses: profile.recurringErrors,
    evolution: items.length >= 5 ? 'Profil createur en apprentissage avance.' : 'Profil createur en construction.',
    strengths: profile.memory.strengths,
    weaknesses: profile.memory.weaknesses,
    strategicRecommendations: profile.advancedInsights,
  };
}
