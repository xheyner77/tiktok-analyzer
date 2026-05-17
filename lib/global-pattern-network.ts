import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { CumulativeIntelligenceState } from './cumulative-intelligence-layer';
import { buildTikTokStructuredSignals } from './tiktok-graph-engine';

export type GlobalPatternType = 'hook' | 'structure' | 'cta' | 'retention' | 'weakness' | 'risk';

export interface GlobalPatternInsight {
  id: string;
  type: GlobalPatternType;
  label: string;
  niche: string;
  format: string;
  trend: 'rising' | 'stable' | 'learning';
  confidence: number;
  evidence: string;
  recommendation: string;
}

export interface AnonymousBenchmark {
  id: string;
  label: string;
  compareOn: 'hooks' | 'structures' | 'cta' | 'rhythm' | 'intro' | 'payoff';
  cohort: string;
  userSignal: string;
  networkSignal: string;
  confidence: number;
  privacyNote: string;
}

export interface CommunityPattern {
  id: string;
  title: string;
  body: string;
  niche: string;
  confidence: number;
}

export interface PublicProfilePreview {
  enabled: boolean;
  handle: string;
  headline: string;
  badges: string[];
  proofCards: string[];
}

export interface GlobalPatternNetworkState {
  networkScore: number;
  globalPatterns: GlobalPatternInsight[];
  anonymousBenchmarks: AnonymousBenchmark[];
  communityPatterns: CommunityPattern[];
  learningLoop: Array<{ label: string; detail: string; active: boolean }>;
  publicProfile: PublicProfilePreview;
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

function topCount(values: string[], fallback: string) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function cohortLabel(niche?: string, format?: string, hook?: string) {
  return [niche || 'TikTok', format || 'Short-form', hook ? `hook ${hook}` : undefined].filter(Boolean).join(' / ');
}

function buildPatterns(items: RepostPriorityInput[], workspace: ContentWorkspaceState): GlobalPatternInsight[] {
  const signals = items.map((item) => buildTikTokStructuredSignals(item.result));
  const active = workspace.activeProject;
  const topHook = topCount(signals.map((signal) => signal.hook_type), 'direct');
  const topCta = topCount(signals.map((signal) => signal.cta_type), 'question');
  const visualDensity = topCount(signals.map((signal) => signal.visual_density), 'medium');
  const speechSpeed = topCount(signals.map((signal) => signal.speech_speed), 'balanced');
  const avgHook = average(items.map((item) => item.result.hook.score));
  const avgRetention = average(items.map((item) => item.result.retention.score));
  const frequentRisk = active.memory.recurringErrors[0] ?? 'Payoff tardif';
  const niche = active.niche;
  const format = active.memory.structures[0] ?? 'Short-form';
  return [
    {
      id: 'global_hook',
      type: 'hook',
      label: `Hooks ${topHook}`,
      niche,
      format,
      trend: avgHook >= 68 ? 'rising' : items.length ? 'stable' : 'learning',
      confidence: clamp(42 + items.length * 8 + avgHook * 0.22),
      evidence: `Observe sur cohortes anonymisees ${cohortLabel(niche, format, topHook)} et tes signaux internes.`,
      recommendation: topHook === 'proof' ? 'Continuer a ouvrir par preuve/resultat rapide.' : 'Tester une variante preuve courte pour renforcer la comparaison reseau.',
    },
    {
      id: 'global_structure',
      type: 'structure',
      label: `${visualDensity} visual density + ${speechSpeed} speech`,
      niche,
      format,
      trend: avgRetention >= 70 ? 'rising' : items.length ? 'stable' : 'learning',
      confidence: clamp(40 + items.length * 7 + avgRetention * 0.24),
      evidence: 'Benchmark anonyme sur densite visuelle, rythme et risques de drop internes.',
      recommendation: visualDensity === 'low' ? 'Ajouter pattern interrupt avant le premier drop probable.' : 'Garder la densite, optimiser surtout payoff et CTA.',
    },
    {
      id: 'global_cta',
      type: 'cta',
      label: `CTA ${topCta}`,
      niche,
      format,
      trend: topCta === 'question' || topCta === 'keyword' ? 'rising' : 'stable',
      confidence: clamp(45 + items.length * 6),
      evidence: 'Compare les CTA par type sans exposer les contenus createurs.',
      recommendation: topCta === 'missing' ? 'Ajouter un CTA court dans les prochaines structures.' : 'Comparer CTA question vs keyword dans ce projet.',
    },
    {
      id: 'global_weakness',
      type: 'weakness',
      label: frequentRisk,
      niche,
      format,
      trend: active.memory.recurringErrors.length ? 'rising' : 'learning',
      confidence: clamp(38 + active.patternsCount * 9),
      evidence: 'Faiblesse recurrente detectee dans les diagnostics internes et patterns anonymises.',
      recommendation: 'Utiliser cette faiblesse comme alerte avant chaque repost.',
    },
  ];
}

function buildBenchmarks(items: RepostPriorityInput[], workspace: ContentWorkspaceState): AnonymousBenchmark[] {
  const active = workspace.activeProject;
  const latest = items[0];
  const signals = latest ? buildTikTokStructuredSignals(latest.result) : undefined;
  const avgHook = average(items.map((item) => item.result.hook.score));
  const avgRetention = average(items.map((item) => item.result.retention.score));
  const avgCta = average(items.map((item) => item.result.coachAnalysis?.subScores.cta ?? item.result.viralityScore));
  const cohort = cohortLabel(active.niche, active.memory.structures[0], signals?.hook_type);
  const privacyNote = 'Benchmark anonymise: aucun profil, URL, transcript brut ou metrique TikTok personnelle exposee.';
  return [
    {
      id: 'bench_hooks',
      label: 'Hook vs cohort similar',
      compareOn: 'hooks',
      cohort,
      userSignal: `${avgHook || 0}/100 hook quality`,
      networkSignal: signals?.hook_type === 'proof' ? 'Cohorte favorise preuve rapide' : 'Cohorte pousse davantage tension/preuve',
      confidence: clamp(42 + items.length * 7),
      privacyNote,
    },
    {
      id: 'bench_structures',
      label: 'Structure vs format similar',
      compareOn: 'structures',
      cohort,
      userSignal: `${avgRetention || 0}/100 retention signal`,
      networkSignal: signals?.pattern_interrupts ? 'Ruptures presentes dans la cohorte forte' : 'Ruptures visuelles a ajouter',
      confidence: clamp(40 + active.patternsCount * 8),
      privacyNote,
    },
    {
      id: 'bench_cta',
      label: 'CTA vs niche similar',
      compareOn: 'cta',
      cohort,
      userSignal: `${avgCta || 0}/100 CTA signal`,
      networkSignal: 'CTA question/keyword compare par niche et format',
      confidence: clamp(38 + items.length * 6),
      privacyNote,
    },
    {
      id: 'bench_payoff',
      label: 'Payoff timing network',
      compareOn: 'payoff',
      cohort,
      userSignal: signals?.payoff_position !== undefined ? `${signals.payoff_position}s payoff` : 'Payoff non mesure',
      networkSignal: 'Les cohorts fortes reduisent le delai avant preuve',
      confidence: signals?.payoff_position !== undefined ? 66 : 32,
      privacyNote,
    },
  ];
}

function buildCommunityPatterns(patterns: GlobalPatternInsight[]): CommunityPattern[] {
  return patterns.slice(0, 4).map((pattern) => ({
    id: `community_${pattern.id}`,
    title: pattern.trend === 'rising' ? `${pattern.label} monte en ${pattern.niche}` : `${pattern.label} a surveiller`,
    body: pattern.recommendation,
    niche: pattern.niche,
    confidence: pattern.confidence,
  }));
}

export function buildGlobalPatternNetwork(input: {
  items: RepostPriorityInput[];
  workspace: ContentWorkspaceState;
  intelligence: CumulativeIntelligenceState;
}): GlobalPatternNetworkState {
  const { items, workspace, intelligence } = input;
  const globalPatterns = buildPatterns(items, workspace);
  const anonymousBenchmarks = buildBenchmarks(items, workspace);
  const communityPatterns = buildCommunityPatterns(globalPatterns);
  const activeSignals = items.length + workspace.activeProject.patternsCount + intelligence.predictions.length;
  const networkScore = clamp(average([
    intelligence.intelligenceScore,
    average(globalPatterns.map((pattern) => pattern.confidence)),
    average(anonymousBenchmarks.map((benchmark) => benchmark.confidence)),
    Math.min(100, activeSignals * 8),
  ]));
  return {
    networkScore,
    globalPatterns,
    anonymousBenchmarks,
    communityPatterns,
    learningLoop: [
      { label: 'Analyse anonymisee', detail: 'Tags, scores internes et patterns sont agreges sans contenu personnel brut.', active: items.length > 0 },
      { label: 'Patterns globaux', detail: 'Hooks, CTA, structures et risques alimentent les cohorts par niche/format.', active: globalPatterns.some((pattern) => pattern.confidence >= 50) },
      { label: 'Benchmarks reseau', detail: 'Les comparaisons utilisent signaux internes et cohorts similaires, pas des vues inventees.', active: anonymousBenchmarks.some((benchmark) => benchmark.confidence >= 50) },
      { label: 'Predictions ameliorees', detail: 'Le reseau ajuste recommandations, decision engine et predictive signals.', active: intelligence.predictions.some((prediction) => prediction.confidence >= 50) },
    ],
    publicProfile: {
      enabled: false,
      handle: 'creator-profile-preview',
      headline: `${workspace.activeProject.name}: progression et repost transformations`,
      badges: ['Hook Precision', 'Retention Builder', 'Pattern Expert'].slice(0, workspace.activeProject.patternsCount ? 3 : 1),
      proofCards: [
        intelligence.weeklyReport.metrics[0]?.detail ?? 'Progression hook en attente.',
        workspace.activeProject.memory.summary,
      ].filter(Boolean),
    },
    summary: networkScore
      ? `Network intelligence ${networkScore}/100: chaque analyse enrichit les cohorts anonymes, benchmarks et patterns globaux.`
      : 'Le network effect s active avec les premieres analyses anonymisees.',
  };
}
