export interface TikTokPublicStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  favorites?: number;
  durationSec?: number;
  authorUsername?: string;
  publishedAt?: string;
  caption?: string;
}

function extractJsonByScriptId(html: string, scriptId: string): unknown | null {
  const re = new RegExp(
    `<script[^>]*id=["']${scriptId}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    'i'
  );
  const match = html.match(re);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function asNumber(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function parseFromUniversalData(data: any): TikTokPublicStats | null {
  const itemStruct =
    data?.['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
  if (!itemStruct) return null;

  const stats = itemStruct.stats ?? {};
  const author = itemStruct.author ?? {};
  const createTime = asNumber(itemStruct.createTime);

  return {
    views: asNumber(stats.playCount),
    likes: asNumber(stats.diggCount),
    comments: asNumber(stats.commentCount),
    shares: asNumber(stats.shareCount),
    favorites: asNumber(stats.collectCount),
    durationSec: asNumber(itemStruct.video?.duration),
    authorUsername: typeof author.uniqueId === 'string' ? author.uniqueId : undefined,
    publishedAt: createTime ? new Date(createTime * 1000).toISOString() : undefined,
    caption: typeof itemStruct.desc === 'string' ? itemStruct.desc : undefined,
  };
}

function parseFromSigiState(data: any): TikTokPublicStats | null {
  const itemModule = data?.ItemModule;
  if (!itemModule || typeof itemModule !== 'object') return null;
  const firstKey = Object.keys(itemModule)[0];
  if (!firstKey) return null;
  const item = itemModule[firstKey];
  if (!item) return null;

  const stats = item.stats ?? {};
  const author = item.author ?? {};
  const createTime = asNumber(item.createTime);

  return {
    views: asNumber(stats.playCount),
    likes: asNumber(stats.diggCount),
    comments: asNumber(stats.commentCount),
    shares: asNumber(stats.shareCount),
    favorites: asNumber(stats.collectCount),
    durationSec: asNumber(item.video?.duration),
    authorUsername: typeof author.uniqueId === 'string' ? author.uniqueId : undefined,
    publishedAt: createTime ? new Date(createTime * 1000).toISOString() : undefined,
    caption: typeof item.desc === 'string' ? item.desc : undefined,
  };
}

export async function fetchTikTokPublicStats(videoUrl: string): Promise<TikTokPublicStats | null> {
  try {
    const response = await fetch(videoUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[tiktok] page fetch failed:', response.status);
      return null;
    }

    const html = await response.text();
    if (!html) return null;

    const universal =
      extractJsonByScriptId(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__') ??
      extractJsonByScriptId(html, '__NEXT_DATA__');
    const fromUniversal = universal ? parseFromUniversalData(universal) : null;
    if (fromUniversal && (fromUniversal.views || fromUniversal.likes || fromUniversal.comments || fromUniversal.shares)) {
      return fromUniversal;
    }

    const sigi = extractJsonByScriptId(html, 'SIGI_STATE');
    const fromSigi = sigi ? parseFromSigiState(sigi) : null;
    if (fromSigi && (fromSigi.views || fromSigi.likes || fromSigi.comments || fromSigi.shares)) {
      return fromSigi;
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[tiktok] stats extraction error:', message);
    return null;
  }
}
