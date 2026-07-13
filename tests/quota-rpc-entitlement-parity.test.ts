import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/lib/auth';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/supabase');
});

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-quota',
    email: 'quota@example.test',
    plan: 'free',
    analyses_count: 0,
    hooks_count: 0,
    reconstructions_count: 0,
    last_reset_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-07-01T00:00:00.000Z',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_status: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    tiktok_open_id: null,
    tiktok_display_name: null,
    tiktok_avatar_url: null,
    tiktok_connected_at: null,
    ...overrides,
  };
}

function mockRpcReservation(input: {
  reservationName: string;
  refundName: string;
  allowed?: boolean;
  used?: number;
  limitValue?: number;
}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === input.reservationName) {
      return {
        data: [{
          allowed: input.allowed ?? true,
          used: input.used ?? 1,
          limit_value: input.limitValue,
        }],
        error: null,
      };
    }
    if (name === input.refundName) return { data: 0, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });

  vi.doMock('@/lib/supabase', () => ({
    supabase: {
      rpc,
      from: vi.fn(() => {
        throw new Error('Direct table fallback must not run.');
      }),
    },
  }));
  return rpc;
}

describe('quota RPC entitlement parity', () => {
  it('rejects and refunds a raw Lifetime analysis grant without canonical entitlement', async () => {
    const rpc = mockRpcReservation({
      reservationName: 'reserve_analysis_quota',
      refundName: 'refund_analysis_quota',
      used: 1,
      limitValue: 2_147_483_647,
    });
    const { reserveAnalysisQuota } = await import('@/lib/auth');

    const result = await reserveAnalysisQuota(user({ plan: 'lifetime' }));

    expect(result).toEqual({ allowed: false, used: 0, limit: 3 });
    expect(rpc).toHaveBeenCalledWith('refund_analysis_quota', { p_user_id: 'user-quota' });
  });

  it('rejects and refunds a hook reservation whose SQL limit exceeds the effective plan', async () => {
    const rpc = mockRpcReservation({
      reservationName: 'reserve_hook_quota',
      refundName: 'refund_hook_quota',
      used: 10,
      limitValue: 250,
    });
    const { reserveHookQuota } = await import('@/lib/auth');

    const result = await reserveHookQuota(user({ plan: 'starter' }), 10);

    expect(result).toEqual({ allowed: false, used: 0, limit: 50 });
    expect(rpc).toHaveBeenCalledWith('refund_hook_quota', {
      p_user_id: 'user-quota',
      p_amount: 10,
    });
  });

  it('rejects malformed successful responses and refunds when the reservation is identifiable', async () => {
    const rpc = mockRpcReservation({
      reservationName: 'reserve_reconstruction_quota',
      refundName: 'refund_reconstruction_quota',
      used: 1,
      limitValue: undefined,
    });
    const { reserveReconstructionQuota } = await import('@/lib/auth');

    const result = await reserveReconstructionQuota(user({ plan: 'pro' }));

    expect(result).toEqual({ allowed: false, used: 0, limit: 30 });
    expect(rpc).toHaveBeenCalledWith('refund_reconstruction_quota', {
      p_user_id: 'user-quota',
      p_amount: 1,
    });
  });

  it('keeps infinite entitlements on the counter-only path', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    vi.doMock('@/lib/supabase', () => ({
      supabase: { rpc, from: vi.fn() },
    }));
    const { reserveAnalysisQuota } = await import('@/lib/auth');

    const result = await reserveAnalysisQuota(user({
      plan: 'lifetime',
      subscription_status: 'lifetime',
    }));

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Number.POSITIVE_INFINITY);
    expect(rpc).toHaveBeenCalledWith('increment_analyses_count', { user_id: 'user-quota' });
    expect(rpc).not.toHaveBeenCalledWith('reserve_analysis_quota', expect.anything());
  });
});
