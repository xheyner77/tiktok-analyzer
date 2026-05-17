import type { RepostPriorityInput } from './repost-priority-engine';
import type { CreatorProfile } from './creator-profile-engine';

export interface ContentStrategy {
  contentClusters: Array<{ name: string; count: number; recommendation: string }>;
  formatRecommendations: string[];
  strategySuggestions: string[];
  nicheAnalysis: string;
  creatorStrengths: string[];
  fatigueSignals: string[];
}

function countBy(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values.filter(Boolean)) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function contentStrategyEngine(items: RepostPriorityInput[], profile: CreatorProfile): ContentStrategy {
  const formats = countBy(items.map((item) => item.result.coachAnalysis?.patternLabel ?? item.result.analyzerMeta?.nicheLabel ?? 'TikTok'));
  const repeatedProblems = countBy(items.flatMap((item) => item.result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? []));
  const topFormat = formats[0]?.[0] ?? 'Format principal';

  return {
    contentClusters: formats.slice(0, 4).map(([name, count]) => ({
      name,
      count,
      recommendation: count >= 2 ? 'Doubler ce cluster avec un angle different.' : 'Tester encore avant conclusion.',
    })),
    formatRecommendations: [
      `${topFormat}: produire 2 variations avant de changer de sujet.`,
      profile.bestRhythms[0] ?? 'Ajouter une rupture visuelle avant 0:05.',
    ],
    strategySuggestions: [
      profile.advancedInsights[0] ?? 'Concentrer la semaine sur hooks courts et preuve rapide.',
      repeatedProblems[0] ? `Corriger le pattern recurrent: ${repeatedProblems[0][0]}.` : 'Identifier un probleme recurrent avec plus de donnees.',
      'Recycler les meilleurs hooks en versions commentaire, watchtime et storytelling.',
    ],
    nicheAnalysis: items[0]?.result.analyzerMeta?.nicheLabel ? `Niche dominante: ${items[0].result.analyzerMeta.nicheLabel}.` : 'Niche a consolider avec davantage de videos.',
    creatorStrengths: profile.memory.strengths,
    fatigueSignals: repeatedProblems.slice(0, 3).map(([name]) => name),
  };
}
