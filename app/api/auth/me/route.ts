import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(session.userId);

  if (!user) {
    return NextResponse.json({
      user: {
        id: session.userId,
        email: session.email,
        plan: 'free',
        billingPlan: 'free' as const,
        analyses_count: 0,
        hooks_count: 0,
        created_at: new Date().toISOString(),
        subscriptionStatus: null,
        subscriptionCancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      },
    });
  }

  const effective = getEffectivePlan(user);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      plan: effective,
      billingPlan: user.plan,
      analyses_count: user.analyses_count,
      hooks_count: user.hooks_count,
      created_at: user.created_at,
      subscriptionStatus: user.subscription_status,
      subscriptionCancelAtPeriodEnd: user.subscription_cancel_at_period_end,
      currentPeriodEnd: user.subscription_current_period_end,
    },
  });
}
