/**
 * Quotas d’abonnement — source unique pour l’API et l’UI.
 * (Free : analyses = quota « vie » ; Creator/Pro/Scale : quotas mensuels, voir auth.checkAndResetMonthly.)
 */

export const MAX_ANALYSES_FREE = 3;
export const MAX_ANALYSES_CREATOR = 30;
export const MAX_ANALYSES_PRO = 150;
export const MAX_ANALYSES_SCALE = Number.POSITIVE_INFINITY;

export const MAX_HOOKS_CREATOR = 150;
export const MAX_HOOKS_PRO = 500;
export const MAX_HOOKS_SCALE = Number.POSITIVE_INFINITY;

export const MAX_RECONSTRUCTIONS_CREATOR = 0;
export const MAX_RECONSTRUCTIONS_PRO = 30;
export const MAX_RECONSTRUCTIONS_SCALE = 150;

/** Analyses par période (free = lifetime ; plans payants = mois calendaire) */
export const PLAN_LIMITS: Record<string, number> = {
  free: MAX_ANALYSES_FREE,
  creator: MAX_ANALYSES_CREATOR,
  pro: MAX_ANALYSES_PRO,
  scale: MAX_ANALYSES_SCALE,
};

/** Hooks générés / mois (0 = fonctionnalité indisponible) */
export const HOOK_LIMITS: Record<string, number> = {
  free: 0,
  creator: MAX_HOOKS_CREATOR,
  pro: MAX_HOOKS_PRO,
  scale: MAX_HOOKS_SCALE,
};

export const RECONSTRUCTION_LIMITS: Record<string, number> = {
  free: 0,
  creator: MAX_RECONSTRUCTIONS_CREATOR,
  pro: MAX_RECONSTRUCTIONS_PRO,
  scale: MAX_RECONSTRUCTIONS_SCALE,
};

/** Nombre d'analyses conservées dans l'historique par plan */
export const HISTORY_LIMITS: Record<string, number> = {
  free: 0,
  creator: 30,
  pro: 200,
  scale: Infinity,
};

/** Nombre d'analyses/snapshots utilisables par la memoire IA interne */
export const CREATOR_MEMORY_LIMITS: Record<string, number> = {
  free: 3,
  creator: 20,
  pro: 120,
  scale: 500,
};

/** Niveau de profondeur autorise pour les patterns memoire */
export const CREATOR_MEMORY_DEPTH: Record<string, 'short' | 'simple' | 'extended' | 'cross_account'> = {
  free: 'short',
  creator: 'simple',
  pro: 'extended',
  scale: 'cross_account',
};

export function getCreatorMemoryLimit(plan: string): number {
  return CREATOR_MEMORY_LIMITS[plan] ?? CREATOR_MEMORY_LIMITS.free;
}
