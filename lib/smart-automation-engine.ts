import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { StrategicDecisionState } from './strategic-decision-engine';
import type { CumulativeIntelligenceState } from './cumulative-intelligence-layer';

export type AutomationType = 'auto_repost_queue' | 'weak_hook_alert' | 'hook_suggestion' | 'cta_alternative' | 'opportunity_detection' | 'auto_experiment';
export type AutomationPriority = 'high' | 'medium' | 'low';

export interface SmartAutomation {
  id: string;
  type: AutomationType;
  title: string;
  trigger: string;
  action: string;
  reason: string;
  priority: AutomationPriority;
  confidence: number;
  status: 'active' | 'suggested' | 'learning';
}

export interface RepostAutoQueueItem {
  id: string;
  title: string;
  priorityScore: number;
  reason: string;
  corrections: string[];
  effort: 'faible' | 'moyen' | 'eleve';
}

export interface SmartAlertItem {
  id: string;
  title: string;
  body: string;
  tone: 'opportunity' | 'warning' | 'progress' | 'system';
  confidence: number;
}

export interface AutoExperimentItem {
  id: string;
  title: string;
  experimentType: 'hook_ab' | 'intro_shortening' | 'payoff_shift' | 'cta_variant';
  variants: string[];
  successSignal: string;
  nextStep: string;
}

export interface SmartWorkflow {
  id: string;
  name: string;
  ifSignal: string;
  thenActions: string[];
  priority: AutomationPriority;
  active: boolean;
}

export interface SmartAutomationState {
  automationScore: number;
  automations: SmartAutomation[];
  repostAutoQueue: RepostAutoQueueItem[];
  smartAlerts: SmartAlertItem[];
  autoExperiments: AutoExperimentItem[];
  workflows: SmartWorkflow[];
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function effort(value: number): RepostAutoQueueItem['effort'] {
  if (value >= 66) return 'eleve';
  if (value >= 42) return 'moyen';
  return 'faible';
}

function buildRepostQueue(items: RepostPriorityInput[]): RepostAutoQueueItem[] {
  return rankRepostPriorities(items)
    .filter((item) => item.repostScore >= 62 && item.correctionDifficulty <= 70)
    .slice(0, 5)
    .map((item) => ({
      id: `auto_queue_${item.id}`,
      title: item.title,
      priorityScore: item.repostScore,
      reason: item.reason,
      corrections: [item.recommendedFix, item.category === 'strong_topic_weak_hook' ? 'Tester un hook preuve plus court.' : 'Verifier payoff et CTA avant repost.'],
      effort: effort(item.correctionDifficulty),
    }));
}

function buildAlerts(contentOS: ContentOperatingSystem, intelligence: CumulativeIntelligenceState): SmartAlertItem[] {
  const weakHook = contentOS.patterns.find((pattern) => /hook|intro|payoff/i.test(pattern.label));
  const ctaPrediction = intelligence.predictions.find((prediction) => prediction.type === 'cta');
  const progress = intelligence.dailyBriefing.find((item) => item.type === 'progress');
  return [
    {
      id: 'alert_hook',
      title: weakHook ? 'Hook descriptif recurrent detecte' : 'Hook pattern en surveillance',
      body: weakHook?.evidence ?? 'Pas encore assez de recurrence pour alerter fortement.',
      tone: weakHook ? 'warning' : 'system',
      confidence: weakHook?.confidence ?? 38,
    },
    {
      id: 'alert_cta',
      title: 'CTA alternatif suggere',
      body: ctaPrediction?.prediction ?? 'Tester une question courte sur la prochaine video prioritaire.',
      tone: 'opportunity',
      confidence: ctaPrediction?.confidence ?? 44,
    },
    {
      id: 'alert_progress',
      title: 'Progression importante',
      body: progress?.body ?? 'Viralynz surveille hook, retention et reposts apres chaque analyse.',
      tone: 'progress',
      confidence: progress?.confidence ?? 40,
    },
  ];
}

function buildExperiments(contentOS: ContentOperatingSystem, decisions: StrategicDecisionState): AutoExperimentItem[] {
  const top = decisions.topDecision;
  const experiments = contentOS.experiments.slice(0, 3).map((experiment) => ({
    id: `auto_${experiment.id}`,
    title: experiment.title,
    experimentType: experiment.type === 'cta_test' ? 'cta_variant' as const : experiment.type === 'intro_test' ? 'intro_shortening' as const : 'hook_ab' as const,
    variants: experiment.variants.map((variant) => variant.label).slice(0, 3),
    successSignal: 'Comparer feedback createur, score hook et potentiel repost apres publication.',
    nextStep: experiment.nextAction,
  }));
  if (experiments.length) return experiments;
  return [
    {
      id: 'auto_top_decision',
      title: top.type === 'fix_cta' ? 'Test CTA question vs keyword' : 'Test hook preuve vs direct',
      experimentType: top.type === 'fix_cta' ? 'cta_variant' : top.type === 'reduce_intro' ? 'intro_shortening' : 'hook_ab',
      variants: [top.action, 'Version plus courte', 'Version plus preuve'],
      successSignal: 'Utilite percue, repost effectue et confidence score.',
      nextStep: 'Creer le test depuis la prochaine analyse.',
    },
  ];
}

function buildAutomations(queue: RepostAutoQueueItem[], alerts: SmartAlertItem[], experiments: AutoExperimentItem[], workspace: ContentWorkspaceState): SmartAutomation[] {
  return [
    {
      id: 'automation_repost_queue',
      type: 'auto_repost_queue',
      title: 'Ajouter automatiquement a la queue A repost',
      trigger: 'repost_score >= 62 + correction simple + bon sujet',
      action: queue[0]?.corrections[0] ?? 'Surveiller les prochaines analyses pour detecter une opportunite repost.',
      reason: queue[0]?.reason ?? 'Aucune video assez claire pour auto-queue sans forcer.',
      priority: queue.length ? 'high' : 'low',
      confidence: queue[0]?.priorityScore ?? 36,
      status: queue.length ? 'active' : 'learning',
    },
    {
      id: 'automation_weak_hooks',
      type: 'weak_hook_alert',
      title: 'Detecter hooks faibles recurrents',
      trigger: 'pattern hook/intro/payoff recurrent',
      action: alerts[0]?.body ?? 'Attendre plus de signaux.',
      reason: workspace.activeProject.memory.summary,
      priority: alerts[0]?.tone === 'warning' ? 'high' : 'medium',
      confidence: alerts[0]?.confidence ?? 40,
      status: alerts[0]?.tone === 'warning' ? 'active' : 'suggested',
    },
    {
      id: 'automation_hook_suggestions',
      type: 'hook_suggestion',
      title: 'Proposer nouveaux hooks',
      trigger: 'hook faible ou decision test_hook',
      action: experiments[0]?.variants[0] ?? 'Generer une variante plus tendue.',
      reason: 'Le moteur utilise memoire projet, decision engine et hook vault.',
      priority: 'medium',
      confidence: 62,
      status: 'suggested',
    },
    {
      id: 'automation_auto_experiment',
      type: 'auto_experiment',
      title: 'Creer un experiment automatiquement',
      trigger: 'gap hook/CTA/intro avec potentiel repost',
      action: experiments[0]?.nextStep ?? 'Creer un test A/B sur le prochain repost.',
      reason: experiments[0]?.successSignal ?? 'Le moteur apprend mieux quand une variante est testee puis notee.',
      priority: experiments.length ? 'high' : 'medium',
      confidence: experiments.length ? 68 : 45,
      status: experiments.length ? 'active' : 'suggested',
    },
  ];
}

function buildWorkflows(decisions: StrategicDecisionState): SmartWorkflow[] {
  const top = decisions.topDecision;
  return [
    {
      id: 'workflow_repost_high_potential',
      name: 'High potential repost workflow',
      ifSignal: 'Score eleve + hook faible + fort potentiel repost',
      thenActions: ['Generer nouveau hook', 'Creer tache repost', 'Proposer CTA alternatif', 'Ajouter priorite elevee'],
      priority: top.type === 'repost_video' || top.type === 'test_hook' ? 'high' : 'medium',
      active: top.opportunityScore >= 60,
    },
    {
      id: 'workflow_cta_weakness',
      name: 'CTA repair workflow',
      ifSignal: 'CTA faible frequent ou decision fix_cta',
      thenActions: ['Proposer CTA question', 'Creer experiment CTA', 'Surveiller feedback repost'],
      priority: top.type === 'fix_cta' ? 'high' : 'medium',
      active: top.type === 'fix_cta',
    },
    {
      id: 'workflow_intro_payoff',
      name: 'Intro payoff workflow',
      ifSignal: 'Intro longue ou payoff tardif',
      thenActions: ['Raccourcir intro', 'Avancer preuve', 'Ajouter pattern interrupt'],
      priority: top.type === 'reduce_intro' || top.type === 'improve_structure' ? 'high' : 'medium',
      active: top.type === 'reduce_intro' || top.type === 'improve_structure',
    },
  ];
}

export function buildSmartAutomationEngine(input: {
  items: RepostPriorityInput[];
  contentOS: ContentOperatingSystem;
  workspace: ContentWorkspaceState;
  decisions: StrategicDecisionState;
  intelligence: CumulativeIntelligenceState;
}): SmartAutomationState {
  const repostAutoQueue = buildRepostQueue(input.items);
  const smartAlerts = buildAlerts(input.contentOS, input.intelligence);
  const autoExperiments = buildExperiments(input.contentOS, input.decisions);
  const automations = buildAutomations(repostAutoQueue, smartAlerts, autoExperiments, input.workspace);
  const workflows = buildWorkflows(input.decisions);
  const automationScore = clamp(
    (repostAutoQueue[0]?.priorityScore ?? 30) * 0.32
      + (autoExperiments.length ? 72 : 36) * 0.2
      + (smartAlerts.reduce((sum, alert) => sum + alert.confidence, 0) / Math.max(1, smartAlerts.length)) * 0.24
      + input.decisions.topDecision.opportunityScore * 0.24,
  );
  return {
    automationScore,
    automations,
    repostAutoQueue,
    smartAlerts,
    autoExperiments,
    workflows,
    summary: automationScore
      ? `${automations.filter((automation) => automation.status === 'active').length} automations actives. Viralynz transforme les signaux en queue, alertes, experiments et workflows.`
      : 'Les automations se calibrent avec les premieres analyses.',
  };
}
