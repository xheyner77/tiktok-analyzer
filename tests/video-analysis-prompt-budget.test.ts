import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/video-analysis/artifacts', () => ({ listJobArtifacts: vi.fn() }));
vi.mock('@/lib/video-analysis/jobs', () => ({
  getAnalysisJobForWorkflow: vi.fn(),
  updateJobStage: vi.fn(),
}));

import type { AnalysisCritique, SpecialistDiagnostic, TimelineSegment } from '@/lib/analysis-engine/index';
import type { DeterministicEvidenceBundle } from '@/lib/video-analysis/evidence';
import {
  SPECIALIST_PROMPT_MAX_CHARACTERS,
  SYNTHESIS_PROMPT_MAX_CHARACTERS,
  buildDistributedTemporalPromptView,
  buildTranscriptPromptView,
  compactPromptText,
} from '@/lib/video-analysis/grounding';
import {
  buildSpecialistPrompt,
  type SpecialistName,
} from '@/lib/video-analysis/specialists';
import {
  buildCritiquePrompt,
  buildSynthesisPrompt,
  type CritiqueAndSynthesisInput,
} from '@/lib/video-analysis/synthesis';

const DURATION_SEC = 600;
const SEGMENT_COUNT = 100;
const WORDS_PER_SEGMENT = 18;
const FRAME_COUNT = 72;
const NOW = '2026-07-13T20:00:00.000Z';
const SPECIALISTS: readonly SpecialistName[] = [
  'hook',
  'script',
  'audio',
  'editing',
  'storytelling',
  'visual_text',
  'cta',
];

function unavailable(reason: string) {
  return {
    status: 'unavailable' as const,
    reasonCode: 'not_measurable' as const,
    reason,
  };
}

function denseTranscript() {
  const words = Array.from({ length: SEGMENT_COUNT * WORDS_PER_SEGMENT }, (_, wordIndex) => {
    const segmentIndex = Math.floor(wordIndex / WORDS_PER_SEGMENT);
    const position = wordIndex % WORDS_PER_SEGMENT;
    const segmentStartSec = segmentIndex * (DURATION_SEC / SEGMENT_COUNT);
    const wordDuration = (DURATION_SEC / SEGMENT_COUNT) / WORDS_PER_SEGMENT;
    return {
      id: `word-${wordIndex.toString().padStart(4, '0')}`,
      segmentId: `segment-${segmentIndex.toString().padStart(3, '0')}`,
      startSec: segmentStartSec + (position * wordDuration),
      endSec: segmentStartSec + ((position + 1) * wordDuration),
      text: `mot${wordIndex.toString().padStart(4, '0')}`,
    };
  });
  const segments = Array.from({ length: SEGMENT_COUNT }, (_, segmentIndex) => {
    const segmentWords = words.slice(
      segmentIndex * WORDS_PER_SEGMENT,
      (segmentIndex + 1) * WORDS_PER_SEGMENT,
    );
    return {
      id: `segment-${segmentIndex.toString().padStart(3, '0')}`,
      startSec: segmentIndex * (DURATION_SEC / SEGMENT_COUNT),
      endSec: (segmentIndex + 1) * (DURATION_SEC / SEGMENT_COUNT),
      text: segmentWords.map((word) => word.text).join(' '),
      wordIds: segmentWords.map((word) => word.id),
    };
  });
  return {
    status: 'available' as const,
    text: segments.map((segment) => segment.text).join(' '),
    segments,
    words,
  };
}

function denseEvidence(transcript: ReturnType<typeof denseTranscript>): DeterministicEvidenceBundle {
  return {
    creatorContext: {
      version: 'creator-context-v1',
      objective: 'views',
      platform: 'tiktok',
      niche: 'Montage video pedagogique',
      audience: 'Createurs qui preparent une V2',
      audienceKnowledge: 'intermediate',
      format: 'facecam',
      tone: 'Direct et concret',
      language: 'fr',
      memoryConsent: true,
    },
    video: {
      version: 'video-metadata-v1',
      fileName: 'dense-600s.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: 80_000_000,
      durationSec: DURATION_SEC,
      width: 1080,
      height: 1920,
      framesPerSecond: 30,
      container: 'mp4',
      videoCodec: 'h264',
      audioTrack: { status: 'present', codec: 'aac' },
      probedAt: NOW,
    },
    frames: Array.from({ length: FRAME_COUNT }, (_, index) => ({
      id: `frame-${index.toString().padStart(3, '0')}`,
      timestampSec: (index * DURATION_SEC) / (FRAME_COUNT - 1),
      artifactRef: `artifact:frame-${index.toString().padStart(3, '0')}`,
      width: 540,
      height: 960,
      samplingReason: index === 0
        ? 'opening' as const
        : index === FRAME_COUNT - 1
          ? 'ending' as const
          : 'adaptive_interval' as const,
      ocr: {
        status: 'observed' as const,
        text: `Texte visuel exact de la frame ${index.toString().padStart(3, '0')}`,
        confidence: 'high' as const,
        method: 'Fixture vision dense',
      },
    })),
    transcription: {
      status: 'available',
      source: 'openai',
      model: 'fixture-transcriber',
      timingPrecision: 'word',
      raw: { text: transcript.text, language: 'fr' },
      normalized: {
        text: transcript.text,
        language: { status: 'measured', code: 'fr', method: 'fixture' },
        segments: transcript.segments,
        words: transcript.words,
      },
      generatedAt: NOW,
    },
    audioSignals: {
      version: 'audio-signals-v1',
      integratedLoudness: unavailable('Non mesure dans la fixture de budget.'),
      truePeak: unavailable('Non mesure dans la fixture de budget.'),
      meanVolumeDb: unavailable('Non mesure dans la fixture de budget.'),
      peakVolumeDb: unavailable('Non mesure dans la fixture de budget.'),
      silenceRatio: unavailable('Non mesure dans la fixture de budget.'),
      speechRatio: unavailable('Non mesure dans la fixture de budget.'),
      speakingRateWpm: unavailable('Non mesure dans la fixture de budget.'),
      averageSentenceLengthWords: unavailable('Non mesure dans la fixture de budget.'),
      wordDensityPerSecond: unavailable('Non mesure dans la fixture de budget.'),
      repeatedPhraseCount: unavailable('Non mesure dans la fixture de budget.'),
      hesitationCount: unavailable('Non mesure dans la fixture de budget.'),
      pauseIntervals: unavailable('Non mesure dans la fixture de budget.'),
      voiceMusicBalance: unavailable('Non mesure dans la fixture de budget.'),
    },
    visualSignals: {
      version: 'visual-signals-v1',
      averageLuma: unavailable('Non mesure dans la fixture de budget.'),
      brightnessVariation: unavailable('Non mesure dans la fixture de budget.'),
      blackFrameRatio: unavailable('Non mesure dans la fixture de budget.'),
      freezeRatio: unavailable('Non mesure dans la fixture de budget.'),
      sceneCutCount: unavailable('Non mesure dans la fixture de budget.'),
      cutsPerMinute: unavailable('Non mesure dans la fixture de budget.'),
      motionIntensity: unavailable('Non mesure dans la fixture de budget.'),
      textCoverageRatio: unavailable('Non mesure dans la fixture de budget.'),
      facePresenceRatio: unavailable('Non mesure dans la fixture de budget.'),
    },
    observedMetrics: { status: 'unavailable', reason: 'Aucune metrique plateforme.' },
    retention: { status: 'unavailable', reason: 'Aucune courbe de retention.' },
  };
}

function denseSpecialists(): SpecialistDiagnostic[] {
  return SPECIALISTS.map((specialist, specialistIndex) => ({
    id: `specialist-${specialist}`,
    specialist,
    summary: `Diagnostic dense ${specialist} relie aux observations temporelles visibles.`,
    findings: Array.from({ length: 18 }, (_, findingIndex) => {
      const segmentIndex = Math.min(
        SEGMENT_COUNT - 1,
        Math.round((findingIndex * (SEGMENT_COUNT - 1)) / 17),
      );
      return {
        id: `finding-${specialist}-${findingIndex.toString().padStart(2, '0')}`,
        claim: `Observation ${findingIndex} du specialiste ${specialist}.`,
        implication: `Cette observation precise le diagnostic ${specialist} sans inventer de performance.`,
        decision: `Tester la decision ${findingIndex} sur la V2 avec un exemple concret.`,
        severity: findingIndex % 3 === 0 ? 'high' as const : 'medium' as const,
        confidence: 'high' as const,
        timeRange: {
          startSec: segmentIndex * (DURATION_SEC / SEGMENT_COUNT),
          endSec: (segmentIndex + 1) * (DURATION_SEC / SEGMENT_COUNT),
        },
        evidenceRefs: [
          `segment-${segmentIndex.toString().padStart(3, '0')}`,
          `frame-${Math.min(FRAME_COUNT - 1, specialistIndex * 10).toString().padStart(3, '0')}`,
        ],
      };
    }),
    limitations: ['Aucune performance future ne peut etre deduite de cette fixture.'],
  }));
}

function denseTimeline(transcript: ReturnType<typeof denseTranscript>): TimelineSegment[] {
  return transcript.segments.map((segment, index) => {
    const frameIndex = Math.round((index * (FRAME_COUNT - 1)) / (SEGMENT_COUNT - 1));
    const quote = segment.text.split(' ').slice(0, 6).join(' ');
    const evidence = [segment.id, `frame-${frameIndex.toString().padStart(3, '0')}`];
    return {
      id: `timeline-${index.toString().padStart(3, '0')}`,
      startTime: segment.startSec,
      endTime: segment.endSec,
      transcript: { status: 'available', text: segment.text, evidence: [segment.id] },
      visualObservation: {
        status: 'available',
        text: `Composition observee sur la frame ${frameIndex.toString().padStart(3, '0')}.`,
        evidence: [evidence[1]],
      },
      audioObservation: {
        status: 'available',
        text: 'La parole est presente dans ce segment horodate.',
        evidence: [segment.id],
      },
      editingObservation: {
        status: 'available',
        text: 'Le segment conserve une unite de montage mesurable.',
        evidence,
      },
      narrativeFunction: index === 0 ? 'hook' : index === SEGMENT_COUNT - 1 ? 'cta' : 'explanation',
      observation: `Le segment ${index} contient une phrase et une frame identifiees.`,
      diagnostic: `Le role du segment ${index} est explicite dans la progression de 600 secondes.`,
      action: `Conserver ou reecrire le segment ${index} selon la preuve citee.`,
      objective: 'views',
      objectiveFit: 'La decision reste alignee sur la clarte de la proposition pour les vues.',
      example: `Version V2 exacte du segment ${index} avec sa preuve avancee.`,
      transcriptCitation: { status: 'available', segmentId: segment.id, quote },
      nature: 'mixed',
      strengths: ['Le segment est horodate.'],
      problems: index % 4 === 0 ? ['La preuve peut etre avancee.'] : [],
      recommendedAction: `Appliquer la decision de montage ${index} a ce timeRange.`,
      evidence,
      confidence: 'high',
    };
  });
}

function denseRequest(): CritiqueAndSynthesisInput {
  const transcript = denseTranscript();
  return {
    jobId: 'job-dense-600s',
    analysisId: 'analysis-dense-600s',
    generatedAt: NOW,
    evidence: denseEvidence(transcript),
    specialists: denseSpecialists(),
    timeline: denseTimeline(transcript),
  };
}

function critiqueFor(request: CritiqueAndSynthesisInput): AnalysisCritique {
  return {
    version: 'analysis-critique-v1',
    verdict: 'pass',
    reviewedDiagnosticIds: request.specialists.map((diagnostic) => diagnostic.id),
    issues: [],
    contradictionsResolved: [],
    limitations: ['Aucune metrique plateforme dans la fixture de budget.'],
  };
}

describe('budgets des prompts video denses', () => {
  it('distribue transcript et timeline du debut a la fin sans muter la source canonique', () => {
    const transcript = denseTranscript();
    const originalText = transcript.text;
    const transcriptView = buildTranscriptPromptView(transcript, {
      maximumSegments: 72,
      maximumWords: 320,
    });
    const timeline = denseTimeline(transcript);
    const timelineView = buildDistributedTemporalPromptView({
      items: timeline,
      maximumItems: 60,
      getId: (segment) => segment.id,
      getStartSec: (segment) => segment.startTime,
      getEndSec: (segment) => segment.endTime,
    });

    expect(transcript.words).toHaveLength(1_800);
    expect(transcript.segments).toHaveLength(100);
    expect(transcript.text).toBe(originalText);
    expect(transcriptView.segments.coverage).toMatchObject({
      originalCount: 100,
      includedCount: 72,
      omittedCount: 28,
      openingId: 'segment-000',
      endingId: 'segment-099',
      canonicalDataPreservedOutsidePrompt: true,
    });
    expect(transcriptView.segments.coverage.midpointId).toMatch(/^segment-0(49|50)$/);
    expect(transcriptView.words.coverage.openingId).toBe('word-0000');
    expect(transcriptView.words.coverage.endingId).toBe('word-1799');
    expect(timelineView.coverage.openingId).toBe('timeline-000');
    expect(timelineView.coverage.midpointId).toMatch(/^timeline-0(49|50)$/);
    expect(timelineView.coverage.endingId).toBe('timeline-099');
    const compacted = compactPromptText('a'.repeat(2_000), 240);
    expect(compacted).toHaveLength(240);
    expect(compacted).toContain('characters omitted from prompt view');
    expect(compacted).toContain('canonical source preserved');
  });

  it('garde chaque prompt specialiste strictement sous 120k avec couverture declaree', () => {
    const transcript = denseTranscript();
    const transcriptView = buildTranscriptPromptView(transcript, {
      maximumSegments: 72,
      maximumWords: 320,
    });
    const evidenceIds = [
      ...transcriptView.segments.coverage.includedIds,
      ...transcriptView.words.coverage.includedIds,
    ];

    for (const specialist of SPECIALISTS) {
      const prompt = buildSpecialistPrompt({
        specialist,
        durationSec: DURATION_SEC,
        evidenceIds,
        promptContext: {
          transcript: transcriptView,
          frameCoverage: {
            originalCount: FRAME_COUNT,
            includedCount: 36,
            omittedCount: 36,
            openingId: 'frame-000',
            midpointId: 'frame-035',
            endingId: 'frame-071',
            canonicalDataPreservedOutsidePrompt: true,
          },
        },
      });
      expect(prompt.length, specialist).toBeLessThan(SPECIALIST_PROMPT_MAX_CHARACTERS);
      expect(prompt).toContain('segment-000');
      expect(prompt).toContain('segment-099');
      expect(prompt).toContain('omittedCount');
    }
  });

  it('garde critique et synthese sous 350k avec sources compatibles et citations exactes', () => {
    const request = denseRequest();
    const fullTranscript = request.evidence.transcription.status === 'available'
      ? request.evidence.transcription.normalized.text
      : '';
    const critiquePrompt = buildCritiquePrompt(request);
    const synthesisPrompt = buildSynthesisPrompt(request, critiqueFor(request));

    expect(critiquePrompt.length).toBeLessThan(SYNTHESIS_PROMPT_MAX_CHARACTERS);
    expect(synthesisPrompt.length).toBeLessThan(SYNTHESIS_PROMPT_MAX_CHARACTERS);
    for (const prompt of [critiquePrompt, synthesisPrompt]) {
      expect(prompt).toContain('segment-000');
      expect(prompt).toContain('segment-099');
      expect(prompt).toContain('frame-000');
      expect(prompt).toContain('frame-071');
      expect(prompt).toContain('timeline-000');
      expect(prompt).toContain('timeline-099');
      expect(prompt).toContain('finding-hook-00');
      expect(prompt).toContain('finding-cta-17');
      expect(prompt).toContain('supportingSourceIds');
      expect(prompt).not.toContain(fullTranscript);
    }
    expect(synthesisPrompt).toContain('verbatim');
    expect(synthesisPrompt).toContain('bestHook');
    if (request.evidence.transcription.status !== 'available') throw new Error('Transcript dense absent');
    expect(request.evidence.transcription.normalized.words).toHaveLength(1_800);
    expect(request.evidence.transcription.normalized.segments).toHaveLength(100);
    expect(request.evidence.transcription.normalized.text).toBe(fullTranscript);
    expect(request.timeline).toHaveLength(100);
    expect(request.evidence.frames).toHaveLength(72);
  });
});
