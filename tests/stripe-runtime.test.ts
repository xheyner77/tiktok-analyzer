import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getStripePublishableKey,
  getStripePortalConfigurationId,
  getStripeSecretKey,
  getStripeWebhookSecret,
  readStripeRuntimeEnv,
  stripeScopedEnvName,
} from '@/lib/stripe-runtime';

const touchedEnv = [
  'VERCEL_ENV',
  'STRIPE_SECRET_KEY',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_LIVE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_TEST_WEBHOOK_SECRET',
  'STRIPE_LIVE_WEBHOOK_SECRET',
  'STRIPE_PORTAL_CONFIGURATION_ID',
  'STRIPE_TEST_PORTAL_CONFIGURATION_ID',
  'STRIPE_LIVE_PORTAL_CONFIGURATION_ID',
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_TEST_STARTER_PRICE_ID',
  'STRIPE_LIVE_STARTER_PRICE_ID',
] as const;

const previousEnv = Object.fromEntries(touchedEnv.map((key) => [key, process.env[key]]));

beforeEach(() => {
  for (const key of touchedEnv) delete process.env[key];
});

afterEach(() => {
  for (const key of touchedEnv) {
    const previous = previousEnv[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

describe('Stripe runtime isolation', () => {
  it('keeps canonical test variables available only for local development', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_local_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_value_123456';

    expect(getStripeSecretKey().envVar).toBe('STRIPE_SECRET_KEY');
    expect(getStripePublishableKey().envVar).toBe('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    expect(getStripeWebhookSecret().envVar).toBe('STRIPE_WEBHOOK_SECRET');
  });

  it('ignores a shared canonical live key in Preview', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.STRIPE_SECRET_KEY = 'sk_live_shared_value';

    expect(() => getStripeSecretKey()).toThrow(/stripe_secret_missing/);
  });

  it('refuses a live key even when it is stored in the Preview-specific variable', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.STRIPE_TEST_SECRET_KEY = 'sk_live_wrong_mode';

    expect(() => getStripeSecretKey()).toThrow(/stripe_secret_mode_mismatch/);
  });

  it('refuses a test key in Production', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.STRIPE_LIVE_SECRET_KEY = 'sk_test_wrong_mode';

    expect(() => getStripeSecretKey()).toThrow(/stripe_secret_mode_mismatch/);
  });

  it('requires mode-scoped publishable and webhook secrets on Vercel', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_live_shared_value';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_value_123456';

    expect(() => getStripePublishableKey()).toThrow(/stripe_publishable_key_missing/);
    expect(() => getStripeWebhookSecret()).toThrow(/stripe_webhook_secret_missing/);
  });

  it('selects only the Price ID scoped to the active Vercel mode', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.STRIPE_STARTER_PRICE_ID = 'price_live_shared';
    process.env.STRIPE_TEST_STARTER_PRICE_ID = 'price_test_preview';

    expect(stripeScopedEnvName('STRIPE_STARTER_PRICE_ID')).toBe('STRIPE_TEST_STARTER_PRICE_ID');
    expect(readStripeRuntimeEnv('STRIPE_STARTER_PRICE_ID')).toEqual({
      value: 'price_test_preview',
      envVar: 'STRIPE_TEST_STARTER_PRICE_ID',
    });
  });

  it('selects the test Customer Portal configuration only in Preview', () => {
    process.env.VERCEL_ENV = 'preview';
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_live_shared_value';
    process.env.STRIPE_TEST_PORTAL_CONFIGURATION_ID = 'bpc_test_preview_12345';

    expect(getStripePortalConfigurationId()).toEqual({
      value: 'bpc_test_preview_12345',
      envVar: 'STRIPE_TEST_PORTAL_CONFIGURATION_ID',
    });
  });
});
