import type { TeamModeV2 } from './team-mode-v2-engine';
import type { AdvancedAIReportsV2 } from './advanced-ai-reports-v2';

export interface AdvancedTeamAgencyMode {
  workspaces: string[];
  clients: string[];
  approvals: string[];
  validationWorkflows: string[];
  internalComments: string[];
  performanceReports: string[];
  repostBoards: string[];
  sharedHookLibraries: string[];
}

export function advancedTeamAgencyMode(team: TeamModeV2, reports: AdvancedAIReportsV2): AdvancedTeamAgencyMode {
  return {
    workspaces: team.workspaces,
    clients: team.clients,
    approvals: ['hook_approval', 'rewrite_approval', 'client_signoff'],
    validationWorkflows: team.validationWorkflows,
    internalComments: team.internalCommentsReady ? ['comments_enabled'] : ['comments_ready_no_activity'],
    performanceReports: [reports.weeklyRecap, ...reports.performanceClusters].slice(0, 5),
    repostBoards: team.sharedBoards,
    sharedHookLibraries: team.sharedHookLibraries,
  };
}
