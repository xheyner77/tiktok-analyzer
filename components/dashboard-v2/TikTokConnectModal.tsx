'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const DISMISS_KEY = 'viralynz_tiktok_popup_dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

type TikTokConnectModalProps = {
  isTikTokConnected: boolean;
  connectUrl?: string;
  analyzerUrl?: string;
  hasAnalyses?: boolean;
};

const unlockedMetrics = ['Vues réelles', 'Engagement', 'Top vidéos', 'Opportunités IA'];

const tiktokMessages: Record<string, { tone: 'warn' | 'error' | 'success'; title: string; body: string }> = {
  config: {
    tone: 'warn',
    title: 'Connexion TikTok à configurer',
    body: 'Ajoute TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET dans .env.local, puis redémarre le serveur local.',
  },
  limit: {
    tone: 'warn',
    title: 'Limite TikTok atteinte',
    body: 'Ton plan actuel ne permet pas de connecter un compte TikTok supplémentaire.',
  },
  setup: {
    tone: 'error',
    title: 'Connexion TikTok indisponible',
    body: 'La connexion TikTok n’est pas prête côté serveur. Réessaie dans quelques minutes.',
  },
  session: {
    tone: 'warn',
    title: 'Session requise',
    body: 'Reconnecte-toi à Viralynz, puis relance la connexion TikTok.',
  },
  state: {
    tone: 'warn',
    title: 'Session TikTok expirée',
    body: 'Le jeton OAuth a expiré. Clique à nouveau sur Connecter TikTok.',
  },
  denied: {
    tone: 'warn',
    title: 'Connexion annulée',
    body: 'L’autorisation TikTok a été refusée ou fermée avant la fin.',
  },
  token: {
    tone: 'error',
    title: 'Échange TikTok impossible',
    body: 'TikTok n’a pas validé le code OAuth. Vérifie la callback URL dans ton app TikTok.',
  },
  profile: {
    tone: 'error',
    title: 'Profil TikTok inaccessible',
    body: 'Le compte a été autorisé, mais Viralynz n’a pas pu récupérer le profil.',
  },
  db: {
    tone: 'error',
    title: 'Enregistrement impossible',
    body: 'La connexion TikTok n’a pas pu être enregistrée en base.',
  },
  connected: {
    tone: 'success',
    title: 'TikTok connecté',
    body: 'Ton compte TikTok est bien lié à Viralynz.',
  },
};

function isDismissedRecently(value: string | null) {
  if (!value) return false;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp < DISMISS_DURATION_MS;
}

export default function TikTokConnectModal({
  isTikTokConnected,
  connectUrl = '/api/tiktok/connect',
  analyzerUrl = '/dashboard/analyze',
}: TikTokConnectModalProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const tiktokStatus = searchParams?.get('tiktok') ?? null;
  const tiktokMessage = tiktokStatus ? tiktokMessages[tiktokStatus] : null;

  useEffect(() => {
    if (isTikTokConnected) {
      setOpen(false);
      return;
    }

    if (tiktokMessage) {
      setOpen(true);
      return;
    }

    try {
      const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
      const dismissedRecently = isDismissedRecently(dismissedAt);
      if (dismissedAt && !dismissedRecently) {
        window.localStorage.removeItem(DISMISS_KEY);
      }
      setOpen(!dismissedRecently);
    } catch {
      setOpen(true);
    }
  }, [isTikTokConnected, tiktokMessage]);

  function closeModal() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      if (tiktokStatus) {
        const url = new URL(window.location.href);
        url.searchParams.delete('tiktok');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // localStorage can be unavailable in private or restricted contexts.
    }
    setOpen(false);
  }

  if (isTikTokConnected || !open) return null;

  return (
    <div data-tiktok-connect-modal="true" className="fixed inset-0 z-[240] flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#020611]/80 px-3 py-3 backdrop-blur-[12px] sm:px-6 sm:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_16%,rgba(139,92,246,0.18),transparent_30%),radial-gradient(circle_at_68%_43%,rgba(34,211,238,0.07),transparent_27%)]" />
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="tiktok-connect-title"
        className="relative max-h-[calc(100vh-24px)] w-full max-w-[640px] overflow-x-hidden overflow-y-auto rounded-[18px] border border-white/[0.10] bg-[linear-gradient(180deg,rgba(12,17,33,0.94),rgba(3,7,18,0.985))] p-3.5 text-white shadow-[0_32px_100px_-48px_rgba(124,58,237,0.95),0_0_0_1px_rgba(34,211,238,0.055),inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-4 md:p-5"
      >
        <div className="pointer-events-none absolute -right-20 -top-28 h-52 w-52 rounded-full bg-violet-500/[0.16] blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-10 h-44 w-44 rounded-full bg-cyan-300/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.62),rgba(196,88,255,0.58),transparent)]" />

        <button
          type="button"
          aria-label="Fermer le popup TikTok"
          onClick={closeModal}
          className="absolute right-4 top-4 z-30 grid h-8 w-8 place-items-center rounded-[9px] border border-white/[0.08] bg-white/[0.035] text-slate-500 transition hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/[0.35]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="relative">
          <div className="flex items-center gap-2 pr-10">
            <div className="inline-flex h-7 items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-200/[0.07] px-2.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_24px_-16px_rgba(34,211,238,0.9)]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-[13px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)]">♪</span>
              TikTok Sync
            </div>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 min-[420px]:inline">
              Dashboard réel
            </span>
          </div>

          <div className="mt-3 max-w-[560px] pr-7 sm:pr-10">
            <h2 id="tiktok-connect-title" className="text-[23px] font-black leading-[1.05] tracking-[-0.025em] text-white sm:text-[30px]">
              Débloque ton dashboard réel
            </h2>
            <p className="mt-2 text-[12.5px] leading-[1.45] text-slate-300 sm:text-[13.5px]">
              Connecte TikTok pour importer tes vraies performances. Sinon, commence maintenant avec une analyse manuelle.
            </p>
          </div>

          {tiktokMessage && (
            <div
              className={`mt-3 rounded-[12px] border px-3 py-2.5 ${
                tiktokMessage.tone === 'success'
                  ? 'border-emerald-300/[0.18] bg-emerald-300/[0.07] text-emerald-50'
                  : tiktokMessage.tone === 'error'
                    ? 'border-rose-300/[0.18] bg-rose-400/[0.07] text-rose-50'
                    : 'border-amber-300/[0.18] bg-amber-300/[0.07] text-amber-50'
              }`}
            >
              <p className="text-[12px] font-black leading-tight">{tiktokMessage.title}</p>
              <p className="mt-1 text-[11.5px] font-medium leading-[1.35] text-slate-300">{tiktokMessage.body}</p>
            </div>
          )}

          <div className="relative mt-4">
            <div className="pointer-events-none absolute inset-x-8 -top-4 h-24 rounded-full bg-violet-500/[0.13] blur-3xl" />
            <div className="group relative overflow-hidden rounded-[16px] border border-violet-200/[0.22] bg-[linear-gradient(145deg,rgba(139,92,246,0.16),rgba(20,27,48,0.84)_48%,rgba(5,10,22,0.92))] p-3 shadow-[0_24px_70px_-42px_rgba(139,92,246,0.98),inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/[0.24] sm:p-3.5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(226,96,255,0.95),rgba(34,211,238,0.40),transparent)]" />
              <div className="flex items-start gap-2.5">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-violet-400/[0.16] text-cyan-100 ring-1 ring-violet-200/[0.16] shadow-[0_8px_24px_-16px_rgba(34,211,238,0.9)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-black leading-tight text-white">Connecter TikTok</h3>
                  <p className="mt-1 text-[12px] leading-[1.38] text-slate-300 sm:text-[12.5px]">
                    Importe tes vues, ton engagement, ton watch time et tes top vidéos.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {unlockedMetrics.map((metric) => (
                  <div key={metric} className="flex min-h-[34px] items-center gap-2 rounded-[10px] border border-white/[0.075] bg-white/[0.045] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <svg className="h-3 w-3 shrink-0 text-cyan-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m20 6-11 11-5-5" />
                    </svg>
                    <span className="text-[10.5px] font-extrabold leading-tight text-slate-100 sm:text-[11px]">{metric}</span>
                  </div>
                ))}
              </div>

              <Link
                href={connectUrl}
                className="mt-3 flex h-10 w-full items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#ef6cff_0%,#8b5cf6_50%,#5b21e8_100%)] px-4 text-[13px] font-black text-white shadow-[0_16px_36px_-17px_rgba(139,92,246,0.98),inset_0_1px_0_rgba(255,255,255,0.28)] transition hover:scale-[1.01] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/[0.45]"
              >
                Connecter TikTok
              </Link>
            </div>

            <div className="my-3 flex items-center gap-2 text-center">
              <div className="h-px flex-1 bg-white/[0.07]" />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-500">
                ou commence sans connecter TikTok
              </span>
              <div className="h-px flex-1 bg-white/[0.07]" />
            </div>

            <div className="relative overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.032] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition duration-200 hover:border-cyan-100/[0.16] hover:bg-white/[0.045]">
              <div className="flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-cyan-300/[0.075] text-cyan-100 ring-1 ring-white/[0.07]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m15 10 4.5-2.5v9L15 14" />
                      <rect width="12" height="10" x="3" y="7" rx="2" />
                      <path d="M9 13v-2" />
                      <path d="M8 12h2" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-black leading-tight text-white">Analyser une vidéo</h3>
                    <p className="mt-1 text-[12px] leading-[1.35] text-slate-400">
                      Upload une vidéo et reçois ton diagnostic + ta V2 recommandée.
                    </p>
                  </div>
                </div>
                <Link
                  href={analyzerUrl}
                  className="flex h-10 w-full shrink-0 items-center justify-center rounded-[10px] border border-cyan-100/[0.16] bg-cyan-100/[0.055] px-4 text-[12.5px] font-black text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] transition hover:border-cyan-100/[0.30] hover:bg-cyan-100/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-200/[0.25] min-[460px]:w-auto"
                >
                  Analyser une vidéo
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-center gap-1 border-t border-white/[0.07] pt-2.5 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-[11px] font-medium leading-snug text-slate-500">
              Tu peux connecter TikTok plus tard depuis le dashboard.
            </p>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-[8px] px-3 py-1.5 text-[12px] font-bold text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-white/10"
            >
              Plus tard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
