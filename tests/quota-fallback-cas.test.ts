import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/supabase');
});

function mockRefundFallback(updated: { analyses_count: number } | null) {
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => ({ data: { analyses_count: 4 }, error: null })),
    maybeSingle: vi.fn(async () => ({ data: updated, error: null })),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  vi.doMock('@/lib/supabase', () => ({
    supabase: {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'rpc_unavailable' } })),
      from: vi.fn(() => query),
    },
  }));
  return query;
}

describe('analysis quota refund fallback', () => {
  it('uses compare-and-swap before refunding a reserved analysis', async () => {
    const query = mockRefundFallback({ analyses_count: 3 });
    const { refundAnalysisQuota } = await import('@/lib/auth');

    await expect(refundAnalysisQuota('user_quota')).resolves.toBe(true);

    expect(query.update).toHaveBeenCalledWith({ analyses_count: 3 });
    expect(query.eq).toHaveBeenCalledWith('analyses_count', 4);
    expect(query.select).toHaveBeenCalledWith('analyses_count');
  });

  it('fails closed when another request changes the counter concurrently', async () => {
    mockRefundFallback(null);
    const { refundAnalysisQuota } = await import('@/lib/auth');

    await expect(refundAnalysisQuota('user_quota')).resolves.toBe(false);
  });
});
