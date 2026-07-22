import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import type { VisualBatchObservation } from '@/lib/video-analysis/intermediate-schemas';
import type { AnalysisArtifactRow } from '@/lib/video-analysis/artifacts';
import {
  buildVisualBatchPayload,
  buildOverlappingVisualBatches,
  mergePersistentTextGroups,
  validateVisualBatch,
} from '@/lib/video-analysis/visual-analysis';

function frame(index: number): AnalysisArtifactRow {
  return {
    id: `frame-${String(index).padStart(2, '0')}`,
    job_id: 'job-1',
    user_id: 'user-1',
    kind: 'frame',
    storage_bucket: 'analysis-evidence',
    storage_path: `user-1/job-1/frames/frame-${index}.jpg`,
    start_time: index - 1,
    end_time: index - 1,
    metadata: {},
    created_at: '2026-07-14T00:00:00.000Z',
  };
}

function observation(evidenceRef: string, timestampSec: number): VisualBatchObservation['frames'][number] {
  return {
    evidenceRef,
    timestampSec,
    visibleSubject: 'Une personne présente le sujet face caméra.',
    framing: 'Plan poitrine centré.',
    movement: 'Mouvement faible mais visible.',
    changeFromPrevious: 'Le texte reste présent depuis la frame précédente.',
    onScreenText: {
      status: 'observed',
      text: 'PROMESSE',
      legibility: 'clear',
      safeZoneRisk: 'none',
    },
    speechVisualAlignment: { status: 'unavailable', reason: 'Aucune parole proche exploitable.' },
    proofOrDemonstration: { status: 'not_observed', note: 'Aucune preuve visible sur cette frame.' },
    distractions: [],
    lightContrastComposition: 'Lumière et contraste lisibles.',
    cameraPresence: { status: 'observed', note: 'Regard vers la caméra.' },
    bRollOrProduct: { status: 'not_observed', note: 'Aucun B-roll ou produit visible.' },
    confidence: 'high',
  };
}

describe('lots visuels avec continuité inter-batch', () => {
  it('compacte le contexte sans dupliquer la transcription et utilise le detail bas', () => {
    const frames = Array.from({ length: 10 }, (_, index) => frame(index + 1));
    const payload = buildVisualBatchPayload({
      batchId: 'visual-batch-01',
      targetFrames: frames,
      contextFrame: null,
      signedUrls: new Map(frames.map((item) => [item.id, `https://example.test/${item.id}.jpg`])),
      segments: [{ startSec: 0, endSec: 2, text: 'Une phrase unique.' }],
    });

    expect(payload.images).toHaveLength(10);
    expect(payload.images.every((image) => image.detail === 'low')).toBe(true);
    expect(payload.prompt.match(/Une phrase unique\./gu)).toHaveLength(1);
    expect(payload.prompt.length).toBeLessThan(4_000);
  });

  it('ajoute la frame 10 comme contexte non cible pour analyser correctement la frame 11', () => {
    const frames = Array.from({ length: 11 }, (_, index) => frame(index + 1));
    const batches = buildOverlappingVisualBatches(frames, 10);

    expect(batches).toHaveLength(2);
    expect(batches[0].contextFrame).toBeNull();
    expect(batches[0].targetFrames.map((item) => item.id)).toEqual(
      frames.slice(0, 10).map((item) => item.id),
    );
    expect(batches[1].contextFrame?.id).toBe('frame-10');
    expect(batches[1].targetFrames.map((item) => item.id)).toEqual(['frame-11']);
    expect(batches[1].evidenceFrames.map((item) => item.id)).toEqual(['frame-10', 'frame-11']);
  });

  it('autorise le contexte dans un groupe persistant mais jamais une frame hors du lot', () => {
    const context = frame(10);
    const target = frame(11);
    const valid: VisualBatchObservation = {
      batchId: 'visual-batch-02',
      frames: [observation(target.id, target.start_time)],
      persistentTextGroups: [{ text: 'PROMESSE', evidenceRefs: [context.id, target.id] }],
      limitations: [],
    };

    expect(validateVisualBatch(valid, [target], [context, target], 'visual-batch-02'))
      .toEqual(valid);

    expect(() => validateVisualBatch({
      ...valid,
      persistentTextGroups: [{ text: 'PROMESSE', evidenceRefs: ['frame-09', target.id] }],
    }, [target], [context, target], 'visual-batch-02'))
      .toThrow('VISUAL_PERSISTENT_TEXT_EVIDENCE_MISMATCH');

    expect(() => validateVisualBatch({
      ...valid,
      persistentTextGroups: [{ text: 'PROMESSE', evidenceRefs: [context.id, context.id] }],
    }, [target], [context, target], 'visual-batch-02'))
      .toThrow('VISUAL_PERSISTENT_TEXT_EVIDENCE_MISMATCH');
  });

  it('fusionne et ordonne le même texte détecté de part et d’autre de la frontière 10/11', () => {
    const frames = Array.from({ length: 11 }, (_, index) => frame(index + 1));
    const merged = mergePersistentTextGroups([
      { text: '  PROMESSE ', evidenceRefs: ['frame-09', 'frame-10'] },
      { text: 'promesse', evidenceRefs: ['frame-10', 'frame-11'] },
      { text: 'Preuve', evidenceRefs: ['frame-11'] },
    ], frames);

    expect(merged).toEqual([
      { text: 'PROMESSE', evidenceRefs: ['frame-09', 'frame-10', 'frame-11'] },
      { text: 'Preuve', evidenceRefs: ['frame-11'] },
    ]);
  });

  it('ne fusionne pas deux réapparitions éloignées du même texte sans frame commune', () => {
    const frames = Array.from({ length: 11 }, (_, index) => frame(index + 1));
    const merged = mergePersistentTextGroups([
      { text: 'PROMESSE', evidenceRefs: ['frame-01', 'frame-02'] },
      { text: 'promesse', evidenceRefs: ['frame-10', 'frame-11'] },
    ], frames);

    expect(merged).toEqual([
      { text: 'PROMESSE', evidenceRefs: ['frame-01', 'frame-02'] },
      { text: 'promesse', evidenceRefs: ['frame-10', 'frame-11'] },
    ]);
  });
});
