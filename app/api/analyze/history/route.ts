import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { getAnalyses } from '@/lib/analyses';
import { privateJson } from '@/lib/api-route-security';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return privateJson({ analyses: [], locked: true }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return privateJson({ analyses: [], locked: true }, { status: 404 });
    }

    const tier = getEffectivePlan(user);
    const analyses = await getAnalyses(session.userId, tier);
    const dashboardCap = tier === 'lifetime' ? analyses.length : Math.min(analyses.length, 30);
    return privateJson({
      analyses: analyses.slice(0, dashboardCap),
      locked: tier === 'free',
      plan: tier,
      billingPlan: user.plan,
    });
  } catch (error) {
    console.error('[analyze/history] Erreur inattendue.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ analyses: [], locked: true }, { status: 500 });
  }
}
