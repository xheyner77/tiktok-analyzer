import type { TrendDataProvider, TrendProviderResult } from '@/lib/trends/providers/types';
import { hasApifyTrendConfig } from '@/lib/trends/config';
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
  return encodeURIComponent(actorId.trim().replace(/\//g, '~'));
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

function readRecord(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return {};
}

function readNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function flattenStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number') return [String(entry)];
        const record = asRecord(entry);
        return [
          readString(record, ['name', 'title', 'hashtagName', 'text', 'id']),
        ].filter((item): item is string => Boolean(item));
      })
      .map((item) => item.replace(/^#/, '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,\s]+/)
      .map((item) => item.replace(/^#/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function readArray(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const parsed = flattenStringArray(record[key]);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

function extractHashtags(record: Record<string, unknown>, caption: string): string[] {
  const explicit = readArray(record, ['hashtags', 'hashtagNames', 'textExtra']);
  const fromCaption = Array.from(caption.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  return Array.from(new Set([...explicit, ...fromCaption].map((tag) => tag.toLowerCase())));
}

type ApifyMapResult = { item: RawTrendItem | null; ignoredReason?: string };

export function mapApifyItem(item: unknown, context: { country: string; language: string; query: string; sourceType: TrendSourceType }): ApifyMapResult {
  const record = asRecord(item);
  const nestedStats = readRecord(record, ['stats', 'statistics', 'metrics']);
  const video = readRecord(record, ['video', 'videoMeta', 'videoData']);
  const author = readRecord(record, ['authorMeta', 'author', 'user', 'authorInfo', 'creator']);
  const music = readRecord(record, ['musicMeta', 'music', 'sound', 'musicInfo']);

  const providerItemId =
    readString(record, ['id', 'videoId', 'awemeId', 'itemId', 'item_id']) ??
    readString(video, ['id', 'videoId', 'awemeId']) ??
    readString(record, ['webVideoUrl', 'url', 'shareUrl', 'videoUrl']);
  if (!providerItemId) return { item: null, ignoredReason: 'missing_provider_item_id' };

  const caption = readString(record, ['text', 'caption', 'desc', 'description', 'title']) ?? readString(video, ['title', 'description']) ?? '';
  const createdAt =
    readString(record, ['createTimeISO', 'createdAt', 'createTime', 'timestamp', 'publishedAt', 'postedAt']) ??
    readString(video, ['createTimeISO', 'createdAt', 'createTime']);
  const sourceUrl =
    readString(record, ['webVideoUrl', 'url', 'shareUrl', 'videoUrl']) ??
    readString(video, ['webVideoUrl', 'url', 'shareUrl', 'videoUrl', 'downloadAddr', 'playAddr']);
  const views = readNumber(record, ['playCount', 'views', 'viewCount']) || readNumber(nestedStats, ['playCount', 'views', 'viewCount', 'play_count']);
  const likes = readNumber(record, ['diggCount', 'likes', 'likeCount']) || readNumber(nestedStats, ['diggCount', 'likes', 'likeCount', 'digg_count']);
  const comments = readNumber(record, ['commentCount', 'comments']) || readNumber(nestedStats, ['commentCount', 'comments', 'comment_count']);
  const shares = readNumber(record, ['shareCount', 'shares']) || readNumber(nestedStats, ['shareCount', 'shares', 'share_count']);

  if (!caption && !sourceUrl && views === 0) {
    return { item: null, ignoredReason: 'missing_caption_url_and_metrics' };
  }

  return { item: {
    id: `apify:${providerItemId}`,
    provider: 'apify',
    providerItemId,
    sourceUrl,
    country: context.country,
    language: context.language,
    query: context.query,
    sourceType: context.sourceType,
    caption,
    hashtags: extractHashtags(record, caption),
    soundId: readString(music, ['musicId', 'id', 'playUrl']),
    soundName: readString(music, ['musicName', 'name', 'title']),
    authorId: readString(author, ['id', 'userId', 'secUid', 'uid']),
    authorUsername: readString(author, ['name', 'nickName', 'nickname', 'uniqueId', 'username']),
    authorFollowers: readNumber(author, ['fans', 'followers', 'followerCount', 'follower_count']) || null,
    createdAt,
    fetchedAt: new Date().toISOString(),
    metrics: {
      views,
      likes,
      comments,
      shares,
      saves: readNumber(record, ['collectCount', 'saves']) || undefined,
    },
    duration: readNumber(record, ['duration', 'videoDuration']) || readNumber(video, ['duration']) || null,
    coverUrl: readString(record, ['coverUrl', 'thumbnail', 'imageUrl']) ?? readString(video, ['cover', 'coverUrl', 'thumbnail', 'imageUrl']),
    rawPayload: record,
  } };
}

export class ApifyTrendProvider implements TrendDataProvider {
  isConfigured(): boolean {
    return hasApifyTrendConfig();
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
    const stats = {
      actorsUsed: actors.map((actor) => actor.id),
      itemsRetrieved: 0,
      validItems: 0,
      ignoredItems: 0,
      ignoredReasons: {} as Record<string, number>,
    };

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
            stats.itemsRetrieved += rows.length;
            let validForRun = 0;
            let ignoredForRun = 0;

            rows.forEach((row) => {
              const mapped = mapApifyItem(row, {
                  country,
                  language: process.env.TREND_SCAN_LANGUAGE ?? 'fr',
                  query,
                  sourceType: actor.sourceType,
                });
              if (mapped.item) {
                validForRun += 1;
                items.push(mapped.item);
                return;
              }
              ignoredForRun += 1;
              const reason = mapped.ignoredReason ?? 'unknown';
              stats.ignoredReasons[reason] = (stats.ignoredReasons[reason] ?? 0) + 1;
            });
            stats.validItems += validForRun;
            stats.ignoredItems += ignoredForRun;
            console.info('[trends:apify] actor_run', {
              actor: actor.id,
              sourceType: actor.sourceType,
              country,
              query,
              fetched: rows.length,
              valid: validForRun,
              ignored: ignoredForRun,
              ignoredReasons: stats.ignoredReasons,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erreur inconnue';
            errors.push(`Apify ${actor.sourceType} ${country}/${query}: ${message}`);
          }
        }
      }
    }

    console.info('[trends:apify] scan_summary', {
      actorsUsed: stats.actorsUsed,
      itemsRetrieved: stats.itemsRetrieved,
      validItems: stats.validItems,
      ignoredItems: stats.ignoredItems,
      ignoredReasons: stats.ignoredReasons,
    });

    return { provider: 'apify', items, errors, stats };
  }
}
