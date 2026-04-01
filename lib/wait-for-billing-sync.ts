/**
 * Côté client uniquement — attend que `/api/auth/me` reflète le plan après webhook Stripe.
 */
export async function waitForBillingPlan(
  expected: 'pro' | 'elite',
  maxMs = 25000,
  intervalMs = 500
): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      const j = await r.json();
      const bp = j.user?.billingPlan as string | undefined;
      const st = j.user?.subscriptionStatus as string | undefined;
      if (bp === expected && (st === 'active' || st === 'trialing')) return true;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
}
