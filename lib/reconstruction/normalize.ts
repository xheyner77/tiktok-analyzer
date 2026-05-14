import type { ReconstructionIAOutput, RepostVersion } from '@/lib/types';
import type {
  AIReasoningItem,
  AlternativeHook,
  OptimizedCTA,
  ReconstructionFlowStep,
  ReconstructionPlan,
  ReconstructionSequence,
  ReconstructionSequenceType,
  RetentionPoint,
} from '@/types/reconstruction';
import { clampScore, formatTime, parseTimecode } from './scoring';

const flow: ReconstructionFlowStep[] = [
  { id: 'structure_analysis', label: 'Analyse structure actuelle', detail: 'Lecture du hook, du contexte et du payoff.' },
  { id: 'drop_detection', label: 'Detection des drops', detail: 'Localisation des secondes qui cassent la retention.' },
  { id: 'sequence_reconstruction', label: 'Reconstruction des sequences', detail: 'Nouvel ordre: preuve, contexte, correction, relance.' },
  { id: 'hook_optimization', label: 'Optimisation hook', detail: 'Variantes par curiosite, preuve, erreur et resultat.' },
  { id: 'cta_optimization', label: 'Optimisation CTA', detail: 'Moment optimal et action commentaire plus simple.' },
  { id: 'retention_simulation', label: 'Simulation de retention', detail: 'Projection avant/apres avec points critiques.' },
  { id: 'final_structure', label: 'Generation structure finale', detail: 'Plan pret a remonter dans ton outil de montage.' },
];

function normalizeType(type: string): ReconstructionSequenceType {
  if (type === 'ERROR') return 'TRANSITION';
  if (type === 'CONTEXT') return 'CONTEXT';
  if (type === 'CORRECTION') return 'CORRECTION';
  if (type === 'PATTERN_INTERRUPT') return 'PATTERN_INTERRUPT';
  if (type === 'PAYOFF') return 'PAYOFF';
  if (type === 'PROOF') return 'PROOF';
  if (type === 'CTA') return 'CTA';
  return 'HOOK';
}

function fallbackSequences(repost: RepostVersion): ReconstructionSequence[] {
  const base = [
    ['0:00', '0:02', 'HOOK', 'Hook visuel', 'Montrer le resultat final immediatement.', 'Limiter la perte avant 3 secondes.', 'Faire comprendre la valeur avant le contexte.'],
    ['0:02', '0:05', 'PROOF', 'Preuve rapide', 'Afficher transformation, preuve ou contraste.', 'Installer la credibilite avant le detail.', 'Prouver avant d expliquer.'],
    ['0:05', '0:08', 'TRANSITION', 'Contexte coupe', "Supprimer l introduction et nommer le blocage.", 'Reduire la friction mentale.', 'Contextualiser sans ralentir.'],
    ['0:08', '0:12', 'PATTERN_INTERRUPT', 'Relance attention', 'Ajouter texte ecran et rupture visuelle.', 'Eviter le drop mid-video.', 'Injecter une nouvelle stimulation.'],
    ['0:12', '0:15', 'CTA', 'CTA commentaire', 'Deplacer la question avant la sortie probable.', 'Transformer l attention en signal.', 'Obtenir une action simple.'],
  ] as const;

  return base.map(([start, end, type, title, recommendation, expectedImpact, retentionGoal], index) => ({
    id: `fallback-sequence-${index + 1}`,
    start,
    end,
    type: normalizeType(type),
    title,
    recommendation: repost.structure[index] ?? recommendation,
    expectedImpact,
    retentionGoal,
    move: index === 2 ? 'cut' : index === 3 ? 'insert' : index === 4 ? 'move_cta' : 'advance',
  }));
}

function normalizeSequences(legacy: ReconstructionIAOutput | undefined, repost: RepostVersion): ReconstructionSequence[] {
  if (!legacy?.optimizedStructure?.length) return fallbackSequences(repost);
  return legacy.optimizedStructure.map((step, index) => ({
    id: `sequence-${index + 1}-${step.type.toLowerCase()}`,
    start: step.start,
    end: step.end,
    type: normalizeType(step.type),
    title: step.goal,
    recommendation: step.recommendation,
    expectedImpact: step.expectedImpact,
    retentionGoal: step.sourceIssue ?? 'Conserver une raison claire de rester.',
    sourceIssue: step.sourceIssue,
    move: step.move,
  }));
}

function normalizeHooks(legacy: ReconstructionIAOutput | undefined, repost: RepostVersion): AlternativeHook[] {
  const source = legacy?.alternativeHooks?.length
    ? legacy.alternativeHooks
    : [
      { hook: repost.hook, why: 'Variante issue du plan de remontage.', bestFor: 'Curiosite' },
      { hook: 'Tu perds des viewers ici parce que la preuve arrive trop tard.', why: 'Transforme le diagnostic en tension.', bestFor: 'Preuve' },
      { hook: "Le probleme n'est pas ton idee. C'est l'ordre.", why: 'Angle frontal pour stopper le scroll.', bestFor: 'Erreur frequente' },
    ];
  const angles: AlternativeHook['angle'][] = ['curiosite', 'preuve', 'emotion', 'erreur_frequente', 'resultat_final', 'autorite'];
  return source.map((item, index) => ({
    id: `hook-${index + 1}`,
    angle: angles[index] ?? 'curiosite',
    hook: item.hook,
    why: item.why,
    bestFor: item.bestFor,
  }));
}

function normalizeCTAs(legacy: ReconstructionIAOutput | undefined, repost: RepostVersion, sequences: ReconstructionSequence[]): OptimizedCTA[] {
  const ctaStart = sequences.find((sequence) => sequence.type === 'CTA')?.start ?? 'fin active';
  const source = legacy?.ctaRecommendations?.length
    ? legacy.ctaRecommendations
    : [{ cta: repost.cta, why: 'CTA aligne sur le moment ou le viewer a deja recu la preuve.' }];

  return source.map((item, index) => ({
    id: `cta-${index + 1}`,
    cta: item.cta,
    why: item.why,
    optimalMoment: ctaStart,
    engagementGoal: 'Rendre l action evidente en une phrase.',
    commentGoal: 'Creer une reponse simple: mot-cle ou choix binaire.',
    watchTimeGoal: 'Afficher le CTA avant la sortie probable.',
  }));
}

function normalizeReasoning(legacy?: ReconstructionIAOutput): AIReasoningItem[] {
  const reasoning = legacy?.whyThisStructureWorks;
  const items = [
    ['Logique IA', reasoning?.retentionLogic ?? 'Le hook principal est deplace au debut pour reduire la perte des viewers avant le payoff.', 'retention'],
    ['Psychologie viewer', reasoning?.viewerPsychology ?? 'Le viewer recoit une preuve avant le contexte, donc il comprend plus vite pourquoi rester.', 'viewer'],
    ['Justification changements', reasoning?.changeJustification ?? 'Les changements suivent les drops, le hook et le CTA detectes dans la timeline.', 'signals'],
  ] as const;

  return items.map(([title, body, signal], index) => ({
    id: `reasoning-${index + 1}`,
    title,
    body,
    signal,
  }));
}

function buildRetentionSimulation(retentionScore: number, optimizedRetentionScore: number, legacy?: ReconstructionIAOutput): RetentionPoint[] {
  const drops = legacy?.retentionFixes?.map((fix) => parseTimecode(fix.timeRange.split('-')[0] ?? fix.timeRange)).filter(Boolean) ?? [];
  const firstDrop = drops[0] ?? 5;
  const relaunch = legacy?.patternInterrupts?.[0]?.at ? parseTimecode(legacy.patternInterrupts[0].at) : Math.max(3, firstDrop - 1);
  const points = [
    ['0:00', 94, 96, 'baseline', 'Ouverture'],
    [formatTime(Math.max(2, firstDrop - 2)), clampScore(retentionScore + 8), clampScore(optimizedRetentionScore - 4), 'payoff', 'Preuve avancee'],
    [formatTime(firstDrop), clampScore(retentionScore - 12), clampScore(optimizedRetentionScore - 7), 'drop', 'Drop critique'],
    [formatTime(relaunch), clampScore(retentionScore - 16), clampScore(optimizedRetentionScore - 5), 'relaunch', 'Relance'],
    ['0:12', clampScore(retentionScore - 20), clampScore(optimizedRetentionScore - 8), 'cta', 'CTA actif'],
  ] as const;

  return points.map(([time, current, optimized, type, label], index) => ({
    id: `retention-point-${index + 1}`,
    time,
    current,
    optimized,
    type,
    label,
  }));
}

export function normalizeReconstructionPlan({
  legacy,
  repost,
  currentRetentionScore,
  currentViralityScore,
}: {
  legacy?: ReconstructionIAOutput;
  repost: RepostVersion;
  currentRetentionScore: number;
  currentViralityScore: number;
}): ReconstructionPlan {
  const retentionScore = clampScore(currentRetentionScore || currentViralityScore);
  const optimizedRetentionScore = clampScore(legacy?.predictedImprovements.retentionPotential ?? retentionScore + 16, 0, 96);
  const sequences = normalizeSequences(legacy, repost);
  const ctas = normalizeCTAs(legacy, repost, sequences);
  const retentionFixes = (legacy?.retentionFixes ?? []).map((fix, index) => ({
    id: `retention-fix-${index + 1}`,
    ...fix,
  }));
  const patternInterrupts = (legacy?.patternInterrupts ?? []).map((interrupt, index) => ({
    id: `interrupt-${index + 1}`,
    ...interrupt,
  }));

  return {
    retentionScore,
    optimizedRetentionScore,
    watchTimeScore: clampScore(legacy?.predictedImprovements.watchTimePotential ?? retentionScore + 18, 0, 96),
    engagementScore: clampScore(legacy?.predictedImprovements.engagementPotential ?? currentViralityScore + 12, 0, 94),
    commentScore: clampScore(legacy?.predictedImprovements.commentPotential ?? currentViralityScore + 10, 0, 92),
    mainIssue: {
      title: sequences[0]?.sourceIssue ? 'Hook trop lent' : 'Structure a clarifier',
      description: sequences[0]?.sourceIssue ?? 'Le viewer ne comprend pas assez rapidement la valeur de rester.',
    },
    optimizedStructure: sequences,
    alternativeHooks: normalizeHooks(legacy, repost),
    optimizedCTAs: ctas,
    retentionFixes,
    patternInterrupts,
    aiReasoning: normalizeReasoning(legacy),
    retentionSimulation: buildRetentionSimulation(retentionScore, optimizedRetentionScore, legacy),
    metrics: [
      { id: 'retention', label: 'Retention', before: retentionScore, after: optimizedRetentionScore, description: 'Potentiel de tenue apres reconstruction.' },
      { id: 'watch-time', label: 'Watch time', before: retentionScore, after: clampScore(legacy?.predictedImprovements.watchTimePotential ?? retentionScore + 18, 0, 96), description: 'Projection de temps regarde.' },
      { id: 'engagement', label: 'Engagement', before: currentViralityScore, after: clampScore(legacy?.predictedImprovements.engagementPotential ?? currentViralityScore + 12, 0, 94), description: 'Capacite a generer une action.' },
      { id: 'comments', label: 'Commentaires', before: currentViralityScore, after: clampScore(legacy?.predictedImprovements.commentPotential ?? currentViralityScore + 10, 0, 92), description: 'Potentiel de reponse CTA.' },
    ],
    flow,
    source: { legacy, repost },
  };
}
