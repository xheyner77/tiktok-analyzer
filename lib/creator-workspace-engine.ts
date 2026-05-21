import type { RepostPriorityInput } from './repost-priority-engine';

export type WorkspaceRole = 'owner' | 'admin' | 'strategist' | 'editor' | 'viewer';

export interface CreatorWorkspace {
  id: string;
  name: string;
  roles: WorkspaceRole[];
  tables: string[];
  settings: {
    aiMemoryEnabled: boolean;
    multiAccountReady: boolean;
    invitesEnabled: boolean;
  };
  counts: {
    videos: number;
    hooks: number;
    reposts: number;
    patterns: number;
  };
}

export function buildCreatorWorkspace(items: RepostPriorityInput[], ownerLabel = 'Espace créateur'): CreatorWorkspace {
  const hooks = new Set(items.flatMap((item) => [
    item.result.repostVersion?.hook,
    ...(item.result.coachAnalysis?.hookVariants ?? []),
  ].filter(Boolean)));
  const reposts = items.filter((item) => item.result.coachAnalysis?.repostEngine.recommended).length;
  const patterns = new Set(items.map((item) => item.result.coachAnalysis?.patternLabel).filter(Boolean));

  return {
    id: 'workspace_primary',
    name: ownerLabel,
    roles: ['owner', 'admin', 'strategist', 'editor', 'viewer'],
    tables: ['workspaces', 'workspace_members', 'workspace_invites', 'workspace_settings', 'workspace_tiktok_accounts'],
    settings: {
      aiMemoryEnabled: true,
      multiAccountReady: true,
      invitesEnabled: true,
    },
    counts: {
      videos: items.length,
      hooks: hooks.size,
      reposts,
      patterns: patterns.size,
    },
  };
}
