import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildDeterministicEvidence } from '@/lib/video-analysis/evidence';
import type { AnalysisArtifactRow } from '@/lib/video-analysis/artifacts';
import type { AnalysisJobRow } from '@/lib/video-analysis/types';

const NOW = '2026-07-13T20:00:00.000Z';

function measured<T>(value: T) {
  return { availability: 'measured' as const, value, method: 'fixture déterministe' };
}

function jobFixture(): AnalysisJobRow {
  return {
    id: 'job-evidence-fixture',
    user_id: 'user-evidence-fixture',
    idempotency_key: 'evidence-fixture',
    status: 'validation',
    progress: 90,
    current_step: 'validation',
    storage_bucket: 'analysis-uploads',
    storage_path: 'user-evidence-fixture/job-evidence-fixture/input.mp4',
    original_file_name: 'fixture.mp4',
    content_type: 'video/mp4',
    size_bytes: 1_024,
    creator_context: {
      objective: 'retention',
      platform: 'tiktok',
      niche: 'Montage vidéo',
      audience: 'Créateurs débutants',
      audienceKnowledge: 'beginner',
      format: 'facecam',
      tone: 'direct',
      language: 'fr',
      memoryConsent: false,
    },
    source_metadata: { durationSeconds: 10, hasAudio: false },
    probe: {
      durationSec: 10,
      displayWidth: 1_080,
      displayHeight: 1_920,
      fps: 30,
      bitrate: 1_000_000,
      container: 'mp4',
      videoCodec: 'h264',
      hasAudio: false,
    },
    transcript: {
      status: 'unavailable',
      reasonCode: 'no_audio_track',
      reason: 'La fixture ne contient aucune piste audio.',
    },
    technical_signals: {
      sceneCuts: measured([{ timestamp: 4, score: 0.8 }]),
      cutDensityPerMinute: measured(6),
      blackIntervals: measured([]),
      freezeIntervals: measured([]),
      brightness: measured({ meanLuma: 104, standardDeviation: 18 }),
      audio: {},
    },
    cost_metrics: {},
    workflow_run_id: 'run-evidence-fixture',
    analysis_id: null,
    quota_state: 'reserved',
    quota_used: 1,
    quota_limit: 10,
    attempts: 1,
    error_code: null,
    error_message: null,
    created_at: NOW,
    upload_completed_at: NOW,
    quota_reserved_at: NOW,
    quota_period_started_at: NOW,
    cleanup_pending: true,
    started_at: NOW,
    completed_at: null,
    failed_at: null,
    updated_at: NOW,
  };
}

function frameFixture(): AnalysisArtifactRow {
  return {
    id: 'frame-evidence-fixture',
    job_id: 'job-evidence-fixture',
    user_id: 'user-evidence-fixture',
    kind: 'frame',
    storage_bucket: 'analysis-artifacts',
    storage_path: 'user-evidence-fixture/job-evidence-fixture/frames/0001.jpg',
    start_time: 0,
    end_time: 0,
    metadata: { width: 720, height: 1_280, samplingReason: 'opening' },
    created_at: NOW,
  };
}

describe('deterministic evidence identity', () => {
  it('keeps every measured signal ID unique after deriving related metrics', () => {
    const evidence = buildDeterministicEvidence(jobFixture(), [frameFixture()]);
    const measuredIds = [
      ...Object.values(evidence.audioSignals),
      ...Object.values(evidence.visualSignals),
    ].flatMap((signal) => (
      signal && typeof signal === 'object' && 'status' in signal && signal.status === 'measured' && 'id' in signal
        ? [String(signal.id)]
        : []
    ));

    expect(measuredIds).toContain('signal-visual-scene-count');
    expect(measuredIds).toContain('signal-visual-cut-density');
    expect(measuredIds).toContain('signal-visual-brightness-mean');
    expect(measuredIds).toContain('signal-visual-brightness-variation');
    expect(new Set(measuredIds).size).toBe(measuredIds.length);
  });

  it('mesure réellement la dynamique audio du mix sur les plages parlées et non parlées', () => {
    const job = jobFixture();
    job.source_metadata = { durationSeconds: 10, hasAudio: true };
    job.probe = {
      ...(job.probe && typeof job.probe === 'object' ? job.probe : {}),
      hasAudio: true,
      audioCodec: 'aac',
    };
    job.transcript = {
      status: 'available',
      source: 'openai',
      model: 'whisper-1',
      timingPrecision: 'word',
      raw: { text: 'Voici une preuve audio', language: 'fr' },
      normalized: {
        text: 'Voici une preuve audio',
        language: { status: 'measured', code: 'fr', method: 'provider' },
        segments: [{
          id: 'segment-audio-1',
          startSec: 0,
          endSec: 2,
          text: 'Voici une preuve audio',
          wordIds: ['word-audio-1'],
        }],
        words: [{
          id: 'word-audio-1',
          segmentId: 'segment-audio-1',
          startSec: 0,
          endSec: 1,
          text: 'Voici',
        }],
      },
      generatedAt: NOW,
    };
    job.technical_signals = {
      ...(job.technical_signals && typeof job.technical_signals === 'object'
        ? job.technical_signals
        : {}),
      audio: {
        silenceIntervals: measured([]),
        initialSilenceDurationSec: measured(0),
        meanVolumeDb: measured(-18),
        peakVolumeDb: measured(-0.1),
        loudnessSamples: measured([
          { timestampSec: 0.5, momentaryLufs: -22 },
          { timestampSec: 1, momentaryLufs: -16 },
          { timestampSec: 1.5, momentaryLufs: -20 },
          { timestampSec: 4, momentaryLufs: -30 },
          { timestampSec: 5, momentaryLufs: -32 },
          { timestampSec: 6, momentaryLufs: -31 },
        ]),
      },
    };

    const audio = buildDeterministicEvidence(job, [frameFixture()]).audioSignals;
    expect(audio.speechWindowLoudnessVariation).toMatchObject({
      status: 'measured',
      unit: 'LUFS_stddev',
    });
    expect(audio.nonSpeechLoudness).toMatchObject({
      status: 'measured',
      value: -31,
      unit: 'LUFS_momentary_mean',
    });
    expect(audio.saturationRisk).toMatchObject({ status: 'measured', value: 'possible' });
    expect(audio.backgroundNoise).toMatchObject({ status: 'measured', value: 'possible' });
    expect(audio.vocalEnergyVariation).toMatchObject({ status: 'measured' });
    expect(audio.speakingRateWpm).toMatchObject({
      status: 'measured',
      value: 120,
      unit: 'words_per_minute',
    });
    expect(audio.averageSentenceLengthWords).toMatchObject({ status: 'measured', value: 4 });
    expect(audio.wordDensityPerSecond).toMatchObject({ status: 'measured', value: 0.4 });
    expect(audio.repeatedPhraseCount).toMatchObject({ status: 'measured', value: 0 });
    expect(audio.hesitationCount).toMatchObject({ status: 'measured', value: 0 });
    expect(JSON.stringify(audio)).toMatch(/ne (?:prouve|sépare) pas/iu);
  });
});
