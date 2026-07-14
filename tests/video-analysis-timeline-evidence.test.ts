import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/video-analysis/artifacts', () => ({ listJobArtifacts: vi.fn() }));
vi.mock('@/lib/video-analysis/jobs', () => ({
  getAnalysisJobForWorkflow: vi.fn(),
  updateJobStage: vi.fn(),
}));

import type { TimelineSegment } from '@/lib/analysis-engine/index';
import { validateTimelineChunk } from '@/lib/video-analysis/timeline-analysis';
import type { TimelineSegmentSpec } from '@/lib/video-analysis/segmentation';

const spec: TimelineSegmentSpec = {
  id: 'timeline-1',
  startTime: 0,
  endTime: 3,
  transcript: 'La preuve arrive maintenant.',
  transcriptRefs: ['transcript-inside'],
  transcriptWordRefs: [],
  transcriptSegmentRefs: ['transcript-inside'],
  transcriptTimingPrecision: 'segment',
  transcriptTimingNote: 'Bornes du segment de transcription contenues dans la tranche.',
  frameRefs: ['frame-inside'],
  evidenceRefs: ['transcript-inside', 'frame-inside'],
  eventCoverage: {
    sceneCutCount: 0,
    silenceBoundaryCount: 0,
    originalCount: 0,
    includedCount: 0,
    omittedCount: 0,
    representativeEvents: [],
    canonicalEventsPreservedInTechnicalSignals: true,
  },
};

function segment(evidence: string[]): TimelineSegment {
  return {
    id: spec.id,
    startTime: spec.startTime,
    endTime: spec.endTime,
    transcript: {
      status: 'available',
      text: spec.transcript,
      evidence: ['transcript-inside'],
    },
    visualObservation: {
      status: 'available',
      text: 'Le résultat est visible.',
      evidence: ['frame-inside'],
    },
    audioObservation: { status: 'unavailable', reason: 'Aucune piste audio.' },
    editingObservation: { status: 'unavailable', reason: 'Aucun cut mesurable.' },
    narrativeFunction: 'proof',
    observation: 'Le résultat apparaît entre 0 et 3 secondes.',
    diagnostic: 'La preuve soutient l’objectif de rétention.',
    action: 'Garder le résultat visible dès la première seconde.',
    objective: 'retention',
    objectiveFit: 'La preuve immédiate clarifie la raison de poursuivre.',
    example: 'Afficher le résultat final avec le texte « Voilà la différence ».',
    transcriptCitation: {
      status: 'available',
      segmentId: 'transcript-inside',
      quote: 'La preuve arrive maintenant.',
    },
    nature: 'mixed',
    strengths: ['La preuve est visible.'],
    problems: [],
    recommendedAction: 'Conserver cette preuve en ouverture.',
    evidence,
    confidence: 'high',
  };
}

describe('timeline evidence scoping', () => {
  it('accepte uniquement les preuves autorisées dans la plage du segment', () => {
    expect(validateTimelineChunk({
      output: [segment(['frame-inside', 'transcript-inside'])],
      specs: [spec],
      allowedEvidenceBySegment: new Map([[spec.id, new Set(['frame-inside', 'transcript-inside'])]]),
      hasAudio: false,
    })).toHaveLength(1);
  });

  it('rejette un ID connu globalement mais extérieur à la plage', () => {
    expect(() => validateTimelineChunk({
      output: [segment(['frame-outside'])],
      specs: [spec],
      allowedEvidenceBySegment: new Map([[spec.id, new Set(['frame-inside', 'transcript-inside'])]]),
      hasAudio: false,
    })).toThrow('TIMELINE_OUT_OF_RANGE_EVIDENCE');
  });

  it('interdit une observation visuelle quand aucune frame ne tombe dans la tranche', () => {
    const noFrameSpec: TimelineSegmentSpec = {
      ...spec,
      frameRefs: [],
      evidenceRefs: ['transcript-inside'],
    };
    const output = segment(['transcript-inside']);

    expect(() => validateTimelineChunk({
      output: [output],
      specs: [noFrameSpec],
      allowedEvidenceBySegment: new Map([[noFrameSpec.id, new Set(['transcript-inside'])]]),
      hasAudio: false,
    })).toThrow('TIMELINE_VISUAL_INVENTED');

    output.visualObservation = {
      status: 'unavailable',
      reason: 'Aucune frame echantillonnee dans cette tranche.',
    };
    expect(validateTimelineChunk({
      output: [output],
      specs: [noFrameSpec],
      allowedEvidenceBySegment: new Map([[noFrameSpec.id, new Set(['transcript-inside'])]]),
      hasAudio: false,
    })).toHaveLength(1);
  });

  it('exige une preuve mot quand le texte a ete decoupe par horodatage mot', () => {
    const wordSpec: TimelineSegmentSpec = {
      ...spec,
      transcriptRefs: ['transcript-inside', 'word-inside'],
      transcriptWordRefs: ['word-inside'],
      transcriptTimingPrecision: 'word',
    };
    const withoutWordEvidence = segment(['frame-inside', 'transcript-inside']);

    expect(() => validateTimelineChunk({
      output: [withoutWordEvidence],
      specs: [wordSpec],
      allowedEvidenceBySegment: new Map([[
        wordSpec.id,
        new Set(['frame-inside', 'transcript-inside', 'word-inside']),
      ]]),
      hasAudio: false,
    })).toThrow('TIMELINE_TRANSCRIPT_WORD_EVIDENCE_REQUIRED');

    withoutWordEvidence.transcript = {
      status: 'available',
      text: spec.transcript,
      evidence: ['word-inside'],
    };
    expect(validateTimelineChunk({
      output: [withoutWordEvidence],
      specs: [wordSpec],
      allowedEvidenceBySegment: new Map([[
        wordSpec.id,
        new Set(['frame-inside', 'transcript-inside', 'word-inside']),
      ]]),
      hasAudio: false,
    })).toHaveLength(1);
  });
});
