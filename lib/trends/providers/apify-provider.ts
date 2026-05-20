import type { TrendDataProvider, TrendProviderResult } from '@/lib/trends/providers/types';
import type { RawTrendItem, TrendScanPayload, TrendSourceType } from '@/lib/trends/types';

const APIFY_BASE_URL = 'https://api.apify.com/v2';

type ApifyActorConfig = {
  id: string | null;
  sourceType: TrendSourceType;
  queries: string[];
};

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function actorPath(actorId: string): string {
  return encodeURIComponent(actorId.replace('/', '~'));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function readArray(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(String).map((item) => item.replace(/^#/, '').trim()).filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[,\s]+/)
        .map((item) => item.replace(/^#/, '').trim())
        .filter(Boolean);
    }
  }
  return [];
}

function extractHashtags(record: Record<string, unknown>, caption: string): string[] {
  const explicit = readArray(record, ['hashtags', 'hashtagNames', 'textExtra']);
  const fromCaption = Array.from(caption.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  return Array.from(new Set([...explicit, ...fromCaption].map((tag) => tag.toLowerCase())));
}

function mapApifyItem(item: unknown, context: { country: string; language: string; query: string; sourceType: TrendSourceType }): RawTrendItem | null {
  const record = asRecord(item);
  const nestedStats = asRecord(record.stats);
  const author = asRecord(record.authorMeta ?? record.author ?? record.user);
  const music = asRecord(record.musicMeta ?? record.music ?? record.sound);

  const providerItemId =
    readString(record, ['id', 'videoId', 'awemeId', 'itemId']) ??
    readString(record, ['webVideoUrl', 'url', 'shareUrl']);
  if (!providerItemId) return null;

  const caption = readString(record, ['text', 'caption', 'desc', 'description', 'title']) ?? '';
  const createdAt =
    readString(record, ['createTimeISO', 'createdAt', 'createTime', 'timestamp']) ??
    readString(record, ['publishedAt']);

  return {
    id: `apify:${providerItemId}`,
    provider: 'apify',
    providerItemId,
    sourceUrl: readString(record, ['webVideoUrl', 'url', 'shareUrl', 'videoUrl']),
    country: context.country,
    language: context.language,
    query: context.query,
    sourceType: context.sourceType,
    caption,
    hashtags: extractHashtags(record, caption),
    soundId: readString(music, ['musicId', 'id', 'playUrl']),
    soundName: readString(music, ['musicName', 'name', 'title']),
    authorId: readString(author, ['id', 'userId', 'secUid', 'uid']),
    authorUsername: readString(author, ['name', 'nickName', 'uniqueId', 'username']),
    authorFollowers: readNumber(author, ['fans', 'followers', 'followerCount']) || null,
    createdAt,
    fetchedAt: new Date().toISOString(),
    metrics: {
      views: readNumber(record, ['playCount', 'views', 'viewCount']) || readNumber(nestedStats, ['playCount', 'views']),
      likes: readNumber(record, ['diggCount', 'likes', 'likeCount']) || readNumber(nestedStats, ['diggCount', 'likes']),
      comments: readNumber(record, ['commentCount', 'comments']) || readNumber(nestedStats, ['commentCount', 'comments']),
      shares: readNumber(record, ['shareCount', 'shares']) || readNumber(nestedStats, ['shareCount', 'shares']),
      saves: readNumber(record, ['collectCount', 'saves']) || undefined,
    },
    duration: readNumber(record, ['duration', 'videoDuration']) || null,
    coverUrl: readString(record, ['coverUrl', 'thumbnail', 'imageUrl']),
    rawPayload: record,
  };
}

export class ApifyTrendProvider implements TrendDataProvider {
  isConfigured(): boolean {
    return Boolean(env('APIFY_TOKEN') && (env('APIFY_TIKTOK_TRENDS_ACTOR_ID') || env('APIFY_TIKTOK_SEARCH_ACTOR_ID') || env('APIFY_TIKTOK_HASHTAG_ACTOR_ID')));
  }

  async fetchItems(payload: TrendScanPayload): Promise<TrendProviderResult> {
    const token = env('APIFY_TOKEN');
    if (!token) {
      return { provider: 'apify', items: [], errors: ['APIFY_TOKEN absent.'] };
    }

    const actorCandidates: ApifyActorConfig[] = [
      { id: env('APIFY_TIKTOK_TRENDS_ACTOR_ID'), sourceType: 'trend' as const, queries: ['trending'] },
      { id: env('APIFY_TIKTOK_SEARCH_ACTOR_ID'), sourceType: 'search' as const, queries: payload.keywords },
      { id: env('APIFY_TIKTOK_HASHTAG_ACTOR_ID'), sourceType: 'hashtag' as const, queries: payload.keywords.filter((query) => query.startsWith('#')) },
    ];
    const actors = actorCandidates.filter((actor): actor is ApifyActorConfig & { id: string } => Boolean(actor.id));

    const maxItems = Number(process.env.TREND_SCAN_MAX_ITEMS ?? 100);
    const errors: string[] = [];
    const items: RawTrendItem[] = [];

    for (const actor of actors) {
      for (const country of payload.countries) {
        const actorQueries = actor.queries.length > 0 ? actor.queries : payload.keywords;
        for (const query of actorQueries.slice(0, 10)) {
          try {
            const response = await fetch(`${APIFY_BASE_URL}/acts/${actorPath(actor.id)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                searchQueries: query === 'trending' ? undefined : [query],
                hashtags: query.startsWith('#') ? [query.replace(/^#/, '')] : undefined,
                country,
                language: process.env.TREND_SCAN_LANGUAGE ?? 'fr',
                maxItems: Math.min(maxItems, 100),
              }),
              cache: 'no-store',
            });

            if (!response.ok) {
              errors.push(`Apify ${actor.sourceType} ${country}/${query}: HTTP ${response.status}`);
              continue;
            }

            const data = (await response.json()) as unknown;
            const rows = Array.isArray(data) ? data : [];
            rows
              .map((row) =>
                mapApifyItem(row, {
                  country,
                  language: process.env.TREND_SCAN_LANGUAGE ?? 'fr',
                  query,
                  sourceType: actor.sourceType,
                }),
              )
              .filter((row): row is RawTrendItem => Boolean(row))
              .forEach((row) => items.push(row));
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erreur inconnue';
            errors.push(`Apify ${actor.sourceType} ${country}/${query}: ${message}`);
          }
        }
      }
    }

    return { provider: 'apify', items, errors };
  }
}
