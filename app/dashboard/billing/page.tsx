import { redirect } from 'next/navigation';
import BillingActionButton from '@/components/dashboard-v2/BillingActionButton';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { normalizePlan, type AppPlan } from '@/lib/plans';
import { getSession } from '@/lib/session';
import { isSubscriptionStatusAllowingAccess, type PaidStripePlan } from '@/lib/stripe-billing';
import {
  DISPLAY_CATALOG_CREATOR_EUR,
  DISPLAY_CATALOG_LIFETIME_EUR,
  DISPLAY_CATALOG_PRO_EUR,
} from '@/lib/stripe-pricing';

export const dynamic = 'force-dynamic';

type PlanCard = {
  id: PaidStripePlan;
  rank: number;
  name: string;
  badge?: string;
  icon: 'bolt' | 'crown' | 'infinity';
  price: string;
  cadence: string;
  subtitle?: string;
  benefit?: string;
  features: Array<string | { label: string; available: boolean }>;
  cta: string;
};

const planRank: Record<AppPlan, number> = { free: 0, starter: 1, creator: 1, pro: 2, lifetime: 3, scale: 3 };

const plans: PlanCard[] = [
  {
    id: 'starter',
    rank: 1,
    name: 'Starter',
    icon: 'bolt',
    price: `${DISPLAY_CATALOG_CREATOR_EUR}€`,
    cadence: '/mois',
    subtitle: 'Pour découvrir Viralynz et comprendre pourquoi tes vidéos flop.',
    features: [
      '30 analyses vidéo / mois',
      '50 hooks générés / mois',
      'Analyse complète',
      'Score de viralité',
      'Historique limité',
      { label: 'Radar tendances inclus', available: false },
    ],
    cta: `Commencer — ${DISPLAY_CATALOG_CREATOR_EUR}€/mois`,
  },
  {
    id: 'pro',
    rank: 2,
    name: 'Pro',
    badge: '⭐ ⭐ Populaire',
    icon: 'crown',
    price: `${DISPLAY_CATALOG_PRO_EUR}€`,
    cadence: '/mois',
    subtitle: 'Pour améliorer tes vidéos et obtenir une version prête à reposter.',
    features: [
      '100 analyses vidéo / mois',
      '200 hooks générés / mois',
      'Analyse complète détaillée',
      'Version corrigée prête à reposter',
      'Radar tendances inclus',
      'Historique complet',
    ],
    cta: `Débloquer Pro — ${DISPLAY_CATALOG_PRO_EUR}€/mois`,
  },
  {
    id: 'lifetime',
    rank: 3,
    name: 'Lifetime',
    badge: '∞ ∞ À vie',
    icon: 'infinity',
    price: `${DISPLAY_CATALOG_LIFETIME_EUR}€`,
    cadence: 'une seule fois',
    benefit: 'Économise +199€/an vs mensuel',
    features: [
      'Analyses vidéo illimitées à vie',
      'Hooks générés illimités à vie',
      'Analyse avancée complète',
      'Version corrigée prête à reposter',
      'Radar tendances inclus',
      'Plus jamais de paiement mensuel',
      'Priorité nouvelles features',
    ],
    cta: `Prendre Lifetime — ${DISPLAY_CATALOG_LIFETIME_EUR}€`,
  },
];

const primaryButton =
  'inline-flex min-h-[40px] items-center justify-center rounded-[7px] px-4 text-[13px] font-black transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2';

const secondaryButton =
  'inline-flex min-h-[40px] items-center justify-center rounded-[7px] border border-white/[0.10] bg-white/[0.04] px-4 text-[13px] font-black text-slate-300 transition duration-200 hover:border-cyan-200/20 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-200/25';

const checkoutButtonStyles: Record<string, string> = {
  starter: 'bg-[linear-gradient(135deg,#1db7d1_0%,#5b5cf6_100%)] text-white shadow-[0_16px_42px_-30px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.16)] focus:ring-cyan-300/35',
  pro: 'bg-[linear-gradient(135deg,#a855f7_0%,#7c3aed_52%,#4f46e5_100%)] text-white shadow-[0_22px_58px_-28px_rgba(139,92,246,1),inset_0_1px_0_rgba(255,255,255,0.18)] focus:ring-violet-300/45',
  lifetime: 'bg-[linear-gradient(135deg,#facc15_0%,#fb923c_100%)] text-[#070811] shadow-[0_18px_48px_-30px_rgba(251,191,36,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] focus:ring-amber-300/45',
};

function PlanIcon({ icon, tone }: { icon: PlanCard['icon']; tone: 'starter' | 'pro' | 'lifetime' }) {
  const className = tone === 'lifetime' ? 'h-[22px] w-[22px] text-amber-300' : tone === 'pro' ? 'h-[22px] w-[22px] text-violet-300' : 'h-[22px] w-[22px] text-cyan-300';
  const stroke = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (icon === 'crown') {
    return (
      <svg {...stroke}>
        <path d="m3 8 4 4 5-8 5 8 4-4v10H3V8Z" />
        <path d="M3 18h18" />
      </svg>
    );
  }

  if (icon === 'infinity') {
    return (
      <svg {...stroke}>
        <path d="M18.2 7.8c-2.4 0-4.1 2.2-6.2 4.2-2.1 2-3.8 4.2-6.2 4.2A4.2 4.2 0 1 1 5.8 7.8c2.4 0 4.1 2.2 6.2 4.2 2.1 2 3.8 4.2 6.2 4.2a4.2 4.2 0 1 0 0-8.4Z" />
      </svg>
    );
  }

  return (
    <svg {...stroke}>
      <path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" />
    </svg>
  );
}

function CheckIcon({ tone }: { tone: 'starter' | 'pro' | 'lifetime' }) {
  const color = tone === 'lifetime' ? 'text-amber-300' : tone === 'pro' ? 'text-violet-300' : 'text-cyan-300';

  return (
    <svg className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${color}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="m4.5 10.5 3.2 3.2 7.8-8.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BadgeStarIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-yellow-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="m10 1.75 2.35 5.05 5.42.82-3.92 3.98.92 5.62L10 14.56l-4.77 2.66.92-5.62-3.92-3.98 5.42-.82L10 1.75Z" />
    </svg>
  );
}

function BadgeInfinityIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18.2 7.8c-2.4 0-4.1 2.2-6.2 4.2-2.1 2-3.8 4.2-6.2 4.2A4.2 4.2 0 1 1 5.8 7.8c2.4 0 4.1 2.2 6.2 4.2 2.1 2 3.8 4.2 6.2 4.2a4.2 4.2 0 1 0 0-8.4Z" />
    </svg>
  );
}

function PlanBadge({ tone }: { tone: 'pro' | 'lifetime' }) {
  const className = tone === 'pro'
    ? 'border-violet-200/30 bg-[linear-gradient(135deg,#c084fc_0%,#7c3aed_100%)] text-white shadow-[0_16px_34px_-22px_rgba(139,92,246,0.95)]'
    : 'border-amber-100/45 bg-[linear-gradient(135deg,#facc15_0%,#fb923c_100%)] text-[#070811] shadow-[0_16px_34px_-22px_rgba(251,191,36,0.95)]';

  return (
    <div
      className={`absolute left-1/2 top-0 z-10 flex h-[28px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[11px] font-black leading-none tracking-[-0.01em] ${className}`}
      aria-label={tone === 'pro' ? '⭐ ⭐ Populaire' : '∞ ∞ À vie'}
    >
      {tone === 'pro' ? (
        <>
          <BadgeStarIcon />
          <BadgeStarIcon />
          <span>Populaire</span>
        </>
      ) : (
        <>
          <BadgeInfinityIcon />
          <BadgeInfinityIcon />
          <span>À vie</span>
        </>
      )}
    </div>
  );
}

function PlanAction({
  plan,
  effectivePlan,
  hasActiveStripeSubscription,
  hasStripeCustomer,
}: {
  plan: PlanCard;
  effectivePlan: AppPlan;
  hasActiveStripeSubscription: boolean;
  hasStripeCustomer: boolean;
}) {
  const currentRank = planRank[effectivePlan] ?? 0;

  if (effectivePlan === normalizePlan(plan.id)) {
    return (
      <button type="button" disabled className="min-h-[40px] w-full rounded-[7px] border border-white/[0.10] bg-white/[0.045] px-4 text-[13px] font-black text-slate-400">
        Plan actuel
      </button>
    );
  }

  if (currentRank > plan.rank) {
    return (
      <button type="button" disabled className="min-h-[40px] w-full rounded-[7px] border border-white/[0.08] bg-white/[0.025] px-4 text-[13px] font-black text-slate-500">
        Inclus
      </button>
    );
  }

  if (hasActiveStripeSubscription && plan.id !== 'lifetime' && hasStripeCustomer) {
    return (
      <BillingActionButton action="portal" fullWidth className={`${secondaryButton} w-full`}>
        Gérer la facturation
      </BillingActionButton>
    );
  }

  return (
    <BillingActionButton action="checkout" plan={plan.id} fullWidth className={`${primaryButton} ${checkoutButtonStyles[plan.id]} w-full`}>
      {plan.cta}
    </BillingActionButton>
  );
}

export default async function DashboardBillingPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/billing');

  const profile = await getUserById(session.userId);
  const effectivePlan = normalizePlan(profile ? getEffectivePlan(profile) : 'free');
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const hasActiveStripeSubscription = Boolean(profile?.stripe_subscription_id && isSubscriptionStatusAllowingAccess(profile.subscription_status));

  return (
    <section className="relative isolate mx-auto w-full max-w-[970px] pb-8 pt-0 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-118px] -z-10 h-[640px] w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 bg-[radial-gradient(ellipse_62%_38%_at_50%_0%,rgba(124,58,237,0.24),transparent_64%),radial-gradient(ellipse_40%_28%_at_76%_18%,rgba(34,211,238,0.08),transparent_68%),linear-gradient(180deg,rgba(6,9,21,0.18)_0%,rgba(5,8,22,0.10)_56%,transparent_100%)]" aria-hidden />

      <header className="text-center">
        <h1 className="text-[34px] font-black leading-none tracking-[-0.045em] text-white sm:text-[38px]">
          Choisis ton plan
        </h1>
        <p className="mx-auto mt-4 max-w-[720px] text-[15px] font-medium leading-6 text-slate-300 sm:text-[17px]">
          Comprends pourquoi tes vidéos décrochent et repars avec une version plus forte à publier.
        </p>
      </header>

      <section id="plans" className="mt-14 grid items-stretch gap-5 md:grid-cols-2 xl:flex xl:justify-center xl:gap-6">
        {plans.map((plan) => {
          const isPro = plan.id === 'pro';
          const isLifetime = plan.id === 'lifetime';
          const tone = isLifetime ? 'lifetime' : isPro ? 'pro' : 'starter';

          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[520px] flex-col overflow-visible rounded-[15px] border px-6 pb-6 pt-7 transition duration-200 hover:-translate-y-0.5 md:min-h-[520px] xl:h-[520px] xl:w-[284px] ${
                isPro
                  ? 'border-violet-400/80 bg-[linear-gradient(180deg,rgba(35,19,72,0.86),rgba(9,14,34,0.98))] shadow-[0_30px_82px_-58px_rgba(139,92,246,0.98),inset_0_1px_0_rgba(255,255,255,0.09)]'
                  : isLifetime
                    ? 'border-amber-400/55 bg-[linear-gradient(180deg,rgba(31,27,16,0.82),rgba(9,13,24,0.98))] shadow-[0_28px_78px_-60px_rgba(250,204,21,0.72),inset_0_1px_0_rgba(255,255,255,0.07)]'
                    : 'border-white/[0.12] bg-[linear-gradient(180deg,rgba(17,27,42,0.86),rgba(7,12,25,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]'
              }`}
            >
              <div className={`pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent ${
                isPro ? 'via-violet-200/50' : isLifetime ? 'via-amber-200/45' : 'via-white/25'
              } to-transparent`} aria-hidden />
              {plan.badge ? <PlanBadge tone={isLifetime ? 'lifetime' : 'pro'} /> : null}

              <div className="flex items-center gap-3">
                <PlanIcon icon={plan.icon} tone={tone} />
                <h2 className="text-[22px] font-black tracking-[-0.035em] text-white">{plan.name}</h2>
              </div>

              <div className="mt-[22px] flex min-h-[112px] flex-col">
                <div>
                  <span className={isLifetime ? 'text-[40px] font-black leading-none tracking-[-0.06em] text-amber-300' : 'text-[40px] font-black leading-none tracking-[-0.06em] text-white'}>
                    {plan.price}
                  </span>
                  <span className="ml-1.5 text-[13px] font-bold text-slate-300">{plan.cadence}</span>
                </div>

                {plan.benefit ? (
                  <p className="mt-2 text-[13px] font-black leading-5 text-emerald-300">{plan.benefit}</p>
                ) : null}

                {plan.subtitle ? (
                  <p className="mt-3 text-[13px] font-semibold leading-[1.5] text-slate-300">{plan.subtitle}</p>
                ) : null}
              </div>

              <ul className="mt-4 flex-1 space-y-2.5">
                {plan.features.map((feature) => {
                  const label = typeof feature === 'string' ? feature : feature.label;
                  const available = typeof feature === 'string' ? true : feature.available;

                  if (!available) {
                    return (
                      <li key={label} className="flex gap-2.5 text-[13px] font-semibold leading-[1.32] text-rose-300/55">
                        <svg className="mt-[3px] h-3.5 w-3.5 shrink-0 text-rose-300/55" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                          <path d="M5.5 10h9" strokeLinecap="round" />
                        </svg>
                        <span className="line-through decoration-rose-300/60 decoration-2">{label}</span>
                      </li>
                    );
                  }

                  return (
                  <li key={label} className="flex gap-2.5 text-[13px] font-semibold leading-[1.32] text-slate-200">
                      <CheckIcon tone={tone} />
                    <span>{label}</span>
                  </li>
                  );
                })}
              </ul>

              <div className="mt-auto pt-6">
                <PlanAction
                  plan={plan}
                  effectivePlan={effectivePlan}
                  hasActiveStripeSubscription={hasActiveStripeSubscription}
                  hasStripeCustomer={hasStripeCustomer}
                />
              </div>
            </article>
          );
        })}
      </section>

      <footer className="mx-auto mt-12 max-w-2xl text-center text-[13px] font-medium leading-6 text-slate-400">
        <p>Tu peux annuler ton abonnement à tout moment depuis Stripe.</p>
        <p className="mt-3">Lifetime est une offre founder en paiement unique, avec accès à vie à Viralynz.</p>
        {hasActiveStripeSubscription && hasStripeCustomer ? (
          <div className="mt-4">
            <BillingActionButton action="portal" fullWidth={false} className="text-[13px] font-black text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 transition hover:text-white">
              Gérer la facturation
            </BillingActionButton>
          </div>
        ) : null}
      </footer>
    </section>
  );
}
