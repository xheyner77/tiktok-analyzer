import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: vi.fn() },
}));

import { checkAndResetMonthly, type UserProfile } from '@/lib/auth';

function profile(plan: UserProfile['plan']): UserProfile {
  return {
    id: 'user-period', email: 'period@example.test', plan,
    analyses_count: 17, hooks_count: 9, reconstructions_count: 2,
    last_reset_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    stripe_customer_id: null, stripe_subscription_id: null, stripe_price_id: null,
    subscription_status: plan === 'lifetime' ? 'lifetime' : null,
    subscription_current_period_end: null, subscription_cancel_at_period_end: false,
    tiktok_open_id: null, tiktok_display_name: null,
    tiktok_avatar_url: null, tiktok_connected_at: null,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('reset de la fenêtre commerciale', () => {
  it('réinitialise Lifetime mensuellement comme Pro', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-22T12:00:00.000Z'));
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-period' }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    mocks.update.mockReturnValue({ eq: firstEq });
    mocks.from.mockReturnValue({ update: mocks.update });

    const result = await checkAndResetMonthly(profile('lifetime'));

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      analyses_count: 0, hooks_count: 0, reconstructions_count: 0,
      last_reset_at: '2026-07-22T12:00:00.000Z',
    }));
    expect(result).toMatchObject({ analyses_count: 0, hooks_count: 0, reconstructions_count: 0 });
  });

  it('ne réinitialise jamais les trois analyses Free à vie', async () => {
    const result = await checkAndResetMonthly(profile('free'));
    expect(result.analyses_count).toBe(17);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
