export function normalizeTikTokUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

/** vm / vt = liens partagés (mobile), ex. https://vm.tiktok.com/ZNRCosuVc/ */
const TIKTOK_SHORT_SHARE_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com']);

function isTikTokHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'tiktok.com' || h.endsWith('.tiktok.com');
}

/** Slug court après / (lettres, chiffres, tirets, underscore). */
function isShortSharePath(pathname: string): boolean {
  return /^\/[A-Za-z0-9][A-Za-z0-9_-]{2,62}\/?$/.test(pathname);
}

export function isTikTokVideoUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (!isTikTokHostname(u.hostname)) return false;

    const p = u.pathname;
    if (p.includes('/video/') || p.includes('/t/')) return true;

    const host = u.hostname.toLowerCase();
    if (TIKTOK_SHORT_SHARE_HOSTS.has(host) && isShortSharePath(p)) return true;

    if (host === 'm.tiktok.com' && /^\/v\/\d+/.test(p)) return true;

    return false;
  } catch {
    return false;
  }
}
