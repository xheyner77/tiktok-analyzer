import { describe, expect, it } from 'vitest';
import { formatOverviewAnalysis } from '@/lib/dashboard-overview';
import { classifyAnalysisTransparency, type AnalysisResult } from '@/lib/types';

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    analysisSource: 'vision_upload',
    viralityScore: 72,
    observedStatsSource: 'live_page',
    observedMetrics: {
      views: 1200,
      likes: 140,
      comments: 12,
      shares: 8,
    },
    hook: { score: 70, rating: 'Bon', analysis: 'Hook clair.', strengths: ['Sujet clair'], weaknesses: [] },
    editing: { score: 72, rating: 'Bon', analysis: 'Rythme propre.', strengths: ['Cuts utiles'], weaknesses: [] },
    retention: { score: 71, rating: 'Bon', analysis: 'Payoff lisible.', strengths: ['Preuve rapide'], weaknesses: [] },
    improvements: [{ priority: 'haute', tip: 'Avance la preuve.' }],
    analyzerMeta: {
      analysisMode: 'vision',
      analysisModeLabel: 'Vision upload',
      analysisConfidence: { score: 82, level: 'elevee', reasons: ['Frames exploitables'] },
      signalDisclosure: {
        observedData: ['Frames extraites', 'Stats TikTok détectées'],
        aiHypotheses: ['Priorité hook'],
        simulations: ['Score après correction'],
        previews: [],
      },
    },
    videoIntelligence: {
      metadata: { frameCount: 8, source: 'upload_frames', durationSec: 24 },
      transcript: { available: false, confidence: 0, source: 'none', limitations: [] },
      frames: { sampled: true, count: 8, timestamps: [0, 3, 6], quality: 'bonne', limitations: [] },
      onScreenText: { available: true, text: ['Preuve'], textDensity: 30, confidence: 78, source: 'vision_ocr', limitations: [] },
      visualSignals: { available: true, visualEnergy: 62, motionEstimate: 60, cutDensityEstimate: 58, cutRhythm: 'moyen', facePresence: 'detected', limitations: [] },
      audioSignals: { available: false, speechDetected: false, speechDensity: 0, limitations: [] },
      confidence: { score: 82, level: 'élevée', signalsUsed: ['frame_sampling'], missingSignals: [] },
      limitations: [],
    },
    ...overrides,
  };
}

describe('analysis transparency classification', () => {
  it('blocks real benchmarks and aggregates for fallback results', () => {
    const transparency = classifyAnalysisTransparency(result({
      analyzerMeta: {
        analysisMode: 'fallback',
        analysisModeLabel: 'Fallback',
        isFallback: true,
        analysisConfidence: { score: 45, level: 'faible', reasons: ['Erreur OpenAI'] },
      },
    }));

    expect(transparency.level).toBe('fallback');
    expect(transparency.canShowRealBenchmark).toBe(false);
    expect(transparency.includeInRealAggregates).toBe(false);
  });

  it('excludes demo results from real dashboard aggregates', () => {
    const transparency = classifyAnalysisTransparency(result({
      analyzerMeta: {
        analysisMode: 'demo',
        analysisModeLabel: 'Preview demo',
        isFallback: true,
      },
    }));

    expect(transparency.level).toBe('demo');
    expect(transparency.includeInRealAggregates).toBe(false);
  });

  it('treats analyses without metadata cautiously instead of real by default', () => {
    const transparency = classifyAnalysisTransparency(result({
      analysisSource: 'url',
      analyzerMeta: undefined,
      videoIntelligence: undefined,
      observedStatsSource: 'none',
      observedMetrics: undefined,
    }));

    expect(transparency.level).toBe('estimated');
    expect(transparency.canShowRealBenchmark).toBe(false);
    expect(transparency.includeInRealAggregates).toBe(false);
  });

  it('allows real aggregates only when observed signals are strong enough', () => {
    const transparency = classifyAnalysisTransparency(result());

    expect(transparency.level).toBe('real');
    expect(transparency.canShowRealBenchmark).toBe(true);
    expect(transparency.includeInRealAggregates).toBe(true);
  });

  it('keeps overview cards transparent when the score should not be shown as real', () => {
    const transparency = classifyAnalysisTransparency(result({
      analyzerMeta: {
        analysisMode: 'fallback',
        isFallback: true,
      },
    }));
    const baseCard = formatOverviewAnalysis({
      id: 'analysis-1',
      title: 'Vidéo analysée',
      createdAtLabel: '28 juin 2026',
      score: transparency.includeInRealAggregates ? 72 : null,
    });
    const card = transparency.includeInRealAggregates
      ? baseCard
      : { ...baseCard, badgeLabel: transparency.label, badgeTone: 'danger' as const };

    expect(card.score).toBeNull();
    expect(card.badgeLabel).toBe('Analyse dégradée');
  });
});
