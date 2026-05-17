import type { TeamCollaborationFoundation } from './team-collaboration-engine';
import type { AgencyModeFoundation } from './agency-mode-engine';

export interface TeamModeV2 {
  workspaces: string[];
  roles: string[];
  clients: string[];
  validationWorkflows: string[];
  internalCommentsReady: boolean;
  sharedBoards: string[];
  sharedHookLibraries: string[];
}

export function teamModeV2Engine(collaboration: TeamCollaborationFoundation, agency: AgencyModeFoundation): TeamModeV2 {
  return {
    workspaces: ['creator_workspace', 'agency_workspace', 'client_workspace'],
    roles: agency.rolesReady,
    clients: agency.clients.map((client) => client.name),
    validationWorkflows: ['hook_approval', 'repost_review', 'client_signoff', 'publish_ready'],
    internalCommentsReady: collaboration.internalComments.length > 0,
    sharedBoards: collaboration.sharedRepostBoards,
    sharedHookLibraries: agency.sharedAssets.filter((asset) => asset.includes('hook')),
  };
}
