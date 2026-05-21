import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { ViralynzProgressState } from './viralynz-progress-engine';
import type { ContentExecutionState } from './content-execution-engine';

export type ViralynzConceptKey = 'slow_payoff' | 'scroll_risk' | 'dead_intro' | 'weak_cta' | 'retention_break' | 'late_proof';
export type CreatorArchetypeKey = 'proof_builder' | 'story_crafter' | 'fast_hooker' | 'educational_loop' | 'tension_creator';
export type ReputationGrade = 'Elite' | 'Strong' | 'Developing' | 'Weak';

export interface ViralynzVocabularyConcept {
  key: ViralynzConceptKey;
  label: string;
  definition: string;
  trigger: string;
  example: string;
  severity: 'critical' | 'important' | 'watch' | 'strength';
  confidence: number;
}

export interface CreatorArchetype {
  key: CreatorArchetypeKey;
  label: string;
  description: string;
  dominantSignals: string[];
  recommendationStyle: string;
  benchmarkLens: string;
  confidence: number;
}

export interface CreatorIdentityCard {
  title: string;
  dominantStyle: string;
  contentReputation: string;
  strengths: string[];
  weaknesses: string[];
  evolution: string[];
}

export interface ReputationMetric {
  id: 'hook_precision' | 'retention_structure' | 'cta_timing' | 'proof_speed' | 'execution_readiness';
  label: string;
  grade: ReputationGrade;
  score: number;
  evidence: string;
}

export interface ProductLanguageItem {
  id: string;
  phrase: string;
  usage: string;
}

export interface ProductIdentityState {
  identityScore: number;
  vocabulary: ViralynzVocabularyConcept[];
  archetype: CreatorArchetype;
  identityCard: CreatorIdentityCard;
  reputation: ReputationMetric[];
  productLanguage: ProductLanguageItem[];
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

function grade(score: number): ReputationGrade {
  if (score >= 82) return 'Elite';
  if (score >= 68) return 'Strong';
  if (score >= 52) return 'Developing';
  return 'Weak';
}

function activeResults(items: RepostPriorityInput[]) {
  return items.map((item) => item.result);
}

function buildVocabulary(items: RepostPriorityInput[], contentOS: ContentOperatingSystem): ViralynzVocabularyConcept[] {
  const results = activeResults(items);
  const avgHook = average(results.map((result) => result.hook.score));
  const avgRetention = average(results.map((result) => result.retention.score));
  const avgCta = average(results.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore));
  const payoffLate = results.some((result) => (result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? 0) > 4);
  const recurring = contentOS.creatorDNA.recurringErrors[0] ?? 'Signal a confirmer';
  return [
    {
      key: 'slow_payoff',
      label: 'Slow Payoff',
      definition: 'La video explique avant de donner la recompense.',
      trigger: payoffLate ? 'Payoff detecte apres la fenetre forte.' : 'A surveiller quand le contexte prend trop de place.',
      example: 'Avancer resultat, preuve ou transformation avant explication.',
      severity: payoffLate ? 'critical' : 'watch',
      confidence: payoffLate ? 76 : 44,
    },
    {
      key: 'scroll_risk',
      label: 'Scroll Risk',
      definition: 'Moment ou le viewer comprend le sujet mais pas encore pourquoi rester.',
      trigger: avgRetention < 62 ? 'Retention score interne faible.' : 'Risque faible sur les derniers diagnostics.',
      example: 'Ajouter pattern interrupt, preuve ou contraste.',
      severity: avgRetention < 62 ? 'important' : 'watch',
      confidence: clamp(100 - avgRetention + 42),
    },
    {
      key: 'dead_intro',
      label: 'Dead Intro',
      definition: 'Intro descriptive qui repousse la tension.',
      trigger: recurring,
      example: 'Remplacer contexte par preuve ou conflit.',
      severity: /intro|hook|debut/i.test(recurring) ? 'critical' : 'watch',
      confidence: clamp(46 + contentOS.creatorDNA.recurringErrors.length * 8),
    },
    {
      key: 'weak_cta',
      label: 'Weak CTA',
      definition: 'CTA trop vague, trop tardif ou sans friction minimale.',
      trigger: avgCta < 64 ? 'CTA score interne sous le niveau attendu.' : 'CTA stable, a optimiser par tests.',
      example: 'Transformer en question courte ou choix A/B.',
      severity: avgCta < 64 ? 'important' : 'watch',
      confidence: clamp(100 - avgCta + 44),
    },
    {
      key: 'retention_break',
      label: 'Retention Break',
      definition: 'Rupture de rythme ou segment faible dans la timeline.',
      trigger: contentOS.patterns.find((pattern) => pattern.type === 'retention' || pattern.type === 'weak_structure')?.label ?? 'Pattern retention en calibration.',
      example: 'Couper plus vite, ajouter texte ecran ou changer de plan.',
      severity: avgRetention < 58 ? 'critical' : 'important',
      confidence: clamp(48 + contentOS.patterns.length * 5),
    },
    {
      key: 'late_proof',
      label: 'Late Proof',
      definition: 'La preuve arrive apres la promesse au lieu de la porter.',
      trigger: avgHook < 66 ? 'Hook a besoin de preuve plus tot.' : 'Preuve deja assez visible dans certains hooks.',
      example: 'Commencer par resultat, screenshot, avant/apres ou demonstration.',
      severity: avgHook < 66 ? 'important' : 'strength',
      confidence: clamp(100 - avgHook + 48),
    },
  ];
}

function buildArchetype(contentOS: ContentOperatingSystem, workspace: ContentWorkspaceState, execution: ContentExecutionState): CreatorArchetype {
  const style = `${contentOS.creatorDNA.dominantStyle} ${workspace.activeProject.memory.frequentHooks.join(' ')}`.toLowerCase();
  const proofSignals = execution.hookRewrites.filter((hook) => hook.mode === 'proof')[0]?.score ?? 0;
  const storySignals = /story|narratif|storytelling/i.test(style) ? 78 : 42;
  const fastSignals = /rapide|direct|cut|montage/i.test(`${style} ${contentOS.creatorDNA.dominantRhythm}`) ? 76 : 48;
  const educationSignals = /educ|tutoriel|tips|learn|formation/i.test(style) ? 74 : 44;
  const tensionSignals = execution.hookRewrites.find((hook) => hook.mode === 'tension')?.score ?? 52;
  const candidates: Array<CreatorArchetype & { weight: number }> = [
    {
      key: 'proof_builder',
      label: 'Proof Builder',
      description: 'Tu gagnes quand la video montre une preuve avant de trop expliquer.',
      dominantSignals: ['Preuve rapide', contentOS.creatorDNA.strengths[0] ?? 'Hook a rendre plus concret', workspace.activeProject.memory.benchmarks[0] ?? 'Benchmark projet'],
      recommendationStyle: 'Prioriser hooks preuve, avant/apres, resultats visibles et payoff avance.',
      benchmarkLens: 'Comparer tes videos par vitesse de preuve et clarte du resultat.',
      confidence: clamp(proofSignals),
      weight: proofSignals,
    },
    {
      key: 'story_crafter',
      label: 'Story Crafter',
      description: 'Ton style devient plus fort quand la tension narrative arrive avant le contexte.',
      dominantSignals: ['Storytelling', contentOS.creatorDNA.dominantStyle, 'Boucle ouverte'],
      recommendationStyle: 'Construire intro conflit -> preuve -> resolution.',
      benchmarkLens: 'Comparer les videos par qualite de boucle narrative.',
      confidence: clamp(storySignals),
      weight: storySignals,
    },
    {
      key: 'fast_hooker',
      label: 'Fast Hooker',
      description: 'Tu performes mieux quand le hook est court, frontal et tres lisible.',
      dominantSignals: ['Hook direct', contentOS.creatorDNA.dominantRhythm, 'Scroll stop'],
      recommendationStyle: 'Raccourcir intro, supprimer contexte, garder une promesse par hook.',
      benchmarkLens: 'Comparer les hooks par densite et temps avant payoff.',
      confidence: clamp(fastSignals),
      weight: fastSignals,
    },
    {
      key: 'educational_loop',
      label: 'Educational Loop',
      description: 'Tu construis de la valeur avec des boucles pedagogiques simples et repetables.',
      dominantSignals: ['Format education', 'CTA sauvegarde', workspace.activeProject.niche],
      recommendationStyle: 'Commencer par erreur claire, preuve, puis micro-framework.',
      benchmarkLens: 'Comparer par clarte, memorisation et CTA sauvegarde.',
      confidence: clamp(educationSignals),
      weight: educationSignals,
    },
    {
      key: 'tension_creator',
      label: 'Tension créateur',
      description: 'Tu gagnes quand la video pose un conflit net des la premiere phrase.',
      dominantSignals: ['Tension', 'Contraste', contentOS.creatorDNA.weaknesses[0] ?? 'Intro a durcir'],
      recommendationStyle: 'Tester hooks contradiction, erreur cachee et choix A/B.',
      benchmarkLens: 'Comparer par intensite du conflit et vitesse de comprehension.',
      confidence: clamp(tensionSignals),
      weight: tensionSignals,
    },
  ];
  return candidates.sort((a, b) => b.weight - a.weight)[0];
}

function buildReputation(items: RepostPriorityInput[], progress: ViralynzProgressState, execution: ContentExecutionState): ReputationMetric[] {
  const results = activeResults(items);
  const hook = average(results.map((result) => result.hook.score)) || progress.metrics.find((metric) => metric.id === 'hook')?.value || 0;
  const retention = average(results.map((result) => result.retention.score)) || progress.metrics.find((metric) => metric.id === 'retention')?.value || 0;
  const cta = average(results.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore)) || progress.metrics.find((metric) => metric.id === 'cta')?.value || 0;
  const proofSpeed = clamp(100 - average(results.map((result) => result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? 5)) * 10);
  return [
    { id: 'hook_precision', label: 'Hook Precision', grade: grade(hook), score: hook, evidence: 'Base sur scores hook et variantes sauvegardees.' },
    { id: 'retention_structure', label: 'Retention Structure', grade: grade(retention), score: retention, evidence: 'Base sur rythme, drops probables et structure.' },
    { id: 'cta_timing', label: 'CTA Timing', grade: grade(cta), score: cta, evidence: 'Base sur clarte CTA, position et force engagement.' },
    { id: 'proof_speed', label: 'Proof Speed', grade: grade(proofSpeed), score: proofSpeed, evidence: 'Base sur temps estime avant payoff/preuve.' },
    { id: 'execution_readiness', label: 'Execution Readiness', grade: grade(execution.executionScore), score: execution.executionScore, evidence: 'Base sur hooks, CTA, captions et suggestions montage pretes.' },
  ];
}

function buildIdentityCard(
  contentOS: ContentOperatingSystem,
  workspace: ContentWorkspaceState,
  progress: ViralynzProgressState,
  reputation: ReputationMetric[],
  archetype: CreatorArchetype,
): CreatorIdentityCard {
  const strongest = reputation.sort((a, b) => b.score - a.score)[0];
  const weakest = [...reputation].sort((a, b) => a.score - b.score)[0];
  return {
    title: archetype.label,
    dominantStyle: contentOS.creatorDNA.dominantStyle,
    contentReputation: `${strongest.label}: ${strongest.grade}`,
    strengths: [
      ...contentOS.creatorDNA.strengths.slice(0, 3),
      strongest.evidence,
    ].filter(Boolean).slice(0, 4),
    weaknesses: [
      ...contentOS.creatorDNA.weaknesses.slice(0, 3),
      `${weakest.label} a surveiller`,
    ].filter(Boolean).slice(0, 4),
    evolution: [
      progress.dopamineLine,
      workspace.activeProject.nextAction,
      archetype.recommendationStyle,
    ],
  };
}

function buildProductLanguage(archetype: CreatorArchetype): ProductLanguageItem[] {
  return [
    {
      id: 'language_scroll_risk',
      phrase: 'Reduce the Scroll Risk',
      usage: 'Quand une video est claire mais ne donne pas encore assez de raison de rester.',
    },
    {
      id: 'language_payoff_first',
      phrase: 'Payoff before context',
      usage: 'Regle de repost: preuve, resultat ou tension avant explication.',
    },
    {
      id: 'language_proof_window',
      phrase: 'Proof Window',
      usage: 'La fenetre ou le viewer doit voir une preuve, pas une promesse abstraite.',
    },
    {
      id: 'language_creator_lens',
      phrase: `${archetype.label} Lens`,
      usage: archetype.benchmarkLens,
    },
  ];
}

export function buildProductIdentityEngine(input: {
  items: RepostPriorityInput[];
  contentOS: ContentOperatingSystem;
  workspace: ContentWorkspaceState;
  progress: ViralynzProgressState;
  execution: ContentExecutionState;
}): ProductIdentityState {
  const vocabulary = buildVocabulary(input.items, input.contentOS);
  const archetype = buildArchetype(input.contentOS, input.workspace, input.execution);
  const reputation = buildReputation(input.items, input.progress, input.execution);
  const identityCard = buildIdentityCard(input.contentOS, input.workspace, input.progress, reputation, archetype);
  const productLanguage = buildProductLanguage(archetype);
  const identityScore = clamp(
    archetype.confidence * 0.22
      + reputation.reduce((sum, item) => sum + item.score, 0) / Math.max(1, reputation.length) * 0.32
      + input.progress.progressScore * 0.2
      + input.execution.executionScore * 0.26,
  );

  return {
    identityScore,
    vocabulary,
    archetype,
    identityCard,
    reputation,
    productLanguage,
    summary: identityScore
      ? `${archetype.label} detecte. Viralynz traduit tes diagnostics en concepts memorisables et reputation contenu.`
      : 'L identite Viralynz se construit avec les premieres analyses.',
  };
}
