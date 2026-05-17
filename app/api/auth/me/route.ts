import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { listTikTokAccountsForUser } from '@/lib/tiktok-accounts';

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
        reconstructions_count: 0,
        created_at: new Date().toISOString(),
        subscriptionStatus: null,
        subscriptionCancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        tiktok: { connected: false, displayName: null, avatarUrl: null },
      },
    });
  }

  const effective = getEffectivePlan(user);
  const tiktokAccounts = await listTikTokAccountsForUser(user.id);
  const activeTikTokAccounts = tiktokAccounts.filter((account) => account.status === 'active');

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      plan: effective,
      billingPlan: user.plan,
      analyses_count: user.analyses_count,
      hooks_count: user.hooks_count,
      reconstructions_count: user.reconstructions_count,
      created_at: user.created_at,
      subscriptionStatus: user.subscription_status,
      subscriptionCancelAtPeriodEnd: user.subscription_cancel_at_period_end,
      currentPeriodEnd: user.subscription_current_period_end,
      tiktok: {
        connected: activeTikTokAccounts.length > 0 || !!user.tiktok_open_id,
        activeAccounts: activeTikTokAccounts.length,
        displayName: user.tiktok_display_name,
        avatarUrl: user.tiktok_avatar_url,
      },
    },
  });
}
