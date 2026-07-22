import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { FatalError, RetryableError } from 'workflow';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { AnalysisBudgetExceededError } from '@/lib/video-analysis/budget';
import { classifyAnalysisStepError } from '@/lib/video-analysis/workflow-error-policy';
import { visualAnalysisStep } from '@/lib/video-analysis/workflow-steps';

describe('politique de retry du lot visuel', () => {
  it('ne retente jamais une erreur de budget deterministe', () => {
    const classified = classifyAnalysisStepError(new AnalysisBudgetExceededError('stage_input'));
    expect(classified).toBeInstanceOf(FatalError);
    expect(RetryableError.is(classified)).toBe(false);
  });

  it('retente un rate limit une seule fois au niveau Workflow', () => {
    const classified = classifyAnalysisStepError(Object.assign(new Error('rate limited'), { status: 429 }));
    expect(RetryableError.is(classified)).toBe(true);
    expect(visualAnalysisStep.maxRetries).toBe(1);
  });

  it('conserve le remboursement de quota exactement une fois', () => {
    const sql = readFileSync('supabase/migrations/20260713180000_video_analysis_jobs.sql', 'utf8')
      .toLowerCase();
    expect(sql).toMatch(/status <> 'completed' and v_job\.quota_state = 'reserved'/u);
    expect(sql).toContain("quota_state = 'refunded'");
    expect(sql).toContain('analyses_count = greatest(analyses_count - 1, 0)');
  });
});
