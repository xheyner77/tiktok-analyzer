'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FloatingParticles from '@/components/FloatingParticles';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
  HISTORY_LIMITS,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

export const PENDING_URL_KEY  = 'pending_tiktok_url';
export const PENDING_PLAN_KEY = 'pending_plan_after_signup';

type PlanVariant = 'free' | 'pro' | 'elite';

/* ── Shared icon helpers ───────────────────────────────────────────────── */

function CheckFuchsia() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-vn-fuchsia">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}
function CheckViolet() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-400">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}
function CheckGray() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-600">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0 mt-0.5 text-gray-700">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface GuestGateProps {
  show: boolean;
  pendingUrl: string;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function GuestGate({ show, pendingUrl, onClose }: GuestGateProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

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
        backgroundColor: `rgba(0,0,0,${visible ? 0.9 : 0})`,
        backdropFilter: `blur(${visible ? 12 : 0}px)`,
        transition: 'background-color 0.25s ease, backdrop-filter 0.25s ease',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-gate-title"
    >
      <div
        className="guest-gate-dialog guest-gate-dialog-scroll relative w-full max-w-3xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-[#1e1e1e] bg-[#0a0a0f] shadow-2xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
          transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1)',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient top glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/15 to-vn-indigo/10 blur-3xl" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 transition-colors"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>

        <div className="relative px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="mb-5 pr-8 text-center sm:mb-6">
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-vn-fuchsia/20 bg-vn-fuchsia/10 px-3 py-1 text-[11px] font-semibold text-vn-fuchsia">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
              </svg>
              Compte requis
            </div>
            <h2 id="guest-gate-title" className="mb-1.5 text-[18px] font-bold leading-snug text-white sm:text-xl">
              Crée ton compte pour débloquer ton analyse
            </h2>
            <p className="text-[13px] leading-snug text-gray-500">
              Choisis ton plan · Résultats immédiats après inscription
            </p>
          </div>

          {/* ── Plan cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end sm:gap-0">

            {/* ── STARTER ── */}
            <div className="sm:pr-3">
              <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-[#09090f] p-5 h-full">
                <div className="mb-4">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-white/[0.04] text-gray-600 border border-white/[0.05]">
                    Starter
                  </span>
                  <div className="mt-4 mb-1">
                    <span className="text-[2.2rem] font-black text-white leading-none">Gratuit</span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-1.5 leading-relaxed">
                    Découvre Viralynz sans risque. Vois ce que l&apos;IA repère sur tes vidéos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanSelect('free')}
                  className="w-full text-center py-3 rounded-xl font-semibold text-[13px] text-gray-300 bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.09] hover:text-white transition-all mb-5"
                >
                  Commencer gratuitement
                </button>

                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-gray-700 mb-2.5">Ce que tu obtiens</p>
                <ul className="space-y-2 flex-1">
                  {[
                    { text: `${MAX_ANALYSES_FREE} analyses complètes`, sub: 'Score + Hook + Montage + Rétention', ok: true },
                    { text: 'Recommandations IA', sub: 'Plan de correction basique', ok: true },
                    { text: 'Dashboard de progression', sub: null, ok: true },
                    { text: 'Générateur de hooks', sub: null, ok: false },
                    { text: "Plan d'action priorisé", sub: null, ok: false },
                    { text: 'Historique des analyses', sub: null, ok: false },
                  ].map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 ${!f.ok ? 'opacity-35' : ''}`}>
                      {f.ok ? <CheckGray /> : <CrossIcon />}
                      <div>
                        <span className={`text-[12px] leading-snug block ${f.ok ? 'text-gray-400' : 'text-gray-700'}`}>{f.text}</span>
                        {f.sub && <span className="text-[10px] text-gray-700 leading-none">{f.sub}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── PRO — ELEVATED ── */}
            <div className="sm:-mt-8 sm:z-10 relative">
              {/* Popular badge — outside the card */}
              <div className="flex justify-center mb-2.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-4 py-1.5 rounded-full bg-vn-fuchsia text-white shadow-lg shadow-vn-fuchsia/50">
                  ⭐ Le plus populaire
                </span>
              </div>

              <div className="relative flex flex-col rounded-[1.1rem] border border-vn-fuchsia/35 bg-gradient-to-b from-[#130916] to-[#0a0810] p-5 shadow-[0_16px_60px_-16px_rgba(232,121,249,0.35)] z-10 overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/80 to-transparent" />
                <FloatingParticles count={20} className="opacity-40" />

                <div className="relative mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/35">Pro</span>
                    <span className="text-[10px] text-vn-fuchsia/70 font-semibold">Recommandé</span>
                  </div>

                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-[2.6rem] font-black text-white leading-none">{DISPLAY_CATALOG_PRO_EUR}€</span>
                    <span className="text-gray-500 text-sm pb-1.5">/ mois</span>
                  </div>

                  {/* ROI anchor */}
                  <div className="mt-2 mb-3 px-3 py-2 rounded-lg bg-vn-fuchsia/[0.08] border border-vn-fuchsia/15">
                    <p className="text-[11px] text-vn-fuchsia/80 leading-snug">
                      💡 <span className="font-semibold">1 vidéo mieux optimisée</span> = des dizaines de milliers de vues supplémentaires.
                    </p>
                  </div>

                  {/* Social proof */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[11, 47, 12, 44, 15].map((n) => (
                        <img key={n} src={`https://i.pravatar.cc/40?img=${n}`} alt="" width={22} height={22}
                          className="w-5.5 h-5.5 rounded-full border-2 border-[#0a0810] object-cover" />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500">Choisi par <span className="text-gray-300 font-semibold">80% des créateurs</span></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanSelect('pro')}
                  className="relative w-full py-3.5 rounded-xl font-bold text-[13px] text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_32px_-8px_rgba(232,121,249,0.55)] mb-1"
                >
                  Commencer avec Pro →
                </button>
                <p className="text-[10px] text-gray-700 text-center mb-4">Sans engagement · Annule en 1 clic</p>

                <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/25 to-transparent mb-4" />

                {/* Feature groups */}
                <div className="space-y-4 flex-1 relative">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-vn-fuchsia/50 mb-2">Analyse IA</p>
                    <ul className="space-y-1.5">
                      {[
                        { text: `${MAX_ANALYSES_PRO} analyses / mois`, bold: true },
                        { text: 'Score + Hook / Montage / Rétention', bold: false },
                        { text: "Plan d'action IA priorisé", bold: false },
                        { text: 'Recommandations avancées', bold: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckFuchsia />
                          <span className={`text-[12px] leading-snug ${f.bold ? 'text-white font-bold' : 'text-gray-300'}`}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-vn-fuchsia/50 mb-2">Création</p>
                    <ul className="space-y-1.5">
                      {[
                        { text: `${MAX_HOOKS_PRO} hooks générés / mois`, bold: true },
                        { text: `Historique ${HISTORY_LIMITS.pro} analyses`, bold: false },
                        { text: 'Dashboard coach personnalisé', bold: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckFuchsia />
                          <span className={`text-[12px] leading-snug ${f.bold ? 'text-white font-bold' : 'text-gray-300'}`}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ELITE ── */}
            <div className="sm:pl-3">
              <div className="relative flex flex-col rounded-2xl border border-violet-500/25 bg-gradient-to-b from-[#0e0b16] to-[#080810] p-5 h-full overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(139,92,246,0.08),transparent)] pointer-events-none" />

                <div className="relative mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-violet-500/15 text-violet-300 border border-violet-500/25">Elite</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                      🔥 Volume max
                    </span>
                  </div>

                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-[2.2rem] font-black text-white leading-none">{DISPLAY_CATALOG_ELITE_EUR}€</span>
                    <span className="text-gray-500 text-sm pb-1">/ mois</span>
                  </div>

                  {/* ROI anchor */}
                  <div className="mt-2 mb-3 px-3 py-2 rounded-lg bg-violet-500/[0.07] border border-violet-500/15">
                    <p className="text-[11px] text-violet-300/80 leading-snug">
                      ⚡ Pour les <span className="font-semibold">agences & créateurs 100k+</span> qui publient chaque semaine.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanSelect('elite')}
                  className="relative w-full py-3.5 rounded-xl font-bold text-[13px] text-white bg-gradient-to-r from-violet-600 to-vn-fuchsia hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_8px_32px_-8px_rgba(139,92,246,0.4)] mb-1 ring-1 ring-white/10"
                >
                  Passer en Elite →
                </button>
                <p className="text-[10px] text-gray-700 text-center mb-4">Sans engagement · Annule en 1 clic</p>

                <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent mb-4" />

                <div className="space-y-4 flex-1 relative">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-violet-400/50 mb-2">Volume &amp; Analyse</p>
                    <ul className="space-y-1.5">
                      {[
                        { text: `${MAX_ANALYSES_ELITE} analyses / mois`, elite: true },
                        { text: 'Score + Hook / Montage / Rétention', elite: false },
                        { text: 'Recommandations IA complètes', elite: false },
                        { text: "Plan d'action IA priorisé", elite: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckViolet />
                          <span className={`text-[12px] leading-snug flex-1 ${f.elite ? 'text-violet-100 font-bold' : 'text-gray-400'}`}>{f.text}</span>
                          {f.elite && <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wide ml-1 self-center">Elite</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-violet-400/50 mb-2">Exclusif Elite</p>
                    <ul className="space-y-1.5">
                      {[
                        { text: `${MAX_HOOKS_ELITE} hooks / mois`, elite: true },
                        { text: 'Historique illimité', elite: true },
                        { text: 'Stratégie & Insights viraux', elite: true },
                        { text: 'Support prioritaire', elite: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckViolet />
                          <span className={`text-[12px] leading-snug flex-1 ${f.elite ? 'text-violet-100 font-bold' : 'text-gray-400'}`}>{f.text}</span>
                          {f.elite && <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wide ml-1 self-center">Elite</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Trust bar ──────────────────────────────────────── */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6">
            {[
              { icon: '🔒', label: 'Paiement sécurisé Stripe' },
              { icon: '↩', label: 'Remboursement 7 jours' },
              { icon: '∞', label: 'Sans engagement' },
            ].map((t) => (
              <span key={t.label} className="flex items-center gap-1.5 text-[10px] text-gray-600 sm:text-[11px]">
                <span>{t.icon}</span>
                {t.label}
              </span>
            ))}
          </div>

          {/* ── Divider + login ──────────────────────────────────── */}
          <div className="mt-4 mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.05]" />
            <span className="text-[11px] text-gray-600">ou</span>
            <div className="h-px flex-1 bg-white/[0.05]" />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 text-[13px] font-semibold text-gray-300 transition-all hover:bg-white/[0.06] hover:text-white active:scale-[0.99] sm:text-sm"
          >
            Se connecter
          </button>

        </div>
      </div>
    </div>
  );
}
