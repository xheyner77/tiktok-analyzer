export const REQUIRED_TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
] as const;

export type RequiredTikTokScope = (typeof REQUIRED_TIKTOK_SCOPES)[number];

export function parseTikTokScopes(value: unknown): string[] {
  const rawScopes = Array.isArray(value)
    ? value.flatMap((item) => String(item).split(/[,\s]+/))
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];

  const seen = new Set<string>();
  const scopes: string[] = [];

  for (const rawScope of rawScopes) {
    const scope = rawScope.trim();
    if (!scope || seen.has(scope)) continue;
    seen.add(scope);
    scopes.push(scope);
  }

  return scopes;
}

export function normalizeTikTokScopeString(value: unknown): string {
  return parseTikTokScopes(value).join(',');
}

export function formatTikTokScopesForOAuth(value: unknown = REQUIRED_TIKTOK_SCOPES): string {
  const scopes = parseTikTokScopes(value);
  return (scopes.length ? scopes : [...REQUIRED_TIKTOK_SCOPES]).join(',');
}
