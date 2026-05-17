import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { StrategicDecisionState } from './strategic-decision-engine';
import type { ViralynzProgressState } from './viralynz-progress-engine';

export type PredictiveSignalType = 'hook' | 'repost' | 'structure_risk' | 'project' | 'cta';

export interface DailyBriefingItem {
  id: string;
  title: string;
  body: string;
  type: 'hook' | 'pattern' | 'repost' | 'progress' | 'opportunity';
  confidence: number;
}

export interface WeeklyReportMetric {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: 'up' | 'stable' | 'risk';
}

export interface PredictiveSignal {
  id: string;
  type: PredictiveSignalType;
  title: string;
  prediction: string;
  evidence: string;
  confidence: number;
  impactScore: number;
}

export interface IntelligenceDataFlowItem {
  id: string;
  label: string;
  status: 'active' | 'learning';
  detail: string;
}

export interface CumulativeIntelligenceState {
  intelligenceScore: number;
  dailyBriefing: DailyBriefingItem[];
  weeklyReport: {
    title: string;
    summary: string;
    metrics: WeeklyReportMetric[];
  };
  predictions: PredictiveSignal[];
  dataFlow: IntelligenceDataFlowItem[];
  centralContext: string[];
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function average(values: number[]) {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return 0;
  return Math.round(safe.reduce((sum, value) => sum + value, 0) / safe.length);
}

function topRecurringProblem(items: RepostPriorityInput[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const labels = item.result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? item.result.hook.weaknesses ?? [];
    for (const label of labels.filter(Boolean)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
}

function buildDailyBriefing(
  items: RepostPriorityInput[],
  contentOS: ContentOperatingSystem,
  workspace: ContentWorkspaceState,
  decisions: StrategicDecisionState,
  progress: ViralynzProgressState,
): DailyBriefingItem[] {
  const topHook = contentOS.hookVault.sort((a, b) => b.score - a.score)[0];
  const recurring = topRecurringProblem(items);
  const topRepost = contentOS.repostQueue[0];
  const activeProject = workspace.activeProject;
  return [
    {
      id: 'brief_hook',
      title: topHook ? 'Hook a reutiliser' : 'Hook en apprentissage',
      body: topHook ? `${topHook.hook} ressort comme hook a tester dans ${topHook.niche}.` : 'Ajoute des analyses pour identifier les hooks qui reviennent vraiment.',
      type: 'hook',
      confidence: topHook ? clamp(54 + topHook.score * 0.4) : 34,
    },
    {
      id: 'brief_pattern',
      title: recurring ? 'Pattern faible recurrent' : 'Pas encore de recurrence fiable',
      body: recurring ? `${recurring[0]} revient ${recurring[1]} fois dans tes analyses recentes.` : 'Viralynz attend plus de videos avant de confirmer un pattern.',
      type: 'pattern',
      confidence: recurring ? clamp(45 + recurring[1] * 12) : 32,
    },
    {
      id: 'brief_repost',
      title: topRepost ? 'Video a repost prioritaire' : 'Aucun repost confirme',
      body: topRepost ? `${topRepost.label}: ${topRepost.recommendedFix}` : 'Aucune opportunite repost fiable sans signaux supplementaires.',
      type: 'repost',
      confidence: topRepost ? topRepost.confidence : 30,
    },
    {
      id: 'brief_progress',
      title: 'Progression createur',
      body: progress.dopamineLine,
      type: 'progress',
      confidence: progress.hasEnoughData ? 72 : 44,
    },
    {
      id: 'brief_opportunity',
      title: 'Action du jour',
      body: `${decisions.topDecision.title}: ${decisions.topDecision.action}`,
      type: 'opportunity',
      confidence: decisions.topDecision.confidenceScore,
    },
    {
      id: 'brief_project',
      title: `Projet a suivre: ${activeProject.name}`,
      body: activeProject.nextAction,
      type: 'opportunity',
      confidence: clamp(40 + activeProject.videosCount * 10 + activeProject.patternsCount * 4),
    },
  ];
}

function buildWeeklyReport(items: RepostPriorityInput[], progress: ViralynzProgressState, contentOS: ContentOperatingSystem): CumulativeIntelligenceState['weeklyReport'] {
  const results = items.map((item) => item.result);
  const avgHook = average(results.map((result) => result.hook.score));
  const avgStructure = average(results.map((result) => result.editing.score));
  const avgRetention = average(results.map((result) => result.retention.score));
  const avgCta = average(results.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore));
  const bestRepost = contentOS.repostWorkspace.sort((a, b) => (b.scoreAfter - b.scoreBefore) - (a.scoreAfter - a.scoreBefore))[0];
  const recurring = topRecurringProblem(items);
  const metrics: WeeklyReportMetric[] = [
    {
      id: 'weekly_hook',
      label: 'Progression hook',
      value: `${avgHook || 0}/100`,
      detail: progress.metrics.find((metric) => metric.id.includes('hook'))?.evidence ?? 'Score moyen des hooks analyses cette semaine.',
      tone: avgHook >= 70 ? 'up' : avgHook >= 55 ? 'stable' : 'risk',
    },
    {
      id: 'weekly_structure',
      label: 'Progression structure',
      value: `${avgStructure || 0}/100`,
      detail: 'Base sur rythme, cuts, clarté et densite des analyses sauvegardees.',
      tone: avgStructure >= 70 ? 'up' : avgStructure >= 55 ? 'stable' : 'risk',
    },
    {
      id: 'weekly_repost',
      label: 'Meilleur repost',
      value: bestRepost ? `+${Math.max(0, bestRepost.scoreAfter - bestRepost.scoreBefore)}` : '--',
      detail: bestRepost?.optimizedHook ?? 'Aucun repost confirme pour le moment.',
      tone: bestRepost ? 'up' : 'stable',
    },
    {
      id: 'weekly_errors',
      label: 'Erreur frequente',
      value: recurring ? `${recurring[1]}x` : '--',
      detail: recurring?.[0] ?? 'Pas encore de recurrence fiable.',
      tone: recurring && recurring[1] >= 3 ? 'risk' : 'stable',
    },
    {
      id: 'weekly_cta',
      label: 'Evolution CTA',
      value: `${avgCta || 0}/100`,
      detail: avgCta < 62 ? 'Les CTA restent une zone de gain probable.' : 'Les CTA sont assez stables, tester des formulations plus directes.',
      tone: avgCta >= 70 ? 'up' : avgCta >= 55 ? 'stable' : 'risk',
    },
    {
      id: 'weekly_retention',
      label: 'Evolution retention',
      value: `${avgRetention || 0}/100`,
      detail: avgRetention < 62 ? 'Surveiller le payoff et les drops avant milieu de video.' : 'Retention interne plus solide sur les dernieres analyses.',
      tone: avgRetention >= 70 ? 'up' : avgRetention >= 55 ? 'stable' : 'risk',
    },
  ];
  return {
    title: 'Weekly creator intelligence',
    summary: items.length ? `${items.length} analyses alimentees par hooks, reposts, patterns et decisions.` : 'Rapport hebdo pret, en attente de donnees reelles.',
    metrics,
  };
}

function buildPredictions(
  items: RepostPriorityInput[],
  workspace: ContentWorkspaceState,
  contentOS: ContentOperatingSystem,
  decisions: StrategicDecisionState,
): PredictiveSignal[] {
  const topHook = contentOS.hookVault.sort((a, b) => b.score - a.score)[0];
  const topRepost = contentOS.repostQueue[0];
  const riskyPattern = contentOS.patterns.find((pattern) => pattern.type === 'weak_structure' || pattern.type === 'retention');
  const promisingProject = workspace.projects.sort((a, b) => b.progressionScore - a.progressionScore)[0] ?? workspace.activeProject;
  const avgCta = average(items.map((item) => item.result.coachAnalysis?.subScores.cta ?? item.result.viralityScore));
  return [
    {
      id: 'predict_hook',
      type: 'hook',
      title: 'Hook probablement performant',
      prediction: topHook ? topHook.hook : 'Pas assez de hooks pour predire un gagnant.',
      evidence: topHook ? `Score interne ${topHook.score}/100, niche ${topHook.niche}.` : 'Prediction bloquee tant que le vault est vide.',
      confidence: topHook ? clamp(48 + topHook.score * 0.42) : 28,
      impactScore: topHook?.score ?? 0,
    },
    {
      id: 'predict_repost',
      type: 'repost',
      title: 'Video a fort potentiel repost',
      prediction: topRepost ? topRepost.label : 'Aucune video prioritaire fiable.',
      evidence: topRepost ? topRepost.reason : 'Aucun repost score suffisant sans analyse supplementaire.',
      confidence: topRepost?.confidence ?? 30,
      impactScore: topRepost?.repostScore ?? 0,
    },
    {
      id: 'predict_structure',
      type: 'structure_risk',
      title: 'Structure a risque',
      prediction: riskyPattern?.label ?? 'Aucun risque structurel recurrent confirme.',
      evidence: riskyPattern?.evidence ?? 'Viralynz reste prudent sans recurrence.',
      confidence: riskyPattern?.confidence ?? 32,
      impactScore: riskyPattern ? clamp(100 - riskyPattern.confidence * 0.2 + decisions.topDecision.opportunityScore * 0.4) : 0,
    },
    {
      id: 'predict_project',
      type: 'project',
      title: 'Projet prometteur',
      prediction: promisingProject.name,
      evidence: promisingProject.memory.summary,
      confidence: clamp(42 + promisingProject.videosCount * 9 + promisingProject.patternsCount * 3),
      impactScore: promisingProject.progressionScore,
    },
    {
      id: 'predict_cta',
      type: 'cta',
      title: 'CTA a surveiller',
      prediction: avgCta < 62 ? 'Les CTA courts et questions directes doivent etre testes.' : 'CTA stable, optimiser surtout timing et contexte.',
      evidence: `CTA score interne moyen ${avgCta || 0}/100. Aucun taux TikTok invente.`,
      confidence: items.length ? clamp(44 + items.length * 6) : 28,
      impactScore: clamp(100 - avgCta),
    },
  ];
}

function buildDataFlow(items: RepostPriorityInput[], contentOS: ContentOperatingSystem, workspace: ContentWorkspaceState): IntelligenceDataFlowItem[] {
  return [
    {
      id: 'flow_patterns',
      label: 'Patterns',
      status: contentOS.patterns.length ? 'active' : 'learning',
      detail: `${contentOS.patterns.length} patterns structurent les prochaines recommandations.`,
    },
    {
      id: 'flow_memory',
      label: 'Memoire cumulative',
      status: items.length ? 'active' : 'learning',
      detail: `${items.length} analyses alimentent creator memory, project memory et DNA.`,
    },
    {
      id: 'flow_benchmarks',
      label: 'Benchmarks internes',
      status: workspace.projects.some((project) => project.memory.benchmarks.length) ? 'active' : 'learning',
      detail: 'Les comparaisons restent internes et prudentes, sans fausses stats TikTok.',
    },
    {
      id: 'flow_predictions',
      label: 'Predictions',
      status: items.length ? 'active' : 'learning',
      detail: 'Chaque nouvelle analyse ajuste hooks probables, reposts et risques structurels.',
    },
  ];
}

export function buildCumulativeIntelligenceLayer(input: {
  items: RepostPriorityInput[];
  contentOS: ContentOperatingSystem;
  workspace: ContentWorkspaceState;
  decisions: StrategicDecisionState;
  progress: ViralynzProgressState;
}): CumulativeIntelligenceState {
  const { items, contentOS, workspace, decisions, progress } = input;
  const dailyBriefing = buildDailyBriefing(items, contentOS, workspace, decisions, progress);
  const weeklyReport = buildWeeklyReport(items, progress, contentOS);
  const predictions = buildPredictions(items, workspace, contentOS, decisions);
  const dataFlow = buildDataFlow(items, contentOS, workspace);
  const intelligenceScore = clamp(
    average([
      progress.progressScore,
      decisions.topDecision.opportunityScore,
      workspace.activeProject.progressionScore,
      average(predictions.map((prediction) => prediction.confidence)),
    ]),
  );
  return {
    intelligenceScore,
    dailyBriefing,
    weeklyReport,
    predictions,
    dataFlow,
    centralContext: [
      workspace.activeProject.memory.summary,
      decisions.topDecision.decisionContext,
      predictions[0]?.evidence ?? 'Prediction en calibration.',
      weeklyReport.summary,
    ].filter(Boolean),
    summary: intelligenceScore
      ? `Intelligence cumulative ${intelligenceScore}/100: memoire, projets, decisions, predictions et benchmarks sont synchronises.`
      : 'La couche intelligence s active avec les premieres analyses.',
  };
}
