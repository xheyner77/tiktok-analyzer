import 'server-only';
import { createReadStream } from 'node:fs';
import type { TranscriptionVerbose } from 'openai/resources/audio/transcriptions';
import { RetryableError } from 'workflow';
import type { Transcription } from '@/lib/analysis-engine/index';
import { getVideoAnalysisModelConfig } from './config';
import { ANALYSIS_PROFILES, configuredProfileModels, type AnalysisProfileId } from './analysis-profiles';
import {
  getVideoOpenAIClient,
  withProviderRetry,
} from './openai-client';
import {
  inferProviderLedgerContext,
  providerUsageFromUnknown,
} from './provider-ledger';

interface TranscriptionMetrics {
  models: string[];
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  retries: number;
  durationMs: number;
  providerDurationMs: number;
}

interface AlignmentSegment {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  wordIds: string[];
  confidence?: number;
  uncertainty?: 'low' | 'medium' | 'high';
  confidenceMethod?: string;
  providerSignals?: {
    averageLogProbability: number;
    noSpeechProbability: number;
    compressionRatio: number;
  };
}

function normalizeTranscriptText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

const LANGUAGE_NAME_TO_CODE: Readonly<Record<string, string>> = Object.freeze({
  arabic: 'ar',
  chinese: 'zh',
  dutch: 'nl',
  english: 'en',
  french: 'fr',
  german: 'de',
  hindi: 'hi',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  polish: 'pl',
  portuguese: 'pt',
  russian: 'ru',
  spanish: 'es',
  turkish: 'tr',
  ukrainian: 'uk',
});

function normalizeDetectedLanguageCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return null;
  if (/^[a-z]{2,3}$/.test(normalized)) return normalized;
  if (/^[a-z]{2,3}-[a-z]{2}$/.test(normalized)) {
    const [language, region] = normalized.split('-');
    return `${language}-${region.toUpperCase()}`;
  }
  return LANGUAGE_NAME_TO_CODE[normalized] ?? null;
}

function usageTokens(usage: unknown): { input: number; output: number } {
  if (!usage || typeof usage !== 'object') return { input: 0, output: 0 };
  const row = usage as Record<string, unknown>;
  return {
    input: Number(row.input_tokens) || 0,
    output: Number(row.output_tokens) || 0,
  };
}

function rethrowLedgerPersistenceError(error: unknown): void {
  if (RetryableError.is(error)) throw error;
  if (error instanceof Error && error.message.startsWith('PROVIDER_LEDGER_')) throw error;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function confidenceFromLogProbability(logProbability: number): number {
  return clampRatio(Math.exp(Math.min(0, logProbability)));
}

function primaryConfidence(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const logprobs = (value as { logprobs?: unknown }).logprobs;
  if (!Array.isArray(logprobs)) return null;
  const values = logprobs.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const logprob = Number((entry as { logprob?: unknown }).logprob);
    return Number.isFinite(logprob) ? [confidenceFromLogProbability(logprob)] : [];
  });
  return values.length
    ? Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(4))
    : null;
}

function segmentConfidence(segment: {
  avg_logprob?: unknown;
  no_speech_prob?: unknown;
  compression_ratio?: unknown;
}): Pick<AlignmentSegment, 'confidence' | 'uncertainty' | 'confidenceMethod' | 'providerSignals'> {
  const averageLogProbability = Number(segment.avg_logprob);
  const noSpeechProbability = Number(segment.no_speech_prob);
  const compressionRatio = Number(segment.compression_ratio);
  if (
    !Number.isFinite(averageLogProbability)
    || !Number.isFinite(noSpeechProbability)
    || !Number.isFinite(compressionRatio)
  ) return {};
  const normalizedAverageLogProbability = Math.min(0, averageLogProbability);
  const normalizedNoSpeech = clampRatio(noSpeechProbability);
  const compressionPenalty = compressionRatio > 2.4 ? 0.65 : 1;
  const confidence = Number((
    confidenceFromLogProbability(normalizedAverageLogProbability)
    * (1 - normalizedNoSpeech)
    * compressionPenalty
  ).toFixed(4));
  return {
    confidence,
    uncertainty: confidence >= 0.75 ? 'low' : confidence >= 0.5 ? 'medium' : 'high',
    confidenceMethod: 'exp(avg_logprob) × (1 − no_speech_prob), pénalité si compression_ratio > 2,4',
    providerSignals: {
      averageLogProbability: normalizedAverageLogProbability,
      noSpeechProbability: normalizedNoSpeech,
      compressionRatio: Math.max(0, compressionRatio),
    },
  };
}

function buildAlignedContent(alignment: TranscriptionVerbose) {
  const words = (alignment.words ?? [])
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.word.trim())
    .map((word, index) => ({
      id: `word-${index + 1}`,
      segmentId: '',
      startSec: Math.max(0, word.start),
      endSec: Math.max(word.start, word.end),
      text: word.word.trim(),
    }));

  const rawSegments = (alignment.segments ?? [])
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end))
    .map((segment, index): AlignmentSegment => ({
      id: `segment-${index + 1}`,
      startSec: Math.max(0, segment.start),
      endSec: Math.max(segment.start, segment.end),
      text: segment.text.trim(),
      wordIds: [],
      ...segmentConfidence(segment),
    }));

  const segments = rawSegments.length
    ? rawSegments
    : words.length
      ? [{
          id: 'segment-1',
          startSec: words[0].startSec,
          endSec: words[words.length - 1].endSec,
          text: words.map((word) => word.text).join(' '),
          wordIds: [],
        }]
      : [];

  for (const word of words) {
    const segment = segments.find((candidate) => (
      word.startSec <= candidate.endSec + 0.05 && word.endSec >= candidate.startSec - 0.05
    )) ?? segments[segments.length - 1];
    if (segment) {
      word.segmentId = segment.id;
      segment.wordIds.push(word.id);
    }
  }

  return { words, segments };
}

export async function transcribeCompleteAudio(input: {
  audioPath: string;
  hasAudio: boolean;
  expectedLanguage?: string;
  idempotencyKey?: string;
  audioDurationSeconds?: number;
  analysisProfileId?: AnalysisProfileId;
}): Promise<{ transcription: Transcription; metrics: TranscriptionMetrics }> {
  if (!input.hasAudio) {
    return {
      transcription: {
        status: 'unavailable',
        reasonCode: 'no_audio_track',
        reason: 'Aucune piste audio n’est présente dans le fichier.',
      },
      metrics: {
        models: [],
        providerCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        retries: 0,
        durationMs: 0,
        providerDurationMs: 0,
      },
    };
  }

  const client = getVideoOpenAIClient();
  const analysisProfile = input.analysisProfileId
    ? ANALYSIS_PROFILES[input.analysisProfileId]
    : null;
  if (analysisProfile?.singlePassTranscription) {
    const startedAt = Date.now();
    const model = configuredProfileModels(analysisProfile, 'transcription')[0];
    const callKey = input.idempotencyKey
      ? `${input.idempotencyKey}:transcript:${model}`.slice(0, 240)
      : undefined;
    const call = await withProviderRetry(
      () => client.audio.transcriptions.create({
        file: createReadStream(input.audioPath),
        model,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word'],
      }, callKey ? { idempotencyKey: callKey } : undefined),
      {
        ledger: inferProviderLedgerContext({
          idempotencyKey: callKey,
          operation: 'audio.transcriptions.create',
          model,
          fallbackIndex: 0,
          billable: true,
        }),
        usage: (response) => providerUsageFromUnknown(response.usage, input.audioDurationSeconds),
        maxRetries: analysisProfile.maxProviderRetries,
        budgetReservation: callKey ? {
          promptCharacters: 0,
          imageCount: 0,
          maxOutputTokens: 0,
          stage: 'transcription',
          model,
          audioSeconds: input.audioDurationSeconds,
        } : undefined,
      },
    );
    const verbose = call.value as TranscriptionVerbose;
    const aligned = buildAlignedContent(verbose);
    const normalizedText = normalizeTranscriptText(
      verbose.text || aligned.segments.map((segment) => segment.text).join(' '),
    );
    const tokens = usageTokens(verbose.usage);
    const metrics: TranscriptionMetrics = {
      models: [model], providerCalls: 1, inputTokens: tokens.input,
      outputTokens: tokens.output, retries: call.retries,
      durationMs: Date.now() - startedAt, providerDurationMs: call.providerDurationMs,
    };
    if (!normalizedText && aligned.words.length === 0 && aligned.segments.length === 0) {
      return {
        transcription: { status: 'unavailable', reasonCode: 'no_speech_detected', reason: 'Aucune parole exploitable nâ€™a été détectée sur la piste audio.' },
        metrics,
      };
    }
    const rawLanguage = typeof verbose.language === 'string' && verbose.language.trim()
      ? verbose.language.trim().slice(0, 40) : null;
    const languageCode = normalizeDetectedLanguageCode(rawLanguage);
    return {
      transcription: {
        status: 'available', source: 'openai', model,
        timingPrecision: aligned.words.length ? 'word' : aligned.segments.length ? 'segment' : 'none',
        raw: { text: verbose.text, ...(rawLanguage ? { language: rawLanguage } : {}) },
        normalized: {
          text: normalizedText,
          language: languageCode
            ? { status: 'measured', code: languageCode, method: model }
            : { status: 'unavailable', reason: 'Le fournisseur nâ€™a pas renvoyé de langue fiable.' },
          segments: aligned.segments,
          words: aligned.words,
        },
        generatedAt: new Date().toISOString(),
      },
      metrics,
    };
  }
  const config = getVideoAnalysisModelConfig();
  const startedAt = Date.now();
  let primaryText = '';
  let primaryModel = config.transcriptionPrimary;
  let primaryUsage: unknown;
  let primaryConfidenceScore: number | null = null;
  let retries = 0;
  let providerCalls = 0;
  let providerDurationMs = 0;

  const primaryCandidates = [...new Set([
    config.transcriptionPrimary,
    'gpt-4o-mini-transcribe',
    'whisper-1',
  ])];
  let primaryError: unknown;
  for (let candidateIndex = 0; candidateIndex < primaryCandidates.length; candidateIndex += 1) {
    const model = primaryCandidates[candidateIndex];
    try {
      providerCalls += 1;
      const callKey = input.idempotencyKey
        ? `${input.idempotencyKey}:transcript:${model}`.slice(0, 240)
        : undefined;
      const call = await withProviderRetry(
        () => client.audio.transcriptions.create(
          {
            file: createReadStream(input.audioPath),
            model,
            response_format: 'json',
            ...(model === 'whisper-1' ? {} : { chunking_strategy: 'auto' as const, include: ['logprobs' as const] }),
          },
          callKey ? { idempotencyKey: callKey } : undefined,
        ),
        {
          ledger: inferProviderLedgerContext({
            idempotencyKey: callKey,
            operation: 'audio.transcriptions.create',
            model,
            fallbackIndex: candidateIndex,
            billable: true,
          }),
          usage: (response) => providerUsageFromUnknown(response.usage, input.audioDurationSeconds),
        },
      );
      primaryText = call.value.text;
      primaryUsage = call.value.usage;
      primaryConfidenceScore = primaryConfidence(call.value);
      primaryModel = model;
      retries += call.retries;
      providerDurationMs += call.providerDurationMs;
      break;
    } catch (error) {
      rethrowLedgerPersistenceError(error);
      primaryError = error;
    }
  }

  if (!primaryText && primaryError) throw primaryError;

  let alignment: TranscriptionVerbose | null = null;
  let alignmentUsage: unknown;
  let alignmentModel = config.transcriptionAlignment;
  let alignmentError: unknown;
  const alignmentCandidates = [...new Set([config.transcriptionAlignment, 'whisper-1'])];
  for (let candidateIndex = 0; candidateIndex < alignmentCandidates.length; candidateIndex += 1) {
    const model = alignmentCandidates[candidateIndex];
    try {
      providerCalls += 1;
      const callKey = input.idempotencyKey
        ? `${input.idempotencyKey}:alignment:${model}`.slice(0, 240)
        : undefined;
      const call = await withProviderRetry(
        () => client.audio.transcriptions.create(
          {
            file: createReadStream(input.audioPath),
            model,
            response_format: 'verbose_json',
            timestamp_granularities: ['segment', 'word'],
          },
          callKey ? { idempotencyKey: callKey } : undefined,
        ),
        {
          ledger: inferProviderLedgerContext({
            idempotencyKey: callKey,
            operation: 'audio.transcriptions.create',
            model,
            fallbackIndex: candidateIndex,
            billable: true,
          }),
          usage: (response) => providerUsageFromUnknown(response.usage, input.audioDurationSeconds),
        },
      );
      alignment = call.value;
      alignmentUsage = call.value.usage;
      alignmentModel = model;
      retries += call.retries;
      providerDurationMs += call.providerDurationMs;
      break;
    } catch (error) {
      rethrowLedgerPersistenceError(error);
      alignmentError = error;
    }
  }
  if (!alignment) throw alignmentError ?? new Error('TRANSCRIPTION_ALIGNMENT_UNAVAILABLE');

  const primaryTokens = usageTokens(primaryUsage);
  const alignmentTokens = usageTokens(alignmentUsage);

  const aligned = buildAlignedContent(alignment);
  const normalizedPrimary = normalizeTranscriptText(primaryText);
  const normalizedAligned = normalizeTranscriptText(
    alignment.text || aligned.segments.map((segment) => segment.text).join(' '),
  );
  // The normalized transcript is the same provider output that owns the word
  // and segment timestamps. The higher-quality independent transcript remains
  // preserved verbatim in raw.text, but is never presented as if its wording
  // had those timestamps.
  const normalizedText = normalizedAligned || normalizedPrimary;
  if (!normalizedText && aligned.words.length === 0 && aligned.segments.length === 0) {
    return {
      transcription: {
        status: 'unavailable',
        reasonCode: 'no_speech_detected',
        reason: 'Aucune parole exploitable n’a été détectée sur la piste audio.',
      },
      metrics: {
        models: [...new Set([primaryModel, alignmentModel])],
        providerCalls,
        inputTokens: primaryTokens.input + alignmentTokens.input,
        outputTokens: primaryTokens.output + alignmentTokens.output,
        retries,
        durationMs: Date.now() - startedAt,
        providerDurationMs,
      },
    };
  }

  const rawLanguage = typeof alignment.language === 'string' && alignment.language.trim()
    ? alignment.language.trim().slice(0, 40)
    : null;
  const languageCode = normalizeDetectedLanguageCode(rawLanguage);

  return {
    transcription: {
      status: 'available',
      source: 'openai',
      model: [...new Set([primaryModel, alignmentModel])].join(' + '),
      timingPrecision: aligned.words.length ? 'word' : aligned.segments.length ? 'segment' : 'none',
      raw: {
        text: primaryText || alignment.text,
        ...(rawLanguage ? { language: rawLanguage } : {}),
        ...(primaryConfidenceScore === null ? {} : {
          confidence: primaryConfidenceScore,
          confidenceMethod: 'Moyenne de exp(logprob) sur les tokens du transcripteur principal',
        }),
      },
      normalized: {
        text: normalizedText,
        language: languageCode
          ? { status: 'measured', code: languageCode, method: alignmentModel }
          : { status: 'unavailable', reason: 'Le fournisseur n’a pas renvoyé de langue fiable.' },
        segments: aligned.segments,
        words: aligned.words,
      },
      generatedAt: new Date().toISOString(),
    },
    metrics: {
      models: [...new Set([primaryModel, alignmentModel])],
      providerCalls,
      inputTokens: primaryTokens.input + alignmentTokens.input,
      outputTokens: primaryTokens.output + alignmentTokens.output,
      retries,
      durationMs: Date.now() - startedAt,
      providerDurationMs,
    },
  };
}
