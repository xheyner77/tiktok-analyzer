import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import type { ContentWorkspaceState } from './content-workspace-engine';

export type StrategicActionType = 'repost_video' | 'test_hook' | 'fix_cta' | 'prioritize_project' | 'improve_structure' | 'reduce_intro';
export type StrategicEffort = 'faible' | 'moyen' | 'eleve';
export type StrategicPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface StrategicAction {
  id: string;
  rank: number;
  type: StrategicActionType;
  title: string;
  action: string;
  reason: string;
  decisionContext: string;
  impactScore: number;
  confidenceScore: number;
  effort: StrategicEffort;
  opportunityScore: number;
  priority: StrategicPriority;
  projectName: string;
  sourceId?: string;
}

export interface StrategicDecisionState {
  topDecision: StrategicAction;
  actionQueue: StrategicAction[];
  projectPriority: {
    projectName: string;
    reason: string;
    opportunityScore: number;
    confidenceScore: number;
  };
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function effortFromScore(value: number): StrategicEffort {
  if (value >= 66) return 'eleve';
  if (value >= 42) return 'moyen';
  return 'faible';
}

function priorityFrom(opportunity: number, confidence: number, effort: StrategicEffort): StrategicPriority {
  if (opportunity >= 82 && confidence >= 66 && effort !== 'eleve') return 'urgent';
  if (opportunity >= 70) return 'high';
  if (opportunity >= 52) return 'medium';
  return 'low';
}

function opportunityScore(input: {
  subjectStrength: number;
  weakHookGap: number;
  weakCtaGap: number;
  retentionGap: number;
  repostGain: number;
  effort: number;
  confidence: number;
}) {
  return clamp(
    input.subjectStrength * 0.28
      + input.weakHookGap * 0.18
      + input.weakCtaGap * 0.14
      + input.retentionGap * 0.14
      + input.repostGain * 0.18
      + input.confidence * 0.12
      - input.effort * 0.08,
  );
}

function fallbackAction(): StrategicAction {
  return {
    id: 'strategy_empty',
    rank: 1,
    type: 'repost_video',
    title: 'Analyser une video',
    action: 'Lancer une analyse pour activer les decisions prioritaires.',
    reason: 'Le moteur strategique attend des signaux reels avant de prioriser.',
    decisionContext: 'Aucune decision n est classee sans analyse, memoire ou benchmark.',
    impactScore: 0,
    confidenceScore: 0,
    effort: 'faible',
    opportunityScore: 0,
    priority: 'low',
    projectName: 'Premier projet TikTok',
  };
}

function projectForItem(item: RepostPriorityInput, workspace: ContentWorkspaceState) {
  const niche = item.result.analyzerMeta?.nicheLabel ?? item.result.analyzerMeta?.niche ?? 'TikTok';
  return workspace.projects.find((project) => project.niche.toLowerCase() === niche.toLowerCase()) ?? workspace.activeProject;
}

function buildVideoActions(items: RepostPriorityInput[], workspace: ContentWorkspaceState): StrategicAction[] {
  const ranked = rankRepostPriorities(items);
  return ranked.flatMap((priority) => {
    const source = items.find((item) => item.id === priority.id);
    if (!source) return [];
    const result = source.result;
    const ctaScore = result.coachAnalysis?.subScores.cta ?? result.viralityScore;
    const hookGap = Math.max(0, 78 - result.hook.score);
    const ctaGap = Math.max(0, 72 - ctaScore);
    const retentionGap = Math.max(0, 74 - result.retention.score);
    const subjectStrength = Math.max(result.viralityScore, result.coachAnalysis?.subScores.repostPotential ?? 0);
    const repostGain = result.coachAnalysis?.repostEngine.estimatedGain ?? Math.max(4, Math.round((hookGap + retentionGap + ctaGap) / 4));
    const project = projectForItem(source, workspace);
    const base = {
      sourceId: source.id,
      projectName: project.name,
      impactScore: clamp(priority.repostScore + repostGain * 0.5),
      confidenceScore: clamp(priority.confidence),
      effort: effortFromScore(priority.correctionDifficulty),
      decisionContext: project.memory.benchmarks[0] ?? 'Decision basee sur le score de repost, les gaps hook/retention/CTA et la memoire projet.',
    };
    const score = opportunityScore({
      subjectStrength,
      weakHookGap: hookGap,
      weakCtaGap: ctaGap,
      retentionGap,
      repostGain,
      effort: priority.correctionDifficulty,
      confidence: priority.confidence,
    });
    const actions: StrategicAction[] = [];

    if (priority.repostScore >= 70) {
      actions.push({
        ...base,
        id: `repost_${source.id}`,
        rank: 0,
        type: 'repost_video',
        title: 'Repost cette video',
        action: priority.recommendedFix,
        reason: priority.reason,
        opportunityScore: score,
        priority: priorityFrom(score, base.confidenceScore, base.effort),
      });
    }

    if (hookGap >= 10) {
      actions.push({
        ...base,
        id: `hook_${source.id}`,
        rank: 0,
        type: 'test_hook',
        title: 'Tester un hook preuve',
        action: result.repostVersion?.hook ?? result.coachAnalysis?.hookVariants?.[0] ?? 'Reecrire le hook avec preuve ou resultat avant contexte.',
        reason: 'Le sujet est exploitable, mais le hook laisse trop de friction avant la promesse.',
        opportunityScore: clamp(score + hookGap * 0.4),
        priority: priorityFrom(clamp(score + hookGap * 0.4), base.confidenceScore, base.effort),
      });
    }

    if (ctaGap >= 12) {
      actions.push({
        ...base,
        id: `cta_${source.id}`,
        rank: 0,
        type: 'fix_cta',
        title: 'Corriger le CTA',
        action: result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0] ?? 'Finir sur une question simple ou une action claire.',
        reason: 'Le CTA est le levier le plus faible par rapport au reste de la video.',
        opportunityScore: clamp(score + ctaGap * 0.35),
        priority: priorityFrom(clamp(score + ctaGap * 0.35), base.confidenceScore, base.effort),
      });
    }

    if (retentionGap >= 14) {
      actions.push({
        ...base,
        id: `structure_${source.id}`,
        rank: 0,
        type: 'improve_structure',
        title: 'Ameliorer la structure retention',
        action: result.actionPlan?.find((action) => action.toLowerCase().includes('0:')) ?? 'Ajouter une rupture, preuve ou transition plus tot dans la timeline.',
        reason: 'Le moteur detecte un risque de drop plus important que la moyenne du projet.',
        opportunityScore: clamp(score + retentionGap * 0.3),
        priority: priorityFrom(clamp(score + retentionGap * 0.3), base.confidenceScore, base.effort),
      });
    }

    return actions;
  });
}

function buildProjectActions(workspace: ContentWorkspaceState): StrategicAction[] {
  return workspace.projects.slice(0, 3).map((project, index) => {
    const opportunity = clamp(62 + project.repostsCount * 8 + project.patternsCount * 3 - index * 5);
    const confidence = clamp(project.videosCount ? 48 + project.videosCount * 9 : 34);
    const effort = project.repostsCount ? 'moyen' : 'faible';
    return {
      id: `project_${project.id}`,
      rank: 0,
      type: 'prioritize_project',
      title: `Prioriser ${project.name}`,
      action: project.nextAction,
      reason: project.memory.summary,
      decisionContext: project.memory.benchmarks[0] ?? 'Projet classe selon progression, reposts disponibles et recurrence des patterns.',
      impactScore: opportunity,
      confidenceScore: confidence,
      effort,
      opportunityScore: opportunity,
      priority: priorityFrom(opportunity, confidence, effort),
      projectName: project.name,
      sourceId: project.id,
    };
  });
}

function buildExperimentActions(contentOS: ContentOperatingSystem, workspace: ContentWorkspaceState): StrategicAction[] {
  return contentOS.experiments.slice(0, 3).map((experiment, index) => {
    const best = experiment.variants.sort((a, b) => b.score - a.score)[0];
    const project = workspace.projects[index % workspace.projects.length] ?? workspace.activeProject;
    const opportunity = clamp((best?.score ?? 50) + 10 - index * 3);
    return {
      id: `experiment_${experiment.id}`,
      rank: 0,
      type: experiment.type === 'cta_test' ? 'fix_cta' : experiment.type === 'intro_test' ? 'reduce_intro' : 'test_hook',
      title: experiment.type === 'cta_test' ? 'Tester un CTA alternatif' : experiment.type === 'intro_test' ? 'Reduire intro et comparer' : 'Tester le meilleur hook',
      action: best?.label ?? experiment.nextAction,
      reason: experiment.nextAction,
      decisionContext: `Experiment lie au projet ${project.name}. Le gagnant doit renforcer les futures recommandations.`,
      impactScore: opportunity,
      confidenceScore: clamp(58 + index * 4),
      effort: 'faible',
      opportunityScore: opportunity,
      priority: priorityFrom(opportunity, 62, 'faible'),
      projectName: project.name,
      sourceId: experiment.id,
    };
  });
}

export function buildStrategicDecisionEngine(
  items: RepostPriorityInput[],
  workspace: ContentWorkspaceState,
  contentOS: ContentOperatingSystem,
): StrategicDecisionState {
  const actions = [
    ...buildVideoActions(items, workspace),
    ...buildProjectActions(workspace),
    ...buildExperimentActions(contentOS, workspace),
  ];
  const ranked = actions
    .sort((a, b) => b.opportunityScore - a.opportunityScore || b.impactScore - a.impactScore || b.confidenceScore - a.confidenceScore)
    .slice(0, 8)
    .map((action, index) => ({ ...action, rank: index + 1 }));
  const actionQueue = ranked.length ? ranked : [fallbackAction()];
  const project = workspace.projects
    .slice()
    .sort((a, b) => (b.repostsCount * 12 + b.patternsCount * 4 + b.progressionScore) - (a.repostsCount * 12 + a.patternsCount * 4 + a.progressionScore))[0] ?? workspace.activeProject;

  return {
    topDecision: actionQueue[0],
    actionQueue,
    projectPriority: {
      projectName: project.name,
      reason: project.memory.summary,
      opportunityScore: clamp(project.progressionScore + project.repostsCount * 8 + project.patternsCount * 2),
      confidenceScore: clamp(project.videosCount ? 48 + project.videosCount * 9 : 34),
    },
    summary: actionQueue[0].opportunityScore
      ? `${actionQueue.length} actions classees par potentiel, impact, effort et confiance.`
      : 'Le moteur decisionnel s active avec les premieres analyses.',
  };
}
