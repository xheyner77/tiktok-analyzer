export type StripeMappedPlan = 'starter' | 'pro' | 'lifetime';

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
  { envVar: 'STRIPE_PRICE_SCALE_MONTHLY', plan: 'lifetime', legacy: true },
  { envVar: 'STRIPE_PRICE_SCALE_YEARLY', plan: 'lifetime', legacy: true },
  { envVar: 'STRIPE_PRICE_ELITE', plan: 'pro', legacy: true },
];

function cleanEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function listStripePriceMappings(): StripePriceMapping[] {
  const seen = new Set<string>();

  return PRICE_ENV_MAPPINGS.flatMap((mapping) => {
    const priceId = cleanEnv(mapping.envVar);
    if (!priceId || seen.has(priceId)) return [];
    seen.add(priceId);
    return [{
      priceId,
      plan: mapping.plan,
      legacy: mapping.legacy ?? false,
      envVar: mapping.envVar,
    }];
  });
}

export function resolveStripePrice(priceId: string | null | undefined): StripePriceMapping | null {
  if (!priceId) return null;
  return listStripePriceMappings().find((mapping) => mapping.priceId === priceId) ?? null;
}

export function getConfiguredStripePriceId(envVars: string[]): { priceId: string; envVar: string } | null {
  for (const envVar of envVars) {
    const priceId = cleanEnv(envVar);
    if (priceId) return { priceId, envVar };
  }
  return null;
}
