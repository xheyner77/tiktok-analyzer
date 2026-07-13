export type StripeRuntimeMode = 'test' | 'live';

type RuntimeValue = {
  value: string;
  envVar: string;
};

export class StripeRuntimeConfigurationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'StripeRuntimeConfigurationError';
  }
}

function cleanEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getStripeRuntimeMode(): StripeRuntimeMode {
  return process.env.VERCEL_ENV === 'production' ? 'live' : 'test';
}

export function isStripeLiveRuntime(): boolean {
  return getStripeRuntimeMode() === 'live';
}

export function stripeScopedEnvName(
  canonicalName: string,
  mode: StripeRuntimeMode = getStripeRuntimeMode(),
): string {
  const modeLabel = mode.toUpperCase();

  if (canonicalName === 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') {
    return `NEXT_PUBLIC_STRIPE_${modeLabel}_PUBLISHABLE_KEY`;
  }

  if (!canonicalName.startsWith('STRIPE_')) {
    throw new StripeRuntimeConfigurationError('unsupported_stripe_env_name');
  }

  return `STRIPE_${modeLabel}_${canonicalName.slice('STRIPE_'.length)}`;
}

/**
 * On Vercel, Stripe is deliberately configured with mode-scoped variables.
 * This prevents a shared live variable from silently leaking into Preview.
 * Local development keeps the historical canonical names as a safe test-mode
 * fallback so `.env.local` remains usable.
 */
export function readStripeRuntimeEnv(canonicalName: string): RuntimeValue | null {
  const scopedName = stripeScopedEnvName(canonicalName);
  const scopedValue = cleanEnv(scopedName);
  if (scopedValue) return { value: scopedValue, envVar: scopedName };

  if (process.env.VERCEL_ENV) return null;

  const canonicalValue = cleanEnv(canonicalName);
  return canonicalValue ? { value: canonicalValue, envVar: canonicalName } : null;
}

function requireRuntimeEnv(canonicalName: string, missingCode: string): RuntimeValue {
  const configured = readStripeRuntimeEnv(canonicalName);
  if (!configured) throw new StripeRuntimeConfigurationError(missingCode);
  return configured;
}

export function getStripeSecretKey(): RuntimeValue {
  const configured = requireRuntimeEnv('STRIPE_SECRET_KEY', 'stripe_secret_missing');
  const expectedPrefix = getStripeRuntimeMode() === 'live' ? 'sk_live_' : 'sk_test_';

  if (!configured.value.startsWith(expectedPrefix)) {
    throw new StripeRuntimeConfigurationError('stripe_secret_mode_mismatch');
  }

  return configured;
}

export function getStripePublishableKey(): RuntimeValue {
  const configured = requireRuntimeEnv(
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'stripe_publishable_key_missing',
  );
  const expectedPrefix = getStripeRuntimeMode() === 'live' ? 'pk_live_' : 'pk_test_';

  if (!configured.value.startsWith(expectedPrefix)) {
    throw new StripeRuntimeConfigurationError('stripe_publishable_key_mode_mismatch');
  }

  return configured;
}

export function getStripeWebhookSecret(): RuntimeValue {
  const configured = requireRuntimeEnv('STRIPE_WEBHOOK_SECRET', 'stripe_webhook_secret_missing');
  if (!/^whsec_[A-Za-z0-9_]{16,}$/.test(configured.value)) {
    throw new StripeRuntimeConfigurationError('stripe_webhook_secret_invalid');
  }
  return configured;
}

export function getStripePortalConfigurationId(): RuntimeValue {
  const configured = requireRuntimeEnv(
    'STRIPE_PORTAL_CONFIGURATION_ID',
    'stripe_portal_configuration_missing',
  );
  if (!/^bpc_[A-Za-z0-9_]{8,}$/.test(configured.value)) {
    throw new StripeRuntimeConfigurationError('stripe_portal_configuration_invalid');
  }
  return configured;
}

export function getStripePriceRuntimeEnv(canonicalName: string): RuntimeValue | null {
  if (!canonicalName.startsWith('STRIPE_')) {
    throw new StripeRuntimeConfigurationError('unsupported_stripe_price_env_name');
  }
  return readStripeRuntimeEnv(canonicalName);
}
