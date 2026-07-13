import { getPlanLimits, type PlanLimits } from './plans';
import { STRIPE_CATALOG } from './stripe-pricing';

export const COMMERCIAL_PLAN_IDS = ['free', 'starter', 'pro', 'lifetime'] as const;

export type CommercialPlanId = (typeof COMMERCIAL_PLAN_IDS)[number];
export type PaidCommercialPlanId = Exclude<CommercialPlanId, 'free'>;

export interface PublicPlan {
  id: CommercialPlanId;
  name: 'Free' | 'Starter' | 'Pro' | 'Lifetime';
  priceCents: number;
  priceAmount: string;
  priceLabel: string;
  cadence: string;
  description: string;
  limits: PlanLimits;
  features: readonly string[];
  cta: string;
  commerciallyAvailable: true;
  checkoutEnabled: boolean;
  featured?: boolean;
}

export type PaidPublicPlan = PublicPlan & { id: PaidCommercialPlanId };

function formatEuroAmount(priceCents: number): string {
  return Number.isInteger(priceCents / 100)
    ? String(priceCents / 100)
    : (priceCents / 100).toFixed(2).replace('.', ',');
}

function formatAnalyses(value: number, cadence?: 'total' | 'month'): string {
  if (!Number.isFinite(value)) return 'Analyses illimitées';
  if (cadence === 'total') return `${value} analyses au total`;
  if (cadence === 'month') return `${value} analyses par mois`;
  return `${value} analyses`;
}

function formatHooks(value: number, cadence?: 'month'): string {
  if (!Number.isFinite(value)) return 'Hooks illimités';
  return cadence === 'month' ? `${value} hooks par mois` : `${value} hooks`;
}

function historyFeature(value: number): string {
  return value > 0 ? `${value} analyses conservées` : 'Historique non conservé';
}

function buildPublicPlan(
  input: Omit<PublicPlan, 'priceAmount' | 'priceLabel' | 'limits' | 'features'> & {
    featureFactory: (limits: PlanLimits) => readonly string[];
  },
): PublicPlan {
  const limits = getPlanLimits(input.id);
  const priceAmount = formatEuroAmount(input.priceCents);
  const { featureFactory, ...plan } = input;

  return Object.freeze({
    ...plan,
    priceAmount,
    priceLabel: `${priceAmount} €`,
    limits,
    features: Object.freeze(featureFactory(limits)),
  });
}

export const PUBLIC_PLANS: readonly PublicPlan[] = Object.freeze([
  buildPublicPlan({
    id: 'free',
    name: 'Free',
    priceCents: 0,
    cadence: 'sans carte bancaire',
    description: 'Pour tester le diagnostic sur tes premières vidéos.',
    cta: 'Tester Viralynz',
    commerciallyAvailable: true,
    checkoutEnabled: false,
    featureFactory: (limits) => [
      formatAnalyses(limits.analyses, 'total'),
      'Diagnostic et décisions de montage',
      'Connexion TikTok non obligatoire',
      historyFeature(limits.history),
    ],
  }),
  buildPublicPlan({
    id: 'starter',
    name: 'Starter',
    priceCents: STRIPE_CATALOG.starter.unitAmount,
    cadence: 'par mois',
    description: 'Pour analyser régulièrement et retravailler tes hooks.',
    cta: 'Choisir Starter',
    commerciallyAvailable: true,
    checkoutEnabled: true,
    featureFactory: (limits) => [
      formatAnalyses(limits.analyses, 'month'),
      formatHooks(limits.hooks, 'month'),
      historyFeature(limits.history),
      'Diagnostic et plan de remontage',
    ],
  }),
  buildPublicPlan({
    id: 'pro',
    name: 'Pro',
    priceCents: STRIPE_CATALOG.pro.unitAmount,
    cadence: 'par mois',
    description: 'Pour produire des V2 et suivre un volume plus soutenu.',
    cta: 'Choisir Pro',
    commerciallyAvailable: true,
    checkoutEnabled: true,
    featured: true,
    featureFactory: (limits) => [
      formatAnalyses(limits.analyses, 'month'),
      formatHooks(limits.hooks, 'month'),
      `${limits.reconstructions} reconstructions V2 par mois`,
      historyFeature(limits.history),
    ],
  }),
  buildPublicPlan({
    id: 'lifetime',
    name: 'Lifetime',
    priceCents: STRIPE_CATALOG.lifetime.unitAmount,
    cadence: 'paiement unique',
    description: 'Pour garder l’accès sans abonnement mensuel.',
    cta: 'Choisir Lifetime',
    commerciallyAvailable: true,
    checkoutEnabled: true,
    featureFactory: (limits) => [
      formatAnalyses(limits.analyses),
      formatHooks(limits.hooks),
      `${limits.reconstructions} reconstructions V2 disponibles`,
      historyFeature(limits.history),
    ],
  }),
]);

export const PAID_PUBLIC_PLANS = PUBLIC_PLANS.filter(
  (plan): plan is PaidPublicPlan => plan.checkoutEnabled,
);

export const PUBLIC_CHECKOUT_PLAN_IDS: readonly PaidCommercialPlanId[] = Object.freeze(
  PAID_PUBLIC_PLANS.map((plan) => plan.id),
);

export function isPaidCommercialPlan(value: unknown): value is PaidCommercialPlanId {
  return typeof value === 'string'
    && (PUBLIC_CHECKOUT_PLAN_IDS as readonly string[]).includes(value);
}

export function getPublicPlan(id: CommercialPlanId): PublicPlan {
  const plan = PUBLIC_PLANS.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`Plan public introuvable : ${id}`);
  return plan;
}
