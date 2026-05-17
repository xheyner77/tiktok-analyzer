export type WorkspaceRole = 'owner' | 'admin' | 'strategist' | 'editor' | 'viewer';

export interface AgencyWorkspaceBlueprint {
  roles: WorkspaceRole[];
  entities: string[];
  permissions: Record<WorkspaceRole, string[]>;
  dashboards: string[];
}

export const agencyWorkspaceBlueprint: AgencyWorkspaceBlueprint = {
  roles: ['owner', 'admin', 'strategist', 'editor', 'viewer'],
  entities: ['workspace', 'member', 'client', 'creator_account', 'hook_library', 'content_brief', 'repost_task'],
  permissions: {
    owner: ['billing', 'members', 'all_clients', 'publish', 'strategy'],
    admin: ['members', 'all_clients', 'publish', 'strategy'],
    strategist: ['strategy', 'hook_library', 'calendar', 'reports'],
    editor: ['repost_tasks', 'hook_tests', 'video_library'],
    viewer: ['reports', 'read_only_library'],
  },
  dashboards: ['team_overview', 'client_growth', 'hook_library', 'repost_pipeline'],
};
