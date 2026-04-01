import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getUserById, PLAN_LIMITS, HOOK_LIMITS, getEffectivePlan } from '@/lib/auth';
import { isSubscriptionStatusAllowingAccess } from '@/lib/stripe-billing';
import { getAnalyses } from '@/lib/analyses';
import DashboardClient from './DashboardClient';

// Always fetch fresh data — never serve a cached version of the dashboard.
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { success?: string; [key: string]: string | undefined };
}) {
  const session = await getSession();

  if (!session) {
    // Session absent or token expired — just redirect to /login.
    // Do NOT touch cookies here: modifying cookies is only allowed in
    // Route Handlers and Server Actions, not Server Component pages.
    // The stale cookie (if any) will be overwritten on next successful login.
    console.error('[DashboardPage] No valid session — redirecting to /login.');
    redirect('/login');
  }

  const user = await getUserById(session.userId);
  const memberSince   = user?.created_at      ?? new Date().toISOString();
  const billingPlan   = user?.plan             ?? 'free';
  const plan          = user ? getEffectivePlan(user) : 'free';
  const analysesCount = user?.analyses_count   ?? 0;
  const hooksCount    = user?.hooks_count      ?? 0;
  const analysesLimit = PLAN_LIMITS[plan]      ?? 3;
  const hooksLimit    = HOOK_LIMITS[plan]      ?? 0;

  const analyses = await getAnalyses(session.userId, plan);

  const usesStripeSubscription = !!user?.stripe_subscription_id;
  const showEliteUpgrade =
    !!user &&
    user.plan === 'pro' &&
    !!user.stripe_subscription_id &&
    isSubscriptionStatusAllowingAccess(user.subscription_status);
  // Stripe appends the real session ID — use it to verify the payment server-side
  const stripeSessionId = searchParams.session_id ?? null;

  return (
    <main className="min-h-screen bg-[#080808] overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-gradient-to-br from-[#ff0050]/5 to-[#7928ca]/5 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-10 pb-24">
        <DashboardClient
          email={session.email}
          plan={plan}
          billingPlan={billingPlan}
          usesStripeSubscription={usesStripeSubscription}
          showEliteUpgrade={showEliteUpgrade}
          analysesCount={analysesCount}
          analysesLimit={analysesLimit}
          hooksCount={hooksCount}
          hooksLimit={hooksLimit}
          memberSince={memberSince}
          analyses={analyses}
          stripeSessionId={stripeSessionId}
        />
      </div>
    </main>
  );
}
