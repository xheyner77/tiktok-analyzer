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
    price: '9,99€',
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
    price: '24,99€',
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
    router.push('/login?redirect=/');
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.88 : 0})`,
        backdropFilter: `blur(${visible ? 10 : 0}px)`,
        transition: 'background-color 0.25s ease, backdrop-filter 0.25s ease',
      }}
      onClick={onClose}
    >
      {/* Modal — stopPropagation so clicks inside don't close */}
      <div
        className="relative w-full max-w-xl bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl shadow-2xl overflow-y-auto"
        style={{
          maxHeight: 'calc(100vh - 2rem)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
          transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full bg-gradient-to-br from-[#ff0050]/12 to-[#7928ca]/12 blur-3xl pointer-events-none" />

        <div className="relative p-6">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-[#222] transition-colors"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="text-center mb-7 pr-8">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff0050]/10 text-[#ff0050] border border-[#ff0050]/20 mb-4">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
              </svg>
              Compte requis
            </div>
            <h2 className="text-xl font-bold text-white leading-snug mb-2">
              Crée ton compte pour débloquer ton analyse
            </h2>
            <p className="text-sm text-gray-500">
              Choisis ton plan et découvre pourquoi ta vidéo ne perce pas
            </p>
          </div>

          {/* ── Plan cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.variant}
                plan={plan}
                onSelect={() => handlePlanSelect(plan.variant)}
              />
            ))}
          </div>

          {/* ── Divider + login ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-[#1a1a1a]" />
            <span className="text-xs text-gray-600">ou</span>
            <div className="h-px flex-1 bg-[#1a1a1a]" />
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-2.5 rounded-xl bg-[#111] border border-[#1e1e1e] text-sm font-semibold text-gray-300 hover:bg-[#181818] hover:border-[#2a2a2a] hover:text-white transition-all duration-200 active:scale-[0.99]"
          >
            Se connecter
          </button>

          <p className="text-center text-xs text-gray-700 mt-4">
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
      className={`relative flex flex-col rounded-xl p-4 transition-all
        ${isPro
          ? 'gradient-border card-glow'
          : isElite
          ? 'bg-[#0f0a18] border border-[#2d1a4a]'
          : 'bg-[#111] border border-[#1a1a1a]'
        }`}
    >
      {/* Popular badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white shadow-lg shadow-[#ff0050]/20">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Plan label */}
      <div className="mb-3 mt-1">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider
            ${isPro
              ? 'bg-[#ff0050]/10 text-[#ff0050] border border-[#ff0050]/20'
              : isElite
              ? 'bg-[#7928ca]/15 text-[#b060ff] border border-[#7928ca]/25'
              : 'bg-[#1a1a1a] text-gray-500 border border-[#222]'
            }`}
        >
          {plan.name}
        </span>
      </div>

      {/* Price */}
      <div className="mb-3">
        <span className={`text-xl font-bold ${isElite ? 'text-[#c084fc]' : 'text-white'}`}>
          {plan.price}
        </span>
        {plan.period && (
          <span className="text-xs text-gray-500 ml-1">{plan.period}</span>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-1.5 mb-4 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`w-3 h-3 shrink-0 mt-0.5
                ${isPro ? 'text-[#ff0050]' : isElite ? 'text-[#b060ff]' : 'text-gray-600'}`}
            >
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
            <span className="text-xs text-gray-400 leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onSelect}
        className={`w-full rounded-xl py-2.5 font-semibold text-xs transition-all duration-200 active:scale-[0.98]
          ${isPro
            ? 'bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 shadow-md shadow-[#ff0050]/20'
            : isElite
            ? 'bg-[#7928ca]/20 border border-[#7928ca]/40 text-[#c084fc] hover:bg-[#7928ca]/30 hover:border-[#7928ca]/60'
            : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 hover:bg-[#222] hover:border-[#333]'
          }`}
      >
        {plan.cta}
      </button>
    </div>
  );
}
