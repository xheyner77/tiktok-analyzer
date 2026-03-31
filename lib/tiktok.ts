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
  source?: 'page_json' | 'oembed';
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
      return { ...fromUniversal, source: 'page_json' };
    }

    const sigi = extractJsonByScriptId(html, 'SIGI_STATE');
    const fromSigi = sigi ? parseFromSigiState(sigi) : null;
    if (fromSigi && (fromSigi.views || fromSigi.likes || fromSigi.comments || fromSigi.shares)) {
      return { ...fromSigi, source: 'page_json' };
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[tiktok] stats extraction error:', message);
    return null;
  }
}

async function fetchFromOEmbed(videoUrl: string): Promise<TikTokPublicStats | null> {
  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    // oEmbed is limited: author + title/caption-like + publish_date sometimes.
    return {
      authorUsername: typeof data.author_unique_id === 'string' ? data.author_unique_id : undefined,
      caption: typeof data.title === 'string' ? data.title : undefined,
      publishedAt: typeof data.create_time === 'string' ? data.create_time : undefined,
      source: 'oembed',
    };
  } catch {
    return null;
  }
}

export async function fetchTikTokPublicStatsV2(videoUrl: string): Promise<TikTokPublicStats | null> {
  // Retry page-json extraction a few times (TikTok can intermittently fail)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const stats = await fetchTikTokPublicStats(videoUrl);
    if (stats) return stats;
    await new Promise((r) => setTimeout(r, 250 * attempt));
  }

  // Fallback: oEmbed (less complete, but still useful metadata)
  return fetchFromOEmbed(videoUrl);
}
