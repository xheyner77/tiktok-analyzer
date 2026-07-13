import { getStripePriceRuntimeEnv } from '@/lib/stripe-runtime';

export type StripeMappedPlan = 'starter' | 'pro' | 'lifetime' | 'scale';

export type StripePriceMapping = {
  priceId: string;
  plan: StripeMappedPlan;
  legacy: boolean;
  envVar: string;
};

type EnvPlanMapping = {
  envVar: string;
  plan: StripeMappedPlan;
  legacy?: boolean;
};

const PRICE_ENV_MAPPINGS: EnvPlanMapping[] = [
  { envVar: 'STRIPE_STARTER_PRICE_ID', plan: 'starter' },
  { envVar: 'STRIPE_PRO_PRICE_ID', plan: 'pro' },
  { envVar: 'STRIPE_LIFETIME_PRICE_ID', plan: 'lifetime' },
  { envVar: 'STRIPE_LEGACY_PRO_PRICE_ID', plan: 'pro', legacy: true },

  // Legacy env names kept so existing deployments do not lose billing access.
  { envVar: 'STRIPE_PRICE_CREATOR_MONTHLY', plan: 'starter', legacy: true },
  { envVar: 'STRIPE_PRICE_PRO_MONTHLY', plan: 'pro', legacy: true },
  { envVar: 'STRIPE_PRICE_PRO_YEARLY', plan: 'pro', legacy: true },
  { envVar: 'STRIPE_PRICE_PRO', plan: 'pro', legacy: true },
  { envVar: 'STRIPE_PRICE_LIFETIME_ONETIME', plan: 'lifetime', legacy: true },
  // Scale reste un abonnement historique : droits hauts tant qu'il est actif,
  // mais jamais un achat Lifetime irrévocable.
  { envVar: 'STRIPE_PRICE_SCALE_MONTHLY', plan: 'scale', legacy: true },
  { envVar: 'STRIPE_PRICE_SCALE_YEARLY', plan: 'scale', legacy: true },
  { envVar: 'STRIPE_PRICE_ELITE', plan: 'pro', legacy: true },
];

export function listStripePriceMappings(): StripePriceMapping[] {
  const mappingsByPriceId = new Map<string, StripePriceMapping>();
  const conflictedPriceIds = new Set<string>();

  for (const mapping of PRICE_ENV_MAPPINGS) {
    const configured = getStripePriceRuntimeEnv(mapping.envVar);
    if (!configured || conflictedPriceIds.has(configured.value)) continue;
    const priceId = configured.value;

    const existing = mappingsByPriceId.get(priceId);
    if (existing) {
      // Plusieurs alias du meme plan restent compatibles. En revanche, un
      // Price ID partage entre deux plans est retire de la resolution : aucun
      // droit ne doit dependre de l'ordre des variables d'environnement.
      if (existing.plan !== mapping.plan) {
        mappingsByPriceId.delete(priceId);
        conflictedPriceIds.add(priceId);
      }
      continue;
    }

    mappingsByPriceId.set(priceId, {
      priceId,
      plan: mapping.plan,
      legacy: mapping.legacy ?? false,
      envVar: configured.envVar,
    });
  }

  return [...mappingsByPriceId.values()];
}

export function resolveStripePrice(priceId: string | null | undefined): StripePriceMapping | null {
  if (!priceId) return null;
  return listStripePriceMappings().find((mapping) => mapping.priceId === priceId) ?? null;
}

export function getConfiguredStripePriceId(envVars: string[]): { priceId: string; envVar: string } | null {
  const validPriceIds = new Set(listStripePriceMappings().map((mapping) => mapping.priceId));

  for (const envVar of envVars) {
    const configured = getStripePriceRuntimeEnv(envVar);
    if (configured && validPriceIds.has(configured.value)) {
      return { priceId: configured.value, envVar: configured.envVar };
    }
  }
  return null;
}
