import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('workflow', () => ({
  FatalError: class FatalError extends Error {},
}));
vi.mock('@/lib/video-analysis/artifacts', () => ({ listJobArtifacts: vi.fn() }));
vi.mock('@/lib/video-analysis/jobs', () => ({
  getAnalysisJobForWorkflow: vi.fn(),
  updateJobStage: vi.fn(),
}));
vi.mock('@/lib/video-analysis/openai-client', () => ({ parseStructuredResponse: vi.fn() }));

import type { SpecialistDiagnostic } from '@/lib/analysis-engine/index';
import type { AnalysisArtifactRow } from '@/lib/video-analysis/artifacts';
import { TECHNICAL_EVIDENCE_IDS } from '@/lib/video-analysis/grounding';
import {
  buildSpecialistPromptContext,
  validateSpecialistDiagnostic,
  validateSpecialistDiagnosticOrUnavailable,
  type SpecialistName,
  type SpecialistPromptContext,
} from '@/lib/video-analysis/specialists';
import type { AnalysisJobRow } from '@/lib/video-analysis/types';

const NOW = '2026-07-14T10:00:00.000Z';
const DURATION_SEC = 60;

function measured<T>(value: T) {
  return { availability: 'measured' as const, value, method: 'fixture deterministe' };
}

function transcriptFixture() {
  const segments = Array.from({ length: 100 }, (_, index) => ({
    id: `segment-${index.toString().padStart(3, '0')}`,
    startSec: index * 0.6,
    endSec: (index + 1) * 0.6,
    text: `Phrase exacte ${index}`,
    wordIds: [`word-${index.toString().padStart(3, '0')}`],
  }));
  const words = segments.map((segment, index) => ({
    id: segment.wordIds[0],
    segmentId: segment.id,
    startSec: segment.startSec + 0.05,
    endSec: segment.endSec - 0.05,
    text: `mot${index}`,
  }));
  return {
    status: 'available' as const,
    raw: { text: segments.map((segment) => segment.text).join(' '), language: 'fr' },
    normalized: {
      text: segments.map((segment) => segment.text).join(' '),
      language: { status: 'measured', code: 'fr', method: 'fixture' },
      segments,
      words,
    },
  };
}

function jobFixture(): AnalysisJobRow {
  return {
    id: 'job-specialist-scope',
    user_id: 'user-specialist-scope',
    idempotency_key: 'specialist-scope',
    status: 'audio_analysis',
    progress: 63,
    current_step: 'audio_analysis',
    storage_bucket: 'analysis-uploads',
    storage_path: 'user-specialist-scope/job-specialist-scope/input.mp4',
    original_file_name: 'fixture.mp4',
    content_type: 'video/mp4',
    size_bytes: 1_024,
    creator_context: { objective: 'views', language: 'fr' },
    source_metadata: { durationSeconds: DURATION_SEC, hasAudio: true },
    probe: { durationSec: DURATION_SEC, hasAudio: true },
    transcript: transcriptFixture(),
    technical_signals: {
      sceneCuts: measured([{ timestamp: 10, score: 0.92 }]),
      cutDensityPerMinute: measured(1),
      blackIntervals: measured([]),
      freezeIntervals: measured([]),
      brightness: measured({ meanLuma: 100, standardDeviation: 12 }),
      audio: {
        silenceIntervals: measured([{ startTimeSec: 20, endTimeSec: 21 }]),
        initialSilenceDurationSec: measured(0.8),
        meanVolumeDb: measured(-18),
        peakVolumeDb: measured(-2),
        loudnessSamples: measured([{ timestampSec: 30, momentaryLufs: -16 }]),
      },
    },
    cost_metrics: {},
    workflow_run_id: 'run-specialist-scope',
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

function frameFixtures(): AnalysisArtifactRow[] {
  return Array.from({ length: 50 }, (_, index) => ({
    id: `frame-${index.toString().padStart(3, '0')}`,
    job_id: 'job-specialist-scope',
    user_id: 'user-specialist-scope',
    kind: 'frame' as const,
    storage_bucket: 'analysis-evidence',
    storage_path: `user-specialist-scope/job-specialist-scope/frames/${index}.jpg`,
    start_time: index,
    end_time: index,
    metadata: {
      samplingReason: index === 0 ? 'opening' : 'adaptive_interval',
      visualObservation: { summary: `Frame ${index}` },
    },
    created_at: NOW,
  }));
}

function diagnostic(input: {
  specialist?: SpecialistName;
  evidenceRefs: string[];
  timeRange: { startSec: number; endSec: number } | null;
}): SpecialistDiagnostic {
  const specialist = input.specialist ?? 'editing';
  return {
    id: `specialist-${specialist}`,
    specialist,
    summary: 'Diagnostic fonde uniquement sur la vue bornee.',
    findings: [{
      id: 'finding-visible-scope',
      claim: 'Une observation temporelle est visible.',
      implication: 'La decision doit rester liee a cette observation.',
      decision: 'Appliquer la correction uniquement a cet instant.',
      severity: 'medium',
      confidence: 'high',
      timeRange: input.timeRange,
      evidenceRefs: input.evidenceRefs,
    }],
    limitations: [],
  };
}

function validate(view: SpecialistPromptContext, value: SpecialistDiagnostic) {
  return validateSpecialistDiagnostic({
    diagnostic: value,
    specialist: value.specialist,
    evidenceScope: view.evidenceScope,
    durationSec: DURATION_SEC,
  });
}

describe('cloisonnement des preuves des specialistes', () => {
  it('rejette un ID canonique connu mais omis de la vue distribuee', () => {
    const frames = frameFixtures();
    const job = jobFixture();
    const editingView = buildSpecialistPromptContext({ specialist: 'editing', job, frames });
    const omittedFrame = frames.find((frame) => !editingView.evidenceIds.includes(frame.id));
    expect(omittedFrame).toBeDefined();
    expect(editingView.evidenceIds.filter((id) => id.startsWith('frame-'))).toHaveLength(20);

    expect(() => validate(editingView, diagnostic({
      evidenceRefs: [omittedFrame!.id],
      timeRange: { startSec: omittedFrame!.start_time, endSec: omittedFrame!.end_time },
    }))).toThrowError('SPECIALIST_EVIDENCE_NOT_VISIBLE');

    const scriptView = buildSpecialistPromptContext({ specialist: 'script', job, frames });
    const segments = transcriptFixture().normalized.segments;
    const omittedSegment = segments.find((segment) => !scriptView.evidenceIds.includes(segment.id));
    expect(omittedSegment).toBeDefined();
    expect(scriptView.evidenceIds.filter((id) => id.startsWith('segment-'))).toHaveLength(28);
    expect(() => validate(scriptView, diagnostic({
      specialist: 'script',
      evidenceRefs: [omittedSegment!.id],
      timeRange: { startSec: omittedSegment!.startSec, endSec: omittedSegment!.endSec },
    }))).toThrowError('SPECIALIST_EVIDENCE_NOT_VISIBLE');
  });

  it('rejette une plage hors de la preuve visible et exige une plage pour une frame', () => {
    const view = buildSpecialistPromptContext({
      specialist: 'editing',
      job: jobFixture(),
      frames: frameFixtures(),
    });
    const visibleFrameId = view.evidenceIds.find((id) => id.startsWith('frame-'))!;
    const timestamp = Number(visibleFrameId.slice('frame-'.length));

    expect(() => validate(view, diagnostic({
      evidenceRefs: [visibleFrameId],
      timeRange: { startSec: 55, endSec: 56 },
    }))).toThrowError('SPECIALIST_TIMESTAMP_WITHOUT_VISIBLE_EVIDENCE');
    expect(() => validate(view, diagnostic({
      evidenceRefs: [visibleFrameId],
      timeRange: null,
    }))).toThrowError('SPECIALIST_TIMESTAMP_REQUIRED_FOR_VISIBLE_EVIDENCE');
    expect(validate(view, diagnostic({
      evidenceRefs: [visibleFrameId],
      timeRange: { startSec: timestamp, endSec: timestamp + 0.02 },
    }))).toBeTruthy();
  });

  it('ecarte un diagnostic fournisseur non ancre sans faire echouer le pipeline', () => {
    const view = buildSpecialistPromptContext({
      specialist: 'editing',
      job: jobFixture(),
      frames: frameFixtures(),
    });
    const invalid = diagnostic({
      evidenceRefs: ['preuve-inventee-par-le-fournisseur'],
      timeRange: { startSec: 10, endSec: 11 },
    });

    const result = validateSpecialistDiagnosticOrUnavailable({
      diagnostic: invalid,
      specialist: 'editing',
      evidenceScope: view.evidenceScope,
      durationSec: DURATION_SEC,
    });

    expect(result).toMatchObject({
      id: 'specialist-editing',
      specialist: 'editing',
      findings: [],
    });
    expect(result.limitations).toContain(
      'Diagnostic spécialiste écarté car ses preuves ne correspondent pas aux signaux mesurés.',
    );
  });

  it('borne les preuves techniques temporelles et reserve les agregats aux constats globaux', () => {
    const view = buildSpecialistPromptContext({
      specialist: 'editing',
      job: jobFixture(),
      frames: frameFixtures(),
    });
    expect(view.evidenceIds).toContain(TECHNICAL_EVIDENCE_IDS.sceneCutCount);
    expect(view.evidenceIds).toContain(TECHNICAL_EVIDENCE_IDS.cutsPerMinute);

    expect(() => validate(view, diagnostic({
      evidenceRefs: [TECHNICAL_EVIDENCE_IDS.sceneCutCount],
      timeRange: { startSec: 40, endSec: 41 },
    }))).toThrowError('SPECIALIST_TIMESTAMP_WITHOUT_VISIBLE_EVIDENCE');
    expect(validate(view, diagnostic({
      evidenceRefs: [TECHNICAL_EVIDENCE_IDS.sceneCutCount],
      timeRange: { startSec: 9.95, endSec: 10.05 },
    }))).toBeTruthy();
    expect(() => validate(view, diagnostic({
      evidenceRefs: [TECHNICAL_EVIDENCE_IDS.cutsPerMinute],
      timeRange: { startSec: 20, endSec: 21 },
    }))).toThrowError('SPECIALIST_TIMESTAMP_WITHOUT_VISIBLE_EVIDENCE');
    expect(validate(view, diagnostic({
      evidenceRefs: [TECHNICAL_EVIDENCE_IDS.cutsPerMinute],
      timeRange: { startSec: 0, endSec: DURATION_SEC },
    }))).toBeTruthy();
  });

  it('ne valide pas un evenement technique canonique retire par le sampling du prompt', () => {
    const job = jobFixture();
    const signals = job.technical_signals as Record<string, unknown>;
    const canonicalCuts = Array.from({ length: 300 }, (_, index) => ({
      timestamp: index * 0.2,
      score: 0.5 + ((index % 10) / 20),
    }));
    job.technical_signals = { ...signals, sceneCuts: measured(canonicalCuts) };
    const view = buildSpecialistPromptContext({
      specialist: 'editing',
      job,
      frames: frameFixtures(),
    });
    const visibleCutRanges = view.evidenceScope.temporalRanges.get(
      TECHNICAL_EVIDENCE_IDS.sceneCutCount,
    ) ?? [];
    expect(visibleCutRanges.length).toBeLessThan(canonicalCuts.length);
    const omittedCut = canonicalCuts.find((cut) => !visibleCutRanges.some((range) => (
      Math.abs(range.startSec - cut.timestamp) <= 0.05
    )));
    expect(omittedCut).toBeDefined();

    expect(() => validate(view, diagnostic({
      evidenceRefs: [TECHNICAL_EVIDENCE_IDS.sceneCutCount],
      timeRange: { startSec: omittedCut!.timestamp, endSec: omittedCut!.timestamp },
    }))).toThrowError('SPECIALIST_TIMESTAMP_WITHOUT_VISIBLE_EVIDENCE');
  });
});
