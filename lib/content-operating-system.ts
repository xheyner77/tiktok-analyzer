import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';
import { buildHookLibrary } from './hook-library-engine';
import { buildHookTestGroups } from './multi-hook-test-engine';

export interface ContentOSHook {
  id: string;
  hook: string;
  score: number;
  status: 'performant' | 'flop' | 'reposted' | 'saved' | 'used';
  niche: string;
  format: string;
  tags: string[];
  sourceVideoId: string;
}

export interface RepostWorkspaceItem {
  id: string;
  title: string;
  scoreBefore: number;
  scoreAfter: number;
  originalHook: string;
  optimizedHook: string;
  originalCta: string;
  optimizedCta: string;
  oldStructure: string[];
  newStructure: string[];
  modifications: string[];
  timeline: Array<{ time: string; label: string; insight: string }>;
}

export interface CreatorDNA {
  dominantStyle: string;
  dominantRhythm: string;
  frequentHooks: string[];
  frequentCtas: string[];
  recurringErrors: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface ContentPattern {
  id: string;
  type: 'winning_structure' | 'weak_structure' | 'hook' | 'cta' | 'retention' | 'format';
  label: string;
  evidence: string;
  confidence: number;
}

export interface ContentExperiment {
  id: string;
  title: string;
  type: 'hook_test' | 'intro_test' | 'cta_test';
  variants: Array<{ id: string; label: string; score: number; status: 'winner' | 'candidate' | 'saved' }>;
  nextAction: string;
}

export interface ContentOperatingSystem {
  hookVault: ContentOSHook[];
  repostWorkspace: RepostWorkspaceItem[];
  repostQueue: ReturnType<typeof rankRepostPriorities>;
  creatorDNA: CreatorDNA;
  patterns: ContentPattern[];
  experiments: ContentExperiment[];
}

function countTop(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value]) => value);
}

function hookStatus(score: number, tags: string[]): ContentOSHook['status'] {
  if (tags.includes('performant')) return 'performant';
  if (tags.includes('repost')) return 'reposted';
  if (score >= 74) return 'saved';
  if (score < 52) return 'flop';
  return 'used';
}

function buildHookVault(items: RepostPriorityInput[]): ContentOSHook[] {
  const library = buildHookLibrary(items);
  return library.map((hook) => {
    const source = items.find((item) => item.id === hook.group);
    return {
      id: hook.id,
      hook: hook.hook,
      score: hook.score,
      status: hookStatus(hook.score, hook.tags),
      niche: source?.result.analyzerMeta?.nicheLabel ?? source?.result.analyzerMeta?.niche ?? 'TikTok',
      format: source?.result.coachAnalysis?.patternLabel ?? 'Short-form',
      tags: hook.tags,
      sourceVideoId: hook.group,
    };
  });
}

function buildRepostWorkspace(items: RepostPriorityInput[]): RepostWorkspaceItem[] {
  return items
    .filter((item) => item.result.repostVersion)
    .slice(0, 5)
    .map((item) => {
      const result = item.result;
      const repost = result.repostVersion!;
      return {
        id: item.id,
        title: result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'Repost lab',
        scoreBefore: result.coachAnalysis?.repostEngine.scoreBefore ?? result.viralityScore,
        scoreAfter: result.coachAnalysis?.repostEngine.scoreAfter ?? Math.min(100, result.viralityScore + 12),
        originalHook: result.coachAnalysis?.openingAnalysis?.vocalHook ?? result.hook.analysis,
        optimizedHook: repost.hook,
        originalCta: result.coachAnalysis?.optimizedCtas?.[1] ?? 'CTA original non detecte avec confiance',
        optimizedCta: repost.cta,
        oldStructure: result.coachAnalysis?.videoSegments?.slice(0, 4).map((segment) => `${segment.range} - ${segment.mainProblem}`) ?? result.hook.weaknesses,
        newStructure: repost.structure,
        modifications: result.actionPlan?.slice(0, 5) ?? result.coachAnalysis?.repostEngine.priorityChanges ?? [],
        timeline: result.coachAnalysis?.timeline?.slice(0, 5).map((marker) => ({
          time: marker.time,
          label: marker.label,
          insight: marker.insight,
        })) ?? [],
      };
    });
}

function buildCreatorDNA(items: RepostPriorityInput[]): CreatorDNA {
  const results = items.map((item) => item.result);
  const formats = countTop(results.map((result) => result.coachAnalysis?.patternLabel ?? result.analyzerMeta?.nicheLabel ?? 'Short-form'), 3);
  const hooks = countTop(results.flatMap((result) => [result.repostVersion?.hook, ...(result.coachAnalysis?.hookVariants ?? [])].filter(Boolean) as string[]), 4);
  const ctas = countTop(results.flatMap((result) => [result.repostVersion?.cta, ...(result.coachAnalysis?.optimizedCtas ?? [])].filter(Boolean) as string[]), 4);
  const errors = countTop(results.flatMap((result) => result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? result.hook.weaknesses), 5);
  const avgEditing = results.length ? Math.round(results.reduce((sum, result) => sum + result.editing.score, 0) / results.length) : 0;
  return {
    dominantStyle: formats[0] ?? 'Style en calibration',
    dominantRhythm: avgEditing >= 72 ? 'Montage rapide' : avgEditing >= 55 ? 'Rythme cadence' : 'Rythme a densifier',
    frequentHooks: hooks,
    frequentCtas: ctas,
    recurringErrors: errors,
    strengths: countTop(results.flatMap((result) => [...result.hook.strengths, ...result.retention.strengths]), 4),
    weaknesses: countTop(results.flatMap((result) => [...result.hook.weaknesses, ...result.retention.weaknesses]), 4),
  };
}

function buildPatterns(items: RepostPriorityInput[]): ContentPattern[] {
  const results = items.map((item) => item.result);
  const formats = countTop(results.map((result) => result.coachAnalysis?.patternLabel ?? 'Short-form'), 3);
  const hookTypes = countTop(results.map((result) => result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec !== undefined && result.videoIntelligence.technicalSignals.structure.timeToPayoffSec <= 3 ? 'Preuve rapide' : 'Payoff a avancer'), 2);
  const errors = countTop(results.flatMap((result) => result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? []), 4);
  return [
    ...formats.map((format, index) => ({
      id: `format_${index}`,
      type: 'format' as const,
      label: format,
      evidence: 'Format recurrent dans les analyses sauvegardees.',
      confidence: Math.min(92, 52 + items.length * 8),
    })),
    ...hookTypes.map((hook, index) => ({
      id: `hook_${index}`,
      type: 'hook' as const,
      label: hook,
      evidence: 'Pattern extrait des positions de payoff et hooks recommandes.',
      confidence: Math.min(88, 48 + items.length * 7),
    })),
    ...errors.map((error, index) => ({
      id: `weak_${index}`,
      type: 'weak_structure' as const,
      label: error,
      evidence: 'Erreur recurrente detectee dans les diagnostics.',
      confidence: Math.min(90, 50 + items.length * 6),
    })),
  ].slice(0, 10);
}

function buildExperiments(items: RepostPriorityInput[]): ContentExperiment[] {
  const hookTests = buildHookTestGroups(items);
  return hookTests.slice(0, 4).map((group) => ({
    id: group.id,
    title: group.title,
    type: 'hook_test',
    variants: group.variants.slice(0, 4).map((variant) => ({
      id: variant.id,
      label: variant.hook,
      score: variant.score,
      status: variant.id === group.winnerId ? 'winner' : variant.status === 'favori' ? 'saved' : 'candidate',
    })),
    nextAction: 'Tester le hook gagnant sur le prochain repost et sauvegarder le resultat.',
  }));
}

export function buildContentOperatingSystem(items: RepostPriorityInput[]): ContentOperatingSystem {
  return {
    hookVault: buildHookVault(items),
    repostWorkspace: buildRepostWorkspace(items),
    repostQueue: rankRepostPriorities(items).slice(0, 8),
    creatorDNA: buildCreatorDNA(items),
    patterns: buildPatterns(items),
    experiments: buildExperiments(items),
  };
}
