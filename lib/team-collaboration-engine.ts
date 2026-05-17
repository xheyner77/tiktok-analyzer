import type { ContentBoard } from './content-board-engine';

export interface TeamCollaborationFoundation {
  internalComments: Array<{ id: string; targetId: string; body: string }>;
  hookApprovals: Array<{ hookId: string; status: 'pending' | 'approved' | 'changes_requested' }>;
  assignments: Array<{ id: string; role: 'strategist' | 'editor' | 'creator'; task: string }>;
  workspaceActivity: string[];
  sharedRepostBoards: string[];
}

export function teamCollaborationEngine(board: ContentBoard): TeamCollaborationFoundation {
  const firstCard = board.cards[0];
  return {
    internalComments: firstCard ? [{ id: 'comment_1', targetId: firstCard.id, body: 'Valider hook et CTA avant repost.' }] : [],
    hookApprovals: firstCard ? [{ hookId: firstCard.id, status: 'pending' }] : [],
    assignments: [
      { id: 'assign_strategy', role: 'strategist', task: 'Choisir les videos a prioriser cette semaine.' },
      { id: 'assign_edit', role: 'editor', task: 'Preparer les variations hook + texte ecran.' },
    ],
    workspaceActivity: ['board_created', 'daily_insight_generated', 'repost_review_ready'],
    sharedRepostBoards: ['primary_repost_board', 'client_repost_board'],
  };
}
