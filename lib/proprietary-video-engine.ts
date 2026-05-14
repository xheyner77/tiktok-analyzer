import type { AnalysisResult, StructuredDiagnostic, VideoIntelligenceResult } from './types';

export interface TechnicalSceneCut {
  timestamp: number;
  intensity: number;
  reason: 'frame_delta' | 'ffmpeg_scene';
}

export interface TechnicalSpeechSegment {
  start: number;
  end: number;
  text: string;
  wordCount: number;
  wordsPerSecond: number;
}

export interface TechnicalRetentionRisk {
  timestamp: string;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  evidence: string;
  confidence: number;
}

export interface ProprietaryVideoSignals {
  version: 'viralynz-technical-pipeline-v1';
  source: 'browser_sampling' | 'ffmpeg' | 'mixed';
  metadata: {
    durationSec?: number;
    frameCount: number;
    transcriptAvailable: boolean;
    signalQuality: number;
  };
  visual: {
    sceneCuts: TechnicalSceneCut[];
    avgShotDurationSec?: number;
    longestStaticSegmentSec?: number;
    visualRhythm: 'slow' | 'balanced' | 'fast' | 'unknown';
    visualDensity: number;
    patternInterrupts: Array<{ timestamp: string; reason: string; confidence: number }>;
  };
  speech: {
    segments: TechnicalSpeechSegment[];
    wordsPerSecond: number;
    avgPhraseLength: number;
    pauseRisk: 'low' | 'medium' | 'high' | 'unknown';
    repetitions: string[];
    payoffTimestamp?: string;
  };
  structure: {
    hookWindow: string;
    timeToPayoffSec?: number;
    weakTransitions: Array<{ timestamp: string; reason: string; confidence: number }>;
    retentionRisks: TechnicalRetentionRisk[];
  };
  antiHallucination: {
    forbiddenClaims: string[];
    allowedLanguage: string[];
    missingSignals: string[];
  };
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function estimateFrameBytes(base64: string) {
  return Math.round((base64.length * 3) / 4);
}

function timestamp(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `0:${String(safe).padStart(2, '0')}`;
}

function frameTimestamps(frameCount: number, durationSec?: number) {
  if (!frameCount) return [];
  if (!durationSec || durationSec <= 0) return Array.from({ length: frameCount }, (_, index) => index);
  if (frameCount === 1) return [0];
  return Array.from({ length: frameCount }, (_, index) => (durationSec * index) / (frameCount - 1));
}

function buildSceneCuts(frames: string[], durationSec?: number): TechnicalSceneCut[] {
  if (frames.length < 2) return [];
  const sizes = frames.map(estimateFrameBytes);
  const avg = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  const times = frameTimestamps(frames.length, durationSec);
  return sizes
    .slice(1)
    .map((size, index) => {
      const delta = Math.abs(size - sizes[index]) / Math.max(avg, 1);
      return {
        timestamp: times[index + 1] ?? index + 1,
        intensity: clamp(delta * 100),
        reason: 'frame_delta' as const,
      };
    })
    .filter((cut) => cut.intensity >= 14);
}

function splitSentences(transcript?: string): string[] {
  return (transcript ?? '')
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function buildSpeechSegments(transcript?: string, durationSec?: number): TechnicalSpeechSegment[] {
  const sentences = splitSentences(transcript);
  if (!sentences.length) return [];
  const totalWords = sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).filter(Boolean).length, 0);
  const duration = Math.max(durationSec ?? sentences.length * 3, sentences.length);
  let cursor = 0;
  return sentences.slice(0, 18).map((sentence) => {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    const segmentDuration = Math.max(1.2, (wordCount / Math.max(totalWords, 1)) * duration);
    const start = cursor;
    const end = Math.min(duration, cursor + segmentDuration);
    cursor = end;
    return {
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
      text: sentence.slice(0, 220),
      wordCount,
      wordsPerSecond: Math.round((wordCount / Math.max(end - start, 1)) * 10) / 10,
    };
  });
}

function detectRepetitions(transcript?: string) {
  const words = (transcript ?? '').toLowerCase().match(/[\p{L}\p{N}']{4,}/gu) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function detectPayoffTimestamp(transcript?: string, durationSec?: number) {
  const terms = ['resultat', 'preuve', 'voici', 'regarde', 'exemple', 'solution', 'avant apres', 'avant/apres'];
  const lower = (transcript ?? '').toLowerCase();
  if (!lower) return undefined;
  const firstIndex = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (firstIndex === undefined) return undefined;
  const ratio = firstIndex / Math.max(lower.length, 1);
  return timestamp(Math.min(durationSec ?? 30, Math.max(0, ratio * (durationSec ?? 30))));
}

function buildRetentionRisks(input: {
  durationSec?: number;
  sceneCuts: TechnicalSceneCut[];
  avgShotDurationSec?: number;
  wordsPerSecond: number;
  payoffTimestamp?: string;
  transcriptAvailable: boolean;
}): TechnicalRetentionRisk[] {
  const risks: TechnicalRetentionRisk[] = [];
  if ((input.avgShotDurationSec ?? 0) > 4.5) {
    risks.push({
      timestamp: '0:04-0:08',
      risk: 'high',
      reason: 'Rythme visuel lent',
      evidence: `Duree moyenne estimee des plans: ${input.avgShotDurationSec}s.`,
      confidence: 0.68,
    });
  }
  if (input.wordsPerSecond > 3.4) {
    risks.push({
      timestamp: '0:05-0:12',
      risk: 'medium',
      reason: 'Surcharge informationnelle probable',
      evidence: `Vitesse parole estimee: ${input.wordsPerSecond} mots/seconde.`,
      confidence: 0.62,
    });
  }
  if (!input.payoffTimestamp) {
    risks.push({
      timestamp: '0:00-0:06',
      risk: 'medium',
      reason: 'Payoff non detecte dans les signaux textuels',
      evidence: input.transcriptAvailable ? 'Aucun terme de preuve/resultat detecte dans le transcript.' : 'Transcript indisponible, signal limite.',
      confidence: input.transcriptAvailable ? 0.64 : 0.38,
    });
  }
  if (input.sceneCuts.length <= 1 && (input.durationSec ?? 0) >= 12) {
    risks.push({
      timestamp: '0:06-0:12',
      risk: 'medium',
      reason: 'Peu de changements visuels detectes',
      evidence: `${input.sceneCuts.length} cut(s) detecte(s) dans le sampling.`,
      confidence: 0.56,
    });
  }
  return risks.slice(0, 5);
}

export function buildProprietaryVideoSignals(input: {
  frames?: string[];
  durationSec?: number;
  transcript?: string;
  onScreenTexts?: string[];
  source?: ProprietaryVideoSignals['source'];
}): ProprietaryVideoSignals {
  const frames = input.frames ?? [];
  const sceneCuts = buildSceneCuts(frames, input.durationSec);
  const duration = input.durationSec;
  const avgShotDurationSec = sceneCuts.length && duration
    ? Math.round((duration / (sceneCuts.length + 1)) * 10) / 10
    : duration && frames.length
      ? Math.round((duration / Math.max(frames.length, 1)) * 10) / 10
      : undefined;
  const longestStaticSegmentSec = avgShotDurationSec ? Math.round(Math.min(duration ?? avgShotDurationSec, avgShotDurationSec * 1.45) * 10) / 10 : undefined;
  const speechSegments = buildSpeechSegments(input.transcript, duration);
  const totalWords = speechSegments.reduce((sum, segment) => sum + segment.wordCount, 0);
  const wordsPerSecond = Math.round((totalWords / Math.max(duration ?? speechSegments.at(-1)?.end ?? 1, 1)) * 10) / 10;
  const avgPhraseLength = speechSegments.length ? Math.round(totalWords / speechSegments.length) : 0;
  const payoffTimestamp = detectPayoffTimestamp(input.transcript, duration);
  const visualDensity = clamp((sceneCuts.length * 12) + ((input.onScreenTexts?.length ?? 0) * 8) + (frames.length >= 8 ? 18 : frames.length * 2));
  const visualRhythm: ProprietaryVideoSignals['visual']['visualRhythm'] = !frames.length
    ? 'unknown'
    : (avgShotDurationSec ?? 99) > 4.5
      ? 'slow'
      : sceneCuts.length >= 4 || (avgShotDurationSec ?? 0) < 2.2
        ? 'fast'
        : 'balanced';
  const retentionRisks = buildRetentionRisks({
    durationSec: duration,
    sceneCuts,
    avgShotDurationSec,
    wordsPerSecond,
    payoffTimestamp,
    transcriptAvailable: Boolean(input.transcript),
  });
  const missingSignals = [
    !input.transcript ? 'transcript_timestamped' : '',
    !frames.length ? 'frames' : '',
    'real_tiktok_retention',
    'real_tiktok_views',
  ].filter(Boolean);

  return {
    version: 'viralynz-technical-pipeline-v1',
    source: input.source ?? 'browser_sampling',
    metadata: {
      durationSec: duration,
      frameCount: frames.length,
      transcriptAvailable: Boolean(input.transcript),
      signalQuality: clamp(22 + frames.length * 5 + (input.transcript ? 26 : 0) + sceneCuts.length * 4 + (input.onScreenTexts?.length ?? 0) * 3),
    },
    visual: {
      sceneCuts,
      avgShotDurationSec,
      longestStaticSegmentSec,
      visualRhythm,
      visualDensity,
      patternInterrupts: sceneCuts.slice(0, 4).map((cut) => ({
        timestamp: timestamp(cut.timestamp),
        reason: `Changement visuel detecte par variation frame (${cut.intensity}/100).`,
        confidence: Math.min(0.82, 0.42 + cut.intensity / 160),
      })),
    },
    speech: {
      segments: speechSegments,
      wordsPerSecond,
      avgPhraseLength,
      pauseRisk: !input.transcript ? 'unknown' : wordsPerSecond < 1.1 ? 'high' : wordsPerSecond > 3.4 ? 'medium' : 'low',
      repetitions: detectRepetitions(input.transcript),
      payoffTimestamp,
    },
    structure: {
      hookWindow: '0:00-0:03',
      timeToPayoffSec: payoffTimestamp ? Number(payoffTimestamp.split(':')[1]) : undefined,
      weakTransitions: retentionRisks
        .filter((risk) => risk.reason.toLowerCase().includes('visuel') || risk.reason.toLowerCase().includes('rythme'))
        .map((risk) => ({ timestamp: risk.timestamp, reason: risk.reason, confidence: risk.confidence })),
      retentionRisks,
    },
    antiHallucination: {
      forbiddenClaims: ['vues TikTok inventees', 'taux de retention reel invente', 'watch time reel invente', 'comparaison compte non fournie'],
      allowedLanguage: ['risque probable', 'signal interne', 'estimation structurelle', 'confidence score'],
      missingSignals,
    },
  };
}

export function technicalDiagnosticsFromSignals(signals: ProprietaryVideoSignals): StructuredDiagnostic[] {
  return signals.structure.retentionRisks.map((risk) => ({
    title: risk.reason,
    explanation: `Risque ${risk.risk} detecte par le pipeline technique Viralynz.`,
    timestamp: risk.timestamp,
    evidence: risk.evidence,
    impact: 'Ce signal peut reduire la retention probable, sans pretendre mesurer une retention TikTok reelle.',
    fix: risk.reason.includes('Payoff')
      ? 'Avancer la preuve ou le resultat dans les premieres secondes.'
      : risk.reason.includes('Surcharge')
        ? 'Couper une phrase et isoler une seule idee par plan.'
        : 'Ajouter un cut utile, zoom ou changement visuel avant le segment faible.',
    confidence: risk.confidence,
  }));
}

export function mergeTechnicalDiagnostics(result: AnalysisResult, signals?: ProprietaryVideoSignals): AnalysisResult {
  if (!signals) return result;
  const technicalDiagnostics = technicalDiagnosticsFromSignals(signals);
  return {
    ...result,
    structuredDiagnostics: [
      ...technicalDiagnostics,
      ...(result.structuredDiagnostics ?? []),
    ].slice(0, 10),
  };
}
