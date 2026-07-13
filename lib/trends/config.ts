export function isTrendDemoMode(): boolean {
  // Les jeux locaux ne doivent jamais pouvoir alimenter l'app de production.
  return process.env.NODE_ENV !== 'production'
    && process.env.NEXT_PUBLIC_TRENDS_DEMO_MODE === 'true';
}

export function hasApifyTrendConfig(): boolean {
  return Boolean(
    process.env.APIFY_TOKEN &&
      (process.env.APIFY_TIKTOK_TRENDS_ACTOR_ID || process.env.APIFY_TIKTOK_SEARCH_ACTOR_ID || process.env.APIFY_TIKTOK_HASHTAG_ACTOR_ID),
  );
}
