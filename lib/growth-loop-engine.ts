import type { AnalysisRow } from './analyses';
import type { TikTokDashboardState } from './tiktok-accounts';
import type { TrendOpportunity } from './trend-radar-engine';

export type GrowthOpportunitySource = 'analysis' | 'tiktok_account' | 'trend_radar' | 'hook_studio' | 'manual';
export type GrowthPriority = 'high' | 'medium' | 'low';
export type GrowthEffort = 'low' | 'medium' | 'high';
export type GrowthStatus = 'open' | 'in_progress' | 'done' | 'blocked';
export type RepostWorkflowStatus =
  | 'analyzed'
  | 'hook_selected'
  | 'repost_plan_ready'
  | 'ready_to_publish'
  | 'published'
  | 'result_pending'
  | 'result_recorded'
  | 'archived';

export interface GrowthOpportunity {
  id: string;
  source: GrowthOpportunitySource;
  priority: GrowthPriority;
  confidence: number;
  title: string;
  reason: string;
  actionLabel: string;
  actionHref: string;
  relatedVideoId?: string;
  relatedAccountId?: string;
  estimatedImpact: number;
  effort: GrowthEffort;
  status: GrowthStatus;
  evidence: string[];
  isRealData: boolean;
}

export interface NextBestAction extends GrowthOpportunity {
  stage: 'connect' | 'analyze' | 'hook' | 'repost' | 'publish' | 'result' | 'learn';
}

export interface RepostTask {
  id: string;
  videoId: string;
  status: RepostWorkflowStatus;
  selectedHook?: string;
  repostPlanReady: boolean;
  publishedUrl?: string;
  result?: ManualResultInput | SyncedResultInput;
}

export interface HookTask {
  id: string;
  sourceOpportunityId: string;
  hook: string;
  attachedVideoId?: string;
  status: 'generated' | 'selected' | 'attached';
}

export interface TrendTask {
  id: string;
  trendId: string;
  action: string;
  status: GrowthStatus;
}

export interface ManualResultInput {
  source: 'manual';
  views: number;
  likes: number;
  comments: number;
  shares: number;
  tiktokUrl?: string;
  notes?: string;
}

export interface SyncedResultInput {
  source: 'synced';
  tiktokVideoId: string;
  syncedAt: string;
}

export interface FollowUpTask {
  id: string;
  title: string;
  actionLabel: string;
  actionHref: string;
  status: 'pending' | 'recorded';
}

export interface GrowthLoopState {
  opportunities: GrowthOpportunity[];
  nextBestAction: NextBestAction;
  repostTasks: RepostTask[];
  hookTasks: HookTask[];
  trendTasks: TrendTask[];
  followUpTasks: FollowUpTask[];
  currentStep: 'analysis' | 'hook' | 'repost' | 'result' | 'memory';
  progress: number;
  steps: Array<{ id: GrowthLoopState['currentStep']; label: string; status: 'done' | 'current' | 'pending' }>;
  memoryInputs: Array<'analysis' | 'hook_generated' | 'hook_selected' | 'repost_ready' | 'published' | 'manual_result' | 'synced_result'>;
  hasFakeAnalytics: false;
}

export function selectHookForRepost(task: RepostTask, hook: string): RepostTask {
  return { ...task, selectedHook: hook, status: 'hook_selected' };
}

export function createRepostDraft(videoId: string): RepostTask {
  return { id: `repost_${videoId}`, videoId, status: 'analyzed', repostPlanReady: false };
}

export function markRepostReady(task: RepostTask): RepostTask {
  return { ...task, repostPlanReady: true, status: 'ready_to_publish' };
}

export function markRepostPublished(task: RepostTask, publishedUrl?: string): RepostTask {
  return { ...task, publishedUrl, status: 'result_pending' };
}

export function addRepostResult(task: RepostTask, result: ManualResultInput | SyncedResultInput): RepostTask {
  return { ...task, result, status: 'result_recorded' };
}

export function archiveRepost(task: RepostTask): RepostTask {
  return { ...task, status: 'archived' };
}

function priorityValue(priority: GrowthPriority) {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
}

function bestAnalysis(analyses: AnalysisRow[]) {
  return [...analyses].sort((a, b) => {
    const aGap = 100 - Math.min(a.result.hook.score, a.result.retention.score);
    const bGap = 100 - Math.min(b.result.hook.score, b.result.retention.score);
    return bGap - aGap;
  })[0];
}

export function buildGrowthLoopState(input: {
  analyses: AnalysisRow[];
  tiktok: TikTokDashboardState;
  trends: TrendOpportunity[];
  hooksGenerated?: number;
  plan?: string | null;
}): GrowthLoopState {
  const opportunities: GrowthOpportunity[] = [];
  const analysis = bestAnalysis(input.analyses);

  if (input.tiktok.active === 0 && input.tiktok.canConnectMore) {
    opportunities.push({
      id: 'connect_tiktok',
      source: 'tiktok_account',
      priority: 'high',
      confidence: 92,
      title: 'Connecte TikTok pour détecter tes vraies opportunités',
      reason: 'Sans compte connecté, Viralynz ne peut pas prioriser tes vidéos publiées ni préparer le suivi automatique.',
      actionLabel: 'Connecter TikTok',
      actionHref: '/api/tiktok/connect',
      estimatedImpact: 82,
      effort: 'low',
      status: 'open',
      evidence: ['Aucun compte TikTok actif'],
      isRealData: true,
    });
  }

  if (!input.analyses.length) {
    opportunities.push({
      id: 'first_analysis',
      source: 'analysis',
      priority: 'high',
      confidence: 90,
      title: 'Analyse ta première vidéo',
      reason: 'La boucle Viralynz commence avec une vidéo : hook, rétention, repost et mémoire créateur.',
      actionLabel: 'Analyser une vidéo',
      actionHref: '/dashboard/analyze',
      estimatedImpact: 78,
      effort: 'low',
      status: 'open',
      evidence: ['Aucune analyse sauvegardée'],
      isRealData: true,
    });
  }

  if (analysis) {
    const weakHook = analysis.result.hook.score < 72;
    const weakRetention = analysis.result.retention.score < 70;
    opportunities.push({
      id: `rework_${analysis.id}`,
      source: 'analysis',
      priority: weakHook || weakRetention ? 'high' : 'medium',
      confidence: analysis.result.coachAnalysis?.formatConfidence?.score ?? 74,
      title: weakHook ? 'Retravaille cette vidéo : hook trop lent' : 'Prépare le repost de cette vidéo',
      reason: analysis.result.hook.weaknesses?.[0] ?? analysis.result.retention.weaknesses?.[0] ?? 'Cette vidéo a un potentiel de repost exploitable.',
      actionLabel: weakHook ? 'Créer un Hook Pack' : 'Voir le plan de repost',
      actionHref: weakHook ? `/dashboard/hooks?videoId=${encodeURIComponent(analysis.id)}&objective=repost` : '/dashboard/analyze',
      relatedVideoId: analysis.id,
      estimatedImpact: Math.max(55, analysis.result.coachAnalysis?.repostEngine?.scoreAfter ?? analysis.result.viralityScore + 12),
      effort: weakHook ? 'medium' : 'low',
      status: 'open',
      evidence: [`Hook ${analysis.result.hook.score}/100`, `Rétention ${analysis.result.retention.score}/100`],
      isRealData: true,
    });
  }

  const realTrend = input.trends.find((trend) => trend.isRealData) ?? input.trends[0];
  if (realTrend) {
    opportunities.push({
      id: `trend_${realTrend.id}`,
      source: 'trend_radar',
      priority: realTrend.opportunityScore >= 80 ? 'high' : 'medium',
      confidence: realTrend.confidence === 'élevée' ? 86 : realTrend.confidence === 'moyenne' ? 70 : 52,
      title: realTrend.isRealData ? `Teste cette opportunité : ${realTrend.title}` : `À tester : ${realTrend.title}`,
      reason: realTrend.howToUse,
      actionLabel: 'Générer des hooks',
      actionHref: `/dashboard/hooks?trendType=${encodeURIComponent(realTrend.type)}&trendHook=${encodeURIComponent(realTrend.hookExample)}&trendTitle=${encodeURIComponent(realTrend.title)}`,
      estimatedImpact: realTrend.opportunityScore,
      effort: 'low',
      status: 'open',
      evidence: realTrend.evidence,
      isRealData: realTrend.isRealData,
    });
  }

  const sorted = [...opportunities].sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority) || b.estimatedImpact - a.estimatedImpact);
  const next = sorted[0] ?? {
    id: 'manual_start',
    source: 'manual',
    priority: 'high',
    confidence: 80,
    title: 'Lance ta boucle Viralynz',
    reason: 'Analyse une vidéo ou connecte TikTok pour obtenir ta première recommandation actionnable.',
    actionLabel: 'Analyser ma première vidéo',
    actionHref: '/dashboard/analyze',
    estimatedImpact: 75,
    effort: 'low',
    status: 'open',
    evidence: ['Onboarding'],
    isRealData: true,
  } satisfies GrowthOpportunity;

  const stage: NextBestAction['stage'] =
    next.id === 'connect_tiktok' ? 'connect' :
    next.id === 'first_analysis' ? 'analyze' :
    next.source === 'trend_radar' ? 'hook' :
    input.hooksGenerated ? 'repost' :
    analysis ? 'hook' : 'analyze';

  const progress = input.analyses.length
    ? input.hooksGenerated
      ? input.tiktok.totalVideos > 0 ? 80 : 60
      : 35
    : input.tiktok.active > 0 ? 20 : 8;
  const currentStep: GrowthLoopState['currentStep'] = progress >= 80 ? 'result' : progress >= 60 ? 'repost' : progress >= 35 ? 'hook' : 'analysis';
  const stepOrder: GrowthLoopState['currentStep'][] = ['analysis', 'hook', 'repost', 'result', 'memory'];
  const currentIndex = stepOrder.indexOf(currentStep);

  return {
    opportunities: sorted,
    nextBestAction: { ...next, stage },
    repostTasks: analysis ? [{ id: `repost_${analysis.id}`, videoId: analysis.id, status: analysis.result.repostVersion ? 'repost_plan_ready' : 'analyzed', repostPlanReady: !!analysis.result.repostVersion, selectedHook: analysis.result.repostVersion?.hook }] : [],
    hookTasks: input.trends.slice(0, 3).map((trend) => ({ id: `hook_${trend.id}`, sourceOpportunityId: trend.id, hook: trend.hookExample, status: 'generated' })),
    trendTasks: input.trends.slice(0, 3).map((trend) => ({ id: `trend_task_${trend.id}`, trendId: trend.id, action: trend.howToUse, status: 'open' })),
    followUpTasks: analysis ? [{ id: `follow_${analysis.id}`, title: 'Résultat en attente', actionLabel: 'Renseigner le résultat', actionHref: '/dashboard#growth-loop', status: 'pending' }] : [],
    currentStep,
    progress,
    steps: stepOrder.map((id, index) => ({ id, label: id === 'analysis' ? 'Analyse' : id === 'hook' ? 'Hook' : id === 'repost' ? 'Repost' : id === 'result' ? 'Résultat' : 'Mémoire', status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending' })),
    memoryInputs: [
      ...(input.analyses.length ? ['analysis' as const] : []),
      ...(input.hooksGenerated ? ['hook_generated' as const] : []),
      ...(analysis?.result.repostVersion ? ['repost_ready' as const] : []),
      ...(input.tiktok.totalVideos ? ['synced_result' as const] : []),
    ],
    hasFakeAnalytics: false,
  };
}
