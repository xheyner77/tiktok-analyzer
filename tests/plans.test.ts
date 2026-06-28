import { describe, expect, it } from 'vitest';
import { getPlanLimits, hasProOrLifetimeAccess, isLifetimePlan, normalizePlan } from '@/lib/plans';
import { getTikTokAccountLimitForPlan } from '@/lib/tiktok-plan-limits';
import { HOOK_LIMITS, PLAN_LIMITS, RECONSTRUCTION_LIMITS } from '@/lib/plan-limits';
import { getEffectivePlan } from '@/lib/stripe-billing';

describe('plans', () => {
  it('normalizes legacy scale as Lifetime compatibility', () => {
    expect(normalizePlan('scale')).toBe('lifetime');
  });

  it('keeps Lifetime access canonical while accepting legacy Scale', () => {
    expect(isLifetimePlan('lifetime')).toBe(true);
    expect(isLifetimePlan('scale')).toBe(true);
    expect(hasProOrLifetimeAccess('pro')).toBe(true);
    expect(hasProOrLifetimeAccess('lifetime')).toBe(true);
    expect(hasProOrLifetimeAccess('scale')).toBe(true);
    expect(hasProOrLifetimeAccess('free')).toBe(false);
  });

  it('does not fallback a Supabase scale alias to free', () => {
    expect(getPlanLimits('scale').analyses).toBe(Number.POSITIVE_INFINITY);
    expect(getPlanLimits('scale').hooks).toBe(Number.POSITIVE_INFINITY);
  });

  it('treats legacy Scale as effective Lifetime without an active Stripe subscription', () => {
    expect(getEffectivePlan({
      plan: 'scale',
      stripe_subscription_id: null,
      subscription_status: null,
    })).toBe('lifetime');
  });

  it('only falls back to free for unknown plans', () => {
    expect(normalizePlan('enterprise_pending')).toBe('free');
    expect(getPlanLimits('enterprise_pending').analyses).toBe(3);
  });

  it('caps legacy Scale alias like Lifetime', () => {
    expect(getPlanLimits('scale').tiktokAccounts).toBe(3);
    expect(getTikTokAccountLimitForPlan('scale')).toBe(3);
  });

  it('gates complete AI reconstruction by current plan quota', () => {
    expect(RECONSTRUCTION_LIMITS.creator).toBe(0);
    expect(RECONSTRUCTION_LIMITS.pro).toBe(30);
    expect(RECONSTRUCTION_LIMITS.scale).toBe(30);
    expect(getPlanLimits('creator').reconstructions).toBe(0);
    expect(getPlanLimits('pro').reconstructions).toBe(30);
    expect(getPlanLimits('scale').reconstructions).toBe(30);
  });

  it('uses current public quotas for Starter, Pro and Lifetime', () => {
    expect(PLAN_LIMITS.free).toBe(3);
    expect(PLAN_LIMITS.starter).toBe(30);
    expect(PLAN_LIMITS.pro).toBe(150);
    expect(PLAN_LIMITS.lifetime).toBe(Number.POSITIVE_INFINITY);
    expect(HOOK_LIMITS.starter).toBe(50);
    expect(HOOK_LIMITS.pro).toBe(250);
    expect(HOOK_LIMITS.lifetime).toBe(Number.POSITIVE_INFINITY);
    expect(getPlanLimits('pro')).toMatchObject({ analyses: 150, hooks: 250 });
  });

  it('gives active legacy Elite the Pro quota and inactive Elite the Free quota', () => {
    const activeElite = getEffectivePlan({
      plan: 'elite',
      stripe_subscription_id: 'sub_elite_legacy',
      subscription_status: 'active',
    });
    const inactiveElite = getEffectivePlan({
      plan: 'elite',
      stripe_subscription_id: null,
      subscription_status: null,
    });

    expect(activeElite).toBe('pro');
    expect(PLAN_LIMITS[activeElite]).toBe(PLAN_LIMITS.pro);
    expect(HOOK_LIMITS[activeElite]).toBe(HOOK_LIMITS.pro);
    expect(PLAN_LIMITS[activeElite]).not.toBe(PLAN_LIMITS.lifetime);
    expect(inactiveElite).toBe('free');
    expect(PLAN_LIMITS[inactiveElite]).toBe(PLAN_LIMITS.free);
  });
});
