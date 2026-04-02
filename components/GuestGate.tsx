'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

export const PENDING_URL_KEY  = 'pending_tiktok_url';
export const PENDING_PLAN_KEY = 'pending_plan_after_signup';

type PlanVariant = 'free' | 'pro' | 'elite';

interface PlanConfig {
  variant: PlanVariant;
  name: string;
  badge?: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
}

const PLANS: PlanConfig[] = [
  {
    variant: 'free',
    name: 'Free',
    price: 'Gratuit',
    features: [
      '3 analyses',
      'Score de viralité',
      'Analyse Hook, Montage, Rétention',
      '3 conseils d\'amélioration',
    ],
    cta: 'Commencer gratuitement',
  },
  {
    variant: 'pro',
    name: 'Pro',
    badge: 'Le plus populaire',
    price: `${DISPLAY_CATALOG_PRO_EUR}€`,
    period: '/ mois',
    features: [
      `${MAX_ANALYSES_PRO} analyses / mois`,
      'Score de viralité complet',
      '5 conseils détaillés',
      `${MAX_HOOKS_PRO} hooks générés / mois`,
    ],
    cta: 'Choisir Pro',
  },
  {
    variant: 'elite',
    name: 'Elite',
    price: `${DISPLAY_CATALOG_ELITE_EUR}€`,
    period: '/ mois',
    features: [
      `${MAX_ANALYSES_ELITE} analyses / mois`,
      'Recommandations IA avancées',
      `${MAX_HOOKS_ELITE} hooks générés / mois`,
      'Support prioritaire',
    ],
    cta: 'Choisir Elite',
  },
];

interface GuestGateProps {
  show: boolean;
  pendingUrl: string;
  onClose: () => void;
}

export default function GuestGate({ show, pendingUrl, onClose }: GuestGateProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  // Fade-in on open
  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [show]);

  if (!show) return null;

  function saveUrl() {
    if (pendingUrl.trim()) {
      localStorage.setItem(PENDING_URL_KEY, pendingUrl.trim());
    }
  }

  function handlePlanSelect(variant: PlanVariant) {
    saveUrl();
    localStorage.setItem(PENDING_PLAN_KEY, variant);
    router.push('/signup');
  }

  function handleLogin() {
    saveUrl();
    router.push('/login?redirect=/analyzer');
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center px-3 sm:px-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        backgroundColor: `rgba(0,0,0,${visible ? 0.88 : 0})`,
        backdropFilter: `blur(${visible ? 10 : 0}px)`,
        transition: 'background-color 0.25s ease, backdrop-filter 0.25s ease',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-gate-title"
    >
      <div
        className="guest-gate-dialog guest-gate-dialog-scroll relative w-full max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-[#1e1e1e] bg-[#0d0d0d] shadow-2xl sm:max-h-[min(92dvh,720px)]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
          transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/12 to-vn-indigo/12 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1a1a] text-gray-500 hover:bg-[#222] hover:text-gray-300 sm:right-3 sm:top-3"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>

        <div className="relative px-4 pb-6 pt-4 sm:px-6 sm:pb-7 sm:pt-5">
            <div className="pr-10 text-center sm:mb-5 sm:pr-8 mb-4">
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-vn-fuchsia/20 bg-vn-fuchsia/10 px-2.5 py-1 text-[11px] font-semibold text-vn-fuchsia sm:mb-3 sm:px-3 sm:py-1.5 sm:text-xs">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                  <path
                    fillRule="evenodd"
                    d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                    clipRule="evenodd"
                  />
                </svg>
                Compte requis
              </div>
              <h2 id="guest-gate-title" className="mb-1.5 text-[17px] font-bold leading-snug text-white sm:text-xl">
                Crée ton compte pour débloquer ton analyse
              </h2>
              <p className="mx-auto max-w-[280px] text-[13px] leading-snug text-gray-500 sm:max-w-none sm:text-sm">
                Choisis ton plan et découvre pourquoi ta vidéo ne perce pas
              </p>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-2.5 sm:mb-6 sm:grid-cols-3 sm:gap-3">
              {PLANS.map((plan) => (
                <PlanCard key={plan.variant} plan={plan} onSelect={() => handlePlanSelect(plan.variant)} />
              ))}
            </div>

            <div className="mb-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1a1a1a]" />
              <span className="text-[11px] text-gray-600 sm:text-xs">ou</span>
              <div className="h-px flex-1 bg-[#1a1a1a]" />
            </div>

            <button
              type="button"
              onClick={handleLogin}
              className="w-full rounded-xl border border-[#1e1e1e] bg-[#111] py-3 text-[13px] font-semibold text-gray-300 transition-all duration-200 hover:border-[#2a2a2a] hover:bg-[#181818] hover:text-white active:scale-[0.99] sm:py-2.5 sm:text-sm"
            >
              Se connecter
            </button>

            <p className="mt-4 text-center text-[10px] leading-relaxed text-gray-700 sm:text-xs">
              Sans engagement · Annulable à tout moment · Paiement sécurisé
            </p>
        </div>
      </div>
    </div>
  );
}

// ── Plan card ───────────────────────────────────────────────────────────────

function PlanCard({ plan, onSelect }: { plan: PlanConfig; onSelect: () => void }) {
  const isPro  = plan.variant === 'pro';
  const isElite = plan.variant === 'elite';

  return (
    <div
      className={`relative flex flex-col rounded-xl p-3 transition-all sm:p-4 ${plan.badge ? 'pt-5 sm:pt-6' : ''}
        ${isPro
          ? 'gradient-border card-glow'
          : isElite
          ? 'border border-[#2d1a4a] bg-[#0f0a18]'
          : 'border border-[#1a1a1a] bg-[#111]'
        }`}
    >
      {plan.badge && (
        <div className="absolute -top-2.5 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap sm:-top-3">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-2 py-0.5 text-[9px] font-bold text-white shadow-lg shadow-vn-fuchsia/20 sm:gap-1 sm:px-2.5 sm:text-[10px]">
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            {plan.badge}
          </span>
        </div>
      )}

      <div className={`mb-2 sm:mb-3 ${plan.badge ? 'mt-0.5' : 'mt-0'}`}>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:text-xs
            ${isPro
              ? 'border border-vn-fuchsia/20 bg-vn-fuchsia/10 text-vn-fuchsia'
              : isElite
              ? 'border border-vn-violet/25 bg-vn-violet/15 text-vn-glow'
              : 'border border-[#222] bg-[#1a1a1a] text-gray-500'
            }`}
        >
          {plan.name}
        </span>
      </div>

      <div className="mb-2 sm:mb-3">
        <span className={`text-lg font-bold sm:text-xl ${isElite ? 'text-vn-glow' : 'text-white'}`}>{plan.price}</span>
        {plan.period && <span className="ml-1 text-[11px] text-gray-500 sm:text-xs">{plan.period}</span>}
      </div>

      <ul className="mb-3 flex-1 space-y-1 sm:mb-4 sm:space-y-1.5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`mt-0.5 h-3 w-3 shrink-0 ${isPro ? 'text-vn-fuchsia' : isElite ? 'text-vn-glow' : 'text-gray-600'}`}
            >
              <path
                fillRule="evenodd"
                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-[11px] leading-snug text-gray-400 sm:text-xs sm:leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-xl py-2.5 text-[11px] font-semibold transition-all duration-200 active:scale-[0.98] sm:py-2.5 sm:text-xs
          ${isPro
            ? 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-md shadow-vn-fuchsia/20 hover:opacity-90'
            : isElite
            ? 'border border-vn-violet/40 bg-vn-violet/20 text-vn-glow hover:border-vn-violet/60 hover:bg-vn-violet/30'
            : 'border border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 hover:border-[#333] hover:bg-[#222]'
          }`}
      >
        {plan.cta}
      </button>
    </div>
  );
}
