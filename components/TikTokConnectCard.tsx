'use client';

import { useState } from 'react';

interface TikTokConnectCardProps {
  connected: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export default function TikTokConnectCard({
  connected,
  displayName,
  avatarUrl,
}: TikTokConnectCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!connected || disconnecting) return;
    if (!window.confirm('Déconnecter ton compte TikTok de Viralynz ?')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/tiktok/disconnect', { method: 'POST' });
      if (res.ok) window.location.href = '/dashboard';
      else {
        const d = await res.json().catch(() => ({}));
        alert(typeof d.error === 'string' ? d.error : 'Déconnexion impossible.');
      }
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0a0a12] to-[#12101a] p-5 sm:p-6 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#00f2ea]/8 to-[#ff0050]/6 rounded-full blur-3xl pointer-events-none" aria-hidden />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
            {connected && avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" width={48} height={48} />
            ) : (
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-white/90" fill="currentColor" aria-hidden>
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.21 8.21 0 004.79 1.52V7A4.85 4.85 0 0119.59 6.69z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 mb-1">Compte TikTok</p>
            {connected ? (
              <>
                <p className="text-base font-bold text-white truncate">
                  {displayName?.trim() || 'Compte connecté'}
                </p>
                <p className="text-[11px] text-emerald-400/90 mt-0.5">Lié — prochaines étapes : import & stats (à venir)</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-white">Connecte ton TikTok</p>
                <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
                  Lie ton compte pour préparer stats profil, import vidéos et la suite des features.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto shrink-0 w-full sm:w-auto">
          {connected ? (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="w-full sm:w-auto px-4 py-3 rounded-xl text-[13px] font-semibold text-gray-300 bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] hover:border-white/[0.14] disabled:opacity-50 transition-all"
            >
              {disconnecting ? 'Déconnexion…' : 'Déconnecter'}
            </button>
          ) : (
            <a
              href="/api/tiktok/connect"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#00f2ea]/25 via-white/10 to-[#ff0050]/25 border border-white/15 hover:border-white/25 hover:brightness-110 transition-all text-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor" aria-hidden>
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.21 8.21 0 004.79 1.52V7A4.85 4.85 0 0119.59 6.69z" />
              </svg>
              Connecter avec TikTok
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
