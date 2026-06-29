'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { DashboardData } from '@/lib/dashboard-data';
import { useLanguage } from '@/lib/i18n/useLanguage';

interface TikTokConnectedSuccessModalProps {
  connection: DashboardData['tiktokConnection'];
  enabled: boolean;
  analyzeUrl?: string;
}

export function TikTokConnectedSuccessModal({
  connection,
  enabled,
  analyzeUrl = '/dashboard/analyze',
}: TikTokConnectedSuccessModalProps) {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [hasHandledSuccess, setHasHandledSuccess] = useState(false);
  const primaryActionRef = useRef<HTMLAnchorElement | null>(null);
  const displayName = connection.displayName?.trim() || t('tiktok.connectedAccountFallback');
  const modeLabel = connection.modeLabel?.trim();
  const validationRows = [
    t('tiktok.successProfileFetched'),
    connection.capabilities.hasVideoList
      ? t('tiktok.successDashboardSynced')
      : 'Métriques vidéo en attente de permissions TikTok.',
    connection.needsReconnect
      ? 'Reconnecte TikTok pour activer les statistiques.'
      : t('tiktok.successReadyForAnalysis'),
  ];

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

    primaryActionRef.current?.focus();

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
        aria-describedby="tiktok-connected-success-description"
        className="relative w-full max-w-[460px] overflow-hidden rounded-[20px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(12,18,34,0.96),rgba(5,8,18,0.98))] p-4 text-white shadow-[0_30px_96px_-44px_rgba(124,58,237,0.86),0_18px_72px_-52px_rgba(34,211,238,0.56),inset_0_1px_0_rgba(255,255,255,0.08)] animate-[tiktokSuccessIn_320ms_cubic-bezier(.2,.8,.2,1)_both] sm:p-5"
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
          className="absolute right-3.5 top-3.5 z-10 grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/45"
          aria-label={t('tiktok.closeSuccessModal')}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="relative">
          <div className="mb-4 flex items-center gap-3 pr-10">
            <div className="grid h-10 w-10 place-items-center rounded-[14px] border border-emerald-200/18 bg-[linear-gradient(135deg,rgba(52,211,153,0.22),rgba(34,211,238,0.12))] text-emerald-50 shadow-[0_16px_40px_-24px_rgba(52,211,153,0.9),inset_0_1px_0_rgba(255,255,255,0.16)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className="rounded-full border border-cyan-200/16 bg-cyan-300/[0.075] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
              {t('tiktok.syncBadge')}
            </div>
          </div>

          <h2 id="tiktok-connected-success-title" className="max-w-[390px] text-[25px] font-black leading-[1.04] tracking-[-0.03em] text-white sm:text-[30px]">
            {t('tiktok.connectedSuccessTitle')}
          </h2>
          <p id="tiktok-connected-success-description" className="mt-2.5 max-w-[390px] text-[13.5px] leading-6 text-slate-300 sm:text-[14px]">
            {t('tiktok.connectedSuccessSubtitle')}
            <span className="mt-1 block text-slate-400">{t('tiktok.connectedSuccessSupport')}</span>
          </p>

          <div className="mt-5 rounded-[15px] border border-white/[0.09] bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.12] bg-[linear-gradient(135deg,rgba(20,184,166,0.18),rgba(124,58,237,0.2))] text-[15px] font-black text-white">
                {connection.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={connection.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>TT</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-black leading-tight text-white" data-i18n-ignore="true">
                    {displayName}
                  </p>
                  {modeLabel && (
                    <span className="shrink-0 rounded-[6px] border border-amber-200/16 bg-amber-200/[0.075] px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100" data-i18n-ignore="true">
                      {modeLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] font-medium text-emerald-100/80">{t('tiktok.secureConnectionSuccessful')}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {validationRows.map((label) => (
              <div key={label} className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[11px] font-bold leading-none text-slate-200">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-violet-300/12 text-violet-100">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Link
              ref={primaryActionRef}
              href={analyzeUrl}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#d95df2_0%,#7c5cff_54%,#5b21e8_100%)] px-5 text-[13px] font-black text-white shadow-[0_18px_44px_-20px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/45"
            >
              {t('dashboard.analyzeVideo')}
            </Link>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[13px] font-bold text-slate-200 transition hover:border-white/[0.14] hover:bg-white/[0.075] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/35"
            >
              {t('tiktok.continueToDashboard')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
