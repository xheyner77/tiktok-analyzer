import type { RepostPriorityInput } from './repost-priority-engine';
import type { VideoDecision } from './video-decision-engine';
import type { DailyInsight } from './daily-insight-engine';
import type { ContentCluster } from './content-cluster-system';

export interface AICreatorOperatingSystem {
  dailyCommandCenter: string[];
  opportunityQueues: Array<{ queue: string; count: number; topAction: string }>;
  creatorPriorities: string[];
  aiDecisions: string[];
}

export function aiCreatorOperatingSystem(
  items: RepostPriorityInput[],
  daily: DailyInsight,
  decisions: VideoDecision[],
  clusters: ContentCluster[]
): AICreatorOperatingSystem {
  const repostNow = decisions.filter((decision) => decision.decision === 'repost_immediat').length;
  const rework = decisions.filter((decision) => decision.decision === 'retravailler_hook' || decision.decision === 'raccourcir').length;
  return {
    dailyCommandCenter: [
      daily.recommendation,
      decisions[0] ? `Decision prioritaire: ${decisions[0].decision.replace(/_/g, ' ')}.` : 'Analyser une video pour obtenir une decision.',
      clusters[0] ? `Format a pousser: ${clusters[0].label}.` : 'Cluster dominant en attente.',
    ],
    opportunityQueues: [
      { queue: 'Reposts prioritaires', count: repostNow, topAction: decisions.find((decision) => decision.decision === 'repost_immediat')?.reason ?? 'Aucun repost immediat confirme.' },
      { queue: 'A ameliorer', count: rework, topAction: decisions.find((decision) => decision.decision === 'retravailler_hook')?.reason ?? 'Pas de correction urgente.' },
      { queue: 'Hooks a tester', count: daily.todayTasks.filter((task) => /hook/i.test(task.title)).length, topAction: daily.todayTasks.find((task) => /hook/i.test(task.title))?.body ?? 'Generer des hooks.' },
    ],
    creatorPriorities: [
      items.length ? 'Optimiser les videos deja analysees avant de creer plus.' : 'Lancer une premiere analyse.',
      daily.pattern,
      clusters[0] ? `Doubler le cluster ${clusters[0].label}.` : 'Identifier le premier cluster gagnant.',
    ],
    aiDecisions: decisions.slice(0, 5).map((decision) => `${decision.decision.replace(/_/g, ' ')}: ${decision.reason}`),
  };
}
