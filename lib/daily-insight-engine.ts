import type { RepostPriorityInput, RepostPriorityItem } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';
import { buildCreatorMemory, type CreatorMemory } from './creator-memory-engine';

export interface DailyInsight {
  insight: string;
  recommendation: string;
  pattern: string;
  repostOpportunity: string;
  sourceLabel: string;
  confidence: number;
  todayTasks: Array<{
    title: string;
    body: string;
    href: string;
    priority: 'haute' | 'moyenne' | 'basse';
  }>;
  notifications: Array<{
    title: string;
    body: string;
    tone: 'opportunity' | 'warning' | 'system';
  }>;
  strategy: string[];
  memory: CreatorMemory;
  repostPriorities: RepostPriorityItem[];
}

function clamp(value: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function bestRealSignal(items: RepostPriorityInput[]) {
  return items.find((item) => item.result.observedMetrics && Object.keys(item.result.observedMetrics).length > 0);
}

export function dailyInsightEngine(items: RepostPriorityInput[]): DailyInsight {
  const ranked = rankRepostPriorities(items);
  const memory = buildCreatorMemory(items);
  const results = items.map((item) => item.result);
  const avgHook = average(results.map((result) => result.hook.score));
  const avgRetention = average(results.map((result) => result.retention.score));
  const avgCta = average(results.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore));
  const top = ranked[0];
  const realMetrics = bestRealSignal(items);
  const sourceLabel = realMetrics
    ? 'Base sur tes analyses et metrics TikTok disponibles'
    : items.length
      ? 'Base sur tes analyses Viralynz disponibles'
      : 'Demo, aucune analyse reelle disponible';

  const insight = memory.bestHookStyles[0]
    ? `Tes contenus montrent un signal recurrent: ${memory.bestHookStyles[0].toLowerCase()} ressort comme angle de hook exploitable.`
    : avgHook < 66
      ? 'Tes videos perdent du potentiel dans les premieres secondes: le sujet arrive avant la promesse.'
      : 'Tes hooks sont exploitables: le prochain gain vient surtout du rythme et du payoff.';

  const recommendation = avgRetention < 66
    ? 'Aujourd hui, retravaille une video en placant la preuve ou le payoff avant 0:05.'
    : avgCta < 64
      ? 'Aujourd hui, teste un CTA question sur la video prioritaire pour augmenter les commentaires.'
      : 'Aujourd hui, garde le meme sujet mais teste deux hooks plus courts avant repost.';

  const pattern = memory.recurringPatterns[0]
    ? `${memory.recurringPatterns[0]} revient dans tes analyses recentes.`
    : 'Le systeme attend plus de videos pour confirmer un pattern recurrent.';

  const repostOpportunity = top
    ? `${top.label}: ${top.recommendedFix}`
    : 'Analyse une video pour generer une opportunite de repost fiable.';

  return {
    insight,
    recommendation,
    pattern,
    repostOpportunity,
    sourceLabel,
    confidence: clamp(42 + items.length * 8 + (realMetrics ? 16 : 0) + Math.max(0, ranked[0]?.confidence ?? 0) * 0.22),
    todayTasks: [
      {
        title: top ? 'Retravailler la video prioritaire' : 'Analyser une video',
        body: top?.recommendedFix ?? 'Ajoute une premiere analyse pour activer le feed quotidien.',
        href: top ? '/dashboard/analyze' : '/dashboard/analyze',
        priority: 'haute',
      },
      {
        title: 'Tester un hook',
        body: memory.bestHookStyles[0] ? `Variante conseillee: ${memory.bestHookStyles[0].toLowerCase()}.` : 'Genere 5 hooks depuis le Hook Lab.',
        href: '/dashboard/hooks',
        priority: 'moyenne',
      },
      {
        title: 'Poster dans une fenetre test',
        body: memory.bestPostingWindows[0] ?? 'Connecte TikTok pour affiner les horaires avec de vraies donnees.',
        href: '/dashboard#strategy',
        priority: 'basse',
      },
    ],
    notifications: [
      {
        title: 'Insight quotidien pret',
        body: insight,
        tone: 'system',
      },
      {
        title: top ? 'Video a fort potentiel' : 'Memoire contenu en attente',
        body: top ? `${top.repostScore}/100 en priorite repost.` : 'Le dashboard ne fabrique pas de faux analytics sans donnees.',
        tone: top ? 'opportunity' : 'warning',
      },
      {
        title: 'Strategie IA',
        body: memory.strategyInsights[0] ?? recommendation,
        tone: 'system',
      },
    ],
    strategy: memory.strategyInsights,
    memory,
    repostPriorities: ranked,
  };
}
