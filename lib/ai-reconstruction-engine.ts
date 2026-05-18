import type {
  AnalysisResult,
  OptimizedStructureStep,
  ReconstructionIAOutput,
  VideoSegmentAnalysis,
} from './types';
import type { AnalysisEngineContext } from './analysis-engine';

type MoveType = NonNullable<OptimizedStructureStep['move']>;

interface ReconstructionSignal {
  label: string;
  evidence: string;
  severity: number;
}

export interface ReconstructionPromptInput {
  niche: string;
  objective: string;
  durationSec: number;
  contentType: string;
  rhythm: string;
  hookScore: number;
  ctaScore: number;
  dropsDetected: string[];
  currentStructure: string[];
  patternInterruptsDetected: string[];
  creatorMemoryContext?: string;
}

function sanitizeShortString(value: unknown, max = 140): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : undefined;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampDuration(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 18;
  return Math.max(8, Math.min(90, Math.round(numeric)));
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function parseRangeStart(range: string): number {
  const match = range.match(/(\d+):(\d+)|(\d+)/);
  if (!match) return 0;
  if (match[1] && match[2]) return Number(match[1]) * 60 + Number(match[2]);
  return Number(match[3] ?? 0);
}

function normalizeRange(range: string | undefined, fallback: string) {
  if (!range) return fallback;
  const clean = range
    .replace(/\s+/g, '')
    .replace(/s\b/g, '');
  const secondsOnly = clean.match(/^(\d+)-(\d+)$/);
  if (secondsOnly) return `0:${secondsOnly[1].padStart(2, '0')}-0:${secondsOnly[2].padStart(2, '0')}`;
  const mixed = clean.match(/^(\d+):(\d+)-(\d+)$/);
  if (mixed) return `${mixed[1]}:${mixed[2].padStart(2, '0')}-${mixed[1]}:${mixed[3].padStart(2, '0')}`;
  return clean;
}

function getAudience(body: Record<string, unknown>, context?: AnalysisEngineContext) {
  return sanitizeShortString(body.nicheLabel, 80)
    ?? sanitizeShortString(context?.nicheLabel, 80)
    ?? sanitizeShortString(body.niche, 80)
    ?? 'cette audience';
}

function getObjective(body: Record<string, unknown>, context?: AnalysisEngineContext) {
  return sanitizeShortString(body.objectiveLabel, 90)
    ?? sanitizeShortString(context?.objectiveLabel, 90)
    ?? sanitizeShortString(body.objective, 60)
    ?? 'ameliorer la retention';
}

function getContentType(result: AnalysisResult) {
  return result.coachAnalysis?.patternLabel
    ?? result.coachAnalysis?.detectedVideoFormat?.primary
    ?? 'format TikTok court';
}

function segmentLabel(segment: VideoSegmentAnalysis) {
  const text = segment.onScreenText || segment.transcriptExcerpt;
  return text ? `${segment.range} - ${segment.role} (${text.slice(0, 70)})` : `${segment.range} - ${segment.role}`;
}

function getDropSegments(result: AnalysisResult): VideoSegmentAnalysis[] {
  const segments = result.coachAnalysis?.videoSegments ?? [];
  return [...segments]
    .filter((segment) => segment.dropRisk >= 50)
    .sort((a, b) => b.dropRisk - a.dropRisk);
}

function getPrimaryDropRange(result: AnalysisResult) {
  const segment = getDropSegments(result)[0];
  if (segment) return normalizeRange(segment.range, '0:03-0:06');
  const marker = result.coachAnalysis?.timeline?.find((item) => item.severity === 'critique' || item.type === 'drop');
  return normalizeRange(marker?.time, '0:03-0:06');
}

function getOpeningIssue(result: AnalysisResult) {
  const opening = result.coachAnalysis?.openingAnalysis;
  if (opening?.mainProblem) return opening.mainProblem;
  return result.coachAnalysis?.detectedProblems?.[0]?.explanation
    ?? result.hook?.weaknesses?.[0]
    ?? 'Le debut explique le sujet avant de donner une raison immediate de rester.';
}

function getPayoffIssue(result: AnalysisResult, dropRange: string) {
  const opportunity = result.coachAnalysis?.repostEngine?.bestOpportunity;
  if (opportunity?.why) return opportunity.why;
  const segment = getDropSegments(result).find((item) => item.mainProblem.toLowerCase().includes('preuve') || item.mainProblem.toLowerCase().includes('payoff'));
  return segment?.mainProblem
    ?? result.retention?.weaknesses?.[0]
    ?? `Le payoff arrive trop pres du premier decrochage detecte (${dropRange}).`;
}

function getRhythmIssue(result: AnalysisResult, dropRange: string) {
  const segment = getDropSegments(result)[0];
  return segment?.mainProblem
    ?? result.editing?.weaknesses?.[0]
    ?? `La zone ${dropRange} ralentit le flux visuel sans assez de nouvelle information.`;
}

function getCtaIssue(result: AnalysisResult) {
  const ctaProblem = result.coachAnalysis?.detectedProblems?.find((item) => /cta|comment|action/i.test(`${item.title} ${item.explanation}`));
  return ctaProblem?.explanation
    ?? result.improvements?.find((item) => /cta|comment|action/i.test(item.tip))?.tip
    ?? 'Le CTA est trop generique ou trop tardif pour transformer l attention en action.';
}

function buildSignals(result: AnalysisResult, dropRange: string): ReconstructionSignal[] {
  const opening = result.coachAnalysis?.openingAnalysis;
  const drops = getDropSegments(result);
  const transcript = result.coachAnalysis?.transcriptAnalysis;
  const visual = result.videoIntelligence?.visualSignals;
  const signals: ReconstructionSignal[] = [
    {
      label: 'Opening 0-3s',
      evidence: getOpeningIssue(result),
      severity: 100 - (opening?.stopScrollScore ?? result.hook?.score ?? 55),
    },
    {
      label: `Drop ${dropRange}`,
      evidence: getRhythmIssue(result, dropRange),
      severity: drops[0]?.dropRisk ?? Math.max(35, 100 - (result.retention?.score ?? 60)),
    },
  ];

  if (transcript?.available) {
    signals.push({
      label: 'Densite verbale',
      evidence: transcript.avgWordsPerSentence > 16
        ? `Phrases longues (${transcript.avgWordsPerSentence} mots en moyenne), risque de surcharge avant le payoff.`
        : `Transcript exploitable avec ${transcript.hookWordCount} mots sur l ouverture.`,
      severity: transcript.mentalFriction,
    });
  }

  if (visual?.available) {
    signals.push({
      label: 'Rythme visuel',
      evidence: `Rythme estime ${visual.cutRhythm}, energie visuelle ${visual.visualEnergy}/100.`,
      severity: visual.cutRhythm === 'faible' ? 72 : visual.cutRhythm === 'moyen' ? 48 : 30,
    });
  }

  return signals.sort((a, b) => b.severity - a.severity);
}

export function buildReconstructionPromptInput(
  result: AnalysisResult,
  body: Record<string, unknown>,
  context?: AnalysisEngineContext
): ReconstructionPromptInput {
  const durationSec = clampDuration(context?.durationSec ?? body.durationSec ?? result.detectedVideoMeta?.durationSec);
  const dropSegments = getDropSegments(result);
  const currentStructure = result.coachAnalysis?.videoSegments?.map(segmentLabel)
    ?? result.coachAnalysis?.timeline?.map((marker) => `${marker.time} - ${marker.label}: ${marker.insight}`)
    ?? result.repostVersion?.structure
    ?? [];

  return {
    niche: getAudience(body, context),
    objective: getObjective(body, context),
    durationSec,
    contentType: getContentType(result),
    rhythm: result.videoIntelligence?.visualSignals.cutRhythm
      ?? result.coachAnalysis?.transcriptAnalysis?.energyScore.toString()
      ?? 'unknown',
    hookScore: result.coachAnalysis?.subScores?.hook ?? result.hook?.score ?? 50,
    ctaScore: result.coachAnalysis?.subScores?.cta ?? Math.max(35, result.viralityScore - 12),
    dropsDetected: dropSegments.length ? dropSegments.map((segment) => `${segment.range} drop ${segment.dropRisk}: ${segment.mainProblem}`) : [getPrimaryDropRange(result)],
    currentStructure: currentStructure.slice(0, 7),
    patternInterruptsDetected: result.coachAnalysis?.timeline
      ?.filter((marker) => marker.type === 'tension' || marker.type === 'rewatch')
      .map((marker) => `${marker.time}: ${marker.label}`)
      .slice(0, 4) ?? [],
    creatorMemoryContext: context?.creatorMemoryContext?.slice(0, 1800),
  };
}

export function buildReconstructionPromptMessages(input: ReconstructionPromptInput) {
  return {
    system: [
      'Tu es le moteur de reconstruction Viralynz.',
      'Tu ne donnes jamais de conseils generiques. Chaque changement doit citer un signal: timecode, score, drop, densite, rythme, CTA, niche ou objectif.',
      'Tu dois produire un JSON scalable avec optimizedStructure, alternativeHooks, ctaRecommendations, retentionFixes, cutsRecommended, patternInterrupts, recommendedOrder, whyThisStructureWorks et predictedImprovements.',
      'Les predictions sont toujours presentees comme Simulation IA, jamais comme garantie.',
      input.creatorMemoryContext ? 'Utilise la memoire createur fournie pour adapter la V2 au style et aux erreurs recurrentes du createur.' : '',
    ].join('\n'),
    user: JSON.stringify(input, null, 2),
  };
}

function makeStep(
  start: number,
  end: number,
  type: OptimizedStructureStep['type'],
  goal: string,
  recommendation: string,
  expectedImpact: string,
  sourceIssue: string,
  move: MoveType
): OptimizedStructureStep {
  return {
    start: formatTime(start),
    end: formatTime(Math.max(end, start + 1)),
    type,
    goal,
    recommendation,
    expectedImpact,
    sourceIssue,
    move,
  };
}

function buildAlternativeHooks(result: AnalysisResult, audience: string, contentType: string, objective: string, openingIssue: string, payoffIssue: string) {
  const opening = result.coachAnalysis?.openingAnalysis;
  const firstFrame = opening?.recommendedFirstFrame || opening?.firstFrame || 'la preuve visuelle la plus forte';
  const newHook = opening?.newHook;
  return [
    {
      hook: newHook || `Regarde d abord le resultat, l erreur vient juste apres.`,
      why: `Corrige le blocage d ouverture detecte: ${openingIssue}`,
      bestFor: `${contentType} avec objectif ${objective}.`,
    },
    {
      hook: `Tu perds des viewers ici parce que la preuve arrive trop tard.`,
      why: `Transforme le diagnostic en tension explicite: ${payoffIssue}`,
      bestFor: `Audience ${audience} qui decide en moins de 3 secondes si la preuve vaut le temps.`,
    },
    {
      hook: `Avant de faire ca, montre ${firstFrame.toLowerCase()} en premier.`,
      why: `Force une premiere frame plus concrete et evite l introduction explicative.`,
      bestFor: 'Remontage court avec texte ecran, preuve ou avant/apres.',
    },
  ];
}

function memorySignal(context?: string) {
  if (!context) return '';
  const line = context
    .split('\n')
    .find((item) => /Erreurs frequentes|Patterns a renforcer|Prochains tests|A eviter/.test(item));
  return line?.replace(/^-\s*/, '').slice(0, 150) ?? '';
}

function buildCtas(result: AnalysisResult, objective: string, ctaIssue: string) {
  const optimized = result.coachAnalysis?.optimizedCtas?.filter(Boolean) ?? [];
  if (optimized.length) {
    return optimized.slice(0, 3).map((cta) => ({
      cta,
      why: `CTA repris depuis l analyse coach, car le signal detecte est: ${ctaIssue}`,
    }));
  }

  const objectiveLower = objective.toLowerCase();
  const keyword = objectiveLower.includes('comment') ? 'AVIS' : objectiveLower.includes('clic') ? 'LIEN' : 'PLAN';
  return [
    {
      cta: `Commente "${keyword}" si tu veux la version a recopier.`,
      why: `Mot-cle simple, plus facile a executer que le CTA actuel: ${ctaIssue}`,
    },
    {
      cta: 'Tu veux la version courte ou la version detaillee ?',
      why: 'Question binaire qui reduit l effort de reponse et favorise les commentaires rapides.',
    },
  ];
}

export function buildReconstructionIA(
  result: AnalysisResult,
  body: Record<string, unknown>,
  context?: AnalysisEngineContext
): ReconstructionIAOutput {
  const input = buildReconstructionPromptInput(result, body, context);
  const prompt = buildReconstructionPromptMessages(input);
  void prompt;

  const duration = input.durationSec;
  const dropRange = getPrimaryDropRange(result);
  const dropStart = Math.max(3, Math.min(duration - 5, parseRangeStart(dropRange)));
  const hookScore = clamp(input.hookScore);
  const ctaScore = clamp(input.ctaScore);
  const audience = input.niche;
  const contentType = input.contentType;
  const openingIssue = getOpeningIssue(result);
  const payoffIssue = getPayoffIssue(result, dropRange);
  const rhythmIssue = getRhythmIssue(result, dropRange);
  const ctaIssue = getCtaIssue(result);
  const signals = buildSignals(result, dropRange);
  const memory = memorySignal(context?.creatorMemoryContext);

  const payoffEnd = Math.min(duration, hookScore < 65 ? 4 : 5);
  const contextEnd = Math.min(duration, payoffEnd + (duration > 28 ? 5 : 3));
  const interruptEnd = Math.min(duration, Math.max(dropStart + 2, contextEnd + 2));
  const proofLoopEnd = Math.min(duration, interruptEnd + (duration > 35 ? 7 : 5));
  const ctaStart = Math.max(8, Math.min(duration - 4, proofLoopEnd));

  const optimizedStructure: OptimizedStructureStep[] = [
    makeStep(
      0,
      hookScore < 65 ? 2 : 3,
      'HOOK',
      'Stopper le scroll avant la decision de sortie',
      hookScore < 65
        ? `Remplacer l ouverture par la preuve ou la consequence visible. Signal utilise: ${openingIssue}`
        : `Garder l intention du hook, mais condenser la phrase et afficher la promesse en texte ecran des 0:01.${memory ? ` Memoire createur: ${memory}.` : ''}`,
      'Simulation IA: moins de perte dans les 3 premieres secondes.',
      openingIssue,
      hookScore < 65 ? 'rewrite' : 'keep'
    ),
    makeStep(
      2,
      payoffEnd,
      'PROOF',
      'Prouver avant d expliquer',
      `Avancer le resultat, la preuve ou le contraste avant ${formatTime(payoffEnd)}. Le contexte ne doit commencer qu apres une preuve visible.`,
      'Le viewer comprend plus vite pourquoi rester.',
      payoffIssue,
      'advance'
    ),
    makeStep(
      payoffEnd,
      contextEnd,
      'CONTEXT',
      `Contextualiser pour ${audience}`,
      `Resumer le contexte en une seule phrase liee a ${audience}; couper les repetitions et les formulations de type introduction.`,
      'Moins de friction mentale avant le bloc de valeur.',
      signals[2]?.evidence ?? openingIssue,
      'cut'
    ),
    makeStep(
      Math.max(contextEnd, dropStart - 1),
      interruptEnd,
      'PATTERN_INTERRUPT',
      'Relancer au moment de drop',
      `Inserer une rupture visuelle autour de ${dropRange}: cut sec, zoom leger, texte ecran ou objection courte. Signal: ${rhythmIssue}`,
      'Simulation IA: meilleure tenue apres le premier decrochage.',
      rhythmIssue,
      'insert'
    ),
    makeStep(
      interruptEnd,
      proofLoopEnd,
      'CORRECTION',
      'Transformer le diagnostic en sequence utile',
      `Montrer la correction en 2 micro-etapes: erreur detectee puis action concrete. Chaque phrase doit apporter une nouvelle information.`,
      'Renforce la retention mid-video et clarifie la valeur.',
      payoffIssue,
      'rewrite'
    ),
    makeStep(
      ctaStart,
      duration,
      'CTA',
      'Convertir l attention en signal engagement',
      ctaScore < 65
        ? `Deplacer le CTA avant la fin molle et demander une reponse simple. Probleme source: ${ctaIssue}`
        : `Garder le CTA mais le rendre plus specifique avec un mot-cle ou un choix binaire.`,
      'Simulation IA: plus de probabilite de commentaires et rewatch.',
      ctaIssue,
      'move_cta'
    ),
  ].filter((step, index, steps) => index === 0 || step.start !== steps[index - 1]?.start);

  const retentionFixes = [
    {
      timeRange: dropRange,
      problem: `${dropRange} ralentit le flux: ${rhythmIssue}`,
      fix: `Ajouter une nouvelle information juste avant ${dropRange}, puis couper le segment si la phrase repete le contexte.`,
      expectedImpact: 'Simulation IA: reduit le risque de sortie sur le premier creux.',
    },
    {
      timeRange: '0:00-0:03',
      problem: openingIssue,
      fix: `Ouvrir sur preuve/consequence puis expliquer seulement apres ${formatTime(payoffEnd)}.`,
      expectedImpact: 'Le viewer voit la valeur avant de devoir comprendre le contexte.',
    },
    ...getDropSegments(result).slice(1, 2).map((segment) => ({
      timeRange: normalizeRange(segment.range, '0:08-0:12'),
      problem: segment.mainProblem,
      fix: segment.concreteCorrection || segment.recommendation,
      expectedImpact: 'Simulation IA: relance secondaire pour limiter la baisse de watch time.',
    })),
  ];

  const predictedBase = Math.max(48, result.viralityScore);
  const retentionGain = hookScore < 60 ? 20 : hookScore < 75 ? 14 : 9;
  const ctaGain = ctaScore < 60 ? 19 : ctaScore < 75 ? 12 : 7;

  return {
    optimizedStructure,
    alternativeHooks: [
      ...(memory ? [{
        hook: 'Le probleme revient ici : ta preuve arrive apres la perte d attention.',
        why: `Hook personnalise depuis la memoire createur: ${memory}`,
        bestFor: `${contentType} avec objectif ${input.objective}.`,
      }] : []),
      ...buildAlternativeHooks(result, audience, contentType, input.objective, openingIssue, payoffIssue),
    ].slice(0, 4),
    ctaRecommendations: buildCtas(result, input.objective, ctaIssue),
    retentionFixes,
    cutsRecommended: [
      {
        timeRange: '0:00-0:02',
        reason: hookScore < 65
          ? `Le hook score ${hookScore}/100 indique que l ouverture ne cree pas assez vite la tension.`
          : 'La premiere phrase peut etre gardee, mais la preuve doit etre visible plus tot.',
        replacement: 'Commencer par resultat, contraste, erreur visible ou premiere frame plus forte.',
      },
      {
        timeRange: dropRange,
        reason: `Drop prioritaire detecte: ${rhythmIssue}`,
        replacement: 'Couper la repetition, ajouter zoom/cut/texte ecran, puis revenir a la correction.',
      },
    ],
    patternInterrupts: [
      {
        at: formatTime(Math.max(2, dropStart - 1)),
        instruction: `Afficher une objection courte liee a ${audience} avant le drop.`,
        reason: `La transition vers ${dropRange} doit donner une nouvelle raison de rester.`,
      },
      {
        at: formatTime(ctaStart),
        instruction: 'Faire apparaitre le mot-cle du CTA a l ecran avant la derniere phrase.',
        reason: 'Le viewer voit l action avant de quitter la video.',
      },
    ],
    recommendedOrder: optimizedStructure.map((step) => `${step.type} ${step.start}-${step.end}: ${step.goal}`),
    whyThisStructureWorks: {
      retentionLogic: `Le payoff est deplace avant ${formatTime(payoffEnd)} pour reduire la perte avant le drop ${dropRange}.`,
      viewerPsychology: `Pour ${audience}, la sequence preuve -> contexte -> correction demande moins d effort que contexte -> explication -> preuve.`,
      changeJustification: `Les changements repondent aux signaux dominants: ${signals.slice(0, 3).map((signal) => signal.evidence).join(' ')}${memory ? ` Memoire createur utilisee: ${memory}` : ''}`,
    },
    predictedImprovements: {
      retentionPotential: clamp(predictedBase + retentionGain, 0, 96),
      watchTimePotential: clamp((result.retention?.score ?? predictedBase) + retentionGain + 3, 0, 96),
      engagementPotential: clamp(ctaScore + ctaGain, 0, 94),
      commentPotential: clamp(ctaScore + ctaGain + 4, 0, 92),
      label: 'Simulation IA, pas une garantie de performance.',
    },
  };
}
