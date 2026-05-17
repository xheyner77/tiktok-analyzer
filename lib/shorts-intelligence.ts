import type { GrowthPlatform } from './platform-adapters';

export interface PlatformSignal {
  platform: GrowthPlatform;
  signal: string;
  benchmark: string;
  recommendation: string;
}

export const platformSignals: PlatformSignal[] = [
  { platform: 'tiktok', signal: 'scroll velocity', benchmark: 'hook < 2s', recommendation: 'Texte ecran tendu et payoff rapide.' },
  { platform: 'instagram_reels', signal: 'silent viewing', benchmark: 'message lisible sans son', recommendation: 'Renforcer texte ecran et visuel.' },
  { platform: 'youtube_shorts', signal: 'topic clarity', benchmark: 'promesse explicite', recommendation: 'Rendre le sujet plus clair dans le hook.' },
];

export const platformBenchmarks = {
  tiktok: ['hook agressif', 'comment bait propre', 'preuve rapide'],
  instagram_reels: ['visuel clean', 'caption courte', 'lecture sans son'],
  youtube_shorts: ['clarte sujet', 'retention lineaire', 'titre explicite'],
};

export const platformRecommendations = {
  tiktok: 'Garder la tension la plus native.',
  instagram_reels: 'Adoucir le hook et clarifier le visuel.',
  youtube_shorts: 'Ajouter plus de contexte utile sans rallonger.',
};
