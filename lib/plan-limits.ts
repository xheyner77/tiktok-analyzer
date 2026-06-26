/**
 * Quotas d’abonnement — source unique pour l’API et l’UI.
 * (Free : analyses = quota « vie » ; Starter/Pro : quotas mensuels. Lifetime utilise des limites hautes anti-abus.)
 */

export const MAX_ANALYSES_FREE = 3;
export const MAX_ANALYSES_STARTER = 30;
export const MAX_ANALYSES_PRO = 150;
export const MAX_ANALYSES_LIFETIME = Number.POSITIVE_INFINITY;
export const MAX_ANALYSES_CREATOR = MAX_ANALYSES_STARTER;
export const MAX_ANALYSES_SCALE = MAX_ANALYSES_LIFETIME;

export const MAX_HOOKS_STARTER = 50;
export const MAX_HOOKS_PRO = 250;
export const MAX_HOOKS_LIFETIME = Number.POSITIVE_INFINITY;
export const MAX_HOOKS_CREATOR = MAX_HOOKS_STARTER;
export const MAX_HOOKS_SCALE = MAX_HOOKS_LIFETIME;

export const MAX_RECONSTRUCTIONS_STARTER = 0;
export const MAX_RECONSTRUCTIONS_PRO = 30;
export const MAX_RECONSTRUCTIONS_LIFETIME = MAX_RECONSTRUCTIONS_PRO;
export const MAX_RECONSTRUCTIONS_CREATOR = MAX_RECONSTRUCTIONS_STARTER;
export const MAX_RECONSTRUCTIONS_SCALE = MAX_RECONSTRUCTIONS_LIFETIME;

/** Analyses par période (free = lifetime ; plans payants = mois calendaire) */
export const PLAN_LIMITS: Record<string, number> = {
  free: MAX_ANALYSES_FREE,
  starter: MAX_ANALYSES_STARTER,
  pro: MAX_ANALYSES_PRO,
  lifetime: MAX_ANALYSES_LIFETIME,
  creator: MAX_ANALYSES_STARTER,
  scale: MAX_ANALYSES_LIFETIME,
};

/** Hooks générés / mois (0 = fonctionnalité indisponible) */
export const HOOK_LIMITS: Record<string, number> = {
  free: 0,
  starter: MAX_HOOKS_STARTER,
  pro: MAX_HOOKS_PRO,
  lifetime: MAX_HOOKS_LIFETIME,
  creator: MAX_HOOKS_STARTER,
  scale: MAX_HOOKS_LIFETIME,
};

export const RECONSTRUCTION_LIMITS: Record<string, number> = {
  free: 0,
  starter: MAX_RECONSTRUCTIONS_STARTER,
  pro: MAX_RECONSTRUCTIONS_PRO,
  lifetime: MAX_RECONSTRUCTIONS_LIFETIME,
  creator: MAX_RECONSTRUCTIONS_STARTER,
  scale: MAX_RECONSTRUCTIONS_LIFETIME,
};

/** Nombre d'analyses conservées dans l'historique par plan */
export const HISTORY_LIMITS: Record<string, number> = {
  free: 0,
  starter: 30,
  pro: 200,
  lifetime: 1000,
  creator: 30,
  scale: 1000,
};

/** Nombre d'analyses/snapshots utilisables par la memoire IA interne */
export const CREATOR_MEMORY_LIMITS: Record<string, number> = {
  free: 3,
  starter: 20,
  pro: 120,
  lifetime: 300,
  creator: 20,
  scale: 300,
};

/** Niveau de profondeur autorise pour les patterns memoire */
export const CREATOR_MEMORY_DEPTH: Record<string, 'short' | 'simple' | 'extended' | 'cross_account'> = {
  free: 'short',
  starter: 'simple',
  pro: 'extended',
  lifetime: 'extended',
  creator: 'simple',
  scale: 'extended',
};

export function getCreatorMemoryLimit(plan: string): number {
  return CREATOR_MEMORY_LIMITS[plan] ?? CREATOR_MEMORY_LIMITS.free;
}
