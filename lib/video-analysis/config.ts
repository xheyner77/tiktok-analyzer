import 'server-only';

export const VIDEO_ANALYSIS_LIMITS = Object.freeze({
  maxFileBytes: 250 * 1024 * 1024,
  maxDurationSeconds: 10 * 60,
  maxFrames: 72,
  maxGapSeconds: 15,
  framesPerVisionBatch: 10,
  maxSpecialistCalls: 8,
  maxRetriesPerProviderCall: 2,
  providerTimeoutMs: 90_000,
});

export const VIDEO_ANALYSIS_VERSIONS = Object.freeze({
  schema: '2.0.0',
  prompt: 'video-coach-2026-07-13.1',
  pipeline: 'durable-video-2.0.0',
});

export interface VideoAnalysisModelConfig {
  synthesisCandidates: readonly string[];
  extractionCandidates: readonly string[];
  specialistCandidates: readonly string[];
  transcriptionPrimary: string;
  transcriptionAlignment: string;
}

function configuredCandidates(name: string, fallbacks: readonly string[]): readonly string[] {
  const configured = process.env[name]
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? [...new Set(configured)] : fallbacks;
}

/**
 * Candidate lists are resolved against the authenticated OpenAI account at
 * runtime. No analysis assumes that the newest model is enabled for the user.
 */
export function getVideoAnalysisModelConfig(): VideoAnalysisModelConfig {
  return {
    synthesisCandidates: configuredCandidates('OPENAI_ANALYSIS_MODELS', [
      'gpt-5.6',
      'gpt-5.4',
      'gpt-4o',
      'gpt-4o-mini',
    ]),
    extractionCandidates: configuredCandidates('OPENAI_EXTRACTION_MODELS', [
      'gpt-4o',
      'gpt-4o-mini',
    ]),
    specialistCandidates: configuredCandidates('OPENAI_SPECIALIST_MODELS', [
      'gpt-4o-mini',
      'gpt-4o',
    ]),
    transcriptionPrimary: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-transcribe',
    transcriptionAlignment: process.env.OPENAI_ALIGNMENT_MODEL?.trim() || 'whisper-1',
  };
}

export const VIDEO_INPUT_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/mpeg',
]);
