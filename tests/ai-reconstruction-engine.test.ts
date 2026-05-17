import { describe, expect, it } from 'vitest';
import { buildReconstructionIA, buildReconstructionPromptInput, buildReconstructionPromptMessages } from '@/lib/ai-reconstruction-engine';
import type { AnalysisResult } from '@/lib/types';

function analysisResult(): AnalysisResult {
  return {
    viralityScore: 48,
    hook: {
      score: 42,
      rating: 'Moyen',
      analysis: 'Le hook pose le contexte avant la tension.',
      strengths: ['Sujet clair'],
      weaknesses: ['Le payoff arrive trop tard dans les premieres secondes.'],
    },
    editing: {
      score: 51,
      rating: 'Moyen',
      analysis: 'Le montage ralentit au milieu.',
      strengths: ['Plans lisibles'],
      weaknesses: ['La transition entre 0:04 et 0:06 ralentit fortement le flux visuel sans nouvelle information.'],
    },
    retention: {
      score: 44,
      rating: 'Moyen',
      analysis: 'La retention baisse quand la preuve tarde.',
      strengths: ['Probleme identifiable'],
      weaknesses: ['Le resultat final arrive apres le premier drop.'],
    },
    improvements: [
      { priority: 'haute', tip: 'CTA : deplacer la question avant la fin et demander un mot-cle simple.' },
    ],
    coachAnalysis: {
      videoPattern: 'facecam_tiktok',
      patternLabel: 'Facecam TikTok',
      subScores: {
        hook: 42,
        retention: 44,
        clarity: 52,
        tension: 39,
        cta: 46,
        repostPotential: 82,
        engagementPotential: 55,
        rewatchPotential: 50,
      },
      weightedScore: 48,
      verdict: 'Reconstruction recommandee.',
      coachSummary: 'La video explique avant de prouver.',
      detectedProblems: [
        {
          id: 'hook_slow',
          severity: 'critique',
          title: 'Hook trop lent',
          explanation: 'Le debut contextualise avant de montrer le resultat.',
          impact: 'Drop early viewers.',
          action: 'Avancer le payoff.',
          timecode: '0:00-0:03',
        },
      ],
      criticalErrors: [],
      benchmarks: [],
      hookVariants: [],
      optimizedCtas: [],
      priorityActions: { critical: [], important: [], optimization: [] },
      repostEngine: {
        recommended: true,
        estimatedGain: 22,
        improvementProbability: 78,
        priorityChanges: ['Avancer la preuve'],
        scoreBefore: 48,
        scoreAfter: 70,
        bestOpportunity: {
          title: 'Preuve avant contexte',
          why: 'Le resultat final est garde apres le drop 0:03.',
          action: 'Montrer le resultat avant explication.',
          expectedLift: '+15 retention',
        },
      },
      videoSegments: [
        {
          range: '0-1s',
          role: 'Contexte',
          tension: 35,
          clarity: 55,
          dropRisk: 62,
          rewatchPotential: 35,
          mainProblem: 'Ouverture trop descriptive.',
          recommendation: 'Commencer par le resultat.',
        },
        {
          range: '3-5s',
          role: 'Transition',
          tension: 30,
          clarity: 42,
          dropRisk: 74,
          visualRhythm: 'faible',
          rewatchPotential: 28,
          mainProblem: 'La transition 0:03-0:05 ralentit sans nouvelle information.',
          concreteCorrection: 'Inserer un cut texte ecran et avancer la preuve.',
          recommendation: 'Relancer avant le drop.',
        },
      ],
      openingAnalysis: {
        firstFrame: 'Facecam neutre avec contexte.',
        promise: 'Correction structure.',
        curiosity: 42,
        emotion: 35,
        proof: 20,
        friction: 72,
        clarity: 58,
        stopScrollScore: 41,
        recommendedAction: 'Montrer le resultat.',
        mainProblem: 'Le debut contextualise avant de montrer le resultat.',
        whyItBlocks: 'Le viewer doit attendre avant de voir la valeur.',
        exactCorrection: 'Ouvrir sur la consequence.',
        newHook: 'Regarde le resultat avant l erreur.',
        newOnScreenText: 'Le resultat arrive trop tard',
        recommendedFirstFrame: 'Resultat final visible',
        signalsUsed: ['transcript', 'frames'],
        confidence: 78,
      },
    },
  };
}

describe('ai reconstruction engine', () => {
  it('builds a structured prompt input from analysis signals', () => {
    const input = buildReconstructionPromptInput(analysisResult(), {
      nicheLabel: 'coachs business',
      objectiveLabel: 'augmenter les commentaires',
      durationSec: 18,
    });
    const messages = buildReconstructionPromptMessages(input);

    expect(input.niche).toBe('coachs business');
    expect(input.objective).toBe('augmenter les commentaires');
    expect(input.dropsDetected.join(' ')).toContain('drop 74');
    expect(messages.system).toContain('JSON scalable');
    expect(messages.user).toContain('coachs business');
  });

  it('moves payoff forward and ties recommendations to specific drops', () => {
    const reconstruction = buildReconstructionIA(analysisResult(), {
      nicheLabel: 'coachs business',
      objectiveLabel: 'augmenter les commentaires',
      durationSec: 18,
    });

    expect(reconstruction.optimizedStructure[0].move).toBe('rewrite');
    expect(reconstruction.optimizedStructure.some((step) => step.type === 'PROOF' && step.move === 'advance')).toBe(true);
    expect(reconstruction.retentionFixes[0].timeRange).toBe('0:03-0:05');
    expect(reconstruction.cutsRecommended.map((cut) => cut.reason).join(' ')).toContain('Drop prioritaire');
    expect(reconstruction.whyThisStructureWorks.changeJustification).toContain('Le debut contextualise');
    expect(reconstruction.predictedImprovements.label).toBe('Simulation IA, pas une garantie de performance.');
  });
});
