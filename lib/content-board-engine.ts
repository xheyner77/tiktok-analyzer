import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';

export type ContentBoardColumn = 'idees' | 'a_analyser' | 'hooks_prets' | 'a_tourner' | 'a_repost' | 'test_en_cours' | 'performante' | 'a_retravailler';

export interface ContentBoardCard {
  id: string;
  title: string;
  column: ContentBoardColumn;
  score?: number;
  action: string;
}

export interface ContentBoard {
  columns: Array<{ id: ContentBoardColumn; label: string }>;
  cards: ContentBoardCard[];
}

const columns: ContentBoard['columns'] = [
  { id: 'idees', label: 'Idees' },
  { id: 'a_analyser', label: 'A analyser' },
  { id: 'hooks_prets', label: 'Hooks prets' },
  { id: 'a_tourner', label: 'A tourner' },
  { id: 'a_repost', label: 'A repost' },
  { id: 'test_en_cours', label: 'Test en cours' },
  { id: 'performante', label: 'Performante' },
  { id: 'a_retravailler', label: 'A retravailler' },
];

export function buildContentBoard(items: RepostPriorityInput[]): ContentBoard {
  const priorities = rankRepostPriorities(items);
  return {
    columns,
    cards: priorities.map((priority) => ({
      id: priority.id,
      title: priority.title,
      column: priority.status === 'repost_conseille' ? 'a_repost' : priority.repostScore >= 72 ? 'performante' : 'a_retravailler',
      score: priority.repostScore,
      action: priority.recommendedFix,
    })),
  };
}
