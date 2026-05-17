import type { RepostPriorityInput } from './repost-priority-engine';

export interface AgencyClientProfile {
  id: string;
  name: string;
  accountGroup: string;
  videosTracked: number;
  hookLibrarySize: number;
  repostBoardItems: number;
  analyticsSummary: string;
}

export interface AgencyModeFoundation {
  clients: AgencyClientProfile[];
  sharedAssets: string[];
  rolesReady: string[];
}

export function buildAgencyModeFoundation(items: RepostPriorityInput[]): AgencyModeFoundation {
  const clientName = items[0]?.result.detectedVideoMeta?.authorUsername ?? 'Client principal';
  const hooks = new Set(items.flatMap((item) => item.result.coachAnalysis?.hookVariants ?? []));
  const repostBoardItems = items.filter((item) => item.result.coachAnalysis?.repostEngine.recommended).length;

  return {
    clients: [{
      id: 'client_primary',
      name: clientName,
      accountGroup: 'TikTok accounts',
      videosTracked: items.length,
      hookLibrarySize: hooks.size,
      repostBoardItems,
      analyticsSummary: items.length ? `${items.length} videos analysees, ${repostBoardItems} reposts potentiels.` : 'Aucun analytics client reel disponible.',
    }],
    sharedAssets: ['shared_hook_libraries', 'client_repost_boards', 'client_analytics_summaries', 'account_groups'],
    rolesReady: ['owner', 'admin', 'strategist', 'editor', 'viewer'],
  };
}
