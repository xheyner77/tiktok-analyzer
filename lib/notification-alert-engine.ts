import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';

export interface ProductNotification {
  id: string;
  type: 'dashboard' | 'repost_reminder' | 'opportunity' | 'pattern_alert' | 'hook_suggestion' | 'daily_update';
  title: string;
  body: string;
  priority: 'haute' | 'moyenne' | 'basse';
}

export function notificationAlertEngine(items: RepostPriorityInput[]): ProductNotification[] {
  const top = rankRepostPriorities(items)[0];
  return [
    { id: 'daily_update', type: 'daily_update', title: 'Daily AI update', body: items.length ? 'Tes recommandations du jour sont pretes.' : 'Analyse une video pour activer les updates.', priority: 'moyenne' },
    { id: 'repost_reminder', type: 'repost_reminder', title: top ? 'Repost a traiter' : 'Aucun repost reel', body: top?.recommendedFix ?? 'Pas de rappel repost sans donnees.', priority: top ? 'haute' : 'basse' },
    { id: 'hook_suggestion', type: 'hook_suggestion', title: 'Hook suggestion', body: top ? 'Teste une ouverture plus directe.' : 'Le Hook Studio attend un brief.', priority: 'moyenne' },
  ];
}
