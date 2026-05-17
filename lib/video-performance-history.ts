import type { RepostVersion } from './types';
import type { RepostPriorityInput } from './repost-priority-engine';
import { scoreRepostPriority } from './repost-priority-engine';

export type VideoLifecycleStatus = 'analysee' | 'repostee' | 'a_retravailler' | 'testee' | 'archivee';
export type RepostWorkflowState = 'draft_repost' | 'hook_selectionne' | 'repost_pret' | 'repost_publie' | 'resultat_en_attente';

export interface VideoHistoryEntry {
  id: string;
  videoUrl: string;
  createdAt: string;
  currentScore: number;
  scoreAfterRepost: number;
  repostScore: number;
  hookVersions: string[];
  ctaVersions: string[];
  modificationHistory: Array<{
    at: string;
    label: string;
    detail: string;
  }>;
  status: VideoLifecycleStatus;
  workflowState: RepostWorkflowState;
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function repostVersionFor(item: RepostPriorityInput): RepostVersion | undefined {
  return item.result.repostVersion;
}

export function videoPerformanceHistory(items: RepostPriorityInput[]): VideoHistoryEntry[] {
  return items.map((item) => {
    const priority = scoreRepostPriority(item);
    const repost = repostVersionFor(item);
    const engine = item.result.coachAnalysis?.repostEngine;
    const selectedHook = repost?.hook ?? item.result.coachAnalysis?.hookVariants?.[0];
    const hookVersions = unique([
      selectedHook,
      ...(repost?.hookVariants ?? []),
      ...(item.result.coachAnalysis?.hookVariants ?? []),
    ]).slice(0, 8);
    const ctaVersions = unique([
      repost?.cta,
      ...(item.result.coachAnalysis?.optimizedCtas ?? []),
    ]).slice(0, 5);
    const status: VideoLifecycleStatus = priority.status === 'repost_conseille'
      ? 'a_retravailler'
      : item.result.viralityScore >= 82
        ? 'testee'
        : 'analysee';
    const workflowState: RepostWorkflowState = priority.status === 'repost_conseille' && hookVersions.length
      ? 'repost_pret'
      : hookVersions.length
        ? 'hook_selectionne'
        : 'draft_repost';

    return {
      id: item.id,
      videoUrl: item.video_url,
      createdAt: item.created_at,
      currentScore: item.result.viralityScore,
      scoreAfterRepost: engine?.scoreAfter ?? Math.min(100, item.result.viralityScore + Math.max(6, priority.repostScore - item.result.viralityScore)),
      repostScore: priority.repostScore,
      hookVersions,
      ctaVersions,
      modificationHistory: [
        { at: item.created_at, label: 'Analyse', detail: item.result.coachAnalysis?.verdict ?? item.result.finalVerdict ?? 'Analyse Viralynz sauvegardee.' },
        { at: item.created_at, label: 'Probleme detecte', detail: item.result.coachAnalysis?.detectedProblems?.[0]?.title ?? 'Packaging a optimiser.' },
        { at: item.created_at, label: 'Plan repost', detail: priority.recommendedFix },
      ],
      status,
      workflowState,
    };
  });
}
