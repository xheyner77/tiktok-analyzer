import type { AnalysisResult } from '../types';
import type { BrainConfidenceLevel, BrainDiagnostic, BrainEvidence, BrainInput, BrainModuleName } from './types';

export function clampScore(value: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

export function score20(value: number) {
  return Math.max(1, Math.min(20, Math.round(value)));
}

export function from100To20(value?: number) {
  return score20((value ?? 50) / 5);
}

export function from20To100(value: number) {
  return clampScore(value * 5);
}

export function confidenceLevel(confidence: number): BrainConfidenceLevel {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.48) return 'medium';
  return 'low';
}

export function normalizeText(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function buildBrainInput(result: AnalysisResult, context: BrainInput['context']): BrainInput {
  const videoIntelligence = context.videoIntelligence ?? result.videoIntelligence;
  const transcript = normalizeText(context.transcript ?? videoIntelligence?.transcript.text);
  const firstWords = transcript.split(' ').slice(0, 22).join(' ');
  const onScreenText = [
    videoIntelligence?.onScreenText.firstFrameText,
    videoIntelligence?.onScreenText.dominantText,
    ...(videoIntelligence?.onScreenText.text ?? []),
  ]
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 6);

  return {
    result,
    context,
    videoIntelligence,
    transcript,
    firstWords,
    onScreenText,
    creatorMemoryContext: normalizeText(context.previousAnalyses?.length ? `${context.previousAnalyses.length} analyses recentes disponibles.` : ''),
  };
}

export function hasAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export function evidence(signal: string, value?: string | number | boolean): BrainEvidence {
  return {
    signal,
    value: value === undefined || value === '' ? 'non disponible' : String(value),
  };
}

export function diagnostic(
  module: BrainModuleName,
  id: string,
  params: Omit<BrainDiagnostic, 'module' | 'id'>,
): BrainDiagnostic {
  return {
    id,
    module,
    ...params,
  };
}

export function scoreFromIssues(base: number, penalties: number[], bonuses: number[] = []) {
  return score20(base - penalties.reduce((sum, value) => sum + value, 0) + bonuses.reduce((sum, value) => sum + value, 0));
}

export function strictJsonContract(module: BrainModuleName, fields: string[]) {
  return [
    `Module: ${module}`,
    'Return valid JSON only. No markdown. No invented account metrics.',
    'Every diagnosis must include evidence, impact, fix, timestamp when available, and confidence.',
    'If a signal is missing, state that it is unavailable or lower confidence.',
    `Required top-level fields: ${fields.join(', ')}.`,
  ].join('\n');
}
