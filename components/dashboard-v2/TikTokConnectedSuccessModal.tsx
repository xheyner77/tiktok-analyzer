'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { DashboardData } from '@/lib/dashboard-data';

interface TikTokConnectedSuccessModalProps {
  connection: DashboardData['tiktokConnection'];
  enabled: boolean;
  analyzeUrl?: string;
}

const validationRows = [
  'Profil TikTok récupéré',
  'Compte lié à ton dashboard',
  'Prêt pour une première analyse',
] as const;

export function TikTokConnectedSuccessModal({
  connection,
  enabled,
  analyzeUrl = '/dashboard/analyze',
}: TikTokConnectedSuccessModalProps) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);
  const displayName = connection.displayName?.trim() || 'Compte TikTok connecté';
  const modeLabel = connection.modeLabel?.trim();

  useEffect(() => {
    if (hasHandledSuccess || !enabled || !connection.connected) return;
    if (searchParams?.get('tiktok') !== 'connected') return;

    setIsOpen(true);
    setHasHandledSuccess(true);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tiktok');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Non-critical: the modal still closes normally if URL cleanup is unavailable.
    }
  }, [connection.connected, enabled, hasHandledSuccess, searchParams]);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center px-4 py-6 sm:px-6"
      role="presentation"
      onMouseDown={() => setIsOpen(false)}
    >
      <div className="absolute inset-0 bg-[#020611]/82 backdrop-blur-[18px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_54%_42%_at_50%_24%,rgba(124,58,237,0.22),transparent_62%),radial-gradient(ellipse_36%_30%_at_62%_58%,rgba(34,211,238,0.12),transparent_64%)]" />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiktok-connected-success-title"
        className="relative w-full max-w-[520px] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(13,20,38,0.96),rgba(5,9,20,0.98))] p-5 text-white shadow-[0_34px_110px_-42px_rgba(124,58,237,0.82),0_20px_90px_-54px_rgba(34,211,238,0.52),inset_0_1px_0_rgba(255,255,255,0.08)] animate-[tiktokSuccessIn_360ms_cubic-bezier(.2,.8,.2,1)_both] sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <style jsx>{`
          @keyframes tiktokSuccessIn {
            from {
              opacity: 0;
              transform: translateY(16px) scale(0.97);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,93,242,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_34%)]" />
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/45"
          aria-label="Fermer la confirmation TikTok"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-[15px] border border-violet-200/20 bg-[linear-gradient(135deg,rgba(217,93,242,0.24),rgba(34,211,238,0.12))] text-violet-50 shadow-[0_18px_44px_-24px_rgba(217,93,242,0.9),inset_0_1px_0_rgba(255,255,255,0.16)]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="rounded-full border border-cyan-200/16 bg-cyan-300/[0.075] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
              TIKTOK SYNC
            </div>
          </div>

          <h2 id="tiktok-connected-success-title" className="max-w-[420px] text-[28px] font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-[34px]">
            Compte TikTok connecté
          </h2>
          <p className="mt-3 max-w-[450px] text-[14px] leading-relaxed text-slate-300 sm:text-[15px]">
            Ton compte a bien été relié à Viralynz. Tu peux maintenant lancer une analyse et commencer à construire tes insights.
          </p>

          <div className="mt-6 rounded-[16px] border border-white/[0.09] bg-white/[0.045] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.12] bg-[linear-gradient(135deg,rgba(20,184,166,0.18),rgba(124,58,237,0.2))] text-[17px] font-black text-white">
                {connection.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connection.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>♪</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-black leading-tight text-white">{displayName}</p>
                  {modeLabel && (
                    <span className="shrink-0 rounded-[6px] border border-amber-200/16 bg-amber-200/[0.075] px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
                      {modeLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] font-medium text-slate-400">Connexion sécurisée réussie</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {validationRows.map((label) => (
              <div key={label} className="flex min-h-[52px] items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[12px] font-bold leading-snug text-slate-200">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-300/12 text-violet-100">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={analyzeUrl}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#d95df2_0%,#7c5cff_54%,#5b21e8_100%)] px-5 text-[13px] font-black text-white shadow-[0_18px_44px_-20px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/45"
            >
              Analyser une vidéo
            </Link>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[13px] font-bold text-slate-200 transition hover:border-white/[0.14] hover:bg-white/[0.075] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/35"
            >
              Continuer vers le dashboard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
