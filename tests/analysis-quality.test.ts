import { describe, expect, it } from 'vitest';
import { buildAnalysisContext, critiqueAnalysisOutput, estimateAnalysisCost, regenerateWeakSections, scoreAnalysisQuality, validateAnalysisOutput } from '../lib/analysis-quality';
import type { AnalysisResult, VideoIntelligenceResult } from '../lib/types';

function videoIntelligence(overrides: Partial<VideoIntelligenceResult> = {}): VideoIntelligenceResult {
  return {
    metadata: { durationSec: 28, frameCount: 8, source: 'upload_frames', estimatedAspectRatio: 'vertical' },
    transcript: { available: false, confidence: 0, source: 'none', limitations: ['Aucun transcript exploitable disponible.'] },
    frames: { sampled: true, count: 8, timestamps: [0, 4, 8, 12, 16, 20, 24, 28], quality: 'bonne', limitations: [] },
    onScreenText: { available: true, text: ['Erreur hook'], dominantText: 'Erreur hook', firstFrameText: 'Erreur hook', textDensity: 32, confidence: 78, source: 'vision_ocr', limitations: [] },
    visualSignals: { available: true, visualEnergy: 64, motionEstimate: 58, cutDensityEstimate: 54, cutRhythm: 'moyen', facePresence: 'detected', textDensityEstimate: 32, limitations: [] },
    audioSignals: { available: false, speechDetected: false, speechDensity: 0, limitations: ['Parole non detectee.'] },
    confidence: { score: 66, level: 'moyenne', signalsUsed: ['frame_sampling', 'ocr_texte_ecran'], missingSignals: ['transcript', 'optical_flow'] },
    limitations: ['Transcript absent : recommandations vocales formulees avec prudence.'],
    ...overrides,
  };
}

function result(): AnalysisResult {
  return {
    viralityScore: 62,
    hook: { score: 64, rating: 'Bon', analysis: 'La voix est bonne mais le hook est lent.', strengths: ['Bonne voix'], weaknesses: ['Audio trop lent'] },
    editing: { score: 58, rating: 'Moyen', analysis: 'Rythme moyen.', strengths: [], weaknesses: [] },
    retention: { score: 60, rating: 'Bon', analysis: 'Retention correcte.', strengths: [], weaknesses: [] },
    improvements: [{ priority: 'haute', tip: 'Cote hook : refais la voix.' }],
    repostVersion: {
      hook: 'Le vrai probleme arrive trop tard',
      hookVariants: ['Le vrai probleme arrive trop tard', 'Le vrai probleme arrive trop tard!!', 'Regarde ca avant de poster'],
      structure: ['0-3s : preuve directe'],
      onScreenText: ['Erreur hook', 'Erreur hook'],
      cta: 'Commente PLAN',
      angle: 'Plus direct',
    },
  };
}

describe('analysis-quality', () => {
  it('builds a compact multimodal context without raw noisy payloads', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence(), objectiveLabel: 'Ameliorer le hook' });
    expect(context.promptContext).toContain('CONTEXTE MULTIMODAL COMPRESSE');
    expect(context.signals.ocrSummary).toContain('Erreur hook');
    expect(context.promptContext.length).toBeLessThan(1600);
  });

  it('validates output against unavailable transcript and deduplicates hooks', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence() });
    const validated = validateAnalysisOutput(result(), context);
    expect(validated.hook.analysis.toLowerCase()).not.toContain('voix');
    expect(validated.repostVersion?.hookVariants?.length).toBe(2);
    expect(validated.analyzerMeta?.validationWarnings).toBeDefined();
  });

  it('keeps estimated analysis cost inside the Creator unit budget', () => {
    const estimate = estimateAnalysisCost({
      model: 'gpt-4o-mini',
      framesForOcr: 5,
      framesForReasoning: 8,
      transcriptChars: 2500,
      ocrChars: 500,
      promptChars: 1500,
      outputTokens: 1700,
      whisperMinutes: 0.6,
    });
    expect(estimate.estimatedUsd).toBeLessThan(0.01);
  });

  it('quality gate detects generic output and weak repost plans', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence() });
    const weak = {
      ...result(),
      hook: { ...result().hook, analysis: 'Le hook est faible. Ameliore le hook.' },
      repostVersion: { ...result().repostVersion!, structure: ['Ameliore ton intro', 'Ajoute plus de valeur'] },
    };

    const report = scoreAnalysisQuality(weak, context);
    expect(report.qualityScore).toBeLessThan(70);
    expect(report.needsRegeneration).toBe(true);
    expect(report.sectionsToRegenerate).toContain('repostPlan');
  });

  it('critic detects hooks unrelated to the real content', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence() });
    const weak = {
      ...result(),
      repostVersion: { ...result().repostVersion!, hook: 'Decouvrez comment devenir riche rapidement', hookVariants: ['Decouvrez comment devenir riche rapidement'] },
    };

    const issues = critiqueAnalysisOutput(weak, context);
    expect(issues.some((issue) => issue.section === 'hooks')).toBe(true);
  });

  it('critic detects unsupported audio claims when transcript is absent', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence() });
    const issues = critiqueAnalysisOutput(result(), context);
    expect(issues.some((issue) => issue.message.includes('audio'))).toBe(true);
  });

  it('regenerates only weak sections and supports escalation flags', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence() });
    const weak = {
      ...result(),
      hook: { ...result().hook, analysis: 'Le hook est faible. Ameliore le hook.' },
      repostVersion: { ...result().repostVersion!, structure: ['Ameliore ton intro'] },
    };
    const report = scoreAnalysisQuality(weak, context);
    const regenerated = regenerateWeakSections(weak, context, { ...report, qualityScore: 50, escalationRecommended: true }, {
      enableEscalation: true,
      escalationModel: 'gpt-quality',
      baseModel: 'gpt-economy',
    });

    expect(regenerated.regeneratedSections).toContain('hooks');
    expect(regenerated.regeneratedSections).toContain('repostPlan');
    expect(regenerated.escalationTriggered).toBe(true);
    expect(regenerated.modelUsed).toBe('gpt-quality');
    expect(regenerated.result.repostVersion?.structure[0]).toContain('0-1s');
  });

  it('final regenerated output can pass the minimum quality threshold', () => {
    const context = buildAnalysisContext({ videoIntelligence: videoIntelligence() });
    const weak = {
      ...result(),
      hook: { ...result().hook, analysis: 'Le hook est faible. Ameliore le hook.' },
      repostVersion: { ...result().repostVersion!, structure: ['Ameliore ton intro'] },
    };
    const report = scoreAnalysisQuality(weak, context);
    const regenerated = regenerateWeakSections(weak, context, report);
    const finalReport = scoreAnalysisQuality(validateAnalysisOutput(regenerated.result, context), context);

    expect(finalReport.qualityScore).toBeGreaterThanOrEqual(70);
  });
});
