import { supabase } from '@/lib/supabase';
import type {
  RawTrendItem,
  TrendCluster,
  TrendClusterFilters,
  TrendScanJob,
  TrendSourceStatus,
} from '@/lib/trends/types';
import { clusterTrendSignals } from '@/lib/trends/cluster';
import { getDemoRawTrendItems } from '@/lib/trends/demo-data';
import { formatRelativeTime } from '@/lib/trends/formatters';
import { normalizeTrendItems } from '@/lib/trends/normalize';

type DbError = { message?: string; code?: string };

function isMissingTable(error: DbError | null | undefined): boolean {
  return Boolean(error?.message?.includes('relation') || error?.code === '42P01');
}

function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE === 'true';
}

function hasApifyConfig(): boolean {
  return Boolean(
    process.env.APIFY_TOKEN &&
      (process.env.APIFY_TIKTOK_TRENDS_ACTOR_ID || process.env.APIFY_TIKTOK_SEARCH_ACTOR_ID || process.env.APIFY_TIKTOK_HASHTAG_ACTOR_ID),
  );
}

interface ClusterRow {
  id: string;
  title: string;
  slug: string;
  cluster_type: string;
  pattern_key: string;
  niche: string | null;
  country: string | null;
  language: string | null;
  sample_size: number | null;
  unique_creators: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  top_hashtags: string[] | null;
  top_sounds: string[] | null;
  evidence: unknown;
  scores: unknown;
  recommendation: unknown;
  created_at: string | null;
  updated_at: string | null;
}

function toCluster(row: ClusterRow): TrendCluster {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    clusterType: row.cluster_type as TrendCluster['clusterType'],
    patternKey: row.pattern_key as TrendCluster['patternKey'],
    niche: (row.niche ?? 'general') as TrendCluster['niche'],
    country: row.country ?? 'FR',
    language: row.language ?? 'fr',
    sampleSize: row.sample_size ?? 0,
    uniqueCreators: row.unique_creators ?? 0,
    firstSeenAt: row.first_seen_at ?? new Date().toISOString(),
    lastSeenAt: row.last_seen_at ?? new Date().toISOString(),
    topHashtags: row.top_hashtags ?? [],
    topSounds: row.top_sounds ?? [],
    topExamples: Array.isArray((row.evidence as { topExamples?: unknown }).topExamples) ? ((row.evidence as { topExamples: TrendCluster['topExamples'] }).topExamples) : [],
    evidenceItems: Array.isArray((row.evidence as { evidenceItems?: unknown }).evidenceItems)
      ? ((row.evidence as { evidenceItems: TrendCluster['evidenceItems'] }).evidenceItems)
      : [],
    scores: row.scores as TrendCluster['scores'],
    recommendation: row.recommendation as TrendCluster['recommendation'],
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function getTrendSourceStatus(): Promise<TrendSourceStatus> {
  const { count: rawCount, error: rawError } = await supabase.from('trend_raw_items').select('id', { count: 'exact', head: true });
  if (isMissingTable(rawError)) {
    return {
      status: isDemoMode() ? 'demo' : 'not_configured',
      label: isDemoMode() ? 'Mode demo' : 'Source non connectee',
      detail: isDemoMode()
        ? 'Le cockpit utilise un echantillon local signale comme demo.'
        : 'Applique la migration Supabase et configure APIFY_TOKEN pour scanner TikTok.',
      provider: isDemoMode() ? 'demo' : 'none',
      lastScanAt: null,
      totalRawItems: 0,
      totalClusters: 0,
      isDemoMode: isDemoMode(),
      canScan: hasApifyConfig(),
    };
  }

  const { count: clusterCount } = await supabase.from('trend_clusters').select('id', { count: 'exact', head: true });
  const { data: lastJob } = await supabase
    .from('trend_scan_jobs')
    .select('finished_at,started_at,status,error')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastScanAt = (lastJob as { finished_at?: string | null; started_at?: string | null } | null)?.finished_at ?? (lastJob as { started_at?: string | null } | null)?.started_at ?? null;
  const cacheMinutes = Number(process.env.TREND_SCAN_CACHE_MINUTES ?? 180);
  const isStale = lastScanAt ? Date.now() - new Date(lastScanAt).getTime() > cacheMinutes * 60000 : true;
  const configured = hasApifyConfig();

  return {
    status: !configured ? 'not_configured' : (rawCount ?? 0) === 0 ? 'empty' : isStale ? 'stale' : 'connected',
    label: !configured ? 'Source non connectee' : isStale ? 'Scan recommande' : 'Donnees reelles',
    detail: !configured
      ? 'APIFY_TOKEN et au moins un actor TikTok sont requis.'
      : (rawCount ?? 0) === 0
        ? 'Source configuree, aucun scan stocke.'
        : `Dernier scan ${formatRelativeTime(lastScanAt)}.`,
    provider: configured ? 'apify' : 'none',
    lastScanAt,
    totalRawItems: rawCount ?? 0,
    totalClusters: clusterCount ?? 0,
    isDemoMode: false,
    canScan: configured,
  };
}

export async function listTrendClusters(filters: TrendClusterFilters = {}): Promise<TrendCluster[]> {
  if (isDemoMode() && !hasApifyConfig()) {
    return clusterTrendSignals(normalizeTrendItems(getDemoRawTrendItems()));
  }

  let query = supabase.from('trend_clusters').select('*');
  if (filters.niche && filters.niche !== 'all') query = query.eq('niche', filters.niche);
  if (filters.country && filters.country !== 'all') query = query.eq('country', filters.country);
  if (filters.stage) query = query.eq('recommendation->>stage', filters.stage);
  if (filters.verdict) query = query.eq('recommendation->>verdict', filters.verdict);

  const sort = filters.sort ?? 'score';
  if (sort === 'freshness') query = query.order('last_seen_at', { ascending: false });
  else if (sort === 'sample_size') query = query.order('sample_size', { ascending: false });
  else query = query.order('updated_at', { ascending: false });

  const requestedLimit = filters.limit ?? 10;
  const { data, error } = await query.limit(Math.max(requestedLimit, 50));
  if (isMissingTable(error)) return [];
  if (error) {
    console.error('[trends] list clusters failed:', error.message);
    return [];
  }

  const clusters = ((data ?? []) as ClusterRow[]).map(toCluster);
  return clusters.sort((a, b) => {
    if (sort === 'confidence') return b.scores.confidenceScore - a.scores.confidenceScore;
    if (sort === 'low_saturation') return a.scores.saturationScore - b.scores.saturationScore;
    if (sort === 'freshness') return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    if (sort === 'sample_size') return b.sampleSize - a.sampleSize;
    return b.scores.finalScore - a.scores.finalScore;
  }).slice(0, requestedLimit);
}

export async function getLastTrendScanJob(): Promise<TrendScanJob | null> {
  const { data, error } = await supabase.from('trend_scan_jobs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (isMissingTable(error) || error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    userId: (row.user_id as string | null) ?? null,
    status: row.status as TrendScanJob['status'],
    provider: row.provider as TrendScanJob['provider'],
    countries: (row.countries as string[] | null) ?? [],
    niches: (row.niches as string[] | null) ?? [],
    queries: (row.queries as string[] | null) ?? [],
    startedAt: String(row.started_at),
    finishedAt: (row.finished_at as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    itemsFetched: Number(row.items_fetched ?? 0),
    clustersCreated: Number(row.clusters_created ?? 0),
  };
}

export async function createTrendScanJob(params: {
  userId: string | null;
  provider: string;
  countries: string[];
  niches: string[];
  queries: string[];
}): Promise<string> {
  const { data, error } = await supabase
    .from('trend_scan_jobs')
    .insert({
      user_id: params.userId,
      status: 'running',
      provider: params.provider,
      countries: params.countries,
      niches: params.niches,
      queries: params.queries,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

export async function finishTrendScanJob(jobId: string, params: { status: 'success' | 'failed'; error?: string; itemsFetched: number; clustersCreated: number }) {
  await supabase
    .from('trend_scan_jobs')
    .update({
      status: params.status,
      error: params.error ?? null,
      items_fetched: params.itemsFetched,
      clusters_created: params.clustersCreated,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

export async function saveRawTrendItems(items: RawTrendItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const rows = items.map((item) => ({
    provider: item.provider,
    provider_item_id: item.providerItemId,
    source_url: item.sourceUrl,
    country: item.country,
    language: item.language,
    query: item.query,
    source_type: item.sourceType,
    caption: item.caption,
    hashtags: item.hashtags,
    sound_id: item.soundId,
    sound_name: item.soundName,
    author_id: item.authorId,
    author_username: item.authorUsername,
    author_followers: item.authorFollowers,
    posted_at: item.createdAt,
    fetched_at: item.fetchedAt,
    views: item.metrics.views,
    likes: item.metrics.likes,
    comments: item.metrics.comments,
    shares: item.metrics.shares,
    duration_seconds: item.duration,
    cover_url: item.coverUrl ?? null,
    raw_payload: item.rawPayload,
  }));

  const { error } = await supabase.from('trend_raw_items').upsert(rows, { onConflict: 'provider,provider_item_id' });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function saveTrendClusters(clusters: TrendCluster[]): Promise<number> {
  if (clusters.length === 0) return 0;
  const rows = clusters.map((cluster) => ({
    id: cluster.id,
    title: cluster.title,
    slug: cluster.slug,
    cluster_type: cluster.clusterType,
    pattern_key: cluster.patternKey,
    niche: cluster.niche,
    country: cluster.country,
    language: cluster.language,
    sample_size: cluster.sampleSize,
    unique_creators: cluster.uniqueCreators,
    first_seen_at: cluster.firstSeenAt,
    last_seen_at: cluster.lastSeenAt,
    top_hashtags: cluster.topHashtags,
    top_sounds: cluster.topSounds,
    evidence: { topExamples: cluster.topExamples, evidenceItems: cluster.evidenceItems },
    scores: cluster.scores,
    recommendation: cluster.recommendation,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('trend_clusters').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return rows.length;
}
