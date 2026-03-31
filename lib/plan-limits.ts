/**
 * Quotas d’abonnement — source unique pour l’API et l’UI.
 * (Free : analyses = quota « vie » ; Pro/Elite : analyses + hooks = par mois calendaire, voir auth.checkAndResetMonthly.)
 */

export const MAX_ANALYSES_FREE = 3;
export const MAX_ANALYSES_PRO = 50;
export const MAX_ANALYSES_ELITE = 200;

export const MAX_HOOKS_PRO = 150;
export const MAX_HOOKS_ELITE = 500;

/** Analyses par période (free = lifetime ; pro/elite = mois calendaire) */
export const PLAN_LIMITS: Record<string, number> = {
  free: MAX_ANALYSES_FREE,
  pro: MAX_ANALYSES_PRO,
  elite: MAX_ANALYSES_ELITE,
};

/** Hooks générés / mois (0 = fonctionnalité indisponible) */
export const HOOK_LIMITS: Record<string, number> = {
  free: 0,
  pro: MAX_HOOKS_PRO,
  elite: MAX_HOOKS_ELITE,
};
