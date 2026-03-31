import Link from 'next/link';
import CheckoutButton from '@/components/CheckoutButton';
import { HISTORY_LIMITS } from '@/lib/analyses';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
} from '@/lib/plan-limits';

interface Feature {
  label: string;
  included: boolean;
}

interface Plan {
  name: string;
  badge?: string;
  tagline?: string;
  price: string;
  period?: string;
  description: string;
  cta: string;
  ctaHref: string;
  features: Feature[];
  variant: 'free' | 'pro' | 'elite';
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: 'Gratuit',
    description: 'Pour découvrir la plateforme et tester vos premières vidéos.',
    cta: 'Commencer gratuitement',
    ctaHref: '/',
    variant: 'free',
    features: [
      { label: `${MAX_ANALYSES_FREE} analyses gratuites`, included: true },
      { label: 'Score de viralité', included: true },
      { label: 'Analyse Hook, Montage, Rétention', included: true },
      { label: "3 conseils d'amélioration", included: true },
      { label: 'Générateur de hooks', included: false },
      { label: 'Historique des analyses', included: false },
      { label: 'Recommandations IA avancées', included: false },
      { label: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Pro',
    badge: '⭐ Le plus populaire',
    price: '9,99',
    period: '/ mois',
    description: 'Pour les créateurs sérieux qui veulent scaler leur contenu.',
    cta: 'Passer à Pro',
    ctaHref: '#',
    variant: 'pro',
    features: [
      { label: `${MAX_ANALYSES_PRO} analyses / mois`, included: true },
      { label: 'Score de viralité complet', included: true },
      { label: 'Analyse Hook, Montage, Rétention', included: true },
      { label: '5 conseils détaillés prioritisés', included: true },
      { label: `${MAX_HOOKS_PRO} hooks générés / mois`, included: true },
      { label: `Historique de ${HISTORY_LIMITS.pro} analyses`, included: true },
      { label: 'Recommandations IA avancées', included: false },
      { label: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Elite',
    badge: '🔥 Le meilleur choix',
    tagline: 'Le plan utilisé par les créateurs qui font +1M vues',
    price: '24,99',
    period: '/ mois',
    description: "Pour les agences et créateurs qui veulent dominer l'algorithme.",
    cta: 'Passer à Elite →',
    ctaHref: '#',
    variant: 'elite',
    features: [
      { label: `${MAX_ANALYSES_ELITE} analyses / mois`, included: true },
      { label: 'Score de viralité complet', included: true },
      { label: 'Analyse Hook, Montage, Rétention', included: true },
      { label: 'Conseils illimités personnalisés', included: true },
      { label: `${MAX_HOOKS_ELITE} hooks générés / mois`, included: true },
      { label: 'Historique illimité', included: true },
      { label: 'Recommandations IA avancées', included: true },
      { label: 'Support prioritaire dédié', included: true },
    ],
  },
];

function CheckIcon({ included, elite }: { included: boolean; elite?: boolean }) {
  if (included) {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={`w-4 h-4 shrink-0 mt-px ${elite ? 'text-[#c084fc]' : 'text-[#ff0050]'}`}
      >
        <path
          fillRule="evenodd"
          d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#2a2a2a] shrink-0 mt-px">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

function PricingCard({ plan }: { plan: Plan }) {
  const isPro = plan.variant === 'pro';
  const isElite = plan.variant === 'elite';
  const isFree = plan.variant === 'free';

  return (
    /* Outer wrapper — h-full pour que toutes les cartes s'étirent à la même hauteur */
    <div className="flex flex-col pt-5 h-full">
      {/* Floating badge — always reserving the same height (h-5) */}
      <div className="h-5 flex items-center justify-center mb-3">
        {plan.badge && (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap
              ${isElite
                ? 'bg-gradient-to-r from-[#7928ca] via-[#9333ea] to-[#a855f7] text-white shadow-lg shadow-[#7928ca]/40 ring-1 ring-white/15'
                : 'bg-[#111] border border-[#ff0050]/40 text-[#ff6680]'
              }`}
          >
            {plan.badge}
          </span>
        )}
      </div>

      {/* Card */}
      <div
        className={`relative flex flex-col flex-1 rounded-2xl transition-all duration-300
          ${isElite
            ? 'elite-pricing-card p-7 ring-1 ring-[#a855f7]/30'
            : isPro
            ? 'pro-pricing-card p-6'
            : 'bg-[#0d0d0d] border border-[#1d1d1d] p-6'
          }`}
      >
        {/* Plan label + price */}
        <div className="mb-5">
          <span
            className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-widest mb-3
              ${isElite
                ? 'bg-[#7928ca]/25 text-[#d8b4fe] border border-[#a855f7]/30'
                : isPro
                ? 'bg-[#ff0050]/10 text-[#ff6680] border border-[#ff0050]/20'
                : 'bg-[#1a1a1a] text-gray-500 border border-[#242424]'
              }`}
          >
            {plan.name}
          </span>

          <div className="flex items-end gap-1.5 mb-2.5">
            {plan.period ? (
              <>
                <span className={`font-extrabold tracking-tight text-white leading-none ${isElite ? 'text-5xl' : 'text-4xl'}`}>
                  {plan.price}€
                </span>
                <span className="text-gray-500 text-sm pb-1">{plan.period}</span>
              </>
            ) : (
              <span className="text-4xl font-extrabold text-white leading-none">Gratuit</span>
            )}
          </div>

          <p className={`leading-relaxed ${isElite ? 'text-gray-300 text-sm' : 'text-gray-500 text-sm'}`}>
            {plan.description}
          </p>
        </div>

        {/* CTA */}
        <div className="mb-3">
          {isPro || isElite ? (
            <CheckoutButton
              plan={plan.variant as 'pro' | 'elite'}
              className={`w-full text-center rounded-xl font-semibold text-sm transition-all duration-200 block active:scale-[0.98]
                ${isElite
                  ? 'py-3.5 bg-gradient-to-r from-[#7928ca] to-[#a855f7] text-white hover:opacity-90 shadow-lg shadow-[#7928ca]/30 ring-1 ring-white/10'
                  : 'py-3 bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 shadow-md shadow-[#ff0050]/15'
                }`}
            >
              {plan.cta}
            </CheckoutButton>
          ) : (
            <Link
              href={plan.ctaHref}
              className="w-full text-center rounded-xl py-3 font-semibold text-sm transition-all duration-200 block bg-[#151515] border border-[#252525] text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200 hover:border-[#333] active:scale-[0.98]"
            >
              {plan.cta}
            </Link>
          )}
        </div>

        {/* Tagline social proof — sous le bouton */}
        {plan.tagline && (
          <div className="flex items-start gap-2 mb-5">
            <div className="w-0.5 rounded-full bg-[#a855f7]/70 self-stretch shrink-0 mt-0.5" />
            <p className="text-xs text-[#d8b4fe]/80 leading-snug">{plan.tagline}</p>
          </div>
        )}

        {/* Espace pour les plans sans tagline (Free / Pro) afin de garder l'alignement du divider */}
        {!plan.tagline && <div className="mb-5" />}

        {/* Divider */}
        <div
          className={`mb-5 h-px ${
            isElite
              ? 'bg-gradient-to-r from-transparent via-[#a855f7]/40 to-transparent'
              : 'bg-[#1d1d1d]'
          }`}
        />


        {/* Features */}
        <ul className="space-y-3 flex-1">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckIcon included={feature.included} elite={isElite} />
              <span
                className={`text-sm leading-snug ${
                  feature.included
                    ? isFree
                      ? 'text-gray-400'
                      : isElite
                      ? 'text-gray-200'
                      : 'text-gray-300'
                    : 'text-gray-700'
                }`}
              >
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#080808] overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-[#ff0050]/4 blur-3xl" />
        <div className="absolute -top-20 right-1/4 w-[600px] h-[600px] rounded-full bg-[#7928ca]/6 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 pb-28">

        {/* Hero */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff0050]/10 text-[#ff0050] border border-[#ff0050]/20 mb-5">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            Tarifs simples et transparents
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Choisissez votre{' '}
            <span className="gradient-text">plan</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
            Des analyses précises, des conseils actionnables et des recommandations
            personnalisées pour dominer TikTok.
          </p>
        </div>

        {/* Pricing grid — items-stretch pour que toutes les cartes aient la même hauteur */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-3">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600">
          {[
            'Annulable à tout moment',
            'Paiement 100% sécurisé',
            'Satisfait ou remboursé 7 jours',
            'Sans engagement',
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-600 shrink-0">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
              {t}
            </span>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto space-y-3">
          <h2 className="text-center text-xs font-semibold text-gray-600 uppercase tracking-widest mb-6">
            Questions fréquentes
          </h2>
          {[
            {
              q: `Quel est le quota d'analyses en Elite ?`,
              a: `Le plan Elite inclut jusqu'à ${MAX_ANALYSES_ELITE} analyses par mois calendaire, réinitialisées le 1er de chaque mois.`,
            },
            {
              q: 'Puis-je changer de plan à tout moment ?',
              a: "Oui, vous pouvez upgrader ou downgrader votre plan à n'importe quel moment depuis votre espace compte.",
            },
            {
              q: `Que se passe-t-il après mes ${MAX_ANALYSES_FREE} analyses gratuites ?`,
              a: 'Votre accès est suspendu jusqu\'à la souscription d\'un abonnement. Vos données sont conservées 30 jours.',
            },
          ].map((faq, i) => (
            <div key={i} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
              <p className="text-sm font-medium text-white mb-1.5">{faq.q}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
