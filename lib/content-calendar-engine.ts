import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';

export interface ContentCalendarItem {
  id: string;
  day: string;
  type: 'repost_reminder' | 'hook_test' | 'idea_to_publish' | 'video_to_rework';
  title: string;
  action: string;
}

const days = ['Aujourd hui', 'Demain', 'Mercredi', 'Jeudi', 'Vendredi'];

export function buildContentCalendar(items: RepostPriorityInput[]): ContentCalendarItem[] {
  const priorities = rankRepostPriorities(items).slice(0, 5);
  if (!priorities.length) {
    return [{
      id: 'calendar-empty',
      day: 'Aujourd hui',
      type: 'idea_to_publish',
      title: 'Analyser une premiere video',
      action: 'Active le calendrier avec une vraie analyse.',
    }];
  }
  return priorities.map((priority, index) => ({
    id: `calendar-${priority.id}`,
    day: days[index] ?? 'Cette semaine',
    type: index === 0 ? 'video_to_rework' : index === 1 ? 'hook_test' : 'repost_reminder',
    title: priority.label,
    action: priority.recommendedFix,
  }));
}
