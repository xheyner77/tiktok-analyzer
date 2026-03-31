export function normalizeTikTokUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

export function isTikTokVideoUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.hostname.includes('tiktok.com') &&
      (u.pathname.includes('/video/') || u.pathname.includes('/t/'))
    );
  } catch {
    return false;
  }
}
