import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { CumulativeIntelligenceState } from './cumulative-intelligence-layer';
import { SIGNAL_WEIGHTS } from './scoring-weights';
import type { Plan } from './supabase';

export type ExpertRuleKey = 'intro_gt_3s' | 'cta_after_10s' | 'no_pattern_interrupt' | 'late_payoff';
export type ExpertBenchmarkScope = 'niche' | 'format' | 'facecam' | 'short_video' | 'project';

export interface ExpertWeight {
  key: 'hook' | 'retention' | 'cta' | 'storytelling' | 'payoffSpeed';
  label: string;
  value: number;
  description: string;
}

export interface ExpertBenchmark {
  id: string;
  label: string;
  scope: ExpertBenchmarkScope;
  filter: string;
  active: boolean;
  evidence: string;
}

export interface ExpertRule {
  id: ExpertRuleKey;
  label: string;
  threshold: string;
  active: boolean;
  triggered: boolean;
  evidence: string;
  action: string;
}

export interface CopilotCommand {
  id: string;
  prompt: string;
  mode: 'brainstorm' | 'rewrite' | 'variant' | 'structure';
  outputPreview: string;
  memoryUsed: string;
}

export interface ExpertModeState {
  enabledByDefault: boolean;
  available: boolean;
  planLabel: string;
  weights: ExpertWeight[];
  customBenchmarks: ExpertBenchmark[];
  customRules: ExpertRule[];
  copilotCommands: CopilotCommand[];
  analysisDepth: Array<{ label: string; active: boolean; detail: string }>;
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function latest(items: RepostPriorityInput[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

function getPayoff(item?: RepostPriorityInput) {
  return item?.result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? null;
}

function hasPatternInterrupt(item?: RepostPriorityInput) {
  const interrupts = item?.result.videoIntelligence?.technicalSignals?.visual.patternInterrupts.length;
  if (typeof interrupts === 'number') return interrupts > 0;
  return (item?.result.videoIntelligence?.visualSignals.cutDensityEstimate ?? 0) > 0;
}

function ctaAfterTen(item?: RepostPriorityInput) {
  const cta = item?.result.coachAnalysis?.optimizedCtas?.[0] ?? item?.result.repostVersion?.cta ?? '';
  const hasLateCue = /0:1\d|apres 0:10|after 0:10|fin/i.test(cta);
  return hasLateCue || (item?.result.coachAnalysis?.subScores.cta ?? 100) < 55;
}

function buildWeights(): ExpertWeight[] {
  const global = SIGNAL_WEIGHTS.global;
  return [
    {
      key: 'hook',
      label: 'Hook importance',
      value: clamp(global.hook_score_weight * 100),
      description: 'Pese davantage les 2 premieres secondes, la tension et la clarte.',
    },
    {
      key: 'retention',
      label: 'Retention importance',
      value: clamp(global.retention_score_weight * 100),
      description: 'Renforce le poids des drops, transitions et ruptures visuelles.',
    },
    {
      key: 'cta',
      label: 'CTA importance',
      value: clamp(global.cta_score_weight * 100),
      description: 'Priorise timing, clarte et potentiel commentaire.',
    },
    {
      key: 'storytelling',
      label: 'Storytelling importance',
      value: 16,
      description: 'Adapte le moteur aux formats narratifs et progressifs.',
    },
    {
      key: 'payoffSpeed',
      label: 'Payoff speed importance',
      value: 24,
      description: 'Penalise plus fortement les payoffs tardifs.',
    },
  ];
}

function buildBenchmarks(workspace: ContentWorkspaceState): ExpertBenchmark[] {
  const active = workspace.activeProject;
  return [
    {
      id: 'bench_niche',
      label: 'Niche specifique',
      scope: 'niche',
      filter: active.niche,
      active: true,
      evidence: active.memory.benchmarks[0] ?? 'Compare uniquement les signaux internes de cette niche.',
    },
    {
      id: 'bench_format',
      label: 'Format specifique',
      scope: 'format',
      filter: active.memory.structures[0] ?? 'Short-form',
      active: true,
      evidence: 'Isole les videos de meme structure avant de juger hook et retention.',
    },
    {
      id: 'bench_facecam',
      label: 'Facecam uniquement',
      scope: 'facecam',
      filter: 'facecam=true',
      active: false,
      evidence: 'Utile pour comparer rythme, captions et presence camera.',
    },
    {
      id: 'bench_short',
      label: 'Videos courtes',
      scope: 'short_video',
      filter: '< 25s',
      active: false,
      evidence: 'Compare seulement les contenus courts pour eviter les faux benchmarks.',
    },
    {
      id: 'bench_project',
      label: 'Projet actif',
      scope: 'project',
      filter: active.name,
      active: true,
      evidence: active.memory.summary,
    },
  ];
}

function buildRules(item?: RepostPriorityInput): ExpertRule[] {
  const hookWindow = item?.result.videoIntelligence?.technicalSignals?.structure.hookWindow;
  const introDuration = hookWindow?.match(/(\d+(?:\.\d+)?)s/)?.[1] ? Number(hookWindow.match(/(\d+(?:\.\d+)?)s/)?.[1]) : null;
  const payoff = getPayoff(item);
  return [
    {
      id: 'intro_gt_3s',
      label: 'Alerte si intro > 3s',
      threshold: 'intro_duration > 3s',
      active: true,
      triggered: typeof introDuration === 'number' ? introDuration > 3 : (item?.result.hook.score ?? 100) < 62,
      evidence: typeof introDuration === 'number' ? `Intro estimee a ${introDuration}s.` : 'Intro non mesuree, fallback sur score hook.',
      action: 'Avancer preuve, resultat ou promesse avant le contexte.',
    },
    {
      id: 'cta_after_10s',
      label: 'Alerte si CTA apres 0:10',
      threshold: 'cta_position > 10s',
      active: true,
      triggered: ctaAfterTen(item),
      evidence: 'Base sur CTA detecte, score CTA et indices de timing.',
      action: 'Tester une question courte avant ou juste apres le payoff.',
    },
    {
      id: 'no_pattern_interrupt',
      label: 'Alerte si aucun pattern interrupt',
      threshold: 'pattern_interrupt_count = 0',
      active: true,
      triggered: !hasPatternInterrupt(item),
      evidence: hasPatternInterrupt(item) ? 'Rupture detectee.' : 'Aucune rupture visuelle fiable detectee.',
      action: 'Ajouter cut, zoom, texte ecran ou changement de plan.',
    },
    {
      id: 'late_payoff',
      label: 'Alerte payoff tardif',
      threshold: 'payoff_position > 4s',
      active: true,
      triggered: typeof payoff === 'number' ? payoff > 4 : (item?.result.retention.score ?? 100) < 62,
      evidence: typeof payoff === 'number' ? `Payoff estime a ${payoff}s.` : 'Payoff non mesure, fallback retention.',
      action: 'Faire arriver la recompense dans les 2 premieres secondes.',
    },
  ];
}

function buildCopilotCommands(workspace: ContentWorkspaceState, intelligence: CumulativeIntelligenceState): CopilotCommand[] {
  const active = workspace.activeProject;
  const topHook = active.memory.frequentHooks[0] ?? 'le hook actuel';
  const weakPattern = active.memory.recurringErrors[0] ?? intelligence.predictions.find((item) => item.type === 'structure_risk')?.prediction ?? 'le point faible principal';
  return [
    {
      id: 'copilot_aggressive_hook',
      prompt: 'Donne-moi un hook plus agressif.',
      mode: 'variant',
      outputPreview: `${topHook} -> version plus directe, plus tendue, moins explicative.`,
      memoryUsed: active.memory.summary,
    },
    {
      id: 'copilot_rewrite_intro',
      prompt: 'Reecris cette intro.',
      mode: 'rewrite',
      outputPreview: `Supprimer le contexte et ouvrir sur ${weakPattern.toLowerCase()}.`,
      memoryUsed: active.memory.recurringErrors[0] ?? 'Memoire projet en apprentissage.',
    },
    {
      id: 'copilot_more_tension',
      prompt: 'Version plus tension.',
      mode: 'brainstorm',
      outputPreview: 'Ajouter contraste, enjeu et payoff retarde de quelques secondes.',
      memoryUsed: intelligence.centralContext[1] ?? active.memory.summary,
    },
    {
      id: 'copilot_more_proof',
      prompt: 'Version plus preuve.',
      mode: 'structure',
      outputPreview: 'Commencer par resultat, capture, chiffre interne ou exemple concret.',
      memoryUsed: intelligence.predictions[0]?.evidence ?? 'Prediction hook en calibration.',
    },
  ];
}

export function buildExpertModeState(input: {
  items: RepostPriorityInput[];
  workspace: ContentWorkspaceState;
  intelligence: CumulativeIntelligenceState;
  plan: Plan;
}): ExpertModeState {
  const item = latest(input.items);
  const available = input.plan === 'pro' || input.plan === 'scale';
  const triggeredRules = buildRules(item).filter((rule) => rule.triggered).length;
  return {
    enabledByDefault: input.plan === 'scale',
    available,
    planLabel: available ? 'Expert controls' : 'Preview Pro',
    weights: buildWeights(),
    customBenchmarks: buildBenchmarks(input.workspace),
    customRules: buildRules(item),
    copilotCommands: buildCopilotCommands(input.workspace, input.intelligence),
    analysisDepth: [
      { label: 'Analyse detaillee', active: available, detail: 'Expose signaux, poids, rules et limites.' },
      { label: 'Benchmarks custom', active: available, detail: 'Filtre niche, format, facecam, duree ou projet.' },
      { label: 'Co-pilot memory', active: available, detail: 'Utilise creator memory et project memory dans les variantes.' },
    ],
    summary: available
      ? `${triggeredRules} regle${triggeredRules > 1 ? 's' : ''} expert declenchee${triggeredRules > 1 ? 's' : ''}. Le moteur peut etre ajuste par poids, benchmarks et rules.`
      : 'Expert Mode reste visible en preview, avec activation complete en Pro et Scale.',
  };
}
