import Link from 'next/link';
import { MAX_ANALYSES_ELITE, MAX_ANALYSES_PRO } from '@/lib/plan-limits';
import {
  DISPLAY_CATALOG_ELITE_EUR,
  DISPLAY_CATALOG_PRO_EUR,
  DISPLAY_LAUNCH_ELITE_EUR,
  DISPLAY_LAUNCH_PRO_EUR,
} from '@/lib/stripe-pricing';

interface PremiumGateProps {
  onReset?: () => void;
}

const CheckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className ?? 'w-3.5 h-3.5'}>
    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
  </svg>
);

const freeFeatures = ['3 analyses (utilisées)', 'Score de viralité', 'Conseils basiques'];

const proFeatures = [
  `${MAX_ANALYSES_PRO} analyses / mois`,
  'Score de viralité détaillé',
  'Conseils personnalisés IA',
  'Export PDF du rapport',
  'Historique des analyses',
];

const eliteFeatures = [
  `${MAX_ANALYSES_ELITE} analyses / mois`,
  'Score de viralité détaillé',
  'Conseils personnalisés IA',
  'Export PDF du rapport',
  'Historique des analyses',
  'Analyse comparative concurrents',
  'Support prioritaire',
];

export default function PremiumGate({ onReset }: PremiumGateProps) {
  return (
    <div className="animate-fade-up space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff0050]/15 to-[#7928ca]/15 border border-[#ff0050]/20 mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#lg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <defs>
              <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff0050" />
                <stop offset="100%" stopColor="#7928ca" />
              </linearGradient>
            </defs>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Tes 3 analyses gratuites sont épuisées</h2>
        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
          Choisis un plan pour continuer à analyser tes vidéos TikTok et maximiser ta viralité.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">

        {/* ── Free (used) ────────────────────────────────────────── */}
        <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-2xl p-5 opacity-60">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Free</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gray-500 border border-[#222]">
                Utilisé
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-gray-500">0</span>
              <span className="text-base font-semibold text-gray-600 mb-0.5">€</span>
              <span className="text-sm text-gray-600 mb-1">/mois</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Pour découvrir l&apos;outil</p>
          </div>

          <div className="space-y-2.5 mb-5">
            {freeFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckIcon className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className="text-xs text-gray-600">{f}</span>
              </div>
            ))}
          </div>

          <div className="w-full rounded-xl py-2.5 text-xs font-semibold text-gray-600 bg-[#151515] text-center border border-[#1e1e1e] cursor-not-allowed">
            Plan actuel
          </div>
        </div>

        {/* ── Pro (featured) ─────────────────────────────────────── */}
        <div
          className="relative rounded-2xl p-5 card-glow"
          style={{
            background: 'linear-gradient(#0f0f0f, #0f0f0f) padding-box, linear-gradient(135deg, #ff0050, #7928ca) border-box',
            border: '1px solid transparent',
          }}
        >
          {/* Popular badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white shadow-lg shadow-[#ff0050]/25 whitespace-nowrap">
              ⭐ Le plus populaire
            </span>
          </div>

          <div className="mb-4 mt-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold gradient-text uppercase tracking-widest">Pro</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-500 line-through">
                {DISPLAY_CATALOG_PRO_EUR}€/mois
              </div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-white">{DISPLAY_LAUNCH_PRO_EUR}</span>
                <span className="text-base font-semibold text-gray-300 mb-0.5">€</span>
                <span className="text-sm text-gray-400 mb-1">/mois</span>
              </div>
              <p className="text-[10px] font-semibold text-emerald-400/90">Offre lancement -50%</p>
            </div>
            <p className="text-xs text-green-400 mt-1 font-medium">Annulable à tout moment</p>
          </div>

          <div className="space-y-2.5 mb-5">
            {proFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckIcon className="w-3.5 h-3.5 text-[#ff0050] shrink-0" />
                <span className="text-xs text-gray-300">{f}</span>
              </div>
            ))}
          </div>

          <Link
            href="/pricing"
            className="block w-full rounded-xl py-3 text-sm font-semibold text-white text-center bg-gradient-to-r from-[#ff0050] to-[#7928ca] hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-[#ff0050]/20"
          >
            Choisir Pro →
          </Link>
        </div>

        {/* ── Elite ──────────────────────────────────────────────── */}
        <div className="bg-[#0d0a14] border border-[#7928ca]/25 rounded-2xl p-5 card-glow">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#b060ff] uppercase tracking-widest">Elite</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#7928ca]/15 text-[#b060ff] border border-[#7928ca]/25 whitespace-nowrap">
                Créateurs sérieux
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-gray-500 line-through">
                {DISPLAY_CATALOG_ELITE_EUR}€/mois
              </div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-white">{DISPLAY_LAUNCH_ELITE_EUR}</span>
                <span className="text-base font-semibold text-gray-300 mb-0.5">€</span>
                <span className="text-sm text-gray-400 mb-1">/mois</span>
              </div>
              <p className="text-[10px] font-semibold text-emerald-400/90">Offre lancement -50%</p>
            </div>
            <p className="text-xs text-green-400 mt-1 font-medium">Annulable à tout moment</p>
          </div>

          <div className="space-y-2.5 mb-5">
            {eliteFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckIcon className="w-3.5 h-3.5 text-[#b060ff] shrink-0" />
                <span className="text-xs text-gray-300">{f}</span>
              </div>
            ))}
          </div>

          <Link
            href="/pricing"
            className="block w-full rounded-xl py-3 text-sm font-semibold text-[#b060ff] text-center bg-[#7928ca]/10 border border-[#7928ca]/30 hover:bg-[#7928ca]/20 hover:border-[#7928ca]/50 active:scale-[0.99] transition-all"
          >
            Choisir Elite →
          </Link>
        </div>

      </div>

      {/* Reset link for demo */}
      {onReset && (
        <p className="text-center">
          <button
            onClick={onReset}
            className="text-xs text-gray-700 hover:text-gray-500 transition-colors underline underline-offset-2"
          >
            Réinitialiser le compteur (démo)
          </button>
        </p>
      )}
    </div>
  );
}
