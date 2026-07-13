import { clearSessionCookies, getSessionVerification } from '@/lib/session';
import { ensureUserProfile, getEffectivePlan } from '@/lib/auth';
import { listTikTokAccountsForUser } from '@/lib/tiktok-accounts';
import { privateJson } from '@/lib/api-route-security';

export async function GET() {
  const verification = await getSessionVerification();

  if (verification.status === 'unavailable') {
    return privateJson(
      {
        error: 'Session temporairement indisponible. Réessaie dans un instant.',
        code: 'AUTH_UNAVAILABLE',
      },
      { status: 503 },
    );
  }

  if (verification.status !== 'authenticated') {
    // Supprime aussi les fragments de session invalides ou le cookie JWT historique.
    await clearSessionCookies();
    return privateJson({ user: null });
  }

  const { session } = verification;

  try {
    const user = await ensureUserProfile({
      userId: session.userId,
      email: session.email,
    });

    if (!user) {
      return privateJson(
        {
          error: 'Données du compte temporairement indisponibles.',
          code: 'DATA_UNAVAILABLE',
        },
        { status: 503 },
      );
    }

    const effective = getEffectivePlan(user);
    const tiktokAccounts = await listTikTokAccountsForUser(user.id);
    const activeTikTokAccounts = tiktokAccounts.filter((account) => account.status === 'active');

    return privateJson({
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
  } catch (error) {
    console.error('[api/auth/me] account_data_unavailable', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return privateJson(
      {
        error: 'Données du compte temporairement indisponibles.',
        code: 'DATA_UNAVAILABLE',
      },
      { status: 503 },
    );
  }
}
