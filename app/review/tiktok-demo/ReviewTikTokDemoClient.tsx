'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n/useLanguage';

type ReviewLang = 'fr' | 'en';

export type ReviewTikTokDemoData = {
  isAuthenticated: boolean;
  sessionEmail: string | null;
  account: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    username: string | null;
    profileLink: string | null;
    bio: string | null;
    verified: boolean | null;
    connectedAt: string | null;
    lastSyncAt: string | null;
    scopes: string[];
  } | null;
  stats: {
    followers: number | null;
    following: number | null;
    totalLikes: number | null;
    videoCount: number | null;
  };
  videos: Array<{
    id: string;
    tiktokVideoId: string;
    title: string | null;
    coverUrl: string | null;
    shareUrl: string | null;
    publishedAt: string | null;
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
  }>;
};

const CONNECT_HREF = '/api/tiktok/connect?review=1&return_to=%2Freview%2Ftiktok-demo';
const FALLBACK = '—';

const requestedScopes = [
  {
    name: 'user.info.basic',
    fr: 'Utilisé pour afficher l’avatar et le nom du compte TikTok connecté.',
    en: 'Used to display the connected TikTok account avatar and display name.',
  },
  {
    name: 'user.info.profile',
    fr: 'Utilisé pour afficher le nom d’utilisateur, le lien du profil, la bio et le statut de vérification.',
    en: 'Used to display username, profile link, bio and verification status.',
  },
  {
    name: 'user.info.stats',
    fr: 'Utilisé pour afficher les abonnés, les abonnements, le nombre total de likes et le nombre de vidéos.',
    en: 'Used to display followers, following, total likes and video count.',
  },
  {
    name: 'video.list',
    fr: 'Utilisé pour afficher les vidéos publiques de l’utilisateur et leurs métriques de performance.',
    en: 'Used to display the user’s own public videos and performance metrics.',
  },
] as const;

const copy = {
  fr: {
    eyebrow: 'TikTok review',
    title: 'Démo d’intégration TikTok',
    subtitle:
      'Cette page démontre le parcours complet de connexion TikTok et l’utilisation des permissions en lecture seule demandées par Viralynz.',
    languageLabel: 'Langue',
    requestedScopesTitle: 'Permissions demandées',
    importantNote:
      'Viralynz ne téléverse, ne publie et ne poste aucun contenu sur TikTok. L’intégration est uniquement en lecture seule.',
    loginNotice: 'Connecte-toi à Viralynz pour lancer le flow OAuth TikTok depuis cette page.',
    connectButton: 'Connecter TikTok',
    connected: 'TikTok connecté',
    disconnected: 'TikTok non connecté',
    disconnectButton: 'Déconnecter TikTok',
    disconnecting: 'Déconnexion...',
    profileTitle: 'Profil connecté',
    displayName: 'Nom affiché',
    username: 'Nom d’utilisateur',
    profileLink: 'Lien du profil',
    bio: 'Bio',
    verified: 'Statut vérifié',
    yes: 'Oui',
    no: 'Non',
    connectedAt: 'Connecté le',
    activeScopes: 'Scopes actifs',
    statsTitle: 'Statistiques du compte',
    followers: 'Abonnés',
    following: 'Abonnements',
    totalLikes: 'Likes totaux',
    videoCount: 'Nombre de vidéos',
    publicVideosTitle: 'Vidéos publiques',
    publicVideosPlaceholder:
      'Les vidéos publiques apparaîtront ici après l’autorisation TikTok et l’approbation API.',
    videoTitleFallback: 'Description indisponible',
    publishedAt: 'Publié le',
    views: 'Vues',
    likes: 'Likes',
    comments: 'Commentaires',
    shares: 'Partages',
    openTikTok: 'Ouvrir TikTok',
    dataUsageTitle: 'Comment Viralynz utilise ces données',
    dataUsageText:
      'Viralynz utilise le profil connecté, les statistiques du compte et les métriques des vidéos publiques pour fournir des analyses privées, des retours sur les hooks et des recommandations de repost dans le dashboard utilisateur.',
    disconnectAnytime: 'L’utilisateur peut déconnecter son compte TikTok à tout moment.',
    checklistTitle: 'Checklist de démonstration',
    checklist: [
      'Se connecter à Viralynz',
      'Cliquer sur Connecter TikTok',
      'Autoriser les permissions TikTok',
      'Revenir sur Viralynz',
      'Voir le profil connecté',
      'Voir les statistiques du compte',
      'Voir les vidéos publiques',
      'Déconnecter TikTok',
    ],
    missingData:
      'Les champs affichés avec “—” ne sont pas inventés : ils ne sont pas encore disponibles dans les données TikTok stockées côté serveur.',
    readOnly: 'Lecture seule',
  },
  en: {
    eyebrow: 'TikTok review',
    title: 'TikTok Integration Review Demo',
    subtitle:
      'This page demonstrates the end-to-end TikTok Login Kit flow and the read-only scopes requested by Viralynz.',
    languageLabel: 'Language',
    requestedScopesTitle: 'Requested scopes',
    importantNote:
      'Viralynz does not upload, publish, or post content to TikTok. The integration is read-only.',
    loginNotice: 'Log in to Viralynz to start the TikTok OAuth flow from this page.',
    connectButton: 'Connect TikTok',
    connected: 'TikTok connected',
    disconnected: 'TikTok not connected',
    disconnectButton: 'Disconnect TikTok',
    disconnecting: 'Disconnecting...',
    profileTitle: 'Connected profile',
    displayName: 'Display name',
    username: 'Username',
    profileLink: 'Profile link',
    bio: 'Bio',
    verified: 'Verified status',
    yes: 'Yes',
    no: 'No',
    connectedAt: 'Connected on',
    activeScopes: 'Active scopes',
    statsTitle: 'Account statistics',
    followers: 'Followers',
    following: 'Following',
    totalLikes: 'Total likes',
    videoCount: 'Video count',
    publicVideosTitle: 'Public videos',
    publicVideosPlaceholder:
      'Public videos will appear here after TikTok authorization and API approval.',
    videoTitleFallback: 'Description unavailable',
    publishedAt: 'Published on',
    views: 'Views',
    likes: 'Likes',
    comments: 'Comments',
    shares: 'Shares',
    openTikTok: 'Open TikTok',
    dataUsageTitle: 'How Viralynz uses this data',
    dataUsageText:
      'Viralynz uses the connected creator’s profile, account statistics and public video metrics to provide private analytics, hook feedback and repost recommendations inside the user’s dashboard.',
    disconnectAnytime: 'The user can disconnect their TikTok account at any time.',
    checklistTitle: 'Demo checklist',
    checklist: [
      'Log in to Viralynz',
      'Click Connect TikTok',
      'Authorize TikTok scopes',
      'Return to Viralynz dashboard',
      'View connected profile',
      'View account statistics',
      'View public videos',
      'Disconnect TikTok',
    ],
    missingData:
      'Fields shown as “—” are not fabricated: they are not yet available in the TikTok data stored server-side.',
    readOnly: 'Read-only',
  },
} as const;

function formatNumber(value: number | null, lang: ReviewLang) {
  if (value === null) return FALLBACK;
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(value);
}

function formatDate(value: string | null, lang: ReviewLang) {
  if (!value) return FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FALLBACK;
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-[13px] font-bold leading-5 text-slate-100">{value || FALLBACK}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-5 ${className}`}>
      <h2 className="text-[18px] font-black tracking-[-0.02em] text-white sm:text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

function LanguageSwitcher({ lang, onChange }: { lang: ReviewLang; onChange: (lang: ReviewLang) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[13px] border border-white/[0.10] bg-black/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl">
      {(['fr', 'en'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`h-9 min-w-11 rounded-[10px] px-3 text-[12px] font-black uppercase tracking-[0.12em] transition ${
            lang === item
              ? 'bg-[linear-gradient(135deg,rgba(34,211,238,0.28),rgba(124,58,237,0.42))] text-white shadow-[0_10px_28px_-18px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.18)]'
              : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
          }`}
          aria-pressed={lang === item}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function TikTokGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-2.1-2.78V9.01a6.28 6.28 0 0 0-.79-.05 6.34 6.34 0 1 0 6.34 6.34V8.88a8.21 8.21 0 0 0 4.79 1.52V7a4.85 4.85 0 0 1-1.02-.31Z" />
    </svg>
  );
}

export default function ReviewTikTokDemoClient({ data }: { data: ReviewTikTokDemoData }) {
  const { language, setLanguage } = useLanguage();
  const lang: ReviewLang = language;
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = copy[lang];
  const account = data.account;

  function updateLanguage(nextLang: ReviewLang) {
    setLanguage(nextLang);
  }

  async function disconnectTikTok() {
    if (!account || disconnecting) return;
    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tiktok/accounts/${account.id}/disconnect`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error('disconnect_failed');
      }

      window.location.reload();
    } catch {
      setError(lang === 'fr' ? 'Déconnexion impossible pour le moment.' : 'Unable to disconnect TikTok right now.');
      setDisconnecting(false);
    }
  }

  const activeScopes = useMemo(() => {
    if (!account?.scopes.length) return FALLBACK;
    return account.scopes.join(', ');
  }, [account]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030511] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_42%_at_50%_-12%,rgba(124,58,237,0.34),transparent_62%),radial-gradient(ellipse_42%_35%_at_88%_18%,rgba(34,211,238,0.16),transparent_60%),linear-gradient(180deg,#050712_0%,#030511_46%,#02030a_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-cyan-200/[0.14] bg-cyan-200/[0.065] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
            <span className="truncate">{t.eyebrow}</span>
          </div>
          <div className="shrink-0">
            <LanguageSwitcher lang={lang} onChange={updateLanguage} />
          </div>
        </div>

        <header className="rounded-[26px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-5 shadow-[0_30px_90px_-58px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/[0.13] bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                <span>{t.readOnly}</span>
              </div>
              <h1 className="mt-5 text-[34px] font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-[48px] lg:text-[58px]">
                {t.title}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-[16px]">{t.subtitle}</p>
            </div>

            <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-4 lg:w-[310px]">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">OAuth callback</p>
              <p className="mt-2 break-all font-mono text-[12px] font-bold text-slate-200">/api/tiktok/callback</p>
              <p className="mt-3 text-[12px] leading-5 text-slate-500">{t.missingData}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <SectionCard title={t.requestedScopesTitle}>
            <div className="mt-4 grid gap-3">
              {requestedScopes.map((scope) => (
                <div key={scope.name} className="rounded-[16px] border border-white/[0.075] bg-black/18 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-mono text-[13px] font-black text-cyan-100">{scope.name}</p>
                    <span className="w-fit rounded-full border border-violet-200/[0.14] bg-violet-300/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-violet-100">
                      read
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-300">{scope[lang]}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[16px] border border-cyan-200/[0.13] bg-cyan-200/[0.065] p-4 text-[13px] font-bold leading-6 text-cyan-50">
              {t.importantNote}
            </div>
          </SectionCard>

          <SectionCard title={account ? t.connected : t.disconnected}>
            <div className="mt-4 flex flex-col gap-4">
              {account ? (
                <>
                  <div className="flex min-w-0 items-center gap-4 rounded-[18px] border border-white/[0.08] bg-black/18 p-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[18px] border border-white/[0.10] bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(124,58,237,0.26))] text-white">
                      {account.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <TikTokGlyph />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[19px] font-black text-white">{account.displayName || FALLBACK}</p>
                      <p className="mt-1 truncate text-[12px] font-bold text-slate-400">{account.username ? `@${account.username}` : FALLBACK}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t.displayName} value={account.displayName || FALLBACK} />
                    <Field label={t.username} value={account.username ? `@${account.username}` : FALLBACK} />
                    <Field label={t.profileLink} value={account.profileLink || FALLBACK} />
                    <Field label={t.bio} value={account.bio || FALLBACK} />
                    <Field label={t.verified} value={account.verified === null ? FALLBACK : account.verified ? t.yes : t.no} />
                    <Field label={t.connectedAt} value={formatDate(account.connectedAt, lang)} />
                  </div>

                  <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{t.activeScopes}</p>
                    <p className="mt-2 break-words font-mono text-[12px] font-bold leading-5 text-slate-200">{activeScopes}</p>
                  </div>

                  {error && <p className="rounded-[12px] border border-rose-300/[0.16] bg-rose-300/[0.07] px-3 py-2 text-[12px] font-bold text-rose-100">{error}</p>}

                  <button
                    type="button"
                    onClick={() => void disconnectTikTok()}
                    disabled={disconnecting}
                    className="inline-flex min-h-11 items-center justify-center rounded-[12px] border border-rose-300/[0.16] bg-rose-300/[0.065] px-4 text-[13px] font-black text-rose-50 transition hover:border-rose-200/25 hover:bg-rose-300/[0.10] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {disconnecting ? t.disconnecting : t.disconnectButton}
                  </button>
                </>
              ) : (
                <>
                  {!data.isAuthenticated && (
                    <p className="rounded-[14px] border border-amber-200/[0.14] bg-amber-200/[0.06] p-4 text-[13px] font-bold leading-6 text-amber-50">
                      {t.loginNotice}
                    </p>
                  )}
                  <a
                    href={CONNECT_HREF}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[13px] bg-[linear-gradient(135deg,#22d3ee_0%,#8b5cf6_55%,#d946ef_100%)] px-5 text-[14px] font-black text-white shadow-[0_22px_58px_-28px_rgba(34,211,238,0.9),0_18px_46px_-28px_rgba(139,92,246,0.9),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110"
                  >
                    <TikTokGlyph />
                    {t.connectButton}
                  </a>
                </>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionCard title={t.statsTitle}>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t.followers} value={formatNumber(data.stats.followers, lang)} />
              <Field label={t.following} value={formatNumber(data.stats.following, lang)} />
              <Field label={t.totalLikes} value={formatNumber(data.stats.totalLikes, lang)} />
              <Field label={t.videoCount} value={formatNumber(data.stats.videoCount, lang)} />
            </div>
          </SectionCard>

          <SectionCard title={t.publicVideosTitle}>
            {account && data.videos.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.videos.map((video) => (
                  <article key={video.id} className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-black/20">
                    <div className="aspect-[16/10] bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(124,58,237,0.22))]">
                      {video.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-10 text-[14px] font-black leading-5 text-white">{video.title || t.videoTitleFallback}</h3>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">
                        {t.publishedAt} {formatDate(video.publishedAt, lang)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Field label={t.views} value={formatNumber(video.views, lang)} />
                        <Field label={t.likes} value={formatNumber(video.likes, lang)} />
                        <Field label={t.comments} value={formatNumber(video.comments, lang)} />
                        <Field label={t.shares} value={formatNumber(video.shares, lang)} />
                      </div>
                      {video.shareUrl && (
                        <a
                          href={video.shareUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-3 text-[12px] font-black text-slate-100 transition hover:border-white/[0.16] hover:bg-white/[0.075]"
                        >
                          {t.openTikTok}
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-dashed border-white/[0.12] bg-black/18 p-5 text-[13px] font-bold leading-6 text-slate-300">
                {t.publicVideosPlaceholder}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <SectionCard title={t.dataUsageTitle}>
            <p className="mt-4 text-[14px] leading-7 text-slate-300">{t.dataUsageText}</p>
            <p className="mt-3 rounded-[15px] border border-white/[0.08] bg-black/18 p-4 text-[13px] font-bold leading-6 text-slate-200">
              {t.disconnectAnytime}
            </p>
          </SectionCard>

          <SectionCard title={t.checklistTitle}>
            <ol className="mt-4 grid gap-2">
              {t.checklist.map((item, index) => (
                <li key={item} className="flex items-center gap-3 rounded-[13px] border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan-200/[0.18] bg-cyan-200/[0.07] text-[10px] font-black text-cyan-100">
                    {index + 1}
                  </span>
                  <span className="text-[13px] font-bold leading-5 text-slate-200">{item}</span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
