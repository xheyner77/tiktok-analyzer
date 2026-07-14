import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import type { FinalAnalysisResult } from '@/lib/analysis-engine/index';
import {
  crossVideoRecommendationSimilarity,
  recommendationFingerprints,
} from '@/lib/video-analysis/cross-video-genericity';

function candidate(prefix: string, repeated = true): FinalAnalysisResult {
  const unavailable = { status: 'unavailable', reason: 'Indisponible.', limitations: ['Indisponible.'] };
  const recommendation = (index: number) => ({
    id: `${prefix}-recommendation-${index}`,
    observation: repeated ? `Observation commune ${index}.` : `Observation ${prefix} ${index}.`,
    text: repeated ? `Action commune ${index}.` : `Action ${prefix} ${index}.`,
    example: repeated ? `Exemple commun ${index}.` : `Exemple ${prefix} ${index}.`,
  });
  return {
    analysisId: `${prefix}-analysis`,
    hook: { status: 'available', recommendations: [0, 1, 2, 3].map(recommendation) },
    script: unavailable,
    editing: unavailable,
    visual: unavailable,
    textAndCaptions: unavailable,
    audio: unavailable,
    storytelling: unavailable,
    conversion: unavailable,
    priorities: unavailable,
    correctionPlan: unavailable,
    improvedVersion: unavailable,
    timeline: [],
  } as unknown as FinalAnalysisResult;
}

describe('détection inter-vidéos des recommandations clonées', () => {
  it('détecte les mêmes formulations malgré des identifiants différents', () => {
    const first = candidate('video-a');
    const second = candidate('video-b');
    expect(recommendationFingerprints(first).size).toBe(4);
    expect(crossVideoRecommendationSimilarity(first, second)).toEqual({
      overlap: 4,
      compared: 4,
      ratio: 1,
    });
  });

  it('ne confond pas deux décisions réellement contextualisées', () => {
    const first = candidate('video-a');
    const second = candidate('video-b', false);
    expect(crossVideoRecommendationSimilarity(first, second).ratio).toBe(0);
  });

  it('borne la comparaison aux analyses V2 du même propriétaire avant la persistance', () => {
    const source = readFileSync('lib/video-analysis/cross-video-genericity.ts', 'utf8');
    const workflow = readFileSync('lib/video-analysis/workflow-steps.ts', 'utf8');
    expect(source).toContain(".eq('user_id', input.userId)");
    expect(source).toContain(".eq('analysis_schema_version', '2.0.0')");
    expect(source).toContain(".limit(5)");
    expect(workflow.indexOf('assertCrossVideoRecommendationsDistinct({'))
      .toBeLessThan(workflow.indexOf('completeAnalysisJob({'));
  });
});
