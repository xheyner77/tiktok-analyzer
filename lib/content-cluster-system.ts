import type { RepostPriorityInput } from './repost-priority-engine';

export interface ContentCluster {
  id: string;
  label: string;
  count: number;
  avgScore: number;
  watchtimeSignal: number;
  fatigueRisk: number;
  angles: string[];
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function contentClusterSystem(items: RepostPriorityInput[]): ContentCluster[] {
  const groups = new Map<string, RepostPriorityInput[]>();
  for (const item of items) {
    const key = item.result.coachAnalysis?.patternLabel ?? item.result.analyzerMeta?.nicheLabel ?? 'Short-form';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()].map(([label, group], index) => ({
    id: `cluster_${index + 1}`,
    label,
    count: group.length,
    avgScore: average(group.map((item) => item.result.viralityScore)),
    watchtimeSignal: average(group.map((item) => item.result.coachAnalysis?.subScores.rewatchPotential ?? item.result.retention.score)),
    fatigueRisk: Math.min(100, Math.max(12, group.length * 14 - average(group.map((item) => item.result.viralityScore)) * 0.25)),
    angles: [...new Set(group.flatMap((item) => item.result.coachAnalysis?.hookVariants ?? []))].slice(0, 3),
  }));
}
