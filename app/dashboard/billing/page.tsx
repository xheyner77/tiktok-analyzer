import Link from 'next/link';
import { redirect } from 'next/navigation';
import BillingActionButton from '@/components/dashboard-v2/BillingActionButton';
import { getUserById, PLAN_LIMITS, HOOK_LIMITS, RECONSTRUCTION_LIMITS, getEffectivePlan } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard-data';
import { getPlanLabel, normalizePlan, type AppPlan } from '@/lib/plans';
import { getSession } from '@/lib/session';
import { PLAN_RANK, isSubscriptionStatusAllowingAccess, type PaidStripePlan } from '@/lib/stripe-billing';
import {
  DISPLAY_CATALOG_CREATOR_EUR,
  DISPLAY_CATALOG_PRO_ANNUAL_MONTHLY_EUR,
  DISPLAY_CATALOG_PRO_EUR,
  DISPLAY_CATALOG_SCALE_ANNUAL_MONTHLY_EUR,
  DISPLAY_CATALOG_SCALE_EUR,
} from '@/lib/stripe-pricing';
import { getTikTokAccountLimitForPlan } from '@/lib/tiktok-account-limits';

export const dynamic = 'force-dynamic';

const planDescriptions: Record<AppPlan, string> = {
  free: 'Pour tester le diagnostic Viralynz sur quelques vidéos.',
  creator: 'Pour analyser régulièrement tes contenus et relier ton profil TikTok.',
  pro: 'Pour transformer tes diagnostics en versions prêtes à republier.',
  scale: 'Pour équipes, comptes multiples et workflows de publication.',
};

const planCards: Array<{
  id: AppPlan;
  price: string;
  annual?: string;
  description: string;
  features: string[];
  recommended?: boolean;
}> = [
  {
    id: 'free',
    price: '0€',
    description: 'Premier diagnostic sans métriques inventées.',
    features: ['3 analyses au total', 'Scores issus de tes vidéos', 'Historique limité', 'TikTok Sync verrouillé'],
  },
  {
    id: 'creator',
    price: `${DISPLAY_CATALOG_CREATOR_EUR}€`,
    description: 'Le plan solo pour comprendre pourquoi une vidéo décroche.',
    features: ['30 analyses / mois', '150 hooks / mois', '1 compte TikTok', 'Dashboard prêt pour les analyses'],
  },
  {
    id: 'pro',
    price: `${DISPLAY_CATALOG_PRO_EUR}€`,
    annual: `${DISPLAY_CATALOG_PRO_ANNUAL_MONTHLY_EUR}€ / mois en annuel`,
    description: 'Le meilleur choix pour produire des V2 plus tendues.',
    features: ['150 analyses / mois', '30 reconstructions IA', '500 hooks / mois', 'Mémoire créateur étendue'],
    recommended: true,
  },
  {
    id: 'scale',
    price: `${DISPLAY_CATALOG_SCALE_EUR}€`,
    annual: `${DISPLAY_CATALOG_SCALE_ANNUAL_MONTHLY_EUR}€ / mois en annuel`,
    description: 'Pour piloter plusieurs comptes et workflows de repost.',
    features: ['Analyses illimitées', '150 reconstructions IA', 'Comptes TikTok multiples', 'Publication et exports avancés'],
  },
];

const modules: Array<{
  title: string;
  description: string;
  requiredPlan: AppPlan;
  statusOverride?: 'bientôt';
}> = [
  { title: 'Analyse vidéo', description: 'Diagnostique tes vidéos et repère les moments faibles.', requiredPlan: 'free' },
  { title: 'Insights IA', description: 'Transforme les scores en décisions concrètes de montage.', requiredPlan: 'free' },
  { title: 'Générateur de hooks', description: 'Réécris les premières secondes avec une tension plus claire.', requiredPlan: 'creator' },
  { title: 'Rewrite / V2', description: 'Transforme une analyse en version prête à republier.', requiredPlan: 'pro' },
  { title: 'Reconstruction IA', description: 'Construit une V2 structurée à partir du diagnostic.', requiredPlan: 'pro' },
  { title: 'Publication / programmation', description: 'Prépare tes reposts et pilote la sortie des V2.', requiredPlan: 'scale', statusOverride: 'bientôt' },
  { title: 'Radar tendances', description: 'Repère les angles à surveiller sans inventer de métriques TikTok.', requiredPlan: 'pro' },
  { title: 'Export', description: 'Prépare tes décisions et briefs de montage hors Viralynz.', requiredPlan: 'scale', statusOverride: 'bientôt' },
  { title: 'TikTok Sync', description: 'Relie ton profil TikTok et prépare les permissions avancées.', requiredPlan: 'creator' },
];

function formatLimit(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Non disponible';
  return Number.isFinite(value) ? String(value) : 'Illimité';
}

function formatUsage(used: number, limit: number | null | undefined): string {
  if (typeof limit !== 'number') return `${used} / Non disponible`;
  return `${used} / ${formatLimit(limit)}`;
}

function remainingLabel(used: number, limit: number | null | undefined, unit: string): string {
  if (typeof limit !== 'number') return 'Quota non disponible';
  if (!Number.isFinite(limit)) return `${unit} illimitées sur ce plan`;
  const remaining = Math.max(0, limit - used);
  return `${remaining} ${unit}${remaining > 1 ? ' restantes' : ' restante'}`;
}

function progressWidth(used: number, limit: number | null | undefined): string {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return '100%';
  return `${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%`;
}

function subscriptionLabel(status: string | null | undefined): { label: string; tone: string } {
  if (!status) return { label: 'Aucun abonnement Stripe', tone: 'border-slate-300/15 bg-slate-400/10 text-slate-200' };
  if (status === 'active') return { label: 'Plan actif', tone: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' };
  if (status === 'trialing') return { label: 'Essai actif', tone: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100' };
  if (status === 'canceled') return { label: 'Abonnement annulé', tone: 'border-amber-300/22 bg-amber-400/10 text-amber-100' };
  if (status === 'past_due' || status === 'unpaid') return { label: 'Paiement à vérifier', tone: 'border-rose-300/24 bg-rose-400/10 text-rose-100' };
  return { label: 'Statut à vérifier', tone: 'border-slate-300/15 bg-slate-400/10 text-slate-200' };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponible';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function ModuleStatus({ currentPlan, requiredPlan, override }: { currentPlan: AppPlan; requiredPlan: AppPlan; override?: 'bientôt' }) {
  if (override === 'bientôt') {
    return <span className="rounded-full border border-cyan-300/16 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-black text-cyan-100">Bientôt</span>;
  }
  const included = (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
  if (included) {
    return <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-100">Inclus</span>;
  }
  return (
    <span className="rounded-full border border-violet-300/18 bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-100">
      {getPlanLabel(requiredPlan)}
    </span>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">{eyebrow}</p>
      <h2 className="mt-2 text-[24px] font-black tracking-[-0.035em] text-white sm:text-[28px]">{title}</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function UsageCard({
  title,
  value,
  note,
  width,
  locked,
}: {
  title: string;
  value: string;
  note: string;
  width: string;
  locked?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-bold text-slate-300">{title}</p>
        {locked ? <span className="rounded-full bg-violet-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-100">À débloquer</span> : null}
      </div>
      <p className="mt-3 text-[26px] font-black tracking-[-0.035em] text-white">{value}</p>
      <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#e879f9)] shadow-[0_0_24px_rgba(139,92,246,0.6)]" style={{ width }} />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-slate-400">{note}</p>
    </div>
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
  const status = subscriptionLabel(profile?.subscription_status);
  const hasActiveStripeSubscription = Boolean(profile?.stripe_subscription_id && isSubscriptionStatusAllowingAccess(profile.subscription_status));
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const hasCanceledSubscription = profile?.subscription_status === 'canceled';
  const hasBillingMismatch = profilePlan !== 'free' && !hasActiveStripeSubscription;
  const analysesUsed = dashboard.user.quotaUsed;
  const analysesLimit = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS.free;
  const hooksUsed = profile?.hooks_count ?? 0;
  const hooksLimit = HOOK_LIMITS[effectivePlan] ?? 0;
  const reconstructionsUsed = profile?.reconstructions_count ?? 0;
  const reconstructionsLimit = RECONSTRUCTION_LIMITS[effectivePlan] ?? 0;
  const tiktokLimit = getTikTokAccountLimitForPlan(effectivePlan);
  const tiktokConnected = dashboard.tiktokConnection.connected;

  return (
    <section className="mx-auto w-full max-w-[1500px] pb-12 pt-4 text-white">
      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(5,10,24,0.98)_56%,rgba(20,11,42,0.96))] p-5 shadow-[0_34px_110px_-72px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.22),transparent_34%)]" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div>
            <span className="inline-flex rounded-full border border-cyan-200/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
              Billing
            </span>
            <h1 className="mt-5 text-[34px] font-black tracking-[-0.055em] text-white sm:text-[46px]">Plan & abonnement</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-300">
              Gère ton accès Viralynz, tes quotas et les modules disponibles.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {hasActiveStripeSubscription && hasStripeCustomer ? (
                <BillingActionButton action="portal" fullWidth={false} className="min-h-[46px] rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_18px_42px_-22px_rgba(139,92,246,0.95)] transition hover:brightness-110">
                  Gérer mon abonnement
                </BillingActionButton>
              ) : (
                <a href="#plans" className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_18px_42px_-22px_rgba(139,92,246,0.95)] transition hover:brightness-110">
                  Comparer les plans
                </a>
              )}
              {!hasActiveStripeSubscription && hasStripeCustomer ? (
                <BillingActionButton action="portal" fullWidth={false} className="min-h-[46px] rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
                  Gérer la facturation
                </BillingActionButton>
              ) : null}
              <Link href="/dashboard" className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
                Retour au dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Plan actuel</p>
                <h2 className="mt-3 text-[34px] font-black tracking-[-0.05em] text-white">{getPlanLabel(profilePlan)}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${status.tone}`}>{status.label}</span>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-slate-400">{planDescriptions[profilePlan]}</p>
            <div className="mt-5 grid gap-3 text-[13px] text-slate-300">
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.065] bg-black/15 px-3 py-2.5">
                <span>Email du compte</span>
                <span className="min-w-0 truncate text-right font-semibold text-white">{dashboard.user.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.065] bg-black/15 px-3 py-2.5">
                <span>Accès effectif</span>
                <span className="font-semibold text-white">{getPlanLabel(effectivePlan)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.065] bg-black/15 px-3 py-2.5">
                <span>Prochaine échéance</span>
                <span className="font-semibold text-white">{formatDate(profile?.subscription_current_period_end)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.065] bg-black/15 px-3 py-2.5">
                <span>Compte Stripe</span>
                <span className="font-semibold text-white">{hasStripeCustomer ? 'Relié' : 'Non relié'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasBillingMismatch ? (
        <div className="mt-4 rounded-[16px] border border-amber-300/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.10),rgba(15,23,42,0.74))] px-5 py-4 text-[14px] leading-6 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {hasCanceledSubscription
            ? `Ton accès ${getPlanLabel(profilePlan)} est actif dans Viralynz, mais l’abonnement Stripe lié semble annulé. Tu peux choisir un nouveau plan sans perdre tes analyses.`
            : `Ton profil Viralynz indique ${getPlanLabel(profilePlan)}, mais aucun abonnement Stripe actif n’est relié. La page garde l’accès lisible et te laisse choisir un plan proprement.`}
        </div>
      ) : null}

      <section className="mt-8">
        <SectionTitle
          eyebrow="Utilisation"
          title="Utilisation du mois"
          description="Les quotas viennent du profil Viralynz et du plan effectif. Aucun usage n’est inventé si la donnée n’existe pas."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <UsageCard title="Analyses utilisées" value={formatUsage(analysesUsed, analysesLimit)} note={remainingLabel(analysesUsed, analysesLimit, 'analyse')} width={progressWidth(analysesUsed, analysesLimit)} />
          <UsageCard title="Reconstructions IA" value={formatUsage(reconstructionsUsed, reconstructionsLimit)} note={reconstructionsLimit > 0 ? remainingLabel(reconstructionsUsed, reconstructionsLimit, 'reconstruction') : 'Pro requis pour transformer un diagnostic en V2 complète.'} width={progressWidth(reconstructionsUsed, reconstructionsLimit)} locked={reconstructionsLimit <= 0} />
          <UsageCard title="Hooks générés" value={formatUsage(hooksUsed, hooksLimit)} note={hooksLimit > 0 ? remainingLabel(hooksUsed, hooksLimit, 'hook') : 'Creator requis pour générer des hooks depuis Viralynz.'} width={progressWidth(hooksUsed, hooksLimit)} locked={hooksLimit <= 0} />
          <UsageCard title="Comptes TikTok" value={tiktokConnected ? `1 / ${formatLimit(tiktokLimit)}` : `0 / ${formatLimit(tiktokLimit)}`} note={tiktokConnected ? `${dashboard.tiktokConnection.modeLabel}. Permissions performances non activées si scope basic seulement.` : 'Aucun compte TikTok connecté pour le moment.'} width={progressWidth(tiktokConnected ? 1 : 0, tiktokLimit)} locked={tiktokLimit <= 0} />
        </div>
      </section>

      <section className="mt-9">
        <SectionTitle
          eyebrow="Accès produit"
          title="Modules disponibles"
          description="Chaque module indique ce qui est inclus maintenant, limité par ton plan, ou prévu pour une prochaine étape produit."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <div key={module.title} className="group rounded-[15px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.86),rgba(5,9,20,0.98))] p-4 transition hover:border-violet-300/20 hover:bg-white/[0.055]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-black text-white">{module.title}</h3>
                <ModuleStatus currentPlan={effectivePlan} requiredPlan={module.requiredPlan} override={module.statusOverride} />
              </div>
              <p className="mt-3 text-[13px] leading-6 text-slate-400">{module.description}</p>
              {(PLAN_RANK[effectivePlan] ?? 0) < (PLAN_RANK[module.requiredPlan] ?? 0) && module.statusOverride !== 'bientôt' ? (
                <p className="mt-3 text-[12px] font-semibold text-violet-200">Plan {getPlanLabel(module.requiredPlan)} requis.</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="mt-9">
        <SectionTitle
          eyebrow="Plans"
          title="Comparer les plans"
          description="Choisis le niveau qui correspond à ton volume d’analyses et à ta boucle de repost."
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {planCards.map((plan) => {
            const paidPlan = plan.id === 'free' ? null : (plan.id as PaidStripePlan);
            const isCurrent = plan.id === effectivePlan;
            const canOpenPortal = hasActiveStripeSubscription && hasStripeCustomer && paidPlan !== null;
            const canCheckout = !hasActiveStripeSubscription && paidPlan !== null;

            return (
              <div
                key={plan.id}
                className={`relative flex min-h-[430px] flex-col rounded-[18px] border p-5 ${
                  plan.recommended
                    ? 'border-violet-300/28 bg-[linear-gradient(180deg,rgba(76,29,149,0.28),rgba(8,13,28,0.98))] shadow-[0_28px_90px_-58px_rgba(168,85,247,0.95)]'
                    : 'border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))]'
                }`}
              >
                <div className="flex min-h-[26px] flex-wrap gap-2">
                  {isCurrent ? <span className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">Plan actuel</span> : null}
                  {plan.recommended ? <span className="rounded-full border border-violet-300/18 bg-violet-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-100">Recommandé</span> : null}
                </div>
                <h3 className="mt-4 text-[22px] font-black text-white">{getPlanLabel(plan.id)}</h3>
                <p className="mt-2 min-h-[48px] text-[13px] leading-6 text-slate-400">{plan.description}</p>
                <div className="mt-5">
                  <span className="text-[34px] font-black tracking-[-0.05em] text-white">{plan.price}</span>
                  {plan.id !== 'free' ? <span className="ml-1 text-[13px] font-semibold text-slate-400">/ mois</span> : null}
                  {plan.annual ? <p className="mt-1 text-[12px] font-semibold text-cyan-100/80">{plan.annual}</p> : null}
                </div>
                <ul className="mt-5 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-[13px] leading-5 text-slate-300">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,#22d3ee,#a855f7)] shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {plan.id === 'free' ? (
                    <button type="button" disabled className="min-h-[44px] w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-[13px] font-black text-slate-300 opacity-70">
                      {isCurrent ? 'Plan actuel' : 'Inclus'}
                    </button>
                  ) : isCurrent && hasActiveStripeSubscription ? (
                    <BillingActionButton action="portal" className="min-h-[44px] w-full rounded-[10px] border border-white/[0.09] bg-white/[0.055] text-[13px] font-black text-white transition hover:bg-white/[0.08]">
                      Gérer mon abonnement
                    </BillingActionButton>
                  ) : canOpenPortal ? (
                    <BillingActionButton action="portal" className="min-h-[44px] w-full rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#7c3aed)] text-[13px] font-black text-white transition hover:brightness-110">
                      Gérer dans Stripe
                    </BillingActionButton>
                  ) : canCheckout && paidPlan ? (
                    <div className="space-y-2">
                      <BillingActionButton action="checkout" plan={paidPlan} className="min-h-[44px] w-full rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#7c3aed)] text-[13px] font-black text-white transition hover:brightness-110">
                        {plan.id === 'creator' ? 'Passer à Creator' : plan.id === 'pro' ? 'Passer à Pro' : 'Passer à Scale'}
                      </BillingActionButton>
                      {plan.id === 'pro' || plan.id === 'scale' ? (
                        <BillingActionButton action="checkout" plan={paidPlan} interval="year" className="min-h-[40px] w-full rounded-[10px] border border-cyan-200/[0.12] bg-cyan-300/[0.055] text-[12px] font-black text-cyan-50 transition hover:bg-cyan-300/[0.09]">
                          Choisir l’annuel
                        </BillingActionButton>
                      ) : null}
                    </div>
                  ) : (
                    <button type="button" disabled className="min-h-[44px] w-full rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-[13px] font-black text-slate-400">
                      Indisponible
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Facturation</p>
          <h2 className="mt-3 text-[22px] font-black text-white">Statut abonnement</h2>
          <p className="mt-2 text-[14px] leading-6 text-slate-400">
            Stripe reste la source pour le paiement, les moyens de paiement et les factures. Viralynz affiche uniquement l’état utile au produit.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Statut</p>
              <p className="mt-2 text-[14px] font-black text-white">{status.label}</p>
            </div>
            <div className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Renouvellement</p>
              <p className="mt-2 text-[14px] font-black text-white">{profile?.subscription_cancel_at_period_end ? 'Annulation programmée' : 'Normal'}</p>
            </div>
            <div className="rounded-[12px] border border-white/[0.065] bg-white/[0.035] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Portail Stripe</p>
              <p className="mt-2 text-[14px] font-black text-white">{hasStripeCustomer ? 'Disponible' : 'Après checkout'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[18px] border border-cyan-200/[0.09] bg-[linear-gradient(160deg,rgba(8,47,73,0.36),rgba(8,13,28,0.98))] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100/70">Prochaine étape</p>
          <h2 className="mt-3 text-[22px] font-black text-white">Passe à Pro quand le diagnostic doit devenir une V2.</h2>
          <p className="mt-3 text-[14px] leading-6 text-slate-300">
            Pro débloque les reconstructions IA et la mémoire créateur étendue pour transformer tes analyses en versions prêtes à republier.
          </p>
          <Link href="/dashboard/analyze" className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.055] px-4 text-[13px] font-black text-white transition hover:bg-white/[0.08]">
            Analyser une vidéo
          </Link>
        </div>
      </section>
    </section>
  );
}
