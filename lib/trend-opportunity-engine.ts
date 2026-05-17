import type { CreatorProfile } from './creator-profile-engine';
import type { RepostPriorityInput } from './repost-priority-engine';

export interface TrendOpportunity {
  id: string;
  title: string;
  signal: string;
  confidence: 'faible' | 'moyenne' | 'elevee';
  action: string;
}

export function trendOpportunityEngine(items: RepostPriorityInput[], profile: CreatorProfile): TrendOpportunity[] {
  const hasData = items.length > 0;
  return [
    {
      id: 'format-rising',
      title: hasData ? `${profile.performingFormats[0] ?? 'Format principal'} a pousser` : 'Trends en attente',
      signal: hasData ? 'Signal issu de tes analyses recentes, pas d une API trend externe.' : 'Aucune trend externe branchee pour le moment.',
      confidence: items.length >= 5 ? 'elevee' : hasData ? 'moyenne' : 'faible',
      action: hasData ? 'Produire 2 variations du format cette semaine.' : 'Connecter plus de donnees avant recommandation niche.',
    },
    {
      id: 'hook-recurring',
      title: profile.bestHooks[0] ? 'Hook recurrent detecte' : 'Hook trend non confirme',
      signal: profile.bestHooks[0] ?? 'Le systeme attend des hooks testes.',
      confidence: profile.bestHooks.length >= 3 ? 'moyenne' : 'faible',
      action: profile.bestHooks[0] ? 'Adapter ce hook en version TikTok, Reels et Shorts.' : 'Generer un groupe de hooks.',
    },
  ];
}
