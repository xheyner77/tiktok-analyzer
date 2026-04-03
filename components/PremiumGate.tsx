import Link from 'next/link';
import { MAX_ANALYSES_ELITE, MAX_ANALYSES_PRO } from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

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
  'Historique des analyses',
  'Hook generator (150 / mois)',
];

const eliteFeatures = [
  `${MAX_ANALYSES_ELITE} analyses / mois`,
  'Score de viralité détaillé',
  'Conseils personnalisés IA',
  'Historique illimité',
  'Hook generator (500 / mois)',
  'Analyse comparative concurrents',
  'Support prioritaire',
];

export default function PremiumGate({ onReset }: PremiumGateProps) {
  return (
    <div className="animate-fade-up space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-vn-fuchsia/15 to-vn-indigo/15 border border-vn-fuchsia/25 mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#lg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <defs>
              <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e879f9" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Tes 3 analyses gratuites sont épuisées</h2>
        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
          Choisis un plan pour continuer à analyser tes vidéos courtes et affiner hook, montage et rétention avec Viralynz.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">

        {/* ── Free (used) ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 opacity-60">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Free</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-500 border border-white/[0.09]">
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

          <div className="w-full rounded-xl py-2.5 text-xs font-semibold text-gray-600 bg-white/[0.04] text-center border border-white/[0.07] cursor-not-allowed">
            Plan actuel
          </div>
        </div>

        {/* ── Pro (featured) ─────────────────────────────────────── */}
        <div
          className="relative rounded-2xl p-5 shadow-[0_8px_40px_-8px_rgba(232,121,249,0.25)]"
          style={{
            background: 'linear-gradient(#09090f, #09090f) padding-box, linear-gradient(135deg, #e879f9, #6366f1) border-box',
            border: '1px solid transparent',
          }}
        >
          {/* Popular badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-lg shadow-vn-fuchsia/25 whitespace-nowrap">
              ⭐ Le plus populaire
            </span>
          </div>

          <div className="mb-4 mt-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold gradient-text uppercase tracking-widest">Pro</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-white">{DISPLAY_CATALOG_PRO_EUR}</span>
              <span className="text-base font-semibold text-gray-300 mb-0.5">€</span>
              <span className="text-sm text-gray-400 mb-1">/mois</span>
            </div>
            <p className="text-xs text-green-400 mt-1 font-medium">Annulable à tout moment</p>
          </div>

          <div className="space-y-2.5 mb-5">
            {proFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckIcon className="w-3.5 h-3.5 text-vn-fuchsia shrink-0" />
                <span className="text-xs text-gray-300">{f}</span>
              </div>
            ))}
          </div>

          <Link
            href="/pricing"
            className="block w-full rounded-xl py-3 text-sm font-semibold text-white text-center bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-vn-fuchsia/20"
          >
            Choisir Pro →
          </Link>
        </div>

        {/* ── Elite ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-vn-violet/25 bg-gradient-to-b from-vn-violet/[0.07] to-transparent p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-vn-glow uppercase tracking-widest">Elite</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-vn-violet/15 text-vn-glow border border-vn-violet/25 whitespace-nowrap">
                Créateurs sérieux
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-white">{DISPLAY_CATALOG_ELITE_EUR}</span>
              <span className="text-base font-semibold text-gray-300 mb-0.5">€</span>
              <span className="text-sm text-gray-400 mb-1">/mois</span>
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
            className="block w-full rounded-xl py-3 text-sm font-semibold text-vn-glow text-center bg-vn-violet/10 border border-vn-violet/30 hover:bg-vn-violet/20 hover:border-vn-violet/50 active:scale-[0.99] transition-all"
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
