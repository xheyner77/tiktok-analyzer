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
  /** Accroche sous la description (ex. social proof Elite) */
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
      { label: '3 conseils d\'amélioration', included: true },
      { label: 'Générateur de hooks', included: false },
      { label: 'Historique des analyses', included: false },
      { label: 'Recommandations IA avancées', included: false },
      { label: 'Support prioritaire', included: false },
    ],
  },
  {
    name: 'Pro',
    badge: 'Le plus populaire',
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
    description: 'Pour les agences et créateurs qui veulent dominer l\'algorithme.',
    cta: 'Passer à Elite',
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
  const checkClass = included
    ? elite
      ? 'text-[#c084fc]'
      : 'text-[#ff0050]'
    : 'text-[#282828]';
  if (included) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 mt-0.5 ${checkClass}`}>
        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#282828] shrink-0 mt-0.5">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

function PricingCard({ plan }: { plan: Plan }) {
  const isPro = plan.variant === 'pro';
  const isElite = plan.variant === 'elite';

  return (
    <div
      className={`relative flex flex-col h-full transition-transform duration-300
        ${isPro
          ? 'rounded-2xl p-6 gradient-border card-glow scale-[1.01] z-[1] md:scale-[1.02]'
          : isElite
          ? 'rounded-3xl p-7 md:p-8 elite-pricing-card z-[2] scale-[1.03] md:scale-[1.07] md:-my-3 ring-1 ring-[#a855f7]/35'
          : 'rounded-2xl p-6 bg-[#111] border border-[#1a1a1a] card-glow'
        }`}
    >
      {/* Badge (Pro / Elite) */}
      {plan.badge && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 ${isElite ? '-top-4 md:-top-5' : '-top-3.5'}`}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap shadow-lg
              ${isElite
                ? 'bg-gradient-to-r from-amber-500 via-[#ff0050] to-[#9333ea] text-white shadow-[#7928ca]/35 ring-2 ring-white/10'
                : 'bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white shadow-[#ff0050]/25'
              }`}
          >
            {!isElite && (
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
              </svg>
            )}
            {plan.badge}
          </span>
        </div>
      )}

      {/* Plan header */}
      <div className={`mb-6 ${isElite ? 'mt-2 md:mt-3' : plan.badge ? 'mt-3' : ''}`}>
        <div className="flex items-center gap-2 mb-3.5">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider
              ${isPro
                ? 'bg-[#ff0050]/10 text-[#ff0050] border border-[#ff0050]/20'
                : isElite
                ? 'bg-[#7928ca]/20 text-[#e9d5ff] border border-[#a855f7]/35'
                : 'bg-[#1a1a1a] text-gray-500 border border-[#222]'
              }`}
          >
            {plan.name}
          </span>
        </div>

        {/* Price */}
        <div className="flex items-end gap-1 mb-3">
          {plan.period ? (
            <>
              <span
                className={`font-bold tracking-tight text-white ${isElite ? 'text-5xl' : 'text-4xl'}`}
              >
                {plan.price}€
              </span>
              <span className="text-gray-500 text-sm mb-1.5">{plan.period}</span>
            </>
          ) : (
            <span className="text-4xl font-bold text-white">{plan.price}</span>
          )}
        </div>

        <p
          className={`leading-relaxed ${isElite ? 'text-gray-300 text-[15px]' : 'text-gray-400 text-sm'}`}
        >
          {plan.description}
        </p>

        {plan.tagline && (
          <p
            className="mt-4 pl-3.5 border-l-2 border-[#a855f7]/70 text-sm text-[#e9d5ff]/95 leading-snug font-medium"
          >
            {plan.tagline}
          </p>
        )}
      </div>

      {/* CTA button */}
      {isPro || isElite ? (
        <CheckoutButton
          plan={plan.variant as 'pro' | 'elite'}
          className={`w-full text-center rounded-xl font-semibold transition-all duration-200 block
            ${isPro
              ? 'py-3 text-sm mb-6 bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 shadow-lg shadow-[#ff0050]/20 active:scale-[0.98]'
              : 'py-3.5 text-[15px] mb-7 bg-gradient-to-r from-[#9333ea] via-[#7928ca] to-[#ff0050] text-white hover:opacity-95 shadow-xl shadow-[#7928ca]/35 active:scale-[0.98] ring-1 ring-white/10'
            }`}
        >
          {plan.cta}
        </CheckoutButton>
      ) : (
        <Link
          href={plan.ctaHref}
          className="w-full text-center rounded-xl py-3 font-semibold text-sm transition-all duration-200 mb-6 block bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 hover:bg-[#222] hover:border-[#333] active:scale-[0.98]"
        >
          {plan.cta}
        </Link>
      )}

      {/* Divider */}
      <div
        className={`mb-5 ${isElite ? 'h-px bg-gradient-to-r from-transparent via-[#a855f7]/35 to-transparent' : 'h-px bg-[#1a1a1a]'}`}
      />

      {/* Features */}
      <ul className={`space-y-3.5 flex-1 ${isElite ? 'pb-1' : ''}`}>
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckIcon included={feature.included} elite={isElite} />
            <span
              className={`leading-snug ${isElite ? 'text-[15px]' : 'text-sm'} ${
                feature.included ? (isElite ? 'text-gray-200' : 'text-gray-300') : 'text-gray-600'
              }`}
            >
              {feature.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#080808] overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-[#ff0050]/5 blur-3xl" />
        <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-[#7928ca]/5 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 pb-24">

        {/* Hero */}
        <div className="text-center mb-14">
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
            Passez au niveau supérieur avec des analyses précises, des conseils actionnables et des recommandations personnalisées.
          </p>
        </div>

        {/* Pricing grid — Elite mis en avant (échelle + z-index) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-stretch md:items-center">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-14 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-600">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
              Annulable à tout moment
            </span>
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-600">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
              Paiement 100% sécurisé
            </span>
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-600">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
              Satisfait ou remboursé 7 jours
            </span>
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-600">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
              Sans engagement
            </span>
          </div>

          {/* FAQ teaser */}
          <div className="mt-8 w-full max-w-2xl space-y-3">
            <h2 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-5">
              Questions fréquentes
            </h2>
            {[
              {
                q: `Quel est le quota d’analyses en Elite ?`,
                a: `Le plan Elite inclut jusqu’à ${MAX_ANALYSES_ELITE} analyses par mois calendaire (réinitialisées le 1er de chaque mois), avec historique consultable sans limite pratique côté application.`,
              },
              {
                q: 'Puis-je changer de plan à tout moment ?',
                a: 'Oui, vous pouvez upgrader ou downgrader votre plan à n\'importe quel moment depuis votre espace compte.',
              },
              {
                q: `Que se passe-t-il après mes ${MAX_ANALYSES_FREE} analyses gratuites ?`,
                a: 'Votre accès est suspendu jusqu\'à la souscription d\'un abonnement. Vos données sont conservées 30 jours.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
                <p className="text-sm font-medium text-white mb-1.5">{faq.q}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
