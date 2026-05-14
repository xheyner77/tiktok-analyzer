import type { ReconstructionInput, ReconstructionPromptSuite } from '@/types/reconstruction';

function context(input: ReconstructionInput) {
  return [
    `Niche: ${input.niche}`,
    `Objectif: ${input.objective}`,
    `Duree: ${input.durationSec}s`,
    `Format: ${input.contentType}`,
    `Rythme: ${input.rhythm}`,
    `Hook score: ${input.hookScore}/100`,
    `CTA score: ${input.ctaScore}/100`,
    `Drops: ${input.drops.join(' | ') || 'aucun drop fiable'}`,
    `Structure actuelle: ${input.currentStructure.join(' -> ') || 'structure inconnue'}`,
  ].join('\n');
}

export function buildReconstructionPrompts(input: ReconstructionInput): ReconstructionPromptSuite {
  const base = [
    'Tu es le moteur de Reconstruction IA Viralynz.',
    'Tu dois raisonner comme un strategist TikTok et un monteur short-form.',
    'Chaque recommandation doit citer un signal concret: timecode, drop, score, rythme, CTA, niche ou objectif.',
    'Ne promets jamais generation video, export video ou montage automatique. Tu optimises seulement la structure.',
    context(input),
  ].join('\n\n');

  return {
    hookAnalysis: [
      base,
      'Analyse le hook. Explique si le contexte arrive avant la tension, si le payoff est visible, et propose des hooks specifiques a la video.',
    ].join('\n\n'),
    retentionAnalysis: [
      base,
      'Analyse la retention. Identifie les drops, les longueurs inutiles, les moments morts et les secondes qui manquent de stimulation visuelle ou narrative.',
    ].join('\n\n'),
    ctaOptimization: [
      base,
      'Optimise le CTA. Donne un moment optimal, une formulation courte, un objectif commentaire et un objectif watch time.',
    ].join('\n\n'),
    structureReconstruction: [
      base,
      'Reconstruis la structure en sequences ordonnees. Pour chaque sequence: start, end, type, title, recommendation, expectedImpact, retentionGoal.',
    ].join('\n\n'),
    patternInterruptGeneration: [
      base,
      'Genere des relances attentionnelles serieuses: cut sec, objection, zoom leger, texte ecran, changement de preuve. Chaque relance doit arriver avant un drop.',
    ].join('\n\n'),
    retentionSimulation: [
      base,
      'Simule une courbe de retention avant/apres. Donne les points critiques, relances, payoff et CTA. Precise que c est une simulation IA, pas une garantie.',
    ].join('\n\n'),
  };
}
