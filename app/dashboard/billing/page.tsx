import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import BillingActionButton from '@/components/dashboard-v2/BillingActionButton';
import { getEffectivePlan, getUserById, HOOK_LIMITS, PLAN_LIMITS, RECONSTRUCTION_LIMITS } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard-data';
import { formatPlanLimit, getPlanLabel, normalizePlan } from '@/lib/plans';
import { getSession } from '@/lib/session';
import { isSubscriptionStatusAllowingAccess, type PaidStripePlan } from '@/lib/stripe-billing';
import {
  DISPLAY_CATALOG_CREATOR_EUR,
  DISPLAY_CATALOG_PRO_EUR,
  DISPLAY_CATALOG_SCALE_EUR,
} from '@/lib/stripe-pricing';
import { getTikTokAccountLimitForPlan } from '@/lib/tiktok-account-limits';

export const dynamic = 'force-dynamic';

type Tone = 'violet' | 'cyan' | 'green' | 'amber' | 'slate' | 'rose';

type PlanCard = {
  id: PaidStripePlan;
  badge: string;
  price: string;
  promise: string;
  points: string[];
};

type ComparisonRow = {
  label: string;
  creator: string;
  pro: string;
  scale: string;
};

const shellCard =
  'relative overflow-hidden rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(8,15,30,0.94),rgba(4,8,18,0.99))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_34px_96px_-74px_rgba(0,0,0,0.98)]';

const primaryButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#f36cff_0%,#8b5cf6_52%,#2563eb_100%)] px-5 text-[13px] font-black text-white shadow-[0_24px_58px_-28px_rgba(139,92,246,1),inset_0_1px_0_rgba(255,255,255,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/45';

const secondaryButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-white/[0.10] bg-white/[0.045] px-5 text-[13px] font-black text-slate-100 transition duration-200 hover:border-cyan-200/20 hover:bg-white/[0.075] focus:outline-none focus:ring-2 focus:ring-cyan-200/25';

const plans: PlanCard[] = [
  {
    id: 'creator',
    badge: 'Plan actuel',
    price: DISPLAY_CATALOG_CREATOR_EUR,
    promise: 'Comprendre pourquoi tes vidéos décrochent.',
    points: ['30 analyses', '150 hooks', 'TikTok Sync', 'Diagnostic essentiel'],
  },
  {
    id: 'pro',
    badge: 'Recommandé',
    price: DISPLAY_CATALOG_PRO_EUR,
    promise: 'Reconstruire une V2 prête à republier.',
    points: ['150 analyses', '30 reconstructions IA', 'Rewrite / V2', 'Mémoire créateur avancée', 'Recommandations actionnables'],
  },
  {
    id: 'scale',
    badge: 'Avancé',
    price: DISPLAY_CATALOG_SCALE_EUR,
    promise: 'Piloter plusieurs comptes et workflows.',
    points: ['Analyses illimitées', '150 reconstructions IA', 'Comptes TikTok multiples', 'Exports avancés'],
  },
];

const proUnlocks = [
  {
    title: 'Diagnostic → Reconstruction',
    copy: 'Tu ne regardes plus seulement le problème. Tu obtiens une V2 complète prête à tester.',
  },
  {
    title: 'Hook alternatif',
    copy: 'L’IA te propose une accroche plus forte pour les 3 premières secondes.',
  },
  {
    title: 'Structure corrigée',
    copy: 'Intro, preuve, tension, relance, CTA : la vidéo est reconstruite pour performer.',
  },
  {
    title: 'Mémoire créateur',
    copy: 'Viralynz apprend ton style, tes erreurs qui reviennent et reconstruit avec ce contexte.',
  },
  {
    title: 'CTA prêt à republier',
    copy: 'Tu repars avec une version exploitable, pas avec une analyse théorique.',
  },
];

const comparisonRows: ComparisonRow[] = [
  { label: 'Analyses mensuelles', creator: '30', pro: '150', scale: 'Illimitées' },
  { label: 'Hooks générés', creator: '150', pro: '500', scale: 'Illimités' },
  { label: 'Diagnostic vidéo', creator: 'Essentiel', pro: 'Complet', scale: 'Complet' },
  { label: 'Reconstruction IA', creator: '—', pro: '30 / mois', scale: '150 / mois' },
  { label: 'Mémoire créateur', creator: 'Basique', pro: 'Avancée', scale: 'Multi-comptes' },
  { label: 'TikTok Sync', creator: '1 compte', pro: '3 comptes', scale: '8 comptes' },
  { label: 'Comptes multiples', creator: '—', pro: 'Limité', scale: 'Inclus' },
  { label: 'Exports avancés', creator: '—', pro: '—', scale: 'Inclus' },
  { label: 'Support prioritaire', creator: 'Standard', pro: 'Prioritaire', scale: 'Prioritaire' },
];

const faq = [
  {
    question: 'Puis-je annuler à tout moment ?',
    answer: 'Oui. La gestion se fait depuis le portail Stripe, sans bloquer tes analyses déjà enregistrées.',
  },
  {
    question: 'Que se passe-t-il si je passe à Pro ?',
    answer: 'Tu débloques les reconstructions IA, la V2 complète et une mémoire créateur qui personnalise les prochaines analyses.',
  },
  {
    question: 'Est-ce que Pro remplace le montage ?',
    answer: 'Non. Pro te dit quoi reconstruire : hook, structure, relance, CTA. Le montage reste ta décision.',
  },
  {
    question: 'À qui s’adresse Scale ?',
    answer: 'Aux créateurs avancés, équipes et workflows multi-comptes qui veulent piloter plusieurs boucles de repost.',
  },
];

function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    violet: 'border-violet-300/22 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/22 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/22 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/22 bg-amber-400/10 text-amber-100',
    slate: 'border-white/[0.12] bg-white/[0.055] text-slate-200',
    rose: 'border-rose-300/22 bg-rose-400/10 text-rose-100',
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function stripeStatus(status: string | null | undefined): { label: string; tone: Tone; detail: string } {
  if (status === 'active') return { label: 'Actif', tone: 'green', detail: 'Abonnement Stripe actif.' };
  if (status === 'trialing') return { label: 'Essai actif', tone: 'cyan', detail: 'Essai Stripe actif.' };
  if (status === 'canceled') return { label: 'Annulé', tone: 'amber', detail: 'Abonnement Stripe annulé.' };
  if (status === 'past_due' || status === 'unpaid') return { label: 'Paiement à vérifier', tone: 'rose', detail: 'Un paiement demande ton attention.' };
  return { label: 'Aucun abonnement Stripe actif', tone: 'slate', detail: 'Aucun abonnement Stripe actif n’est actuellement relié à ce compte.' };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponible';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function PortalButton({
  hasStripeCustomer,
  children,
  className = '',
  primary = false,
}: {
  hasStripeCustomer: boolean;
  children: ReactNode;
  className?: string;
  primary?: boolean;
}) {
  if (!hasStripeCustomer) {
    return (
      <a href="#plans" className={`${primary ? primaryButton : secondaryButton} ${className}`}>
        Choisir un plan
      </a>
    );
  }

  return (
    <BillingActionButton action="portal" fullWidth={false} className={`${primary ? primaryButton : secondaryButton} ${className}`}>
      {children}
    </BillingActionButton>
  );
}

function UpgradeButton({
  targetPlan,
  hasActiveStripeSubscription,
  hasStripeCustomer,
  children,
  className = '',
  primary = true,
}: {
  targetPlan: PaidStripePlan;
  hasActiveStripeSubscription: boolean;
  hasStripeCustomer: boolean;
  children: ReactNode;
  className?: string;
  primary?: boolean;
}) {
  if (hasActiveStripeSubscription) {
    return (
      <PortalButton hasStripeCustomer={hasStripeCustomer} primary={primary} className={className}>
        {children}
      </PortalButton>
    );
  }

  return (
    <BillingActionButton action="checkout" plan={targetPlan} fullWidth={false} className={`${primary ? primaryButton : secondaryButton} ${className}`}>
      {children}
    </BillingActionButton>
  );
}

function MetricRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-3 ${accent ? 'border-violet-300/18 bg-violet-400/[0.08]' : 'border-white/[0.065] bg-black/18'}`}>
      <span className="text-[12px] font-semibold text-slate-400">{label}</span>
      <span className="text-right text-[13px] font-black text-white">{value}</span>
    </div>
  );
}

function ProgressMetric({ label, used, limit }: { label: string; used: number; limit: number }) {
  const width = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : used > 0 ? 100 : 0;

  return (
    <div className="rounded-[13px] border border-white/[0.07] bg-black/18 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-slate-400">{label}</span>
        <span className="text-[13px] font-black text-white">{used} / {formatPlanLimit(limit)}</span>
      </div>
      <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#f0abfc)] shadow-[0_0_18px_rgba(139,92,246,0.65)] transition-[width] duration-700"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function PlanAction({
  plan,
  isCurrent,
  hasActiveStripeSubscription,
  hasStripeCustomer,
}: {
  plan: PaidStripePlan;
  isCurrent: boolean;
  hasActiveStripeSubscription: boolean;
  hasStripeCustomer: boolean;
}) {
  if (isCurrent) {
    return (
      <button type="button" disabled className="min-h-[42px] w-full rounded-[11px] border border-white/[0.08] bg-white/[0.035] px-4 text-[13px] font-black text-slate-500">
        Plan actuel
      </button>
    );
  }

  return (
    <UpgradeButton
      targetPlan={plan}
      hasActiveStripeSubscription={hasActiveStripeSubscription}
      hasStripeCustomer={hasStripeCustomer}
      primary={plan === 'pro'}
      className="w-full"
    >
      {plan === 'pro' ? 'Passer à Pro' : plan === 'scale' ? 'Passer à Scale' : 'Passer à Creator'}
    </UpgradeButton>
  );
}

export default async function DashboardBillingPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/billing');

  const [profile, dashboard] = await Promise.all([
    getUserById(session.userId),
    getDashboardData(),
  ]);

  const profilePlan = normalizePlan(profile?.plan ?? dashboard.user.plan);
  const effectivePlan = normalizePlan(profile ? getEffectivePlan(profile) : dashboard.user.plan);
  const status = stripeStatus(profile?.subscription_status);
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const hasActiveStripeSubscription = Boolean(profile?.stripe_subscription_id && isSubscriptionStatusAllowingAccess(profile.subscription_status));

  const analysesUsed = dashboard.user.quotaUsed;
  const analysesLimit = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS.free;
  const hooksUsed = profile?.hooks_count ?? 0;
  const hooksLimit = HOOK_LIMITS[effectivePlan] ?? 0;
  const reconstructionsLimit = RECONSTRUCTION_LIMITS[effectivePlan] ?? 0;
  const tiktokUsed = dashboard.tiktokConnection.connected ? 1 : 0;
  const tiktokLimit = getTikTokAccountLimitForPlan(effectivePlan);
  const v2Locked = effectivePlan === 'free' || effectivePlan === 'creator';

  return (
    <section className="mx-auto w-full max-w-[1440px] pb-10 pt-3 text-white">
      <section className={`${shellCard} p-5 sm:p-6 lg:p-7`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(217,70,239,0.23),transparent_32%),radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.17),transparent_34%),linear-gradient(135deg,rgba(124,58,237,0.10),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="cyan">Billing</Badge>
              {!hasActiveStripeSubscription ? <Badge tone="slate">Aucun abonnement Stripe actif</Badge> : null}
            </div>
            <h1 className="mt-5 max-w-4xl text-[36px] font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-[54px] lg:text-[66px]">
              Ton plan actuel
            </h1>
            <p className="mt-5 max-w-3xl text-[17px] font-black leading-7 text-white sm:text-[20px]">
              Creator t’aide à voir pourquoi une vidéo décroche. Pro te donne la version à republier.
            </p>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              Tu ne payes pas pour plus de boutons. Tu payes pour savoir quoi poster ensuite : hook, structure, relance et CTA prêts à tester.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <UpgradeButton targetPlan="pro" hasActiveStripeSubscription={hasActiveStripeSubscription} hasStripeCustomer={hasStripeCustomer} className="px-5">
                Passer à Pro
              </UpgradeButton>
              <PortalButton hasStripeCustomer={hasStripeCustomer}>
                Gérer la facturation
              </PortalButton>
            </div>
            <p className="mt-3 text-[12px] font-semibold text-slate-500">Annulable à tout moment depuis Stripe.</p>
          </div>

          <aside className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_76px_-58px_rgba(34,211,238,0.75)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Plan actuel</p>
                <h2 className="mt-2 text-[27px] font-black tracking-[-0.045em] text-white">{getPlanLabel(profilePlan)}</h2>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div className="mt-5 grid gap-2.5">
              <ProgressMetric label="Analyses" used={analysesUsed} limit={analysesLimit} />
              <ProgressMetric label="Hooks" used={hooksUsed} limit={hooksLimit} />
              <MetricRow label="TikTok connecté" value={`${tiktokUsed} / ${formatPlanLimit(tiktokLimit)}`} />
              <MetricRow label="V2 complète" value={v2Locked ? 'Verrouillée' : 'Disponible'} accent />
            </div>
          </aside>
        </div>
      </section>

      <section className={`${shellCard} mt-5 p-5 sm:p-6`}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
          <div>
            <Badge tone="violet">Ce que tu débloques avec Pro</Badge>
            <h2 className="mt-4 text-[30px] font-black tracking-[-0.05em] text-white sm:text-[40px]">Une analyse explique l’échec. Une reconstruction prépare le repost.</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {proUnlocks.map((item) => (
                <article key={item.title} className="rounded-[16px] border border-white/[0.075] bg-white/[0.035] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/24 hover:bg-violet-400/[0.055]">
                  <h3 className="text-[16px] font-black tracking-[-0.02em] text-white">{item.title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-slate-300">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[18px] border border-cyan-300/14 bg-[linear-gradient(160deg,rgba(8,47,73,0.24),rgba(76,29,149,0.20),rgba(5,9,20,0.98))] p-4">
            <div className="absolute inset-x-7 top-0 h-px bg-[linear-gradient(90deg,transparent,#22d3ee,#f0abfc,transparent)]" />
            <Badge tone="cyan">Before / After</Badge>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[14px] border border-white/[0.075] bg-black/22 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Avant</p>
                <p className="mt-2 text-[18px] font-black leading-7 text-white">Ta vidéo décroche à 4 secondes.</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-400">Tu sais qu’il y a un problème, mais pas encore quoi republier.</p>
              </div>
              <div className="rounded-[14px] border border-violet-300/20 bg-violet-400/[0.09] p-4 shadow-[0_22px_60px_-44px_rgba(168,85,247,1)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-100/75">Après Pro</p>
                <p className="mt-2 text-[18px] font-black leading-7 text-white">Nouvelle accroche + nouvelle structure + CTA final prêt à publier.</p>
                <p className="mt-2 text-[13px] leading-6 text-violet-50/75">Pro transforme un diagnostic en plan d’action.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="plans" className="mt-5">
        <div className="mb-4">
          <Badge tone="slate">Plans</Badge>
          <h2 className="mt-3 text-[30px] font-black tracking-[-0.045em] text-white sm:text-[38px]">Creator comprend. Pro reconstruit. Scale pilote.</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = effectivePlan === plan.id;
            const isPro = plan.id === 'pro';

            return (
              <article
                key={plan.id}
                className={`group relative flex min-h-[338px] flex-col rounded-[19px] border p-4 transition duration-200 hover:-translate-y-1 ${
                  isPro
                    ? 'border-violet-300/34 bg-[linear-gradient(180deg,rgba(88,28,135,0.42),rgba(8,13,28,0.99))] shadow-[0_38px_118px_-68px_rgba(168,85,247,1),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_42px_128px_-62px_rgba(168,85,247,1)]'
                    : 'border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.985))] hover:border-white/[0.13]'
                }`}
              >
                {isPro ? (
                  <>
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,#f0abfc,#22d3ee,transparent)]" />
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.16),transparent_38%)]" />
                  </>
                ) : null}
                <div className="relative flex min-h-[26px] flex-wrap gap-2">
                  <Badge tone={isCurrent ? 'green' : isPro ? 'violet' : 'slate'}>{isCurrent ? 'Plan actuel' : plan.badge}</Badge>
                </div>
                <h3 className="relative mt-4 text-[25px] font-black text-white">{getPlanLabel(plan.id)}</h3>
                <p className="relative mt-2 min-h-[48px] text-[13px] leading-6 text-slate-300">{plan.promise}</p>
                <div className="relative mt-4">
                  <span className="text-[40px] font-black tracking-[-0.06em] text-white">{plan.price}€</span>
                  <span className="ml-1 text-[13px] font-semibold text-slate-400">/ mois</span>
                </div>
                <ul className="relative mt-4 flex-1 space-y-2">
                  {plan.points.map((point) => (
                    <li key={point} className="flex gap-2 text-[13px] leading-5 text-slate-300">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[linear-gradient(135deg,#22d3ee,#a855f7)] shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="relative mt-5">
                  <PlanAction
                    plan={plan.id}
                    isCurrent={isCurrent}
                    hasActiveStripeSubscription={hasActiveStripeSubscription}
                    hasStripeCustomer={hasStripeCustomer}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={`${shellCard} mt-5 p-5 sm:p-6`}>
        <Badge tone="cyan">Comparaison</Badge>
        <h2 className="mt-3 text-[28px] font-black tracking-[-0.045em] text-white">Ce que chaque plan change dans ton workflow.</h2>
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="min-w-[760px] overflow-hidden rounded-[16px] border border-white/[0.075]">
            <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] bg-white/[0.045] text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              <div className="px-4 py-3">Capacité</div>
              <div className="px-4 py-3">Creator</div>
              <div className="border-x border-white/[0.07] bg-violet-400/[0.07] px-4 py-3 text-violet-100">Pro</div>
              <div className="px-4 py-3">Scale</div>
            </div>
            {comparisonRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1.25fr_1fr_1fr_1fr] border-t border-white/[0.065] text-[13px]">
                <div className="px-4 py-3 font-bold text-white">{row.label}</div>
                <div className="px-4 py-3 text-slate-400">{row.creator}</div>
                <div className="border-x border-white/[0.07] bg-violet-400/[0.04] px-4 py-3 font-black text-white">{row.pro}</div>
                <div className="px-4 py-3 text-slate-300">{row.scale}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className={`${shellCard} p-5 sm:p-6`}>
          <Badge tone="violet">Pourquoi Pro maintenant</Badge>
          <h2 className="mt-3 text-[28px] font-black tracking-[-0.045em] text-white">Arrête de deviner. Reposte une version reconstruite.</h2>
          <p className="mt-3 max-w-3xl text-[16px] font-black leading-7 text-white">
            Une bonne analyse t’explique pourquoi tu as perdu l’audience. Une bonne reconstruction te donne quoi publier ensuite.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              'Tu gagnes du temps sur chaque repost.',
              'Tu ne restes pas bloqué à comprendre le problème.',
              'Tu obtiens une version concrète à tester.',
            ].map((item) => (
              <div key={item} className="rounded-[14px] border border-white/[0.075] bg-white/[0.035] p-4 text-[13px] font-bold leading-6 text-slate-200">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5">
            <UpgradeButton targetPlan="pro" hasActiveStripeSubscription={hasActiveStripeSubscription} hasStripeCustomer={hasStripeCustomer}>
              Passer à Pro
            </UpgradeButton>
          </div>
        </article>

        <article className={`${shellCard} p-5`}>
          <Badge tone={status.tone}>Facturation</Badge>
          <h2 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-white">Stripe reste la source de paiement.</h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-400">{status.detail}</p>
          <div className="mt-4 grid gap-2.5">
            <MetricRow label="Statut abonnement" value={status.label} />
            <MetricRow label="Prochaine échéance" value={formatDate(profile?.subscription_current_period_end)} />
            <MetricRow label="Moyen de paiement" value={hasStripeCustomer ? 'Géré dans Stripe' : 'Non disponible'} />
          </div>
          <div className="mt-4">
            <PortalButton hasStripeCustomer={hasStripeCustomer} primary={hasActiveStripeSubscription} className="w-full">
              Ouvrir le portail Stripe
            </PortalButton>
          </div>
        </article>
      </section>

      <section className={`${shellCard} mt-5 p-5 sm:p-6`}>
        <Badge tone="slate">FAQ</Badge>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {faq.map((item) => (
            <article key={item.question} className="rounded-[15px] border border-white/[0.075] bg-white/[0.032] p-4">
              <h3 className="text-[15px] font-black text-white">{item.question}</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
