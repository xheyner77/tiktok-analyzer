const TIKTOK_CONNECT_PATH = '/api/tiktok/connect';

export function isTikTokConnectHref(href: string): boolean {
  return href === TIKTOK_CONNECT_PATH
    || href.startsWith(`${TIKTOK_CONNECT_PATH}?`)
    || href.startsWith(`${TIKTOK_CONNECT_PATH}#`);
}
