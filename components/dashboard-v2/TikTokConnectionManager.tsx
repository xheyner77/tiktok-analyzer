'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DashboardData } from '@/lib/dashboard-data';

interface TikTokConnectionManagerProps {
  open: boolean;
  connection: DashboardData['tiktokConnection'];
  onClose: () => void;
  onDisconnected: () => void;
}

const advancedPermissions = ['Statistiques TikTok', 'Liste des vidéos', 'Engagement', 'Watch time'] as const;

function formatConnectedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatScope(scope: string) {
  if (scope === 'user.info.basic') return 'profil basique';
  if (scope === 'video.list' || scope === 'video.list.basic') return 'liste des vidéos';
  return scope.replaceAll('.', ' ');
}

function TikTokAvatar({ connection }: { connection: DashboardData['tiktokConnection'] }) {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[18px] border border-white/[0.12] bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(124,58,237,0.22))] text-[20px] font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
      {connection.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={connection.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>♪</span>
      )}
    </div>
  );
}

export function TikTokConnectionManager({
  open,
  connection,
  onClose,
  onDisconnected,
}: TikTokConnectionManagerProps) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = connection.displayName?.trim() || 'Compte TikTok connecté';
  const connectedAt = useMemo(() => formatConnectedAt(connection.connectedAt), [connection.connectedAt]);
  const activeScopes = connection.scopes.length > 0 ? connection.scopes.map(formatScope).join(', ') : 'profil basique';

  if (!open || !connection.connected) return null;

  async function disconnectTikTok() {
    if (disconnecting) return;
    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/tiktok/disconnect', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Impossible de déconnecter TikTok pour le moment.');
      }

      setConfirmDisconnect(false);
      onDisconnected();
    } catch {
      setError('Impossible de déconnecter TikTok pour le moment.');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center px-3 py-4 sm:px-6" role="presentation" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-[#020611]/82 backdrop-blur-[16px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_38%_at_52%_18%,rgba(124,58,237,0.22),transparent_64%),radial-gradient(ellipse_34%_28%_at_74%_70%,rgba(34,211,238,0.1),transparent_62%)]" />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiktok-manager-title"
        className="relative max-h-[calc(100vh-32px)] w-full max-w-[720px] overflow-hidden rounded-[22px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(12,18,34,0.97),rgba(4,8,18,0.99))] text-white shadow-[0_34px_110px_-46px_rgba(124,58,237,0.85),0_18px_80px_-54px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.09)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.58),rgba(217,93,242,0.6),transparent)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet-500/[0.16] blur-3xl" />
        <div className="pointer-events-none absolute -left-28 bottom-10 h-52 w-52 rounded-full bg-cyan-300/[0.08] blur-3xl" />

        <div className="relative max-h-[calc(100vh-32px)] overflow-y-auto p-4 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/45"
            aria-label="Fermer la gestion TikTok"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div className="pr-10">
            <div className="inline-flex h-7 items-center gap-2 rounded-full border border-cyan-200/[0.16] bg-cyan-200/[0.07] px-2.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-cyan-100">
              TikTok integration
            </div>
            <h2 id="tiktok-manager-title" className="mt-4 text-[27px] font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-[34px]">
              Connexion TikTok
            </h2>
            <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-slate-300 sm:text-[15px]">
              Ton compte TikTok est relié à Viralynz. Tu peux analyser une vidéo ou gérer cette connexion.
            </p>
          </div>

          <div className="mt-6 rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              <TikTokAvatar connection={connection} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[18px] font-black leading-tight text-white">{displayName}</p>
                  <span className="rounded-[6px] border border-emerald-200/16 bg-emerald-300/[0.08] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
                    Connecté
                  </span>
                  {connection.modeLabel && (
                    <span className="rounded-[6px] border border-amber-200/16 bg-amber-200/[0.075] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                      {connection.modeLabel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] font-medium text-slate-400">Compte TikTok relié</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
                  <span className="rounded-[7px] border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5">Permission active : {activeScopes}</span>
                  {connectedAt && <span className="rounded-[7px] border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5">Relié le {connectedAt}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <section className="rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4">
              <h3 className="text-[13px] font-black text-white">Permissions actives</h3>
              <div className="mt-3 rounded-[12px] border border-emerald-200/[0.12] bg-emerald-300/[0.055] p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-300/12 text-emerald-100">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-white">Profil basique</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-emerald-50/72">Nom, avatar et identifiant TikTok récupérés avec autorisation.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4">
              <h3 className="text-[13px] font-black text-white">Permissions avancées</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                Les métriques avancées nécessitent des permissions TikTok supplémentaires et une validation de l’app.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {advancedPermissions.map((permission) => (
                  <div key={permission} className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.075] bg-white/[0.03] px-3 py-2.5">
                    <span className="text-[12px] font-bold text-slate-300">{permission}</span>
                    <span className="rounded-[6px] border border-slate-300/[0.10] bg-slate-300/[0.045] px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                      À venir
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {error && (
            <div className="mt-4 rounded-[12px] border border-rose-300/[0.16] bg-rose-300/[0.06] px-3.5 py-3 text-[12px] font-bold text-rose-100">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/dashboard/analyze"
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#d95df2_0%,#7c5cff_54%,#5b21e8_100%)] px-5 text-[13px] font-black text-white shadow-[0_18px_44px_-20px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/45"
            >
              Analyser une vidéo
            </Link>
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-rose-300/[0.14] bg-rose-300/[0.055] px-5 text-[13px] font-bold text-rose-100 transition hover:border-rose-200/25 hover:bg-rose-300/[0.085] focus:outline-none focus:ring-2 focus:ring-rose-300/30"
            >
              Déconnecter TikTok
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[13px] font-bold text-slate-200 transition hover:border-white/[0.14] hover:bg-white/[0.075] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/35"
            >
              Fermer
            </button>
          </div>
        </div>

        {confirmDisconnect && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020611]/72 px-4 backdrop-blur-[10px]" role="presentation" onMouseDown={() => setConfirmDisconnect(false)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="tiktok-disconnect-title"
              className="w-full max-w-[440px] rounded-[18px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(14,20,36,0.98),rgba(5,8,18,0.99))] p-5 shadow-[0_28px_90px_-42px_rgba(244,63,94,0.58),inset_0_1px_0_rgba(255,255,255,0.08)]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <h3 id="tiktok-disconnect-title" className="text-[22px] font-black tracking-[-0.03em] text-white">Déconnecter TikTok ?</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-slate-300">
                Tes analyses restent disponibles. Seule la connexion au compte TikTok sera retirée.
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">Tu pourras reconnecter un compte plus tard.</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(false)}
                  className="flex h-10 flex-1 items-center justify-center rounded-[9px] border border-white/[0.09] bg-white/[0.045] px-4 text-[13px] font-bold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void disconnectTikTok()}
                  disabled={disconnecting}
                  className="flex h-10 flex-1 items-center justify-center rounded-[9px] border border-rose-300/[0.18] bg-[linear-gradient(135deg,rgba(244,63,94,0.25),rgba(190,24,93,0.18))] px-4 text-[13px] font-black text-rose-50 shadow-[0_16px_38px_-24px_rgba(244,63,94,0.9)] transition hover:border-rose-200/30 hover:bg-rose-300/[0.12] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {disconnecting ? 'Déconnexion...' : 'Déconnecter'}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
