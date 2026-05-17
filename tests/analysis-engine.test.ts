import { describe, expect, it } from 'vitest';
import {
  buildFormatSpecificRecommendations,
  cleanOcrForUserDisplay,
  detectVideoFormatFromSignals,
  enrichAnalysisResult,
  scoreFormatCandidate,
} from '@/lib/analysis-engine';
import type { AnalysisResult, VideoIntelligenceResult } from '@/lib/types';

function baseSignals(overrides: Partial<Parameters<typeof detectVideoFormatFromSignals>[0]> = {}) {
  return {
    text: '',
    hasTranscript: false,
    wordCount: 0,
    faceDetected: false,
    facecamLikely: false,
    cutRhythm: 'unknown' as const,
    visualEnergy: 0,
    ocrAvailable: false,
    objective: undefined,
    niche: undefined,
    hookScore: 60,
    retentionScore: 60,
    editingScore: 60,
    avgWordsPerSentence: 10,
    ...overrides,
  };
}

function baseResult(): AnalysisResult {
  return {
    viralityScore: 62,
    hook: {
      score: 62,
      rating: 'Bon',
      analysis: 'D’après les signaux disponibles, le hook pose le sujet mais manque de tension.',
      strengths: ['Sujet clair'],
      weaknesses: ['Promesse tardive'],
    },
    editing: {
      score: 62,
      rating: 'Bon',
      analysis: 'Rythme correct mais améliorable.',
      strengths: ['Montage lisible'],
      weaknesses: ['Peu de rupture visuelle'],
    },
    retention: {
      score: 62,
      rating: 'Bon',
      analysis: 'La rétention dépend surtout du payoff.',
      strengths: ['Sujet exploitable'],
      weaknesses: ['Payoff tardif'],
    },
    improvements: [],
  };
}

function videoIntelligence(overrides: Partial<VideoIntelligenceResult> = {}): VideoIntelligenceResult {
  return {
    metadata: { frameCount: 8, source: 'upload_frames', durationSec: 24 },
    transcript: { available: false, confidence: 0, source: 'none', limitations: ['Pas de transcript.'] },
    frames: { sampled: true, count: 8, timestamps: [0, 2, 5, 8, 12, 16, 20, 24], quality: 'bonne', limitations: [] },
    onScreenText: { available: false, text: [], textDensity: 0, confidence: 0, source: 'not_available', limitations: ['OCR indisponible.'] },
    visualSignals: {
      available: true,
      visualEnergy: 58,
      motionEstimate: 58,
      cutDensityEstimate: 45,
      cutRhythm: 'moyen',
      facePresence: 'unknown',
      textDensityEstimate: 0,
      limitations: [],
    },
    audioSignals: { available: false, speechDetected: false, speechDensity: 0, limitations: [] },
    confidence: { score: 58, level: 'moyenne', signalsUsed: ['frame_sampling'], missingSignals: ['transcript', 'ocr_texte_ecran'] },
    limitations: [],
    ...overrides,
  };
}

describe('video format detection', () => {
  it('detects facecam from face signal and coaching wording', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'coach conseil facecam je t explique cette erreur',
      hasTranscript: true,
      wordCount: 34,
      faceDetected: true,
      facecamLikely: true,
      visualEnergy: 54,
    }));

    expect(detected.primary).toBe('facecam_tiktok');
    expect(detected.confidence).toBeGreaterThanOrEqual(60);
    expect(detected.limitations).not.toContain('Aucun signal visage pour confirmer la facecam.');
  });

  it('detects playback/lipsync without requiring speech', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'pov quand personne ne comprend le son tendance',
      ocrAvailable: true,
      cutRhythm: 'moyen',
      visualEnergy: 66,
    }));

    expect(['playback_lipsync', 'autre_ambigu']).toContain(detected.primary);
    expect([detected.primary, ...detected.secondary]).toContain('playback_lipsync');
  });

  it('detects ecommerce with product and click objective', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'ce produit règle le problème client commande prix boutique',
      hasTranscript: true,
      wordCount: 22,
      objective: 'clicks',
      niche: 'e-commerce beauté',
    }));

    expect(detected.primary).toBe('ecommerce');
    expect(detected.confidence).toBeGreaterThanOrEqual(60);
  });

  it('detects humour from setup/payoff wording', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'pov quand ton pote fait une blague et la chute arrive trop tard humour',
      hasTranscript: true,
      wordCount: 18,
      cutRhythm: 'élevé',
      visualEnergy: 72,
    }));

    expect(detected.primary).toBe('humour');
  });

  it('detects tutorial from steps and guide wording', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'tutoriel étape par étape voici la méthode pour apprendre cette recette',
      hasTranscript: true,
      wordCount: 26,
    }));

    expect(detected.primary).toBe('tutoriel');
  });

  it('detects gaming with fast visual rhythm', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'gameplay fortnite rank boss cette partie finit mal',
      hasTranscript: true,
      wordCount: 16,
      cutRhythm: 'élevé',
      visualEnergy: 80,
    }));

    expect(detected.primary).toBe('gaming');
  });

  it('detects lifestyle/vlog wording', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'vlog routine du matin journée dans ma vie lifestyle',
      hasTranscript: true,
      wordCount: 18,
    }));

    expect(detected.primary).toBe('vlog_lifestyle');
  });

  it('detects no-speech videos from frames without transcript', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: '',
      hasTranscript: false,
      wordCount: 0,
      visualEnergy: 61,
      cutRhythm: 'moyen',
    }));

    expect(detected.primary).toBe('sans_parole');
  });

  it('uses ambiguous fallback when signals conflict or are weak', () => {
    const detected = detectVideoFormatFromSignals(baseSignals({
      text: 'erreur solution routine produit',
      hasTranscript: true,
      wordCount: 8,
      visualEnergy: 20,
    }));

    expect(detected.primary).toBe('autre_ambigu');
    expect(detected.limitations.join(' ')).toContain('ambigu');
  });
});

describe('format safeguards and recommendations', () => {
  it('penalizes facecam when face signal is missing', () => {
    const scored = scoreFormatCandidate('facecam_tiktok', baseSignals({
      text: 'facecam conseil coach',
      faceDetected: false,
      facecamLikely: false,
    }));

    expect(scored.contradictions.join(' ')).toContain('Aucun signal visage');
  });

  it('returns hybrid note for ambiguous format recommendations', () => {
    const rec = buildFormatSpecificRecommendations('autre_ambigu');

    expect(rec.note).toContain('hybride');
    expect(rec.secondaryFormats.length).toBeGreaterThan(0);
  });
});

describe('analysis enrichment output adaptation', () => {
  it('keeps transcript absent when no transcript is available', () => {
    const result = enrichAnalysisResult(baseResult(), {
      videoIntelligence: videoIntelligence(),
    });

    expect(result.coachAnalysis?.transcriptAnalysis?.available).toBe(false);
    expect(result.videoIntelligence?.transcript.available).toBe(false);
  });

  it('uses OCR text in hook source and repost plan when available', () => {
    const result = enrichAnalysisResult(baseResult(), {
      objective: 'repost',
      videoIntelligence: videoIntelligence({
        onScreenText: {
          available: true,
          text: ['Stop cette erreur'],
          dominantText: 'Stop cette erreur',
          firstFrameText: 'Stop cette erreur',
          textDensity: 32,
          confidence: 84,
          source: 'vision_ocr',
          limitations: [],
        },
        confidence: { score: 76, level: 'élevée', signalsUsed: ['frame_sampling', 'ocr_texte_ecran'], missingSignals: ['transcript'] },
      }),
    });

    expect(result.coachAnalysis?.hookSources?.some((source) => source.type === 'texte_ecran' && source.evidence.includes('Stop cette erreur'))).toBe(true);
    expect(result.repostVersion?.onScreenText.join(' ')).toContain('Stop cette erreur');
  });

  it('adapts repost plan for ecommerce format', () => {
    const result = enrichAnalysisResult(baseResult(), {
      objective: 'clicks',
      niche: 'ecommerce',
      nicheLabel: 'E-commerce',
      transcript: 'ce produit règle le problème client et montre le résultat avant la commande',
      videoIntelligence: videoIntelligence({
        transcript: {
          available: true,
          text: 'ce produit règle le problème client et montre le résultat avant la commande',
          confidence: 82,
          source: 'whisper',
          limitations: [],
        },
      }),
    });

    expect(result.coachAnalysis?.detectedVideoFormat?.primary).toBe('ecommerce');
    expect(result.repostVersion?.structure.join(' ')).toContain('problème client');
    expect(result.coachAnalysis?.repostEngine.bestOpportunity?.title.toLowerCase()).toContain('preuve');
  });

  it('keeps facecam confidence capped and disables verbal diagnostics without transcript', () => {
    const result = enrichAnalysisResult(baseResult(), {
      objective: 'repost',
      videoIntelligence: videoIntelligence({
        onScreenText: {
          available: true,
          text: ['je recadre un hater'],
          dominantText: 'je recadre un hater',
          firstFrameText: 'je recadre un hater',
          textDensity: 38,
          confidence: 82,
          source: 'vision_ocr',
          limitations: [],
        },
        visualSignals: {
          available: true,
          visualEnergy: 62,
          motionEstimate: 58,
          cutDensityEstimate: 42,
          cutRhythm: 'moyen',
          facePresence: 'detected',
          faceConfidence: 78,
          facecamLikely: true,
          textDensityEstimate: 38,
          limitations: [],
        },
        confidence: { score: 88, level: 'élevée', signalsUsed: ['frame_sampling', 'ocr_texte_ecran', 'face_detection_light'], missingSignals: ['transcript'] },
      }),
    });

    const analysisText = JSON.stringify(result.coachAnalysis);
    expect(result.coachAnalysis?.formatConfidence.level).toBe('moyenne');
    expect(result.coachAnalysis?.formatConfidence.score).toBeLessThanOrEqual(69);
    expect(result.coachAnalysis?.transcriptAnalysis?.available).toBe(false);
    expect(analysisText).not.toMatch(/texte parlé|hook vocal|stop verbal|la voix|diagnostics vocaux/i);
  });

  it('generates content-based hooks instead of meta analysis hooks', () => {
    const result = enrichAnalysisResult(baseResult(), {
      objective: 'repost',
      videoIntelligence: videoIntelligence({
        onScreenText: {
          available: true,
          text: ['je recadre un hater'],
          dominantText: 'je recadre un hater',
          firstFrameText: 'je recadre un hater',
          textDensity: 34,
          confidence: 80,
          source: 'vision_ocr',
          limitations: [],
        },
      }),
    });

    const hooks = result.repostVersion?.hookVariants?.join(' ') ?? '';
    expect(hooks).toContain('HATER');
    expect(hooks).not.toMatch(/TU EXPLIQUES TROP TÔT|VOILÀ POURQUOI ÇA FLOP/i);
  });

  it('keeps repost after-score coherent with repost potential', () => {
    const result = enrichAnalysisResult({
      ...baseResult(),
      viralityScore: 36,
      hook: { ...baseResult().hook, score: 36 },
      editing: { ...baseResult().editing, score: 38 },
      retention: { ...baseResult().retention, score: 42 },
    }, {
      objective: 'repost',
      videoIntelligence: videoIntelligence({
        onScreenText: {
          available: true,
          text: ['erreur qui bloque'],
          dominantText: 'erreur qui bloque',
          textDensity: 30,
          confidence: 78,
          source: 'vision_ocr',
          limitations: [],
        },
      }),
    });

    const after = result.coachAnalysis?.repostEngine.scoreAfter ?? 0;
    const potential = result.coachAnalysis?.subScores.repostPotential ?? 0;
    expect(after).toBeLessThanOrEqual(potential);
  });

  it('cleans noisy OCR before using it in user-facing outputs', () => {
    const cleaned = cleanOcrForUserDisplay('il veut aider un SDF il veut cours gratuit en bio sdf paris manger');
    expect(cleaned.text).not.toMatch(/il veut aider un sdf il veut/i);

    const result = enrichAnalysisResult(baseResult(), {
      objective: 'repost',
      videoIntelligence: videoIntelligence({
        onScreenText: {
          available: true,
          text: ['il veut aider un SDF il veut cours gratuit en bio sdf paris manger'],
          dominantText: 'il veut aider un SDF il veut cours gratuit en bio sdf paris manger',
          firstFrameText: 'il veut aider un SDF il veut cours gratuit en bio sdf paris manger',
          textDensity: 54,
          confidence: 72,
          source: 'vision_ocr',
          limitations: [],
        },
      }),
    });

    const userFacing = [
      result.repostVersion?.hook,
      ...(result.repostVersion?.hookVariants ?? []),
      ...(result.repostVersion?.structure ?? []),
      ...(result.repostVersion?.onScreenText ?? []),
      ...(result.coachAnalysis?.timeline.map((item) => item.insight) ?? []),
    ].join(' ');

    expect(userFacing).toContain('SDF');
    expect(userFacing).not.toMatch(/IL VEUT AIDER UN SDF IL VEUT/i);
    expect(result.repostVersion?.hookVariants?.[0]).toBe('IL PENSAIT BIEN FAIRE');
  });

  it('returns opening analysis, detailed scores and the new segmented timeline', () => {
    const result = enrichAnalysisResult(baseResult(), {
      transcript: 'Personne ne regarde tes videos parce que ton hook explique trop tot. Voici la preuve avant apres.',
      videoIntelligence: videoIntelligence({
        onScreenText: {
          available: true,
          text: ['Erreur hook'],
          dominantText: 'Erreur hook',
          firstFrameText: 'Erreur hook',
          textDensity: 36,
          confidence: 78,
          source: 'vision_ocr',
          limitations: [],
        },
      }),
    });

    expect(result.coachAnalysis?.openingAnalysis?.stopScrollScore).toBeGreaterThan(0);
    expect(result.coachAnalysis?.videoSegments?.map((segment) => segment.range)).toEqual(['0-1s', '1-3s', '3-5s', '5-10s', '10-20s', 'fin']);
    expect(result.coachAnalysis?.videoSegments?.[0].signalsUsed).toContain('transcript');
    expect(result.coachAnalysis?.videoSegments?.[0].signalsUsed).toContain('ocr_texte_ecran');
    expect(result.coachAnalysis?.detailedScores?.map((item) => item.key)).toContain('openingScore');
    expect(result.coachAnalysis?.detailedScores?.map((item) => item.key)).toContain('repostPotentialScore');
  });
});
