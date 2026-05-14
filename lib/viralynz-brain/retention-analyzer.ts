import type { BrainInput, RetentionAnalyzerResult } from './types';
import { confidenceLevel, diagnostic, evidence, from100To20, scoreFromIssues, strictJsonContract } from './utils';

export const RETENTION_ANALYZER_PROMPT = strictJsonContract('retention_analyzer', [
  'score',
  'rhythm',
  'dropMoments',
  'weakMoments',
  'diagnostics',
  'confidence',
]);

export function analyzeRetention(input: BrainInput): RetentionAnalyzerResult {
  const vi = input.videoIntelligence;
  const duration = input.context.durationSec ?? vi?.metadata.durationSec ?? 0;
  const visualEnergy = vi?.visualSignals.visualEnergy ?? 50;
  const cutDensity = vi?.visualSignals.cutDensityEstimate ?? 50;
  const speechDensity = vi?.audioSignals.speechDensity ?? (input.transcript ? 55 : 0);
  const wordCount = input.transcript ? input.transcript.split(/\s+/).length : 0;
  const densityRatio = duration > 0 ? wordCount / duration : 0;
  const rhythm: RetentionAnalyzerResult['rhythm'] =
    !vi?.visualSignals.available && !input.transcript
      ? 'unknown'
      : densityRatio > 3.4 || cutDensity > 72
        ? 'dense'
        : densityRatio < 1.2 || visualEnergy < 35
          ? 'slow'
          : 'balanced';

  const penalties = [
    rhythm === 'slow' ? 4 : 0,
    rhythm === 'dense' ? 2 : 0,
    visualEnergy < 35 ? 3 : 0,
    cutDensity < 28 ? 2 : 0,
    speechDensity > 82 ? 2 : 0,
    !input.transcript && !vi?.visualSignals.available ? 5 : 0,
  ];
  const score = scoreFromIssues(from100To20(input.result.retention?.score ?? input.result.viralityScore), penalties);
  const confidence = Math.min(0.9, 0.32 + (input.transcript ? 0.22 : 0) + (vi?.visualSignals.available ? 0.26 : 0) + (duration ? 0.1 : 0));

  const dropMoments: RetentionAnalyzerResult['dropMoments'] = [];
  if (rhythm === 'slow') {
    dropMoments.push({ timestamp: '0:03-0:06', reason: 'Le rythme percu est lent avant que la preuve soit installee.', confidence });
  }
  if (rhythm === 'dense') {
    dropMoments.push({ timestamp: '0:05-0:09', reason: 'La densite peut creer une surcharge avant le payoff.', confidence: Math.max(0.35, confidence - 0.08) });
  }
  const diagnostics = [];
  if (rhythm === 'slow') {
    diagnostics.push(diagnostic('retention_analyzer', 'retention_slow_rhythm', {
      severity: 'important',
      title: 'Rythme trop lent apres le hook',
      explanation: 'Les signaux de rythme indiquent un risque de baisse d attention apres l ouverture.',
      timestamp: '0:03-0:06',
      evidence: `Energie visuelle ${Math.round(visualEnergy)}/100, densite cuts ${Math.round(cutDensity)}/100.`,
      impact: 'Le viewer peut comprendre la video mais ne pas sentir de progression assez rapide.',
      fix: 'Ajouter un changement visuel, une preuve ou un cut utile avant 0:06.',
      confidence,
    }));
  }
  if (rhythm === 'dense') {
    diagnostics.push(diagnostic('retention_analyzer', 'retention_overload', {
      severity: 'optimisation',
      title: 'Densite potentiellement trop forte',
      explanation: 'La video donne beaucoup d information en peu de temps.',
      timestamp: '0:05-0:10',
      evidence: duration ? `Environ ${densityRatio.toFixed(1)} mots par seconde.` : 'Duree exacte limitee, signal estime.',
      impact: 'La comprehension peut baisser meme si le rythme semble dynamique.',
      fix: 'Garder une idee par plan et laisser respirer la preuve.',
      confidence: Math.max(0.35, confidence - 0.06),
    }));
  }

  return {
    module: 'retention_analyzer',
    score,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    diagnostics,
    evidence: [
      evidence('duration_sec', duration || undefined),
      evidence('visual_energy', visualEnergy),
      evidence('cut_density', cutDensity),
      evidence('speech_density', speechDensity),
    ],
    fallbackUsed: !vi?.visualSignals.available,
    dropMoments: dropMoments.slice(0, 4),
    rhythm,
    weakMoments: dropMoments.map((moment) => `${moment.timestamp}: ${moment.reason}`).slice(0, 4),
  };
}
