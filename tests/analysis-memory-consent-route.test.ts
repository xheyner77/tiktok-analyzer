import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('legacy analysis creator-memory consent', () => {
  const source = readFileSync('app/api/analyze/route.ts', 'utf8');

  it('gates memory reads and historical comparisons on explicit true consent', () => {
    expect(source.match(/const memoryConsent = body\.memoryConsent === true;/g)).toHaveLength(2);
    expect(source.match(/session && memoryConsent/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/const previousAnalyses = session && memoryConsent/g)).toHaveLength(2);
  });

  it('gates every legacy memory write path while preserving the canonical analysis save', () => {
    expect(source.match(/if \(memoryConsent\) \{\s*await Promise\.all\(\[/g)).toHaveLength(2);
    expect(source.match(/persistAnalysisSnapshotAndMemory\(/g)).toHaveLength(2);
    expect(source.match(/enqueueMemoryLearning\(/g)).toHaveLength(3); // definition + two gated calls
    expect(source.match(/learnCreatorMemoryFromAnalysis\(/g)).toHaveLength(2);
    expect(source.match(/const analysisId = await saveAnalysis\(/g)).toHaveLength(2);
  });
});
