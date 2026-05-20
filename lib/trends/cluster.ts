import type {
  NormalizedTrendSignal,
  TrendCluster,
  TrendClusterType,
  TrendEvidenceItem,
  TrendNiche,
  TrendPatternKey,
} from '@/lib/trends/types';
import { buildRecommendation, calculateTrendScores } from '@/lib/trends/scoring';
import { slugify, unique } from '@/lib/trends/formatters';

const PATTERN_TITLES: Record<TrendPatternKey, string> = {
  before_after: 'Avant / Apres brutal',
  seven_day_test: "J'ai teste pendant 7 jours",
  mistake_hook: "L'erreur qui bloque les vues",
  mini_case_study: 'Mini etude de cas',
  expectation_vs_reality: 'Resultat reel vs attente',
  ranking: 'Ranking brutal',
  three_step_framework: 'Framework en 3 etapes',
  generic_pov: 'POV business generique',
  transformation_story: 'Storytime transformation',
  flop_analysis: "Analyse d'un flop",
  unpopular_truth: 'Ce que personne ne dit',
  confession_hook: 'Hook confession',
  fast_proof: 'Preuve rapide',
  repost_v2: 'Repost ameliore',
  audio_loop: 'Audio loop + caption tendue',
  carousel_explainer: 'Carrousel explicatif',
  unknown: 'Signal creatif emergent',
};

function clusterTypeForPattern(pattern: TrendPatternKey): TrendClusterType {
  if (pattern === 'audio_loop') return 'sound';
  if (pattern === 'carousel_explainer') return 'format_pattern';
  if (pattern === 'unknown') return 'keyword';
  return 'hook_pattern';
}

function countTop(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function evidenceFromSignal(signal: NormalizedTrendSignal): TrendEvidenceItem {
  return {
    sourceUrl: signal.sourceUrl,
    caption: signal.caption,
    hookText: signal.hookText,
    authorUsername: signal.raw.authorUsername,
    views: signal.views,
    likes: signal.likes,
    shares: signal.shares,
    postedAt: signal.postedAt,
    country: signal.country,
  };
}

function average(values: number[]): number {
  const clean = values.filter(Number.isFinite);
  if (clean.length === 0) return 0;
  return Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 10000) / 10000;
}

function median(values: number[]): number {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2) return clean[middle];
  return Math.round((clean[middle - 1] + clean[middle]) / 2);
}

function groupKey(signal: NormalizedTrendSignal): string {
  const primaryNiche = signal.nicheHints[0] ?? 'general';
  const pattern = signal.detectedPattern === 'unknown' && signal.hashtags[0] ? `hashtag:${signal.hashtags[0]}` : signal.detectedPattern;
  return `${signal.country}:${signal.language}:${primaryNiche}:${pattern}`;
}

export function clusterTrendSignals(signals: NormalizedTrendSignal[], now = new Date()): TrendCluster[] {
  const groups = new Map<string, NormalizedTrendSignal[]>();
  signals.forEach((signal) => {
    const key = groupKey(signal);
    groups.set(key, [...(groups.get(key) ?? []), signal]);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const [country, language, nicheRaw, patternRaw] = key.split(':');
    const patternKey = (patternRaw?.startsWith('hashtag') ? 'unknown' : patternRaw) as TrendPatternKey;
    const niche = (nicheRaw || 'general') as TrendNiche | 'general';
    const title = patternKey === 'unknown' && group[0]?.hashtags[0] ? `Signal #${group[0].hashtags[0]}` : PATTERN_TITLES[patternKey];
    const dates = group.map((signal) => signal.postedAt ?? signal.fetchedAt).sort();
    const authorKeys = unique(group.map((signal) => signal.authorKey).filter((value): value is string => Boolean(value)));
    const evidenceItems = group
      .slice()
      .sort((a, b) => b.views - a.views)
      .map(evidenceFromSignal)
      .slice(0, 8);

    const baseCluster = {
      id: slugify(`${country}-${language}-${niche}-${patternRaw}`),
      title,
      slug: slugify(`${title}-${country}-${niche}`),
      clusterType: clusterTypeForPattern(patternKey),
      patternKey,
      niche,
      country,
      language,
      sampleSize: group.length,
      uniqueCreators: authorKeys.length,
      firstSeenAt: dates[0] ?? now.toISOString(),
      lastSeenAt: dates[dates.length - 1] ?? now.toISOString(),
      topHashtags: countTop(group.flatMap((signal) => signal.hashtags), 6),
      topSounds: countTop(group.map((signal) => signal.soundKey ?? '').filter(Boolean), 4),
      topExamples: evidenceItems.slice(0, 3),
      evidenceItems,
      evidenceSummary: {
        sourceProvider: group.some((signal) => signal.raw.provider === 'apify') ? 'apify' : group[0]?.raw.provider ?? 'demo',
        medianViews: median(group.map((signal) => signal.views)),
        averageEngagementRate: average(group.map((signal) => signal.engagementRate)),
        averageShareRate: average(group.map((signal) => signal.shareRate)),
      },
      scores: calculateTrendScores({
        signals: group,
        allSignals: signals,
        firstSeenAt: dates[0] ?? now.toISOString(),
        lastSeenAt: dates[dates.length - 1] ?? now.toISOString(),
        nicheMatch: niche === 'general' ? 58 : 72,
      }),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return {
      ...baseCluster,
      recommendation: buildRecommendation(baseCluster, baseCluster.scores),
    } satisfies TrendCluster;
  });
}
