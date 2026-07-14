import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetryableError } from 'workflow';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  withProviderRetry: vi.fn(),
  alignmentModel: 'whisper-1',
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/video-analysis/config', () => ({
  getVideoAnalysisModelConfig: () => ({
    transcriptionPrimary: 'gpt-4o-transcribe',
    transcriptionAlignment: mocks.alignmentModel,
  }),
}));
vi.mock('@/lib/video-analysis/provider-ledger', () => ({
  inferProviderLedgerContext: () => null,
  providerUsageFromUnknown: () => ({
    kind: 'unknown',
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    audioSeconds: null,
  }),
}));
vi.mock('@/lib/video-analysis/openai-client', () => ({
  getVideoOpenAIClient: () => ({
    audio: { transcriptions: { create: mocks.create } },
  }),
  withProviderRetry: mocks.withProviderRetry,
}));

import { transcribeCompleteAudio } from '@/lib/video-analysis/transcription';

describe('complete timestamped transcription', () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.withProviderRetry.mockReset();
    mocks.withProviderRetry.mockImplementation(async (operation: () => Promise<unknown>) => ({
      value: await operation(),
      retries: 0,
      providerDurationMs: 1,
    }));
    mocks.alignmentModel = 'whisper-1';
  });

  it('keeps the primary transcript raw but makes the timestamped alignment canonical', async () => {
    mocks.create
      .mockResolvedValueOnce({
        text: 'Texte primaire indépendant, volontairement différent.',
        logprobs: [
          { token: 'Texte', logprob: -0.1 },
          { token: ' primaire', logprob: -0.2 },
        ],
        usage: { input_tokens: 10, output_tokens: 8 },
      })
      .mockResolvedValueOnce({
        text: 'Bonjour, then switch to English.',
        language: 'english',
        duration: 3,
        segments: [
          { start: 0, end: 1.2, text: 'Bonjour,', avg_logprob: -0.1, no_speech_prob: 0.02, compression_ratio: 1.1 },
          { start: 1.2, end: 3, text: 'then switch to English.', avg_logprob: -1.4, no_speech_prob: 0.2, compression_ratio: 2.6 },
        ],
        words: [
          { start: 0, end: 0.7, word: 'Bonjour' },
          { start: 1.2, end: 1.5, word: 'then' },
          { start: 1.5, end: 1.9, word: 'switch' },
          { start: 1.9, end: 2.1, word: 'to' },
          { start: 2.1, end: 2.8, word: 'English' },
        ],
        usage: { input_tokens: 9, output_tokens: 7 },
      });

    const result = await transcribeCompleteAudio({
      audioPath: 'package.json',
      hasAudio: true,
      expectedLanguage: 'fr',
      audioDurationSeconds: 3,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    });

    expect(result.transcription.status).toBe('available');
    if (result.transcription.status !== 'available') return;
    expect(result.transcription.raw.text).toBe('Texte primaire indépendant, volontairement différent.');
    expect(result.transcription.normalized.text).toBe('Bonjour, then switch to English.');
    expect(result.transcription.normalized.segments.map((segment) => segment.text)).toEqual([
      'Bonjour,',
      'then switch to English.',
    ]);
    expect(result.transcription.raw).toMatchObject({
      confidenceMethod: expect.stringContaining('exp(logprob)'),
    });
    expect(result.transcription.normalized.segments[0]).toMatchObject({
      uncertainty: 'low',
      providerSignals: {
        averageLogProbability: -0.1,
        noSpeechProbability: 0.02,
        compressionRatio: 1.1,
      },
    });
    expect(result.transcription.normalized.segments[1]).toMatchObject({ uncertainty: 'high' });
    expect(result.transcription.normalized.words.at(-1)).toMatchObject({
      text: 'English',
      startSec: 2.1,
      endSec: 2.8,
    });

    const alignmentPayload = mocks.create.mock.calls[1][0] as Record<string, unknown>;
    expect(alignmentPayload).not.toHaveProperty('language');
    expect(alignmentPayload).toMatchObject({
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    });
  });

  it('falls back to Whisper when the configured alignment model fails', async () => {
    mocks.alignmentModel = 'custom-aligner';
    mocks.create
      .mockResolvedValueOnce({ text: 'Parole primaire.', usage: {} })
      .mockRejectedValueOnce(new Error('model does not support verbose_json'))
      .mockResolvedValueOnce({
        text: 'Parole primaire.',
        language: 'french',
        segments: [{
          start: 0,
          end: 1,
          text: 'Parole primaire.',
          avg_logprob: -0.2,
          no_speech_prob: 0.01,
          compression_ratio: 1,
        }],
        words: [
          { start: 0, end: 0.4, word: 'Parole' },
          { start: 0.4, end: 1, word: 'primaire' },
        ],
        usage: {},
      });

    const result = await transcribeCompleteAudio({
      audioPath: 'package.json',
      hasAudio: true,
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    });

    expect(result.transcription.status).toBe('available');
    expect(result.metrics.providerCalls).toBe(3);
    expect(mocks.create.mock.calls[1][0]).toMatchObject({ model: 'custom-aligner' });
    expect(mocks.create.mock.calls[2][0]).toMatchObject({ model: 'whisper-1' });
  });

  it('propage une lease rejouable sans essayer de fallback transcription payant', async () => {
    mocks.withProviderRetry.mockRejectedValueOnce(
      new RetryableError('PROVIDER_ATTEMPT_LEASE_ACTIVE', { retryAfter: '2s' }),
    );

    const error = await transcribeCompleteAudio({
      audioPath: 'package.json',
      hasAudio: true,
      idempotencyKey: '00000000-0000-4000-8000-000000000003',
    }).then(() => null, (reason: unknown) => reason);

    expect(RetryableError.is(error)).toBe(true);
    expect(mocks.withProviderRetry).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
