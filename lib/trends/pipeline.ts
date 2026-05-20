import 'server-only';
import { ApifyTrendProvider } from '@/lib/trends/providers/apify-provider';
import { fetchUserTikTokSignals } from '@/lib/trends/providers/tiktok-display-provider';
import { clusterTrendSignals } from '@/lib/trends/cluster';
import { normalizeTrendItems } from '@/lib/trends/normalize';
import {
  createTrendScanJob,
  finishTrendScanJob,
  getTrendSourceStatus,
  saveRawTrendItems,
  saveTrendClusters,
} from '@/lib/trends/repository';
import { getDemoRawTrendItems } from '@/lib/trends/demo-data';
import type { TrendCluster, TrendScanPayload } from '@/lib/trends/types';

export interface TrendScanResult {
  jobId: string | null;
  itemsFetched: number;
  clustersCreated: number;
  clusters: TrendCluster[];
  errors: string[];
  source: 'apify' | 'demo';
}

function demoMode(): boolean {
  return process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE === 'true';
}

export async function runTrendScan(payload: TrendScanPayload, userId: string | null): Promise<TrendScanResult> {
  const provider = new ApifyTrendProvider();
  const sourceStatus = await getTrendSourceStatus();

  if (!provider.isConfigured()) {
    if (!demoMode()) {
      throw new Error('Source Apify non configuree. Ajoute APIFY_TOKEN et au moins un actor TikTok.');
    }
    const demoItems = getDemoRawTrendItems();
    const clusters = clusterTrendSignals(normalizeTrendItems(demoItems));
    return {
      jobId: null,
      itemsFetched: demoItems.length,
      clustersCreated: clusters.length,
      clusters,
      errors: ['Mode demo actif : aucun appel Apify execute.'],
      source: 'demo',
    };
  }

  const jobId = await createTrendScanJob({
    userId,
    provider: 'apify',
    countries: payload.countries,
    niches: payload.niches,
    queries: payload.keywords,
  });

  try {
    const [apifyResult, userSignals] = await Promise.all([
      provider.fetchItems(payload),
      userId ? fetchUserTikTokSignals(userId) : Promise.resolve({ provider: 'tiktok_display', items: [], errors: [] }),
    ]);
    const publicItems = apifyResult.items;
    const allItems = [...publicItems, ...userSignals.items];
    const normalized = normalizeTrendItems(allItems);
    const clusters = clusterTrendSignals(normalized);

    const savedItems = await saveRawTrendItems(publicItems);
    const savedClusters = await saveTrendClusters(clusters);

    await finishTrendScanJob(jobId, {
      status: 'success',
      itemsFetched: savedItems,
      clustersCreated: savedClusters,
    });

    return {
      jobId,
      itemsFetched: savedItems,
      clustersCreated: savedClusters,
      clusters,
      errors: [...apifyResult.errors, ...userSignals.errors],
      source: 'apify',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur scan inconnue';
    await finishTrendScanJob(jobId, {
      status: 'failed',
      error: message,
      itemsFetched: 0,
      clustersCreated: 0,
    });
    throw error;
  } finally {
    if (sourceStatus.status === 'not_configured') {
      // no-op: keep status evaluation lazy and avoid logging secrets.
    }
  }
}
