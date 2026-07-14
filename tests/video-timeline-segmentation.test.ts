import { describe, expect, it } from 'vitest';
import {
  MAX_TIMELINE_PROVIDER_CALLS,
  MAX_TIMELINE_SEGMENTS,
  buildTimelineProviderBatches,
  buildTimelineSegments,
  timelineCoversDuration,
} from '@/lib/video-analysis/segmentation';

describe('timeline vidéo déterministe', () => {
  it('couvre une vidéo longue du premier au dernier instant sans trou', () => {
    const frames = Array.from({ length: 61 }, (_, index) => ({
      id: `frame-${index}`,
      timestampSec: Math.min(600, index * 10),
    }));
    const segments = buildTimelineSegments({
      durationSec: 600,
      transcriptSegments: [],
      frames,
      sceneCuts: [19.8, 101.2, 333.4, 520.1],
      silenceBoundaries: [45, 47.2, 210.4],
    });
    expect(timelineCoversDuration(segments, 600)).toBe(true);
    expect(segments[0].startTime).toBe(0);
    expect(segments[0].endTime).toBeLessThanOrEqual(3);
    expect(segments.at(-1)?.endTime).toBe(600);
    expect(Math.max(...segments.map((segment) => segment.endTime - segment.startTime))).toBeLessThanOrEqual(12.001);
    const timestampByFrame = new Map(frames.map((frame) => [frame.id, frame.timestampSec]));
    expect(segments.every((segment) => segment.frameRefs.every((frameId) => {
      const timestamp = timestampByFrame.get(frameId);
      return timestamp !== undefined
        && timestamp >= segment.startTime
        && (timestamp < segment.endTime || segment.endTime === 600);
    }))).toBe(true);
  });

  it('associe uniquement les paroles et preuves qui chevauchent le segment', () => {
    const segments = buildTimelineSegments({
      durationSec: 9,
      transcriptSegments: [
        { id: 'speech-1', startSec: 0.2, endSec: 2.5, text: 'Voici la promesse.' },
        { id: 'speech-2', startSec: 5, endSec: 8, text: 'Voici la preuve.' },
      ],
      frames: [
        { id: 'frame-1', timestampSec: 0 },
        { id: 'frame-2', timestampSec: 3 },
        { id: 'frame-3', timestampSec: 8.9 },
      ],
      sceneCuts: [3],
      maxSegmentSec: 6,
    });
    expect(timelineCoversDuration(segments, 9)).toBe(true);
    expect(segments.find((segment) => segment.transcript.includes('promesse'))).toBeDefined();
    expect(segments.find((segment) => segment.transcript.includes('preuve'))).toBeDefined();
    expect(segments.flatMap((segment) => segment.evidenceRefs)).toContain('speech-2');
  });

  it('reconstruit chaque tranche avec ses mots horodatÃ©s sans dupliquer un segment Whisper traversant 3 s', () => {
    const segments = buildTimelineSegments({
      durationSec: 6,
      transcriptSegments: [{
        id: 'speech-spanning',
        startSec: 0.5,
        endSec: 5.5,
        text: 'Avant la coupe aprÃ¨s la coupe.',
      }],
      transcriptWords: [
        { id: 'word-before-1', segmentId: 'speech-spanning', startSec: 0.5, endSec: 1, text: 'Avant' },
        { id: 'word-before-2', segmentId: 'speech-spanning', startSec: 1, endSec: 2, text: 'la coupe' },
        { id: 'word-after-1', segmentId: 'speech-spanning', startSec: 3.2, endSec: 4, text: 'aprÃ¨s' },
        { id: 'word-after-2', segmentId: 'speech-spanning', startSec: 4, endSec: 5.5, text: 'la coupe.' },
      ],
      frames: [],
    });
    const before = segments.find((segment) => segment.startTime === 0 && segment.endTime === 3);
    const after = segments.find((segment) => segment.startTime === 3 && segment.endTime === 6);

    expect(before?.transcript).toBe('Avant la coupe');
    expect(before?.transcriptWordRefs).toEqual(['word-before-1', 'word-before-2']);
    expect(before?.transcriptRefs).not.toContain('word-after-1');
    expect(after?.transcript).toBe('aprÃ¨s la coupe.');
    expect(after?.transcriptWordRefs).toEqual(['word-after-1', 'word-after-2']);
    expect(after?.transcriptRefs).not.toContain('word-before-1');
    expect(segments.filter((segment) => segment.transcript.includes('Avant la coupe aprÃ¨s'))).toHaveLength(0);
  });

  it('aligne un transcript sans mots sur ses bornes plutÃ´t que de lui inventer une prÃ©cision intra-segment', () => {
    const segments = buildTimelineSegments({
      durationSec: 6,
      transcriptSegments: [{
        id: 'segment-only',
        startSec: 0.5,
        endSec: 5.5,
        text: 'Phrase disponible seulement au niveau segment.',
      }],
      frames: [],
    });
    const attributed = segments.filter((segment) => segment.transcript.includes('Phrase disponible'));

    expect(attributed).toHaveLength(1);
    expect(attributed[0]).toMatchObject({
      startTime: 0.5,
      endTime: 5.5,
      transcriptTimingPrecision: 'segment',
      transcriptSegmentRefs: ['segment-only'],
      transcriptWordRefs: [],
    });
  });

  it('laisse frameRefs vide quand les seules frames sont hors de la tranche 3-6 s', () => {
    const segments = buildTimelineSegments({
      durationSec: 12,
      transcriptSegments: [],
      frames: [
        { id: 'frame-at-start', timestampSec: 0 },
        { id: 'frame-at-end', timestampSec: 12 },
      ],
      sceneCuts: [6],
    });
    const middle = segments.find((segment) => segment.startTime === 3 && segment.endTime === 6);

    expect(middle).toBeDefined();
    expect(middle?.frameRefs).toEqual([]);
    expect(middle?.evidenceRefs).not.toContain('frame-at-start');
    expect(middle?.evidenceRefs).not.toContain('frame-at-end');
  });

  it('refuse une durée absente au lieu de produire une analyse partielle', () => {
    expect(() => buildTimelineSegments({ durationSec: 0, transcriptSegments: [], frames: [] }))
      .toThrow(/durée/i);
  });

  it('borne une vidéo de 600 s avec un événement chaque seconde avant tout appel fournisseur', () => {
    const sceneCuts = Array.from({ length: 599 }, (_, index) => ({
      timestamp: index + 1,
      score: index === 456 ? 0.99 : 0.2 + ((index % 5) * 0.04),
    }));
    const silenceBoundaries = Array.from({ length: 299 }, (_, index) => (index + 1) * 2 - 0.2);
    const segments = buildTimelineSegments({
      durationSec: 600,
      transcriptSegments: [],
      frames: Array.from({ length: 61 }, (_, index) => ({
        id: `dense-frame-${index}`,
        timestampSec: index * 10,
      })),
      sceneCuts,
      silenceBoundaries,
    });
    const batches = buildTimelineProviderBatches(segments);

    expect(segments.length).toBeLessThanOrEqual(MAX_TIMELINE_SEGMENTS);
    expect(batches.length).toBeLessThanOrEqual(MAX_TIMELINE_PROVIDER_CALLS);
    expect(batches.every((batch) => batch.length <= 8)).toBe(true);
    expect(timelineCoversDuration(segments, 600)).toBe(true);
    expect(Math.max(...segments.map((segment) => segment.endTime - segment.startTime))).toBeLessThanOrEqual(12.001);
    expect(segments.reduce((sum, segment) => sum + segment.eventCoverage.originalCount, 0)).toBe(898);
    expect(segments.some((segment) => segment.eventCoverage.omittedCount > 0)).toBe(true);
    expect(segments.flatMap((segment) => segment.eventCoverage.representativeEvents)
      .some((event) => event.timestampSec === 457 && event.strength === 0.99)).toBe(true);
  });
});
