import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_PLAN_IDS,
  PAID_PUBLIC_PLANS,
  PUBLIC_CHECKOUT_PLAN_IDS,
  PUBLIC_PLANS,
  getPublicPlan,
  isPaidCommercialPlan,
} from '@/lib/public-plans';
import { getPlanLimits } from '@/lib/plans';
import { STRIPE_CATALOG } from '@/lib/stripe-pricing';

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('public commercial plan contract', () => {
  it('publishes exactly Free, Starter, Pro and Lifetime', () => {
    expect(COMMERCIAL_PLAN_IDS).toEqual(['free', 'starter', 'pro', 'lifetime']);
    expect(PUBLIC_PLANS.map((plan) => plan.id)).toEqual(COMMERCIAL_PLAN_IDS);
    expect(PUBLIC_PLANS.map((plan) => plan.name)).toEqual(['Free', 'Starter', 'Pro', 'Lifetime']);
    expect(PUBLIC_PLANS.every((plan) => plan.commerciallyAvailable)).toBe(true);
  });

  it('exposes only the authorized prices and cadences', () => {
    expect(getPublicPlan('free')).toMatchObject({ priceCents: 0, priceLabel: '0 €', cadence: 'sans carte bancaire' });
    expect(getPublicPlan('starter')).toMatchObject({ priceCents: 1_000, priceLabel: '10 €', cadence: 'par mois' });
    expect(getPublicPlan('pro')).toMatchObject({ priceCents: 2_900, priceLabel: '29 €', cadence: 'par mois' });
    expect(getPublicPlan('lifetime')).toMatchObject({ priceCents: 14_900, priceLabel: '149 €', cadence: 'paiement unique' });
  });

  it('derives every public entitlement from the quota contract', () => {
    for (const plan of PUBLIC_PLANS) {
      expect(plan.limits).toEqual(getPlanLimits(plan.id));
    }

    expect(getPublicPlan('free').limits).toMatchObject({ analyses: 3, hooks: 0, reconstructions: 0, history: 0 });
    expect(getPublicPlan('starter').limits).toMatchObject({ analyses: 30, hooks: 50, reconstructions: 0, history: 30 });
    expect(getPublicPlan('pro').limits).toMatchObject({ analyses: 150, hooks: 250, reconstructions: 30, history: 200 });
    expect(getPublicPlan('lifetime').limits).toMatchObject({
      analyses: Number.POSITIVE_INFINITY,
      hooks: Number.POSITIVE_INFINITY,
      reconstructions: 30,
      history: 1000,
    });
  });

  it('keeps public amounts identical to the Stripe catalogue', () => {
    for (const plan of PAID_PUBLIC_PLANS) {
      expect(plan.priceCents).toBe(STRIPE_CATALOG[plan.id].unitAmount);
      expect(STRIPE_CATALOG[plan.id].currency).toBe('eur');
      expect(STRIPE_CATALOG[plan.id].recurringInterval).toBe(plan.id === 'lifetime' ? null : 'month');
    }
    expect(Object.keys(STRIPE_CATALOG)).toEqual(['starter', 'pro', 'lifetime']);
  });

  it('allows new Checkout only for Starter, Pro and Lifetime', () => {
    expect(PUBLIC_CHECKOUT_PLAN_IDS).toEqual(['starter', 'pro', 'lifetime']);
    expect(PUBLIC_PLANS.filter((plan) => plan.checkoutEnabled).map((plan) => plan.id))
      .toEqual(PUBLIC_CHECKOUT_PLAN_IDS);
    expect(isPaidCommercialPlan('starter')).toBe(true);
    expect(isPaidCommercialPlan('pro')).toBe(true);
    expect(isPaidCommercialPlan('lifetime')).toBe(true);
    for (const legacyOrInvalid of ['free', 'creator', 'scale', 'elite', undefined, null]) {
      expect(isPaidCommercialPlan(legacyOrInvalid)).toBe(false);
    }
  });

  it('provides one honest CTA and a complete feature list per plan', () => {
    for (const plan of PUBLIC_PLANS) {
      expect(plan.cta.trim()).not.toBe('');
      expect(plan.features).toHaveLength(4);
      expect(plan.features.every((feature) => feature.trim().length > 0)).toBe(true);
    }
    expect(getPublicPlan('starter').features).toContain('30 analyses conservées');
    expect(getPublicPlan('pro').features).toContain('200 analyses conservées');
    expect(getPublicPlan('lifetime').features).toContain('1000 analyses conservées');
  });

  it('keeps landing, pricing, billing and Checkout on the shared catalogue', () => {
    expect(source('components/landing/HomeLanding.tsx')).toContain("@/components/landing/LandingPricingSection");
    for (const relativePath of [
      'components/landing/LandingPricingSection.tsx',
      'app/pricing/page.tsx',
      'app/dashboard/billing/page.tsx',
      'components/GuestGate.tsx',
      'components/PremiumGate.tsx',
      'app/legal/cgv/page.tsx',
      'app/api/checkout/route.ts',
      'app/api/upgrade-plan/route.ts',
    ]) {
      expect(source(relativePath), relativePath).toContain('@/lib/public-plans');
    }
  });
});
