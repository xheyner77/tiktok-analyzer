import { REQUIRED_TIKTOK_SCOPES, parseTikTokScopes } from './scopes';

export type TikTokEnvironment = 'sandbox' | 'production' | 'unknown';

export type TikTokCapabilities = {
  grantedScopes: string[];
  hasBasicProfile: boolean;
  hasProfile: boolean;
  hasUserStats: boolean;
  hasVideoList: boolean;
  canFetchProfileStats: boolean;
  canFetchVideos: boolean;
  canFetchVideoMetrics: boolean;
  canFetchWatchTime: boolean;
  missingScopes: string[];
  environment: TikTokEnvironment;
  needsReconnect: boolean;
};

export function normalizeTikTokEnvironment(value: unknown): TikTokEnvironment {
  if (value === 'sandbox' || value === 'production') return value;
  return 'unknown';
}

export function getConfiguredTikTokEnvironment(): TikTokEnvironment {
  const raw = process.env.TIKTOK_ENV ?? process.env.NEXT_PUBLIC_TIKTOK_ENV ?? process.env.TIKTOK_APP_MODE;
  return normalizeTikTokEnvironment(String(raw ?? '').trim().toLowerCase());
}

export function getTikTokCapabilities(input?: {
  scopes?: unknown;
  environment?: unknown;
  refreshTokenExpiresAt?: string | null;
}): TikTokCapabilities {
  const grantedScopes = parseTikTokScopes(input?.scopes);
  const hasBasicProfile = grantedScopes.includes('user.info.basic');
  const hasProfile = grantedScopes.includes('user.info.profile');
  const hasUserStats = grantedScopes.includes('user.info.stats');
  const hasFullVideoList = grantedScopes.includes('video.list');
  const hasVideoList = hasFullVideoList || grantedScopes.includes('video.list.basic');
  const missingScopes = REQUIRED_TIKTOK_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  const refreshTokenExpired = Boolean(
    input?.refreshTokenExpiresAt && new Date(input.refreshTokenExpiresAt).getTime() <= Date.now()
  );

  return {
    grantedScopes,
    hasBasicProfile,
    hasProfile,
    hasUserStats,
    hasVideoList,
    canFetchProfileStats: hasUserStats,
    canFetchVideos: hasVideoList,
    canFetchVideoMetrics: hasFullVideoList,
    canFetchWatchTime: false,
    missingScopes,
    environment: normalizeTikTokEnvironment(input?.environment),
    needsReconnect: missingScopes.length > 0 || refreshTokenExpired,
  };
}
