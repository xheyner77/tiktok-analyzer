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

const syncBenefits = ['Analyses liées à ton profil', 'Dashboard personnalisé', 'Insights plus précis'];

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
  profile_error: {
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
    body: 'Ton compte TikTok est bien relié. Ton dashboard peut utiliser ce profil.',
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

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeModal();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (isTikTokConnected || !open) return null;

  return (
    <div data-tiktok-connect-modal="true" className="fixed inset-0 z-[240] flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#020611]/78 px-4 py-4 backdrop-blur-[14px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_20%,rgba(139,92,246,0.18),transparent_32%),radial-gradient(circle_at_72%_58%,rgba(34,211,238,0.07),transparent_30%)]" />
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="tiktok-connect-title"
        className="relative w-[calc(100vw-32px)] max-w-[460px] overflow-hidden rounded-[22px] border border-violet-200/[0.12] bg-[linear-gradient(180deg,rgba(11,16,31,0.96),rgba(3,7,18,0.99))] p-5 text-white shadow-[0_30px_100px_-56px_rgba(124,58,237,0.95),0_0_0_1px_rgba(34,211,238,0.045),inset_0_1px_0_rgba(255,255,255,0.11)] sm:p-6"
      >
        <div className="pointer-events-none absolute -right-24 -top-28 h-56 w-56 rounded-full bg-violet-500/[0.14] blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-8 h-48 w-48 rounded-full bg-cyan-300/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.62),rgba(196,88,255,0.58),transparent)]" />

        <button
          type="button"
          aria-label="Fermer"
          onClick={closeModal}
          className="absolute right-4 top-4 z-30 grid h-9 w-9 place-items-center rounded-full border border-white/[0.10] bg-white/[0.055] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/[0.35]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="relative">
          <div className="flex items-center gap-2 pr-10">
            <div className="inline-flex h-8 items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-200/[0.07] px-3 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_24px_-16px_rgba(34,211,238,0.9)]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-[13px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)]">♪</span>
              TikTok Sync
            </div>
          </div>

          <div className="mt-4 pr-8">
            <h2 id="tiktok-connect-title" className="text-[25px] font-black leading-[1.02] tracking-[-0.03em] text-white sm:text-[30px]">
              Connecte ton TikTok
            </h2>
            <p className="mt-2.5 text-[13.5px] font-medium leading-5 text-slate-300 sm:text-sm sm:leading-6">
              Associe ton compte pour activer tes analyses et personnaliser ton dashboard Viralynz.
            </p>
          </div>

          {tiktokMessage && (
            <div
              className={`mt-4 rounded-[14px] border px-3 py-2.5 ${
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

          <div className="mt-4 flex flex-wrap gap-2">
            {syncBenefits.map((benefit) => (
              <span key={benefit} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2.5 py-1.5 text-[11px] font-bold leading-none text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                {benefit}
              </span>
            ))}
          </div>

          <Link
            href={connectUrl}
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(217,70,239,0.96)_0%,rgba(139,92,246,0.98)_48%,rgba(34,211,238,0.92)_100%)] px-5 text-sm font-black text-white shadow-[0_20px_54px_-32px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.20)] transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-violet-300/[0.45]"
          >
            <span>Connecter TikTok</span>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M3.5 8h8.2" strokeLinecap="round" />
              <path d="m8.7 4.6 3.4 3.4-3.4 3.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl px-3 py-2 text-[13px] font-bold text-slate-400 transition hover:bg-white/[0.045] hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-white/10"
            >
              Continuer sans connecter
            </button>
            <p className="mt-2 text-[11.5px] font-medium leading-4 text-slate-500">
              Tu pourras le faire plus tard depuis ton dashboard.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
