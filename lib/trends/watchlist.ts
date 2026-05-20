import type { TrendNiche, TrendScanPayload } from '@/lib/trends/types';
import { supabase } from '@/lib/supabase';

const DEFAULT_NICHES = ['business', 'coaching', 'ecommerce', 'creator_growth', 'fitness', 'beauty', 'education', 'lifestyle'] as TrendNiche[];

export function parseCsvEnv(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function getDefaultTrendScanPayload(): TrendScanPayload {
  const niches = parseCsvEnv('TREND_SCAN_DEFAULT_NICHES', DEFAULT_NICHES) as TrendNiche[];
  const countries = parseCsvEnv('TREND_SCAN_COUNTRIES', ['FR', 'BE', 'CA']);
  return {
    niches,
    countries,
    keywords: [
      'createur TikTok',
      'business TikTok',
      'hook viral',
      'avant apres',
      'erreur createur',
      'mini etude de cas',
      '#businessfr',
      '#tiktokfrance',
    ],
    force: false,
  };
}

interface WatchlistRow {
  niches: string[] | null;
  countries: string[] | null;
  keywords: string[] | null;
  hashtags: string[] | null;
  competitors: string[] | null;
  excluded_terms: string[] | null;
}

export async function getUserTrendWatchlist(userId: string): Promise<TrendScanPayload> {
  const fallback = getDefaultTrendScanPayload();
  const { data, error } = await supabase
    .from('trend_user_watchlists')
    .select('niches,countries,keywords,hashtags,competitors,excluded_terms')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return fallback;

  const row = data as WatchlistRow;
  return {
    niches: ((row.niches?.length ? row.niches : fallback.niches) as TrendNiche[]),
    countries: row.countries?.length ? row.countries : fallback.countries,
    keywords: [
      ...(row.keywords ?? []),
      ...(row.hashtags ?? []).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)),
      ...(row.competitors ?? []),
    ].filter(Boolean),
    force: false,
  };
}
