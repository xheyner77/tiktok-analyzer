import type { RepostPriorityInput } from './repost-priority-engine';

export interface ContentMemoryGraph {
  nodes: Array<{ id: string; type: 'hook' | 'video' | 'format' | 'cta' | 'repost' | 'emotion' | 'metric' | 'trend'; label: string }>;
  edges: Array<{ from: string; to: string; relation: string; weight: number }>;
  repeatedPatterns: string[];
  resultHooks: string[];
  fatigueFormats: string[];
  recurringStructures: string[];
}

function id(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'node';
}

export function contentMemoryGraph(items: RepostPriorityInput[]): ContentMemoryGraph {
  const nodes = new Map<string, ContentMemoryGraph['nodes'][number]>();
  const edges: ContentMemoryGraph['edges'] = [];
  const structures = items.flatMap((item) => item.result.repostVersion?.structure ?? []);
  const formats = items.map((item) => item.result.coachAnalysis?.patternLabel ?? 'Short-form');
  const formatCounts = new Map<string, number>();
  for (const format of formats) formatCounts.set(format, (formatCounts.get(format) ?? 0) + 1);

  for (const item of items) {
    const videoId = `video_${item.id}`;
    const format = item.result.coachAnalysis?.patternLabel ?? 'Short-form';
    const hook = item.result.repostVersion?.hook ?? item.result.coachAnalysis?.hookVariants?.[0] ?? 'Hook';
    const cta = item.result.repostVersion?.cta ?? 'CTA';
    nodes.set(videoId, { id: videoId, type: 'video', label: item.result.coachAnalysis?.verdict ?? 'Video analysee' });
    nodes.set(`format_${id(format)}`, { id: `format_${id(format)}`, type: 'format', label: format });
    nodes.set(`hook_${id(hook)}`, { id: `hook_${id(hook)}`, type: 'hook', label: hook });
    nodes.set(`cta_${id(cta)}`, { id: `cta_${id(cta)}`, type: 'cta', label: cta });
    nodes.set('metric_watchtime', { id: 'metric_watchtime', type: 'metric', label: 'Watchtime' });
    edges.push({ from: videoId, to: `format_${id(format)}`, relation: 'uses_format', weight: item.result.viralityScore });
    edges.push({ from: videoId, to: `hook_${id(hook)}`, relation: 'uses_hook', weight: item.result.hook.score });
    edges.push({ from: `hook_${id(hook)}`, to: 'metric_watchtime', relation: 'influences', weight: item.result.retention.score });
    edges.push({ from: `cta_${id(cta)}`, to: videoId, relation: 'closes', weight: item.result.coachAnalysis?.subScores.cta ?? item.result.viralityScore });
  }

  return {
    nodes: [...nodes.values()],
    edges,
    repeatedPatterns: [...formatCounts.entries()].filter(([, count]) => count > 1).map(([format]) => format),
    resultHooks: items.filter((item) => item.result.viralityScore >= 70).map((item) => item.result.repostVersion?.hook ?? '').filter(Boolean).slice(0, 5),
    fatigueFormats: [...formatCounts.entries()].filter(([, count]) => count >= 3).map(([format]) => format),
    recurringStructures: [...new Set(structures)].slice(0, 6),
  };
}
