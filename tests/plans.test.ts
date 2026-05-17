import { describe, expect, it } from 'vitest';
import { getPlanLimits, normalizePlan } from '@/lib/plans';
import { getTikTokAccountLimitForPlan } from '@/lib/tiktok-plan-limits';
import { RECONSTRUCTION_LIMITS } from '@/lib/plan-limits';

describe('plans', () => {
  it('normalizes scale as a first-class plan', () => {
    expect(normalizePlan('scale')).toBe('scale');
  });

  it('does not fallback a Supabase scale plan to free', () => {
    expect(getPlanLimits('scale').analyses).toBe(Number.POSITIVE_INFINITY);
    expect(getPlanLimits('scale').hooks).toBe(Number.POSITIVE_INFINITY);
  });

  it('only falls back to free for unknown plans', () => {
    expect(normalizePlan('enterprise_pending')).toBe('free');
    expect(getPlanLimits('enterprise_pending').analyses).toBe(3);
  });

  it('caps Scale TikTok accounts at 8', () => {
    expect(getPlanLimits('scale').tiktokAccounts).toBe(8);
    expect(getTikTokAccountLimitForPlan('scale')).toBe(8);
  });

  it('gates complete AI reconstruction by plan quota', () => {
    expect(RECONSTRUCTION_LIMITS.creator).toBe(0);
    expect(RECONSTRUCTION_LIMITS.pro).toBe(30);
    expect(RECONSTRUCTION_LIMITS.scale).toBe(150);
    expect(getPlanLimits('creator').reconstructions).toBe(0);
    expect(getPlanLimits('pro').reconstructions).toBe(30);
    expect(getPlanLimits('scale').reconstructions).toBe(150);
  });
});
