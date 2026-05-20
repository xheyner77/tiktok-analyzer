import type { NormalizedTrendSignal, RawTrendItem, TrendNiche, TrendPatternKey } from '@/lib/trends/types';
import { hoursBetween, unique } from '@/lib/trends/formatters';

const NICHE_KEYWORDS: Record<TrendNiche, string[]> = {
  business: ['business', 'offre', 'vente', 'client', 'ca', 'revenu', 'freelance', 'entrepreneur'],
  coaching: ['coach', 'coaching', 'client', 'programme', 'accompagnement'],
  ecommerce: ['ecommerce', 'boutique', 'produit', 'shopify', 'panier', 'commande'],
  creator_growth: ['createur', 'tiktok', 'contenu', 'hook', 'vues', 'repost', 'video'],
  fitness: ['fitness', 'sport', 'perte', 'muscle', 'entrainement'],
  beauty: ['beaute', 'makeup', 'skin', 'routine', 'cheveux'],
  education: ['apprendre', 'cours', 'methode', 'framework', 'etapes'],
  lifestyle: ['routine', 'journee', 'habitude', 'lifestyle'],
  food: ['recette', 'food', 'cuisine', 'repas'],
  gaming: ['gaming', 'jeu', 'rank', 'setup'],
};

function cleanText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#@][\w-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function extractHookText(caption: string): string {
  const normalized = caption.replace(/\s+/g, ' ').trim();
  const firstSentence = normalized.split(/[.!?\n]/)[0]?.trim() ?? '';
  if (firstSentence.length > 14) return firstSentence.slice(0, 140);
  return normalized.split(' ').slice(0, 16).join(' ');
}

export function detectPattern(caption: string, hashtags: string[]): TrendPatternKey {
  const text = `${cleanText(caption)} ${hashtags.join(' ').toLowerCase()}`;
  if (/avant|apres|before|after|transformation/.test(text)) return 'before_after';
  if (/7 jours|sept jours|pendant 7|day 7|test/.test(text)) return 'seven_day_test';
  if (/erreur|bloque|rate|probleme/.test(text)) return 'mistake_hook';
  if (/etude de cas|case study|client|resultat/.test(text)) return 'mini_case_study';
  if (/attente|realite|vs|expectation/.test(text)) return 'expectation_vs_reality';
  if (/ranking|classement|top [0-9]|pire|meilleur/.test(text)) return 'ranking';
  if (/3 etapes|trois etapes|framework|methode/.test(text)) return 'three_step_framework';
  if (/pov/.test(text)) return 'generic_pov';
  if (/storytime|histoire|transformation/.test(text)) return 'transformation_story';
  if (/flop|echec|analyse|pourquoi ca n'a pas marche/.test(text)) return 'flop_analysis';
  if (/personne ne dit|verite|unpopular|tabou/.test(text)) return 'unpopular_truth';
  if (/j'avoue|confession|j'ai menti|je dois/.test(text)) return 'confession_hook';
  if (/preuve|screenshot|resultat en|voici/.test(text)) return 'fast_proof';
  if (/repost|v2|version corrigee|republie/.test(text)) return 'repost_v2';
  if (/loop|audio|son|sound/.test(text)) return 'audio_loop';
  if (/slide|carrousel|carousel/.test(text)) return 'carousel_explainer';
  return 'unknown';
}

export function detectNicheHints(caption: string, hashtags: string[]): TrendNiche[] {
  const text = `${cleanText(caption)} ${hashtags.map(cleanText).join(' ')}`;
  const hints = Object.entries(NICHE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([niche]) => niche as TrendNiche);
  return unique(hints);
}

export function normalizeTrendItem(item: RawTrendItem, now = new Date()): NormalizedTrendSignal {
  const views = Math.max(0, item.metrics.views);
  const likes = Math.max(0, item.metrics.likes);
  const comments = Math.max(0, item.metrics.comments);
  const shares = Math.max(0, item.metrics.shares);
  const ageHours = Math.max(1, hoursBetween(item.createdAt, now));
  const engagementRate = views > 0 ? (likes + comments + shares) / views : 0;

  return {
    id: `${item.provider}:${item.providerItemId}`,
    sourceItemId: item.id,
    caption: item.caption,
    cleanCaption: cleanText(item.caption),
    hookText: extractHookText(item.caption),
    detectedPattern: detectPattern(item.caption, item.hashtags),
    hashtags: item.hashtags.map((tag) => tag.replace(/^#/, '').toLowerCase()).filter(Boolean),
    soundKey: item.soundId ?? item.soundName ?? null,
    authorKey: item.authorId ?? item.authorUsername ?? null,
    postedAt: item.createdAt,
    fetchedAt: item.fetchedAt,
    ageHours,
    views,
    likes,
    comments,
    shares,
    engagementRate,
    shareRate: views > 0 ? shares / views : 0,
    commentRate: views > 0 ? comments / views : 0,
    viewVelocity: views / ageHours,
    country: item.country,
    language: item.language,
    nicheHints: detectNicheHints(item.caption, item.hashtags),
    sourceUrl: item.sourceUrl,
    raw: item,
  };
}

export function normalizeTrendItems(items: RawTrendItem[], now = new Date()): NormalizedTrendSignal[] {
  return items.map((item) => normalizeTrendItem(item, now));
}
