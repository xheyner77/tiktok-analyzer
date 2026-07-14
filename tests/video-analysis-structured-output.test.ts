import { describe, expect, it, vi } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';

vi.mock('server-only', () => ({}));

import {
  AnalysisCritiqueSchema,
  SpecialistDiagnosticSchema,
  TimelineSegmentSchema,
} from '@/lib/analysis-engine/index';
import { GeneratedAnalysisNarrativeSchema } from '@/lib/video-analysis/synthesis';

describe('OpenAI strict structured-output contracts', () => {
  it.each([
    ['specialist', SpecialistDiagnosticSchema],
    ['critique', AnalysisCritiqueSchema],
    ['timeline', TimelineSegmentSchema],
    ['final narrative', GeneratedAnalysisNarrativeSchema],
  ])('converts the %s schema without optional-field rejection', (_label, schema) => {
    expect(() => zodTextFormat(schema, 'viralynz_contract')).not.toThrow();
  });
});
