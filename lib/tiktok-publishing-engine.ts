import type { Plan } from './supabase';
import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { StrategicDecisionState } from './strategic-decision-engine';
import type { CumulativeIntelligenceState } from './cumulative-intelligence-layer';
import type { SmartAutomationState } from './smart-automation-engine';
import { hasProOrLifetimeAccess } from './plans';

export type PublishingPlatform = 'tiktok' | 'shorts' | 'reels';
export type ContentPipelineStatus = 'idea' | 'editing' | 'ready' | 'scheduled' | 'posted' | 'repost_candidate';
export type PublishAction = 'post_now' | 'schedule' | 'draft' | 'repost_schedule' | 'queue';

export interface SmartScheduleRecommendation {
  id: string;
  platform: PublishingPlatform;
  day: string;
  time: string;
  windowLabel: string;
  projectName: string;
  confidence: number;
  reason: string;
  sourceSignals: string[];
}

export interface PrePublishAnalysis {
  hookRisk: number;
  ctaRisk: number;
  introRisk: number;
  repostPotential: number;
  strength: string;
  issues: string[];
  nextFix: string;
  confidence: number;
}

export interface ContentPipelineItem {
  id: string;
  title: string;
  platform: PublishingPlatform;
  projectName: string;
  status: ContentPipelineStatus;
  action: PublishAction;
  hook: string;
  caption: string;
  hashtags: string[];
  scheduledFor?: string;
  scheduleReason: string;
  prePublish: PrePublishAnalysis;
}

export interface PublishingDraft {
  id: string;
  projectName: string;
  platform: PublishingPlatform;
  hook: string;
  caption: string;
  hashtags: string[];
  cta: string;
  structure: string[];
  editableFields: Array<'hook' | 'caption' | 'hashtags' | 'cta' | 'structure' | 'repost_version'>;
  readinessScore: number;
}

export interface AutoRepostSuggestion {
  id: string;
  title: string;
  projectName: string;
  priorityScore: number;
  reason: string;
  generatedHook: string;
  suggestedTiming: string;
  schedulingConfidence: number;
}

export interface TikTokPublishingState {
  publishingScore: number;
  pipeline: ContentPipelineItem[];
  scheduleRecommendations: SmartScheduleRecommendation[];
  drafts: PublishingDraft[];
  autoRepostSuggestions: AutoRepostSuggestion[];
  queueSummary: {
    ready: number;
    scheduled: number;
    repostCandidates: number;
    drafts: number;
  };
  futurePlatforms: Array<{
    platform: PublishingPlatform;
    label: string;
    status: 'primary' | 'future_ready';
    detail: string;
  }>;
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function projectForItem(item: RepostPriorityInput, workspace: ContentWorkspaceState) {
  const niche = item.result.analyzerMeta?.nicheLabel ?? item.result.analyzerMeta?.niche ?? 'TikTok';
  return workspace.projects.find((project) => project.niche.toLowerCase() === niche.toLowerCase()) ?? workspace.activeProject;
}

function captionFor(item: RepostPriorityInput) {
  const result = item.result;
  const angle = result.repostVersion?.angle ?? result.coachAnalysis?.repostEngine.bestOpportunity?.title ?? result.finalVerdict;
  const cta = result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0] ?? 'Tu testerais quelle version ?';
  return [angle, cta].filter(Boolean).join(' ');
}

function hashtagsFor(item: RepostPriorityInput, projectName: string) {
  const niche = item.result.analyzerMeta?.nicheLabel ?? item.result.analyzerMeta?.niche ?? 'creator';
  return [
    `#${String(niche).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'tiktok'}`,
    '#contentcreator',
    '#tiktoktips',
    projectName.toLowerCase().includes('ugc') ? '#ugccreator' : '#viralynz',
  ].slice(0, 4);
}

function nextDateLabel(offsetDays: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function buildScheduleRecommendations(
  workspace: ContentWorkspaceState,
  intelligence: CumulativeIntelligenceState,
  plan: Plan,
): SmartScheduleRecommendation[] {
  const activeProject = workspace.activeProject;
  const hookPrediction = intelligence.predictions.find((prediction) => prediction.type === 'hook');
  const repostPrediction = intelligence.predictions.find((prediction) => prediction.type === 'repost');
  const advanced = hasProOrLifetimeAccess(plan);
  return [
    {
      id: 'schedule_tiktok_primary',
      platform: 'tiktok',
      day: 'Prochaine fenetre forte',
      time: activeProject.progressionScore >= 70 ? '18:30' : '12:15',
      windowLabel: 'Fenetre recommandee par memoire projet',
      projectName: activeProject.name,
      confidence: clamp(48 + activeProject.videosCount * 7 + activeProject.patternsCount * 4),
      reason: activeProject.memory.benchmarks[0] ?? 'Base sur les patterns internes du projet, pas sur des analytics TikTok inventees.',
      sourceSignals: [
        `Projet ${activeProject.name}`,
        `Progression ${activeProject.progressionScore}/100`,
        hookPrediction?.prediction ?? 'Hook prediction en calibration',
      ],
    },
    {
      id: 'schedule_repost_window',
      platform: 'tiktok',
      day: 'Apres correction hook',
      time: activeProject.repostsCount ? '19:45' : '17:30',
      windowLabel: 'Fenetre repost intelligente',
      projectName: activeProject.name,
      confidence: repostPrediction?.confidence ?? 42,
      reason: repostPrediction?.evidence ?? 'Le repost timing reste prudent tant que peu de feedbacks existent.',
      sourceSignals: [
        repostPrediction?.prediction ?? 'Aucun repost confirme',
        activeProject.nextAction,
      ],
    },
    {
      id: 'schedule_cross_platform',
      platform: advanced ? 'shorts' : 'reels',
      day: advanced ? 'Adaptation future' : 'Verrouille Pro',
      time: advanced ? '09:30' : '--',
      windowLabel: advanced ? 'Cross-platform ready' : 'Future ready',
      projectName: activeProject.name,
      confidence: advanced ? 54 : 28,
      reason: advanced ? 'Structure preparee pour Shorts/Reels avec le meme draft.' : 'Architecture prete, activation reservee aux workflows avances.',
      sourceSignals: ['TikTok reste prioritaire', 'Draft multi-plateforme structure'],
    },
  ];
}

function buildPrePublish(item: RepostPriorityInput): PrePublishAnalysis {
  const result = item.result;
  const ctaScore = result.coachAnalysis?.subScores.cta ?? result.viralityScore;
  const hookRisk = clamp(100 - result.hook.score);
  const ctaRisk = clamp(100 - ctaScore);
  const introRisk = clamp(100 - result.retention.score);
  const repostPotential = clamp(result.coachAnalysis?.subScores.repostPotential ?? result.viralityScore);
  const issues = [
    hookRisk >= 35 ? 'Hook a renforcer avant publication.' : undefined,
    ctaRisk >= 38 ? 'CTA a rendre plus court et plus concret.' : undefined,
    introRisk >= 38 ? 'Intro ou payoff a densifier.' : undefined,
  ].filter(Boolean) as string[];
  return {
    hookRisk,
    ctaRisk,
    introRisk,
    repostPotential,
    strength: result.hook.strengths[0] ?? result.retention.strengths[0] ?? 'Sujet exploitable avec structure a clarifier.',
    issues,
    nextFix: result.coachAnalysis?.detectedProblems?.[0]?.action ?? result.actionPlan?.[0] ?? result.repostVersion?.hook ?? 'Valider hook, CTA et payoff avant publication.',
    confidence: clamp(result.videoIntelligence?.confidence.score ?? result.coachAnalysis?.formatConfidence?.score ?? 54),
  };
}

function statusFor(item: RepostPriorityInput, repostScore: number): ContentPipelineStatus {
  if (item.result.coachAnalysis?.repostEngine.recommended || repostScore >= 70) return 'repost_candidate';
  if (item.result.repostVersion && item.result.hook.score >= 68) return 'ready';
  if (item.result.hook.score < 58 || item.result.retention.score < 58) return 'editing';
  return 'idea';
}

function actionFor(status: ContentPipelineStatus): PublishAction {
  if (status === 'repost_candidate') return 'repost_schedule';
  if (status === 'ready') return 'schedule';
  if (status === 'scheduled') return 'schedule';
  if (status === 'posted') return 'post_now';
  if (status === 'editing') return 'draft';
  return 'queue';
}

function buildPipeline(
  items: RepostPriorityInput[],
  workspace: ContentWorkspaceState,
  recommendations: SmartScheduleRecommendation[],
): ContentPipelineItem[] {
  const ranked = rankRepostPriorities(items);
  return ranked.slice(0, 8).map((priority, index) => {
    const item = items.find((candidate) => candidate.id === priority.id) ?? items[index];
    const project = item ? projectForItem(item, workspace) : workspace.activeProject;
    const prePublish = item ? buildPrePublish(item) : {
      hookRisk: 0,
      ctaRisk: 0,
      introRisk: 0,
      repostPotential: 0,
      strength: 'En attente de video.',
      issues: [],
      nextFix: 'Ajouter une idee ou une video.',
      confidence: 0,
    };
    const status = item ? statusFor(item, priority.repostScore) : 'idea';
    const schedule = recommendations[index % recommendations.length];
    return {
      id: `publish_${priority.id}`,
      title: priority.title,
      platform: 'tiktok',
      projectName: project.name,
      status,
      action: actionFor(status),
      hook: item?.result.repostVersion?.hook ?? item?.result.hook.analysis ?? priority.recommendedFix,
      caption: item ? captionFor(item) : 'Caption a preparer',
      hashtags: item ? hashtagsFor(item, project.name) : ['#viralynz'],
      scheduledFor: status === 'ready' || status === 'repost_candidate' ? nextDateLabel(index + 1, schedule?.time.startsWith('18') ? 18 : 12) : undefined,
      scheduleReason: schedule?.reason ?? 'Pas assez de signaux pour recommander un timing fort.',
      prePublish,
    };
  });
}

function buildDrafts(items: RepostPriorityInput[], workspace: ContentWorkspaceState): PublishingDraft[] {
  const sourceItems = items.length ? items.slice(0, 5) : [];
  const drafts = sourceItems.map((item) => {
    const project = projectForItem(item, workspace);
    const cta = item.result.repostVersion?.cta ?? item.result.coachAnalysis?.optimizedCtas?.[0] ?? 'Commente si tu veux la version complete.';
    return {
      id: `draft_${item.id}`,
      projectName: project.name,
      platform: 'tiktok' as const,
      hook: item.result.repostVersion?.hook ?? item.result.coachAnalysis?.hookVariants?.[0] ?? item.result.hook.analysis,
      caption: captionFor(item),
      hashtags: hashtagsFor(item, project.name),
      cta,
      structure: item.result.repostVersion?.structure ?? item.result.coachAnalysis?.videoSegments?.map((segment) => `${segment.range} - ${segment.mainProblem}`) ?? [],
      editableFields: ['hook', 'caption', 'hashtags', 'cta', 'structure', 'repost_version'] as PublishingDraft['editableFields'],
      readinessScore: clamp((item.result.hook.score + item.result.retention.score + (item.result.coachAnalysis?.subScores.cta ?? item.result.viralityScore)) / 3),
    };
  });
  if (drafts.length) return drafts;
  return [
    {
      id: 'draft_empty',
      projectName: workspace.activeProject.name,
      platform: 'tiktok',
      hook: 'Analyse une video pour generer un draft.',
      caption: 'Caption en attente.',
      hashtags: ['#viralynz'],
      cta: 'CTA en attente.',
      structure: ['Idea', 'Editing', 'Ready', 'Scheduled', 'Posted'],
      editableFields: ['hook', 'caption', 'hashtags', 'cta', 'structure', 'repost_version'],
      readinessScore: 0,
    },
  ];
}

function buildAutoReposts(
  automation: SmartAutomationState,
  workspace: ContentWorkspaceState,
  recommendations: SmartScheduleRecommendation[],
): AutoRepostSuggestion[] {
  return automation.repostAutoQueue.slice(0, 5).map((item, index) => {
    const schedule = recommendations[index % recommendations.length] ?? recommendations[0];
    return {
      id: `publish_repost_${item.id}`,
      title: item.title,
      projectName: workspace.activeProject.name,
      priorityScore: item.priorityScore,
      reason: item.reason,
      generatedHook: item.corrections[0] ?? 'Tester un hook plus direct avant repost.',
      suggestedTiming: schedule ? `${schedule.day} ${schedule.time}` : 'Timing a confirmer',
      schedulingConfidence: schedule?.confidence ?? 38,
    };
  });
}

export function buildTikTokPublishingEngine(input: {
  items: RepostPriorityInput[];
  contentOS: ContentOperatingSystem;
  workspace: ContentWorkspaceState;
  decisions: StrategicDecisionState;
  intelligence: CumulativeIntelligenceState;
  automation: SmartAutomationState;
  plan: Plan;
}): TikTokPublishingState {
  const scheduleRecommendations = buildScheduleRecommendations(input.workspace, input.intelligence, input.plan);
  const pipeline = buildPipeline(input.items, input.workspace, scheduleRecommendations);
  const drafts = buildDrafts(input.items, input.workspace);
  const autoRepostSuggestions = buildAutoReposts(input.automation, input.workspace, scheduleRecommendations);
  const ready = pipeline.filter((item) => item.status === 'ready').length;
  const scheduled = pipeline.filter((item) => item.status === 'scheduled').length;
  const repostCandidates = pipeline.filter((item) => item.status === 'repost_candidate').length;
  const publishingScore = clamp(
    (input.decisions.topDecision.opportunityScore * 0.28)
      + (input.automation.automationScore * 0.22)
      + (input.workspace.activeProject.progressionScore * 0.2)
      + ((input.contentOS.repostQueue[0]?.repostScore ?? 0) * 0.18)
      + (scheduleRecommendations[0]?.confidence ?? 0) * 0.12,
  );

  return {
    publishingScore,
    pipeline,
    scheduleRecommendations,
    drafts,
    autoRepostSuggestions,
    queueSummary: {
      ready,
      scheduled,
      repostCandidates,
      drafts: drafts.filter((draft) => draft.readinessScore < 72).length,
    },
    futurePlatforms: [
      { platform: 'tiktok', label: 'TikTok', status: 'primary', detail: 'Publication, drafts, repost queue et scheduling prioritaires.' },
      { platform: 'shorts', label: 'YouTube Shorts', status: 'future_ready', detail: 'Modele de draft et statut deja compatibles.' },
      { platform: 'reels', label: 'Instagram Reels', status: 'future_ready', detail: 'Architecture preparee pour adaptation cross-platform.' },
    ],
    summary: publishingScore
      ? `Publishing OS actif: ${ready} contenus prets, ${repostCandidates} repost candidates, ${autoRepostSuggestions.length} suggestions repost.`
      : 'Le publishing OS se calibrera apres les premieres analyses sauvegardees.',
  };
}
