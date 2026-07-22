import { describe, expect, it } from 'vitest';
import {
  assessDecodedFrameCoverage,
  buildAdaptiveSamplePlan,
  resolveSamplePlanToFrames,
} from '@/lib/video-pipeline/sampling';

describe('targeted decoded-frame coverage', () => {
  it('keeps A-standard-parole covered with ten real frames and no early duplicate hole', () => {
    const plan = buildAdaptiveSamplePlan(40, [], { maxFrames: 10, maxCoverageGapSec: 12 });
    const timeline = Array.from({ length: 1_200 }, (_, frameIndex) => ({
      frameIndex,
      sourceTimestampSec: frameIndex / 30,
      timestampSec: frameIndex / 30,
    }));
    const frames = resolveSamplePlanToFrames(plan, timeline);
    const coverage = assessDecodedFrameCoverage(frames.map((frame) => frame.timestampSec), 40, 30, 12);

    expect(plan).toHaveLength(10);
    expect(frames).toHaveLength(10);
    expect(coverage.usable).toBe(true);
    expect(coverage.largestGapSec).toBeLessThanOrEqual(12.25);
    expect(frames.every((frame) => timeline.some((point) => point.frameIndex === frame.frameIndex))).toBe(true);
  });

  it('accepts slightly incomplete real coverage and timestamps close to both bounds', () => {
    const coverage = assessDecodedFrameCoverage([0.2, 10, 20, 30, 39.7], 40, 30, 12);
    expect(coverage.usable).toBe(true);
    expect(coverage.startGapSec).toBeCloseTo(0.2);
    expect(coverage.endGapSec).toBeCloseTo(0.3);
  });

  it('rejects coverage that leaves the end and most of the timeline unseen', () => {
    expect(assessDecodedFrameCoverage([0, 2, 3], 40, 30, 12)).toMatchObject({
      usable: false,
      frameCount: 3,
      endGapSec: 37,
    });
  });
});
