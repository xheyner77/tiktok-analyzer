'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardData, DashboardInsight, DashboardRecommendation, DashboardTopVideo } from '@/lib/dashboard-data';
import type {
  OverviewActivity,
  OverviewAnalysisCard,
  OverviewFormatPerformance,
  OverviewGoal,
  OverviewHookSuggestion,
  OverviewKpi,
  OverviewOpportunity,
  OverviewTimeSlot,
} from '@/lib/dashboard-overview';
import TikTokConnectModal from '@/components/dashboard-v2/TikTokConnectModal';
import { TikTokConnectionManager } from '@/components/dashboard-v2/TikTokConnectionManager';
import { TikTokConnectedSuccessModal } from '@/components/dashboard-v2/TikTokConnectedSuccessModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/useLanguage';
import { translateKnownPhrase } from '@/lib/i18n/translations';

type IconName =
  | 'home'
  | 'analysis'
  | 'insights'
  | 'pen'
  | 'radar'
  | 'folder'
  | 'box'
  | 'users'
  | 'bell'
  | 'export'
  | 'settings'
  | 'calendar'
  | 'plus'
  | 'eye'
  | 'clock'
  | 'target'
  | 'info'
  | 'chevron'
  | 'heart'
  | 'message'
  | 'share'
  | 'play'
  | 'external'
  | 'crown'
  | 'hook'
  | 'spark'
  | 'bookmark'
  | 'rocket'
  | 'shield';

const shellCard =
  'relative overflow-hidden rounded-[11px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(8,16,31,0.96),rgba(4,8,17,0.985))] shadow-[inset_0_1px_0_rgba(255,255,255,0.052),0_28px_86px_-54px_rgba(0,0,0,0.96),0_0_0_1px_rgba(124,58,237,0.018)]';

const softPanel =
  'rounded-[9px] border border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

const primaryButton =
  'rounded-[8px] bg-[linear-gradient(135deg,#d95df2_0%,#7c5cff_54%,#5b21e8_100%)] font-bold text-white shadow-[0_14px_34px_-16px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/45';

const insightStyleByType: Record<DashboardInsight['type'], { color: string; icon: IconName }> = {
  hook: { color: '#10b981', icon: 'spark' },
  retention: { color: '#f59e0b', icon: 'analysis' },
  rewatch: { color: '#a855f7', icon: 'bookmark' },
  engagement: { color: '#14b8a6', icon: 'message' },
};

const connectedTikTokMessages: Record<string, string> = {
  config: 'Connexion TikTok a configurer : ajoute les cles TikTok serveur, puis redemarre le serveur.',
  limit: 'Ton plan bloque un compte TikTok different. Pour reconnecter ce compte, relance avec le meme compte TikTok.',
  setup: 'Connexion TikTok indisponible cote serveur. Reessaie dans quelques minutes.',
  session: 'Ta session Viralynz a expire. Reconnecte-toi, puis relance TikTok.',
  state: 'Session TikTok expiree. Clique a nouveau sur Reconnecter TikTok.',
  denied: 'Autorisation TikTok annulee avant la fin.',
  token: 'TikTok n’a pas valide le code OAuth. Verifie la callback URL configuree cote TikTok.',
  profile: 'TikTok a autorise le compte, mais le profil reste inaccessible.',
  profile_error: 'TikTok a autorise le compte, mais le profil reste inaccessible.',
  db: 'La connexion TikTok n’a pas pu etre enregistree en base.',
};

type NavItem = { label: string; href: string; icon: IconName; badge?: string; freeOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: 'Vue d’ensemble', href: '/dashboard', icon: 'home' },
  { label: 'Analyser', href: '/dashboard/analyze', icon: 'analysis' },
  { label: 'Mémoire IA', href: '/dashboard/insights', icon: 'insights' },
  { label: 'Générateur de hooks', href: '/dashboard/hooks', icon: 'pen' },
  { label: 'Rewrite / V2', href: '/dashboard/rewrite', icon: 'spark' },
  { label: 'Publication', href: '/dashboard/share', icon: 'share' },
  { label: 'Radar tendances', href: '/dashboard/radar', icon: 'radar' },
  { label: 'Bibliothèque contenu', href: '/dashboard/library', icon: 'folder' },
  { label: 'Paramètres', href: '/dashboard/settings', icon: 'settings' },
  { label: 'Pricing', href: '/dashboard/billing', icon: 'crown', freeOnly: true },
];

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  const stroke = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'home') return <svg {...stroke}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === 'analysis') return <svg {...stroke}><path d="M4 19V5" /><path d="M8 17V9" /><path d="M12 17V4" /><path d="M16 17v-6" /><path d="M20 17V7" /></svg>;
  if (name === 'insights') return <svg {...stroke}><path d="M8 4.8a3.2 3.2 0 0 0-4.2 4.6A4.1 4.1 0 0 0 5 17.4" /><path d="M16 4.8a3.2 3.2 0 0 1 4.2 4.6A4.1 4.1 0 0 1 19 17.4" /><path d="M9 4v16" /><path d="M15 4v16" /><path d="M9 11h6" /></svg>;
  if (name === 'pen') return <svg {...stroke}><path d="m15.5 5.5 3 3" /><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /></svg>;
  if (name === 'radar') return <svg {...stroke}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 12 18 6" /><path d="M12 4v2" /><path d="M20 12h-2" /><path d="M4 12h2" /></svg>;
  if (name === 'folder') return <svg {...stroke}><path d="M3 7.6A2.6 2.6 0 0 1 5.6 5H9l2 2h7.4A2.6 2.6 0 0 1 21 9.6v6.8a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 16.4Z" /></svg>;
  if (name === 'box') return <svg {...stroke}><path d="M21 8.5 12 3 3 8.5l9 5.5 9-5.5Z" /><path d="M3 8.5v7L12 21l9-5.5v-7" /><path d="M12 14v7" /></svg>;
  if (name === 'users') return <svg {...stroke}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === 'bell') return <svg {...stroke}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></svg>;
  if (name === 'export') return <svg {...stroke}><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7h14v-7" /></svg>;
  if (name === 'settings') return <svg {...stroke}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
  if (name === 'calendar') return <svg {...stroke}><path d="M8 3v4" /><path d="M16 3v4" /><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18" /></svg>;
  if (name === 'plus') return <svg {...stroke}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
  if (name === 'eye') return <svg {...stroke}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (name === 'clock') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'target') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>;
  if (name === 'info') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>;
  if (name === 'chevron') return <svg {...stroke}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'heart') return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08A6.02 6.02 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" /></svg>;
  if (name === 'message') return <svg {...stroke}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /></svg>;
  if (name === 'share') return <svg {...stroke}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v14" /></svg>;
  if (name === 'play') return <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8 5.2v13.6c0 .82.92 1.3 1.58.82l9.47-6.8a1 1 0 0 0 0-1.64L9.58 4.38C8.92 3.9 8 4.38 8 5.2Z" /></svg>;
  if (name === 'external') return <svg {...stroke}><path d="M14 3h7v7" /><path d="m10 14 11-11" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>;
  if (name === 'crown') return <svg {...stroke}><path d="m3 8 4 4 5-8 5 8 4-4v10H3V8Z" /><path d="M3 18h18" /></svg>;
  if (name === 'hook') return <svg {...stroke}><path d="M18 8a6 6 0 1 0-12 0v8a4 4 0 0 0 8 0v-1" /><path d="M14 15h4" /></svg>;
  if (name === 'spark') return <svg {...stroke}><path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" /></svg>;
  if (name === 'bookmark') return <svg {...stroke}><path d="M6 3h12v18l-6-4-6 4V3Z" /></svg>;
  if (name === 'rocket') return <svg {...stroke}><path d="M4.5 16.5c-1 1-1.5 3-1.5 4.5 1.5 0 3.5-.5 4.5-1.5" /><path d="M9 15 7 13c.8-4.4 4.6-8.1 10.5-10.5 1.2 4.2.4 9.3-3.5 13.5l-2-2" /><path d="M9 15h3l3-3V9" /><path d="M13.5 6.5h.01" /></svg>;
  if (name === 'shield') return <svg {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  return null;
}

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`${small ? 'h-8 w-8 rounded-[9px]' : 'h-10 w-10 rounded-[11px]'} relative shrink-0 overflow-hidden border border-[#9b5cff]/25 bg-[#050816] shadow-[0_0_24px_rgba(124,58,237,0.28),inset_0_1px_0_rgba(255,255,255,0.1)]`}>
      <Image
        src="/viralynz-logo-1024.png"
        alt=""
        fill
        sizes={small ? '32px' : '40px'}
        className="object-cover"
        priority
      />
    </div>
  );
}

function DashboardNav({ user, onSelect }: { user: DashboardData['user']; onSelect?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.freeOnly || user.plan === 'free');

  return (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const active = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className={`group relative flex h-[42px] w-full items-center justify-center gap-3 rounded-[10px] text-left text-[13px] font-semibold transition xl:justify-start xl:px-3 ${
            active
              ? 'border border-[#8b5cf6]/38 bg-[linear-gradient(135deg,rgba(124,58,237,0.94),rgba(59,130,246,0.26))] text-white shadow-[0_0_34px_-12px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.13)]'
              : 'border border-transparent text-slate-300/90 hover:border-white/[0.07] hover:bg-white/[0.045] hover:text-white'
          }`}
          onClick={onSelect}
        >
          <Icon name={item.icon} className={`h-[18px] w-[18px] ${active ? 'text-white' : item.freeOnly ? 'text-violet-200/90 group-hover:text-violet-100' : 'text-slate-300/86 group-hover:text-violet-200'}`} />
          <span className="hidden min-w-0 flex-1 truncate xl:block">{item.label}</span>
          {item.badge && <span className="hidden rounded-[5px] bg-[#4c1d95] px-2 py-0.5 text-[10px] font-bold text-violet-100 xl:inline-flex">{item.badge}</span>}
          <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-[8px] border border-white/[0.09] bg-[#071120]/95 px-2.5 py-1.5 text-[11px] font-bold text-slate-100 opacity-0 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl transition group-hover:opacity-100 lg:block xl:hidden">
            {item.label}
          </span>
        </Link>
        );
      })}
    </nav>
  );
}

function PlanUsageCard({ user }: { user: DashboardData['user'] }) {
  return (
    <div className="rounded-[9px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(8,17,34,0.94),rgba(6,10,22,0.98))] p-4">
      <div className="text-[15px] font-semibold text-white">Plan {user.planLabel}</div>
      <div className="mt-3 text-[13px] text-slate-300">
        {user.quotaUsed} / {user.quotaLimit ?? '∞'} analyses utilisées
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-white/[0.09]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#e879f9,#7c3aed)] shadow-[0_0_18px_rgba(168,85,247,0.7)]"
          style={{ width: user.quotaLimit ? `${Math.min(100, Math.round((user.quotaUsed / Math.max(user.quotaLimit, 1)) * 100))}%` : '100%' }}
        />
      </div>
      <Link href="/dashboard/billing" className="mt-5 flex h-[39px] w-full items-center justify-center gap-2 rounded-[8px] border border-violet-400/25 bg-[linear-gradient(135deg,rgba(91,33,182,0.58),rgba(46,16,101,0.7))] text-[12px] font-semibold text-fuchsia-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-violet-300/45 hover:bg-violet-900/55 focus:outline-none focus:ring-2 focus:ring-violet-300/35">
        <Icon name="crown" className="h-4 w-4" />
        Gérer mon plan
      </Link>
    </div>
  );
}

function getAccountInitials(name: string, email: string) {
  const source = name.trim() || email.split('@')[0] || 'VN';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function ProfileCard({
  user,
  tiktokConnection,
  showPlanAction = false,
}: {
  user: DashboardData['user'];
  tiktokConnection: DashboardData['tiktokConnection'];
  showPlanAction?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const quotaLabel = user.quotaLimit ? `${user.quotaUsed}/${user.quotaLimit} analyses` : `${user.quotaUsed} analyses`;
  const hasTikTok = tiktokConnection.connected;
  const avatarUrl = hasTikTok ? tiktokConnection.avatarUrl : null;
  const initials = getAccountInitials(user.name, user.email);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="group relative">
      {menuOpen && (
        <div className="absolute bottom-[calc(100%+10px)] right-0 z-50 w-[218px] overflow-hidden rounded-[14px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(8,15,30,0.98),rgba(3,7,16,0.995))] p-1.5 shadow-[0_26px_86px_-42px_rgba(0,0,0,0.98),0_0_0_1px_rgba(139,92,246,0.08),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[12px] font-bold text-rose-100 transition hover:bg-rose-500/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="external" className="h-4 w-4 rotate-180 text-rose-200/80" />
            <span>{loggingOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
          </button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-[14px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(13,24,45,0.94),rgba(6,11,24,0.98)_58%,rgba(15,11,33,0.98))] p-3.5 shadow-[0_24px_70px_-48px_rgba(79,70,229,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-violet-300/20 group-hover:shadow-[0_28px_82px_-48px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.1)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(232,121,249,0.15),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.11),transparent_35%)]" />
        <div className="relative flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <div className="absolute -inset-1 rounded-full bg-[conic-gradient(from_160deg,rgba(34,211,238,0.38),rgba(168,85,247,0.48),rgba(244,114,182,0.28),rgba(34,211,238,0.38))] opacity-70 blur-[2px] transition group-hover:opacity-95" />
            <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-white/[0.16] bg-[radial-gradient(circle_at_35%_22%,rgba(240,171,252,0.92),rgba(124,58,237,0.55)_42%,rgba(8,15,30,0.96)_100%)] text-[14px] font-black tracking-[-0.03em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#070d19] ${hasTikTok ? 'bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.7)]' : 'bg-slate-500'}`} />
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[14px] font-black leading-tight tracking-[-0.015em] text-white">{user.name}</p>
              <button
                type="button"
                aria-label="Ouvrir le menu du compte"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border border-white/[0.08] bg-white/[0.045] text-slate-300 transition hover:border-violet-200/24 hover:bg-white/[0.075] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/25"
              >
                <Icon name="chevron" className={`h-3.5 w-3.5 rotate-90 transition ${menuOpen ? 'rotate-[270deg]' : ''}`} />
              </button>
            </div>
            <p className="mt-1 max-w-[136px] truncate text-[11px] font-medium text-slate-400">{user.email}</p>
          </div>
        </div>

        <div className="relative mt-3 border-t border-white/[0.065] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-[7px] border border-violet-300/20 bg-violet-400/[0.12] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-violet-100">
              {user.planLabel} actif
            </span>
            <span className={`rounded-[7px] border px-2 py-1 text-[10px] font-black ${hasTikTok ? 'border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-100' : 'border-white/[0.09] bg-white/[0.045] text-slate-300'}`}>
              {hasTikTok ? 'TikTok synchronisé' : 'Compte actif'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="truncate text-[11px] font-semibold text-slate-500">{quotaLabel}</span>
            <span className="h-[5px] min-w-[54px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="block h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#f0abfc)] shadow-[0_0_14px_rgba(139,92,246,0.62)]"
                style={{ width: user.quotaLimit ? `${Math.min(100, Math.round((user.quotaUsed / Math.max(user.quotaLimit, 1)) * 100))}%` : '100%' }}
              />
            </span>
          </div>
          {showPlanAction ? (
            <Link
              href="/dashboard/billing"
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[9px] border border-violet-300/20 bg-violet-400/10 text-[12px] font-black text-violet-100 transition hover:border-violet-200/35 hover:bg-violet-400/15 focus:outline-none focus:ring-2 focus:ring-violet-300/30"
            >
              <Icon name="crown" className="h-4 w-4" />
              Gérer mon plan
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SidebarSupportButton({ onSelect }: { onSelect?: () => void }) {
  return (
    <Link
      href="/dashboard/support"
      onClick={onSelect}
      className="group flex h-[40px] w-full items-center gap-2.5 rounded-[9px] border border-white/[0.075] bg-white/[0.026] px-3 text-[12px] font-bold text-slate-300 transition hover:border-cyan-200/18 hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/20"
    >
      <Icon name="message" className="h-4 w-4 text-cyan-100/58 transition group-hover:text-cyan-100/86" />
      <span className="min-w-0 flex-1 truncate">Support</span>
      <Icon name="chevron" className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-slate-300" />
    </Link>
  );
}

function SidebarSettingsButton({ onSelect }: { onSelect?: () => void }) {
  return (
    <Link
      href="/dashboard/settings"
      onClick={onSelect}
      className="group flex h-[40px] w-full items-center gap-2.5 rounded-[9px] border border-white/[0.075] bg-white/[0.026] px-3 text-[12px] font-bold text-slate-300 transition hover:border-violet-200/20 hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-200/20"
    >
      <Icon name="settings" className="h-4 w-4 text-violet-100/60 transition group-hover:text-violet-100/90" />
      <span className="min-w-0 flex-1 truncate">Paramètres</span>
      <Icon name="chevron" className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-slate-300" />
    </Link>
  );
}

function Sidebar({
  user,
  tiktokConnection,
}: {
  user: DashboardData['user'];
  tiktokConnection: DashboardData['tiktokConnection'];
}) {
  return (
    <aside data-dashboard-sidebar="desktop" className="fixed inset-y-0 left-0 z-20 hidden w-[84px] flex-col border-r border-white/[0.065] bg-[linear-gradient(180deg,rgba(3,8,20,0.985),rgba(2,5,12,0.998))] shadow-[28px_0_90px_-46px_rgba(109,40,217,0.68)] transition-[width] duration-200 lg:flex xl:w-[260px]">
      <div className="flex h-[68px] items-center justify-center gap-3 px-3 xl:justify-start xl:px-5">
        <LogoMark small />
        <div className="hidden min-w-0 text-[22px] font-black tracking-[-0.04em] text-white xl:block">Viralynz</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1 xl:px-5">
        <DashboardNav user={user} />
      </div>

      <div className="space-y-3 px-3 pb-4 pt-2 xl:px-5">
        <div className="hidden space-y-3 xl:block">
          <PlanUsageCard user={user} />
          <ProfileCard user={user} tiktokConnection={tiktokConnection} />
        </div>
        <div className="hidden xl:block">
          <SidebarSupportButton />
        </div>
        <div className="grid gap-2 xl:hidden">
          <Link
            href="/dashboard/billing"
            title="Gérer mon plan"
            className="grid h-[42px] w-full place-items-center rounded-[12px] border border-violet-300/22 bg-[linear-gradient(135deg,rgba(124,58,237,0.24),rgba(34,211,238,0.08))] text-violet-100 shadow-[0_0_26px_-16px_rgba(168,85,247,0.9),inset_0_1px_0_rgba(255,255,255,0.09)] transition hover:border-violet-200/35 hover:bg-violet-400/16 focus:outline-none focus:ring-2 focus:ring-violet-300/25"
            aria-label="Gérer mon plan"
          >
            <Icon name="crown" className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/dashboard/support"
            title="Support"
            className="grid h-[42px] w-full place-items-center rounded-[12px] border border-white/[0.075] bg-white/[0.035] text-cyan-100/70 transition hover:border-cyan-200/22 hover:bg-white/[0.06] hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/20"
            aria-label="Support"
          >
            <Icon name="message" className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function TikTokConnectedBadge({
  connection,
  compact = false,
  onManage,
}: {
  connection: DashboardData['tiktokConnection'];
  compact?: boolean;
  onManage?: () => void;
}) {
  const displayName = connection.displayName?.trim() || 'Compte TikTok';

  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-[9px] border border-emerald-300/18 bg-emerald-300/[0.075] ${compact ? 'px-3 py-2' : 'h-[44px] px-3.5'} text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.075)]`}>
      <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-emerald-200/20 bg-emerald-300/10 text-[15px] font-black text-white">
        {connection.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={connection.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>♪</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-black leading-tight text-white">TikTok connecté</span>
        </div>
        <div className="truncate text-[11px] font-medium leading-tight text-emerald-100/72">{displayName}</div>
      </div>
      {!compact && onManage && (
        <button
          type="button"
          onClick={onManage}
          className="ml-1 shrink-0 rounded-[7px] border border-white/[0.08] bg-white/[0.045] px-2.5 py-1.5 text-[11px] font-bold text-emerald-50 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-emerald-200/30"
        >
          Gérer
        </button>
      )}
    </div>
  );
}

const pageHeaderCopy: Array<{ match: (pathname: string | null) => boolean; title: (user: DashboardData['user']) => string; subtitle: string }> = [
  {
    match: (pathname) => pathname === '/dashboard',
    title: (user) => `Bienvenue, ${user.name} 👋`,
    subtitle: 'Ton cockpit de croissance TikTok est prêt.',
  },
  {
    match: (pathname) => pathname === '/dashboard/analyze',
    title: () => 'Analyser une vidéo',
    subtitle: 'Importe une vidéo et lance un diagnostic.',
  },
  {
    match: (pathname) => pathname === '/dashboard/insights',
    title: () => 'Mémoire IA',
    subtitle: 'Viralynz apprend ton style à chaque analyse.',
  },
  {
    match: (pathname) => pathname === '/dashboard/settings',
    title: () => 'Paramètres',
    subtitle: 'Gère ton compte et tes préférences.',
  },
  {
    match: (pathname) => pathname === '/dashboard/billing',
    title: () => 'Abonnement',
    subtitle: 'Gère ton plan et tes quotas.',
  },
  {
    match: (pathname) => pathname === '/dashboard/support',
    title: () => 'Support',
    subtitle: 'Contacte l’équipe Viralynz.',
  },
  {
    match: (pathname) => pathname === '/dashboard/updates',
    title: () => 'Nouveautés',
    subtitle: 'Suis les dernières évolutions produit.',
  },
  {
    match: (pathname) => pathname === '/dashboard/hooks',
    title: () => 'Générateur de hooks',
    subtitle: 'Prépare des angles plus tendus pour ta prochaine V2.',
  },
  {
    match: (pathname) => pathname === '/dashboard/rewrite',
    title: () => 'Rewrite / V2',
    subtitle: 'Transforme un diagnostic en version à republier.',
  },
  {
    match: (pathname) => pathname === '/dashboard/radar',
    title: () => 'Radar tendances',
    subtitle: 'Repère les angles utiles sans inventer de métriques.',
  },
];

function getPageHeaderCopy(pathname: string | null, user: DashboardData['user']) {
  const pageCopy = pageHeaderCopy.find((entry) => entry.match(pathname));
  if (pageCopy) return { title: pageCopy.title(user), subtitle: pageCopy.subtitle };

  const navItem = NAV_ITEMS.find((item) => item.href !== '/dashboard' && (pathname === item.href || pathname?.startsWith(`${item.href}/`)));
  if (navItem) {
    return {
      title: navItem.label,
      subtitle: 'Contrôle les éléments utiles à ton workflow Viralynz.',
    };
  }

  return {
    title: `Bienvenue, ${user.name} 👋`,
    subtitle: 'Ton cockpit de croissance TikTok est prêt.',
  };
}

function DashboardTopBar({
  user,
  states,
  tiktokConnection,
  onManageTikTok,
  pathname,
}: {
  user: DashboardData['user'];
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
  onManageTikTok: () => void;
  pathname: string | null;
}) {
  const copy = getPageHeaderCopy(pathname, user);
  const tiktokLabel = states.hasTikTokConnection
    ? states.hasTikTokStats
      ? 'TikTok synchronisé'
      : 'TikTok connecté · données limitées'
    : 'TikTok non connecté';

  return (
    <header className="flex min-h-[68px] items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[20px] font-black leading-[1.05] tracking-[-0.035em] text-white min-[1440px]:text-[22px]">{copy.title}</h1>
        <p className="mt-1 truncate text-[12.5px] font-medium text-slate-400 min-[1440px]:text-[13.5px]">{copy.subtitle}</p>
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <LanguageSwitcher />
        <button className="flex h-[38px] items-center gap-2 rounded-[9px] border border-white/[0.09] bg-[#071120]/82 px-3 text-[12px] font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] min-[1440px]:h-[40px]" type="button">
          <Icon name="calendar" className="h-4 w-4 text-slate-300" />
          <span className="hidden min-[1400px]:inline">Période actuelle</span>
          <span className="min-[1400px]:hidden">Période</span>
          <Icon name="chevron" className="h-3.5 w-3.5 rotate-90 text-slate-500" />
        </button>
        <button className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[9px] border border-white/[0.09] bg-[#071120]/82 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] min-[1440px]:h-[40px] min-[1440px]:w-[40px]" type="button" aria-label="Notifications">
          <Icon name="bell" className="h-[17px] w-[17px]" />
          <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.9)]" />
        </button>
        {states.hasTikTokConnection ? (
          <button
            type="button"
            onClick={onManageTikTok}
            className="hidden h-[38px] max-w-[230px] items-center gap-2 rounded-[9px] border border-emerald-300/18 bg-emerald-300/[0.075] px-3 text-[11.5px] font-black text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.075)] transition hover:bg-emerald-300/[0.11] min-[1180px]:flex min-[1440px]:h-[40px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.72)]" />
            <span className="truncate">{tiktokLabel}</span>
          </button>
        ) : (
          <Link href="/api/tiktok/connect" className="hidden h-[38px] items-center gap-2 rounded-[9px] border border-cyan-300/18 bg-cyan-300/10 px-3 text-[12px] font-bold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/14 min-[1180px]:flex min-[1440px]:h-[40px]">
            <span className="text-[16px] leading-none">♪</span>
            Connecter TikTok
          </Link>
        )}
        <Link href="/dashboard/analyze" className={`flex h-[38px] items-center gap-2 px-3 text-[12px] min-[1440px]:h-[40px] min-[1440px]:px-4 min-[1440px]:text-[13px] ${primaryButton}`}>
          <Icon name="plus" className="h-4 w-4" />
          <span className="hidden min-[1440px]:inline">Analyser une vidéo</span>
          <span className="min-[1440px]:hidden">Analyser</span>
        </Link>
      </div>
    </header>
  );
}

function MobileDashboardHeader({
  user,
  onMenuOpen,
}: {
  user: DashboardData['user'];
  onMenuOpen: () => void;
}) {
  return (
    <header data-mobile-dashboard-header="true" className="sticky top-0 z-40 border-b border-white/[0.065] bg-[#020611]/88 px-3 py-2.5 shadow-[0_18px_44px_-34px_rgba(124,58,237,0.85)] backdrop-blur-xl min-[1024px]:hidden">
      <div className="mx-auto flex w-full max-w-[780px] items-center gap-3">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={onMenuOpen}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] border border-white/[0.09] bg-white/[0.045] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <LogoMark small />
          <div className="min-w-0">
            <div className="truncate text-[18px] font-black tracking-[-0.035em] text-white">Viralynz</div>
          </div>
        </div>
        <LanguageSwitcher compact />
        <Link href="/dashboard/analyze" aria-label="Nouvelle analyse" className={`grid h-11 w-11 shrink-0 place-items-center !rounded-[13px] ${primaryButton}`}>
          <Icon name="plus" className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

function MobileDrawer({
  open,
  onClose,
  user,
  states,
  tiktokConnection,
}: {
  open: boolean;
  onClose: () => void;
  user: DashboardData['user'];
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
}) {
  return (
    <div data-mobile-dashboard-drawer="true" className={`fixed inset-0 z-[190] min-[1024px]:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className={`absolute inset-0 bg-black/62 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside className={`absolute inset-y-0 left-0 flex w-[min(336px,calc(100vw-28px))] flex-col overflow-y-auto border-r border-white/[0.075] bg-[linear-gradient(180deg,rgba(3,8,20,0.99),rgba(2,5,12,0.998))] p-5 shadow-[30px_0_90px_-48px_rgba(124,58,237,0.8)] transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3">
          <LogoMark small />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[22px] font-black tracking-[-0.04em] text-white">Viralynz</div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-200/75">Dashboard</div>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.04] text-slate-300"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6">
          <DashboardNav user={user} onSelect={onClose} />
        </div>

        <div className="mt-6 grid gap-3">
          {!states.hasTikTokConnection && (
            <Link href="/api/tiktok/connect" onClick={onClose} className="flex h-[44px] items-center justify-center gap-2 rounded-[9px] border border-cyan-300/18 bg-cyan-300/10 px-4 text-[13px] font-bold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/14">
              <span className="text-[16px] leading-none">♪</span>
              Connecter TikTok
            </Link>
          )}
          {states.hasTikTokConnection && <TikTokConnectedBadge connection={tiktokConnection} compact />}
        </div>

        <div className="mt-6 space-y-4">
          <ProfileCard user={user} tiktokConnection={tiktokConnection} showPlanAction />
          <SidebarSupportButton onSelect={onClose} />
          <SidebarSettingsButton onSelect={onClose} />
        </div>
      </aside>
    </div>
  );
}

function ResponsiveIntro({ user, states, tiktokConnection }: { user: DashboardData['user']; states: DashboardData['states']; tiktokConnection: DashboardData['tiktokConnection'] }) {
  return (
    <section className="min-[1280px]:hidden">
      <div>
        <h1 className="text-[28px] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[34px]">Bienvenue, {user.name} 👋</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-400 sm:text-[15px]">Ton cockpit de croissance TikTok est prêt.</p>
      </div>
      {states.hasTikTokConnection && (
        <div className="mt-4">
          <TikTokConnectedBadge connection={tiktokConnection} compact />
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">Les performances réelles seront disponibles après activation des permissions TikTok dédiées.</p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!states.hasTikTokConnection && (
          <Link href="/api/tiktok/connect" className="flex h-[46px] items-center justify-center gap-2 rounded-[9px] border border-cyan-300/18 bg-cyan-300/10 px-4 text-[13px] font-bold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/14">
            <span className="text-[16px] leading-none">♪</span>
            Connecter TikTok
          </Link>
        )}
        <Link href="/dashboard/analyze" className={`flex h-[46px] items-center justify-center gap-2 px-5 text-[14px] ${primaryButton} ${!states.hasTikTokConnection ? '' : 'sm:col-span-2'}`}>
          <Icon name="plus" className="h-4 w-4" />
          Analyser une vidéo
        </Link>
      </div>
    </section>
  );
}

type KpiItem = {
  label: string;
  value: string;
  note: string;
  icon: IconName;
  tone: 'violet' | 'cyan' | 'emerald' | 'slate';
  progress?: number | null;
};

function formatQuotaValue(user: DashboardData['user']) {
  return `${user.quotaUsed} / ${user.quotaLimit ?? '∞'}`;
}

function quotaProgress(user: DashboardData['user']) {
  if (!user.quotaLimit) return 100;
  return Math.min(100, Math.round((user.quotaUsed / Math.max(user.quotaLimit, 1)) * 100));
}

function getTikTokStatusLabel(states: DashboardData['states']) {
  if (!states.hasTikTokConnection) return 'À connecter';
  if (states.hasTikTokStats) return 'Synchronisé';
  if (states.hasTikTokVideoPermissions) return 'Connecté · sync à confirmer';
  return 'Connecté · données limitées';
}

function buildKpis(dashboard: DashboardData, states: DashboardData['states']): KpiItem[] {
  const { user, metrics } = dashboard;
  const scoreValue = metrics.averageViralScore === null ? 'À lancer' : `${metrics.averageViralScore} / 100`;
  const opportunityValue = states.hasAnalyses
    ? metrics.opportunityCount > 0
      ? `${metrics.opportunityCount} à surveiller`
      : '1 angle à cadrer'
    : 'À débloquer';
  const tiktokNote = states.hasTikTokConnection
    ? states.hasTikTokStats
      ? 'Stats TikTok synchronisées'
      : 'Compte relié, permissions stats à compléter'
    : 'Relie ton profil quand tu veux synchroniser TikTok';

  if (states.hasTikTokStats) {
    return [
      {
        label: 'Vues TikTok',
        value: metrics.totalViews,
        note: 'Source : vidéos synchronisées depuis TikTok',
        icon: 'eye',
        tone: 'emerald',
        progress: 100,
      },
      {
        label: 'Engagement TikTok',
        value: metrics.engagementRate,
        note: 'Likes, commentaires et partages réels',
        icon: 'message',
        tone: 'cyan',
        progress: metrics.engagementRate === '—' ? 0 : 100,
      },
      {
        label: 'Score viral moyen',
        value: scoreValue,
        note: states.hasAnalyses ? 'Source : analyses Viralynz' : 'Lance une analyse pour créer ce score',
        icon: 'target',
        tone: 'violet',
        progress: metrics.averageViralScore,
      },
      {
        label: 'Analyses utilisées ce mois',
        value: formatQuotaValue(user),
        note: `Plan ${user.planLabel}`,
        icon: 'analysis',
        tone: 'slate',
        progress: quotaProgress(user),
      },
    ];
  }

  return [
    {
      label: 'Analyses utilisées ce mois',
      value: formatQuotaValue(user),
      note: `Plan ${user.planLabel}`,
      icon: 'analysis',
      tone: 'violet',
      progress: quotaProgress(user),
    },
    {
      label: 'Score viral moyen',
      value: scoreValue,
      note: states.hasAnalyses ? 'Source : analyses Viralynz' : 'Lance une analyse pour créer ce score',
      icon: 'target',
      tone: 'cyan',
      progress: metrics.averageViralScore,
    },
    {
      label: 'Opportunités de repost',
      value: opportunityValue,
      note: states.hasAnalyses ? metrics.opportunityText : 'Aucune opportunité inventée',
      icon: 'spark',
      tone: 'emerald',
      progress: states.hasAnalyses ? Math.min(100, 42 + metrics.opportunityCount * 18) : 0,
    },
    {
      label: 'Statut TikTok',
      value: getTikTokStatusLabel(states),
      note: tiktokNote,
      icon: 'shield',
      tone: 'slate',
      progress: states.hasTikTokConnection ? (states.hasTikTokStats ? 100 : 58) : 18,
    },
  ];
}

function Sparkline({ color = '#a855f7' }: { color?: string }) {
  return (
    <svg className="absolute bottom-3 right-4 h-[50px] w-[165px] opacity-90" viewBox="0 0 128 42" fill="none" aria-hidden="true">
      <path d="M0 33 C10 34 15 31 22 33 C29 35 35 29 42 30 C50 32 56 27 64 29 C72 32 77 25 83 20 C89 15 96 22 101 18 C107 14 111 13 116 8 C120 5 124 10 128 6" stroke={color} strokeWidth="1.2" />
      <path d="M0 41 L0 33 C10 34 15 31 22 33 C29 35 35 29 42 30 C50 32 56 27 64 29 C72 32 77 25 83 20 C89 15 96 22 101 18 C107 14 111 13 116 8 C120 5 124 10 128 6 L128 41 Z" fill="url(#sparkFill)" />
      <defs>
        <linearGradient id="sparkFill" x1="64" y1="6" x2="64" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} stopOpacity=".42" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const kpiToneClass: Record<KpiItem['tone'], { icon: string; progress: string; glow: string }> = {
  violet: {
    icon: 'border-violet-200/16 bg-violet-400/12 text-violet-100',
    progress: 'from-fuchsia-300 via-violet-400 to-violet-600',
    glow: 'rgba(168,85,247,0.42)',
  },
  cyan: {
    icon: 'border-cyan-200/16 bg-cyan-300/10 text-cyan-100',
    progress: 'from-cyan-200 via-sky-400 to-violet-500',
    glow: 'rgba(34,211,238,0.36)',
  },
  emerald: {
    icon: 'border-emerald-200/14 bg-emerald-300/10 text-emerald-100',
    progress: 'from-emerald-200 via-cyan-300 to-violet-500',
    glow: 'rgba(16,185,129,0.3)',
  },
  slate: {
    icon: 'border-white/[0.09] bg-white/[0.045] text-slate-200',
    progress: 'from-slate-300 via-cyan-300 to-violet-400',
    glow: 'rgba(148,163,184,0.24)',
  },
};

function StatCard({ item }: { item: KpiItem }) {
  const tone = kpiToneClass[item.tone];
  const progress = typeof item.progress === 'number' && Number.isFinite(item.progress)
    ? Math.max(0, Math.min(100, item.progress))
    : null;
  return (
    <div className={`${shellCard} min-h-[118px] p-4`}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[12.5px] font-semibold leading-snug text-slate-300">{item.label}</p>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border ${tone.icon}`}>
          <Icon name={item.icon} className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 min-h-[32px] text-[23px] font-black leading-none tracking-[-0.04em] text-white min-[1440px]:text-[25px]">
        {item.value}
      </div>
      <p className="mt-2 line-clamp-2 min-h-[34px] text-[12px] leading-[1.4] text-slate-400">{item.note}</p>
      <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-white/[0.075]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone.progress}`}
          style={{
            width: `${progress ?? 0}%`,
            boxShadow: `0 0 18px ${tone.glow}`,
          }}
        />
      </div>
    </div>
  );
}

function OpportunityCard({ metrics, className = '' }: { metrics: DashboardData['metrics']; className?: string }) {
  return (
    <div className={`${shellCard} min-h-[124px] bg-[linear-gradient(135deg,rgba(30,14,64,0.94),rgba(8,12,29,0.99))] px-4 py-4 sm:h-[128px] sm:px-5 ${className}`}>
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-violet-500/18 blur-3xl" />
      <div className="text-[13px] text-white/88">Opportunité IA</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[22px] font-semibold leading-none tracking-[-0.025em] text-white">{metrics.opportunityLabel}</div>
          <p className="mt-2 max-w-[520px] text-[13.5px] leading-[1.35] text-slate-300">{metrics.opportunityText}</p>
        </div>
        <div className="hidden w-[102px] shrink-0 flex-col items-end gap-3 min-[420px]:flex">
          <div className="flex gap-1.5">
            <span className="h-1.5 w-8 rounded-full bg-violet-400" />
            <span className="h-1.5 w-8 rounded-full bg-violet-500" />
            <span className="h-1.5 w-6 rounded-full bg-white/10" />
            <span className="h-1.5 w-7 rounded-full bg-white/8" />
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-500/12 text-violet-200 shadow-[0_0_24px_rgba(124,58,237,0.4)]">
            <Icon name="chevron" className="h-[18px] w-[18px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiGrid({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const kpis = buildKpis(dashboard, states);

  return (
    <section data-dashboard-kpi-grid="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1180px]:grid-cols-4">
      {kpis.map((item) => <StatCard key={item.label} item={item} />)}
    </section>
  );
}

function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[16px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[17px]">
        {children}
        <Icon name="info" className="h-[13px] w-[13px] text-slate-400" />
      </div>
      {right}
    </div>
  );
}

function EmptyState({
  title,
  message,
  cta,
  href,
}: {
  title: string;
  message: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="relative flex h-full min-h-[150px] flex-col items-center justify-center overflow-hidden rounded-[10px] border border-white/[0.07] bg-white/[0.035] px-4 py-5 text-center sm:px-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.16),transparent_42%)]" />
      <div className="relative grid h-11 w-11 place-items-center rounded-[12px] border border-violet-300/18 bg-violet-400/10 text-violet-100">
        <Icon name="shield" className="h-5 w-5" />
      </div>
      <p className="relative mt-3 text-[14px] font-semibold leading-snug text-white sm:text-[15px]">{title}</p>
      <p className="relative mt-2 max-w-[360px] text-[12.5px] leading-relaxed text-slate-400 sm:text-[13px]">{message}</p>
      {cta && href ? (
        <Link href={href} className={`relative mt-4 inline-flex h-9 items-center px-4 text-[12px] ${primaryButton}`}>
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

function RetentionChartCard({
  retention,
  states,
  cta,
}: {
  retention: DashboardData['retention'];
  states: DashboardData['states'];
  cta: DashboardData['analysisCta'];
}) {
  if (!states.hasRetentionData) {
    return (
      <div className={`${shellCard} min-h-[330px] p-4 sm:h-[378px] sm:p-5`}>
        <SectionTitle>Analyse de rétention</SectionTitle>
        <div className="mt-4 min-h-[240px] sm:h-[290px]">
          <EmptyState
            title="Analyse de rétention"
            message={states.hasAnalyses ? "Cette analyse ne contient pas encore de courbe de rétention exploitable." : "Analyse ta première vidéo pour voir où l’attention casse."}
            cta="Analyser une vidéo"
            href="/dashboard/analyze"
          />
        </div>
      </div>
    );
  }

  const points = retention.points.slice(0, 9);
  const coords = points.map((point, index) => {
    const x = 32 + (index * (562 / Math.max(points.length - 1, 1)));
    const y = 216 - (Math.max(0, Math.min(100, point.current)) / 100) * 184;
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const fillPath = `${path} L594 216 L32 216 Z`;

  return (
    <div className={`${shellCard} min-h-[348px] p-4 sm:h-[378px] sm:p-5`}>
      <SectionTitle>Analyse de rétention</SectionTitle>

      <div className="relative mt-4 h-[210px] sm:h-[238px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 626 238" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="retentionLineReal" x1="32" y1="33" x2="594" y2="194" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e879f9" />
              <stop offset=".5" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="retentionFillReal" x1="312" y1="34" x2="312" y2="219" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a855f7" stopOpacity=".35" />
              <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`h-${i}`} x1="32" x2="594" y1={32 + i * 46} y2={32 + i * 46} stroke="rgba(255,255,255,.055)" strokeWidth="1" />
          ))}
          {coords.map((point) => (
            <line key={`v-${point.id}`} x1={point.x} x2={point.x} y1="32" y2="216" stroke="rgba(255,255,255,.035)" strokeWidth="1" />
          ))}
          <path d={fillPath} fill="url(#retentionFillReal)" />
          <path d={path} stroke="url(#retentionLineReal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point) => (
            <g key={point.id}>
              <circle cx={point.x} cy={point.y} r="4.5" fill={point.type === 'drop' ? '#ef4444' : point.type === 'payoff' ? '#10b981' : '#8b5cf6'} />
              <text x={point.x} y={Math.max(14, point.y - 12)} textAnchor="middle" fill="#cbd5e1" fontSize="10">{point.time}</text>
            </g>
          ))}
        </svg>

        <div className="absolute left-0 top-[24px] space-y-[29px] text-[12px] text-slate-300">
          <div>100%</div>
          <div>75%</div>
          <div>50%</div>
          <div>25%</div>
          <div>0%</div>
        </div>
      </div>

      <div className="mt-3 flex min-h-[48px] flex-wrap items-center gap-2.5 rounded-[8px] border border-white/[0.06] bg-[#06101d]/78 px-3.5 py-2">
        <span className="mr-2 text-[13px] text-white">Moments clés détectés</span>
        {retention.keyMoments.length > 0 ? retention.keyMoments.map(({ label, time, tone }) => (
          <span key={label} className={`inline-flex h-[30px] items-center gap-3 rounded-[6px] px-3.5 text-[12px] ${tone}`}>
            <span className="font-semibold">{label}</span>
            <span className="text-slate-300">{time}</span>
          </span>
        )) : <span className="text-[12px] text-slate-500">Aucun moment fiable détecté.</span>}
        <Link href={cta.href} className="ml-auto text-[12px] font-semibold text-violet-200 hover:text-white">{cta.label}</Link>
      </div>
    </div>
  );
}

function CreatorPortrait({ latestVideo }: { latestVideo: DashboardData['latestVideo'] }) {
  const hasSocialMetrics = latestVideo.likes !== '—' || latestVideo.comments !== '—' || latestVideo.shares !== '—';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] bg-[radial-gradient(circle_at_55%_20%,rgba(139,92,246,0.38),transparent_32%),linear-gradient(180deg,#140b2d_0%,#07111f_64%,#030812_100%)]">
      {latestVideo.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={latestVideo.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_36%_18%,rgba(232,121,249,0.32),transparent_28%),radial-gradient(circle_at_74%_42%,rgba(34,211,238,0.18),transparent_30%),linear-gradient(160deg,rgba(88,28,135,0.54),rgba(7,17,31,0.96)_58%,rgba(2,6,17,1))]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.04),rgba(3,7,18,0.34)_62%,rgba(3,7,18,0.82))]" />
      <div className="absolute left-2.5 top-2.5 rounded-md border border-white/10 bg-black/24 px-1.5 py-1 text-[12px] text-white/60 backdrop-blur">Analyse</div>
      <div className="absolute right-[58px] top-1/2 grid h-[50px] w-[50px] -translate-y-1/2 place-items-center rounded-full bg-black/48 text-white backdrop-blur-md shadow-[0_12px_34px_rgba(0,0,0,0.42)] sm:right-[62px] sm:h-[58px] sm:w-[58px]">
        <Icon name="play" className="h-6 w-6 sm:h-7 sm:w-7" />
      </div>
      {hasSocialMetrics ? (
        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:gap-3.5">
          {latestVideo.likes !== '—' ? (
            <div className="text-center">
              <Icon name="heart" className="mx-auto h-6 w-6" />
              <div className="mt-1 text-[9px] font-bold">{latestVideo.likes}</div>
            </div>
          ) : null}
          {latestVideo.comments !== '—' ? (
            <div className="text-center">
              <Icon name="message" className="mx-auto h-5 w-5" />
              <div className="mt-1 text-[9px] font-bold">{latestVideo.comments}</div>
            </div>
          ) : null}
          {latestVideo.shares !== '—' ? (
            <div className="text-center">
              <Icon name="share" className="mx-auto h-5 w-5" />
              <div className="mt-1 text-[9px] font-bold">{latestVideo.shares}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="absolute left-0 top-0 h-full w-[20px] bg-fuchsia-500/25 blur-[10px]" />
    </div>
  );
}

function VideoPreviewCard({
  latestVideo,
  states,
  cta,
}: {
  latestVideo: DashboardData['latestVideo'];
  states: DashboardData['states'];
  cta: DashboardData['analysisCta'];
}) {
  if (!states.hasLatestAnalysis) {
    return (
      <div className={`${shellCard} min-h-[300px] p-3.5 sm:h-[378px]`}>
        <EmptyState
          title="Ta dernière analyse apparaîtra ici."
          message="Viralynz n’affiche pas de fausse vidéo. Analyse une première vidéo pour débloquer cette carte."
          cta="Analyser une vidéo"
          href="/dashboard/analyze"
        />
      </div>
    );
  }

  return (
    <div className={`${shellCard} min-h-[330px] p-3.5 sm:h-[378px]`}>
      <div className="h-[198px] overflow-hidden rounded-[10px] border border-white/[0.08] shadow-[0_18px_48px_-28px_rgba(124,58,237,0.62)] sm:h-[218px]">
        <CreatorPortrait latestVideo={latestVideo} />
      </div>
      <h3 className="mt-3 line-clamp-2 text-[15px] font-bold leading-snug text-white">{latestVideo.title}</h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">{latestVideo.date}&nbsp;&nbsp;•&nbsp;&nbsp;{latestVideo.duration}</p>
      {latestVideo.tiktokUrl ? (
        <a href={latestVideo.tiktokUrl} target="_blank" rel="noreferrer" className="mt-3 flex h-[32px] w-full items-center justify-between rounded-[8px] border border-white/[0.075] bg-[#0b1526] px-3.5 text-[12.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-violet-300/22 hover:bg-[#101c33]">
          <span className="flex items-center gap-2"><span className="text-[18px] leading-none">♪</span>Voir sur TikTok</span>
          <Icon name="external" className="h-3.5 w-3.5 text-slate-400" />
        </a>
      ) : (
        <Link href={cta.href} className="mt-3 flex h-[32px] w-full items-center justify-between rounded-[8px] border border-white/[0.075] bg-[#0b1526] px-3.5 text-[12.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-violet-300/22 hover:bg-[#101c33]">
          <span>{cta.label}</span>
          <Icon name="chevron" className="h-3.5 w-3.5 text-slate-400" />
        </Link>
      )}
    </div>
  );
}

function MiniScoreRing({ score, color }: { score: number | null; color: string }) {
  return (
    <div className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full p-[3px]" style={score === null ? { background: 'rgba(255,255,255,.08)' } : { background: `conic-gradient(${color} 0 ${score}%, rgba(255,255,255,.08) ${score}% 100%)` }}>
      <div className="grid h-full w-full place-items-center rounded-full bg-[#071221]">
        <div className="text-center text-[13px] font-black leading-none text-white">
          {score ?? 'N.D.'}<span className="text-[8.5px] text-slate-400">/100</span>
        </div>
      </div>
    </div>
  );
}

function InsightsIACard({
  insights,
  cta,
  states,
}: {
  insights: DashboardInsight[];
  cta: DashboardData['analysisCta'];
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();

  return (
    <aside className={`${shellCard} min-h-[380px] p-4 sm:h-[488px] sm:p-5`}>
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_88%_14%,rgba(124,58,237,.24),transparent_23%),linear-gradient(rgba(139,92,246,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.13)_1px,transparent_1px)] [background-size:100%_100%,36px_36px,36px_36px]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-semibold text-white">Mémoire IA</h2>
          <span className="rounded-[5px] bg-[#4c1d95] px-2.5 py-0.5 text-[11px] font-bold text-violet-100">{t('dashboard.new')}</span>
        </div>
        {!states.hasRealInsights ? (
          <div className="mt-5 min-h-[260px] flex-1 sm:min-h-0">
            <EmptyState
              title={states.hasTikTokConnection ? 'Compte connecté. Analyse une vidéo pour débloquer ta mémoire.' : 'Analyse ta première vidéo pour débloquer ta Mémoire IA.'}
              message={states.hasTikTokConnection ? 'TikTok est relié. Viralynz attend une vraie vidéo avant d’afficher des décisions de montage.' : 'Aucun score de hook, rétention ou engagement ne sera affiché tant qu’il ne vient pas d’une vraie analyse.'}
              cta={t('dashboard.analyzeVideo')}
              href="/dashboard/analyze"
            />
          </div>
        ) : (
          <>
            <p className="mt-2.5 text-[14.75px] leading-[1.32] text-white">
              {t('dashboard.memorySignalsLatestFull')}
            </p>

            <div className="mt-3 space-y-2">
              {insights.map((item) => {
                const style = insightStyleByType[item.type];
                const title = translateKnownPhrase(item.title, language);
                const description = translateKnownPhrase(item.description, language);
                return (
                <div key={item.title} className="flex min-h-[58px] items-center gap-3 rounded-[10px] border border-white/[0.065] bg-white/[0.035] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full" style={{ background: `${style.color}22`, color: style.color }}>
                    <Icon name={style.icon} className="h-[16px] w-[16px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.6px] font-semibold leading-tight text-white">{title}</div>
                    <p className="mt-1 line-clamp-2 text-[12.25px] leading-[1.36] text-slate-300/92">{description}</p>
                  </div>
                  <MiniScoreRing score={item.score} color={style.color} />
                </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-auto shrink-0 pt-3">
          <Link className={`flex h-[42px] w-full items-center justify-center gap-2 text-[13.5px] ${primaryButton}`} href={cta.href}>
            {cta.label} <span className="text-[13px]">✦</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

function ViralPotentialCard({ metrics, states }: { metrics: DashboardData['metrics']; states: DashboardData['states'] }) {
  const score = metrics.averageViralScore;
  const { t } = useLanguage();

  return (
    <div className={`${shellCard} min-h-[226px] p-4 sm:h-[244px] sm:p-5`}>
      <SectionTitle>Potentiel viral</SectionTitle>
      {score === null ? (
        <div className="mt-4 min-h-[150px] sm:h-[165px]">
          <EmptyState
            title={t('dashboard.unlock')}
            message={states.hasAnalyses ? t('dashboard.noUsableViralScore') : t('dashboard.unlockMetric')}
            cta={t('dashboard.analyzeVideo')}
            href="/dashboard/analyze"
          />
        </div>
      ) : (
        <>
          <div className="mt-2 flex justify-center">
            <div className="relative grid h-[98px] w-[98px] place-items-center rounded-full p-[7px] shadow-[0_0_32px_rgba(124,58,237,0.24)]" style={{ background: `conic-gradient(from 228deg,#8b5cf6 0 ${score}%,rgba(255,255,255,.07) ${score}% 100%)` }}>
              <div className="grid h-full w-full place-items-center rounded-full bg-[#07101d]">
                <div className="flex flex-col items-center justify-center gap-[6px] text-center leading-none">
                  <div className="text-[27px] font-semibold tracking-[-0.045em] text-white">{score}<span className="text-[16px]">%</span></div>
                  <div className="text-[12.25px] font-medium leading-none text-slate-200">{t('dashboard.scoreAverage')}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2.5 text-center text-[12.75px] leading-none text-slate-400">{t('dashboard.basedOnAnalyses')}</div>
          <div className="mt-3 flex justify-center">
            <span className="rounded-[7px] border border-fuchsia-400/12 bg-[#2e0f59] px-3 py-1 text-[12px] font-semibold leading-none text-fuchsia-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">{t('dashboard.noInventedReach')}</span>
          </div>
        </>
      )}
    </div>
  );
}

function EmotionalCurveCard({ states }: { states: DashboardData['states'] }) {
  const { t } = useLanguage();

  return (
    <div className={`${shellCard} min-h-[226px] p-4 sm:h-[244px] sm:p-5`}>
      <SectionTitle>{t('dashboard.emotionalCurve')}</SectionTitle>
      <div className="mt-4 min-h-[150px] sm:h-[165px]">
        <EmptyState
          title={t('dashboard.noRealCurve')}
          message={states.hasAnalyses ? t('dashboard.noMeasurableEmotions') : t('dashboard.analyzeForEmotions')}
          cta={t('dashboard.analyzeVideo')}
          href="/dashboard/analyze"
        />
      </div>
    </div>
  );
}

function ContentPillarsCard({ states }: { states: DashboardData['states'] }) {
  const { t } = useLanguage();

  return (
    <div className={`${shellCard} min-h-[226px] p-4 sm:h-[244px] sm:p-5`}>
      <SectionTitle>{t('dashboard.contentPillarPerformance')}</SectionTitle>
      <div className="mt-4 min-h-[150px] sm:h-[165px]">
        <EmptyState
          title={t('dashboard.categoriesToBuild')}
          message={states.hasAnalyses ? t('dashboard.needMoreRealDataForPillars') : t('dashboard.categoriesAfterAnalyses')}
          cta={t('dashboard.analyzeVideo')}
          href="/dashboard/analyze"
        />
      </div>
    </div>
  );
}

function VideoThumbnail({ index, color }: { index: number; color: string }) {
  return (
    <div
      className="relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-[8px] border border-white/10 bg-cover bg-no-repeat shadow-[0_10px_28px_-18px_rgba(0,0,0,0.85)]"
      style={{
        backgroundColor: color,
        backgroundImage: 'radial-gradient(circle at 35% 22%, rgba(255,255,255,0.25), transparent 28%), linear-gradient(180deg, rgba(3,7,18,0.05), rgba(3,7,18,0.52))',
      }}
    >
      <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/65 to-transparent" />
      <div className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_8px_rgba(232,121,249,0.8)]" />
    </div>
  );
}

function TopVideosCard({ videos, states }: { videos: DashboardTopVideo[]; states: DashboardData['states'] }) {
  const colors = ['#6d28d9', '#f97316', '#22c55e', '#fb7185'];
  const { t } = useLanguage();

  return (
    <aside className={`${shellCard} min-h-[292px] p-4 sm:h-[318px] sm:p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-white">{t('dashboard.videosMostPerforming')}</h2>
        <button className="rounded-[6px] px-2 py-1 text-[12.5px] font-medium text-fuchsia-300 transition hover:bg-fuchsia-400/10 hover:text-fuchsia-200" type="button">{t('dashboard.viewAll')}</button>
      </div>
      {!states.hasTikTokConnection ? (
        <div className="mt-4 min-h-[218px] sm:h-[242px]">
          <EmptyState
            title="Connecte TikTok"
            message="Relie ton profil TikTok à Viralynz. Les vidéos demandent des permissions avancées."
            cta={t('dashboard.connectTikTok')}
            href="/api/tiktok/connect"
          />
        </div>
      ) : videos.length === 0 ? (
        <div className="mt-4 min-h-[218px] sm:h-[242px]">
          <EmptyState
            title="Compte TikTok connecté"
            message="Les vidéos seront disponibles après activation des permissions avancées."
          />
        </div>
      ) : (
      <div className="mt-4 space-y-3">
        {videos.map((video, index) => (
          <div key={video.id} className="flex items-center gap-3.5">
            <VideoThumbnail index={index} color={colors[index] ?? colors[0]} />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[13px] font-semibold leading-[1.25] text-white">{video.title}</div>
              <div className="mt-1 text-[11.75px] text-slate-500">{video.date}</div>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full border border-green-400/45 bg-green-400/10 text-[13px] font-semibold text-green-300">{video.score ?? '—'}</div>
            <div className="w-[52px] text-right text-[11.75px] leading-tight text-slate-300">
              <div>{video.views}</div>
              <div className="text-slate-500">{t('dashboard.views')}</div>
            </div>
          </div>
        ))}
      </div>
      )}
    </aside>
  );
}

const recommendationStyles: Array<{ icon: IconName; tone: string }> = [
  { icon: 'hook', tone: 'from-violet-600 to-violet-900' },
  { icon: 'calendar', tone: 'from-blue-600 to-blue-950' },
  { icon: 'bookmark', tone: 'from-fuchsia-700 to-pink-950' },
  { icon: 'rocket', tone: 'from-teal-600 to-cyan-950' },
];

function BotMascot() {
  return (
    <div className="relative h-[122px] w-[90px] shrink-0">
      <div className="absolute left-3 top-1 h-[61px] w-[64px] rounded-[20px] border border-violet-300/50 bg-[linear-gradient(180deg,#28115d,#0c1230)] shadow-[0_0_32px_rgba(124,58,237,.6),inset_0_1px_0_rgba(255,255,255,.22)]">
        <div className="absolute left-2.5 top-3.5 h-[32px] w-[45px] rounded-[13px] border border-fuchsia-300/55 bg-[#090b1a]">
          <div className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,.9)]" />
          <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,.9)]" />
        </div>
      </div>
      <div className="absolute left-[29px] top-[63px] h-[54px] w-[37px] rounded-[14px] border border-violet-300/35 bg-[linear-gradient(180deg,#3b1683,#160b39)]" />
      <span className="absolute left-0 top-[22px] h-9 w-2 rounded-full bg-violet-400/80" />
      <span className="absolute right-0 top-[22px] h-9 w-2 rounded-full bg-violet-400/80" />
      <span className="absolute left-7 top-[-3px] h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_14px_rgba(232,121,249,.9)]" />
      <span className="absolute left-[52px] top-[-3px] h-2 w-2 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,.9)]" />
    </div>
  );
}

function RecommendationsSection({
  recommendations,
  context,
  states,
}: {
  recommendations: DashboardRecommendation[];
  context: string;
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();

  return (
    <section className={`${shellCard} min-h-[176px] p-4`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[470px] bg-[radial-gradient(circle_at_18%_40%,rgba(124,58,237,0.22),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(232,121,249,0.42),transparent)]" />
      <div className="flex h-full flex-col gap-4 min-[1600px]:flex-row min-[1600px]:items-center min-[1600px]:gap-5">
        <div className="hidden min-[1600px]:block">
          <BotMascot />
        </div>
        <div className="relative w-full shrink-0 min-[1600px]:w-[226px]">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">{t('dashboard.recommendations')}</h2>
            <Icon name="info" className="h-[13px] w-[13px] text-slate-400" />
          </div>
          <p className="mt-2 max-w-[620px] text-[13.5px] leading-[1.45] text-slate-300 min-[1600px]:mt-3">{translateKnownPhrase(context, language)}</p>
        </div>
        <div className="relative grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 min-[1180px]:grid-cols-4 min-[1180px]:gap-3.5 min-[1280px]:grid-cols-2 min-[1600px]:grid-cols-4">
          {recommendations.map((item, index) => {
            const style = recommendationStyles[index] ?? recommendationStyles[0];
            const title = translateKnownPhrase(item.title, language);
            const description = translateKnownPhrase(item.description, language);
            const cta = translateKnownPhrase(item.cta, language);
            return (
            <div key={item.title} className={`${softPanel} flex min-h-[150px] min-w-0 flex-col border-white/[0.095] bg-white/[0.048] p-3.5`}>
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br ${style.tone} text-white shadow-[0_12px_28px_-14px_rgba(124,58,237,0.88)]`}>
                  <Icon name={style.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 break-words text-[13.5px] font-bold leading-tight text-white">{title}</div>
              </div>
              <p className={`mt-2.5 flex-1 break-words pb-2 text-[12.05px] leading-[1.38] ${item.locked ? 'text-slate-500' : 'text-slate-300/92'}`}>{description}</p>
              {item.locked || !states.hasAnalyses ? (
              <Link href="/dashboard/analyze" className="mt-auto flex h-[30px] w-full items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.05] text-[11.85px] font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                  {t('dashboard.analyzeVideo')}
                </Link>
              ) : (
                <button className={`mt-auto h-[30px] w-full text-[11.85px] ${primaryButton}`} type="button">{cta}</button>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TikTokStatusBanner({
  states,
  connection,
  onManageTikTok,
}: {
  states: DashboardData['states'];
  connection: DashboardData['tiktokConnection'];
  onManageTikTok: () => void;
}) {
  const displayName = connection.displayName?.trim();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [syncing, setSyncing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const reconnectHref = '/api/tiktok/connect?mode=reconnect';
  const tiktokStatus = searchParams?.get('tiktok') ?? null;
  const statusMessage = tiktokStatus ? connectedTikTokMessages[tiktokStatus] : null;

  function reconnectTikTok() {
    if (reconnecting) return;
    setReconnecting(true);
    window.location.href = reconnectHref;
  }

  async function syncTikTokNow() {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/tiktok/sync', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null) as { errors?: Array<{ message?: string }>; reason?: string } | null;

      if (!response.ok) {
        const message = payload?.errors?.[0]?.message
          ?? (payload?.reason === 'missing_scope' ? 'TikTok n’a pas accordé les permissions vidéo.' : null)
          ?? 'Synchronisation TikTok impossible pour le moment.';
        setSyncMessage(message);
        return;
      }

      setSyncMessage('Synchronisation lancée. Le cockpit se met à jour.');
      router.refresh();
    } catch {
      setSyncMessage('Synchronisation TikTok impossible pour le moment.');
    } finally {
      setSyncing(false);
    }
  }

  if (!states.hasTikTokConnection) {
    return (
      <section className={`${shellCard} p-4`}>
        <div className="flex flex-col gap-4 min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <h2 className="text-[15px] font-black text-white">Connecte TikTok pour synchroniser ton profil.</h2>
            </div>
            <p className="mt-2 max-w-[760px] text-[12.5px] leading-relaxed text-slate-400">
              Tu peux utiliser Viralynz sans TikTok. Le cockpit n’affichera aucune métrique inventée tant que la connexion n’est pas réelle.
            </p>
          </div>
          <Link href="/api/tiktok/connect" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[9px] border border-cyan-200/18 bg-cyan-300/10 px-4 text-[12.5px] font-black text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/[0.14]">
            <span className="text-[16px] leading-none">♪</span>
            Connecter TikTok
          </Link>
        </div>
      </section>
    );
  }

  if (!states.hasTikTokStats) {
    const missingPermissions = connection.needsReconnect || !states.hasTikTokVideoPermissions;
    const granted = connection.scopes.length > 0 ? connection.scopes.join(', ') : 'profil basique';

    return (
      <section className={`${shellCard} p-4`}>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_100%_20%,rgba(34,211,238,0.13),transparent_52%)]" />
        <div className="relative flex flex-col gap-4 min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.72)]" />
              <h2 className="text-[15px] font-black text-white">
                {missingPermissions ? 'TikTok connecté · permissions insuffisantes' : 'TikTok connecté · synchronisation à lancer'}
              </h2>
              {displayName ? <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300">{displayName}</span> : null}
            </div>
            <p className="mt-2 max-w-[820px] text-[12.5px] leading-relaxed text-slate-400">
              {missingPermissions
                ? `Le compte est relié, mais le token actuel n’autorise que ${granted}. Reconnecte TikTok pour autoriser les scopes configurés côté Viralynz.`
                : 'Le compte est relié avec les bonnes permissions. Lance une synchronisation pour relier les vidéos disponibles au cockpit.'}
            </p>
            {connection.syncError ? (
              <p className="mt-2 max-w-[820px] text-[12px] font-bold leading-relaxed text-amber-100">{connection.syncError}</p>
            ) : null}
            {syncMessage ? (
              <p className="mt-2 max-w-[820px] text-[12px] font-bold leading-relaxed text-cyan-100">{syncMessage}</p>
            ) : null}
            {statusMessage ? (
              <p className="mt-2 max-w-[820px] text-[12px] font-bold leading-relaxed text-amber-100">{statusMessage}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {missingPermissions ? (
              <button
                type="button"
                onClick={reconnectTikTok}
                disabled={reconnecting}
                className={`inline-flex h-10 items-center justify-center gap-2 px-4 text-[12.5px] disabled:cursor-wait disabled:opacity-70 ${primaryButton}`}
              >
                <span className="text-[16px] leading-none">♪</span>
                {reconnecting ? 'Redirection...' : 'Reconnecter TikTok'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void syncTikTokNow()}
                disabled={syncing}
                className={`inline-flex h-10 items-center justify-center gap-2 px-4 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-60 ${primaryButton}`}
              >
                <Icon name="spark" className="h-4 w-4" />
                {syncing ? 'Synchronisation...' : 'Synchroniser TikTok'}
              </button>
            )}
            <button
              type="button"
              onClick={onManageTikTok}
              className="inline-flex h-10 items-center justify-center rounded-[9px] border border-white/[0.09] bg-white/[0.045] px-4 text-[12.5px] font-black text-slate-200 transition hover:bg-white/[0.075] hover:text-white"
            >
              Gérer la connexion
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${shellCard} p-4`}>
      <div className="flex flex-col gap-4 min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.72)]" />
            <h2 className="text-[15px] font-black text-white">TikTok synchronisé</h2>
            {displayName ? <span className="rounded-full border border-emerald-200/14 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-bold text-emerald-100">{displayName}</span> : null}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">Les dernières données TikTok disponibles sont reliées au cockpit.</p>
        </div>
        <button
          type="button"
          onClick={onManageTikTok}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.09] bg-white/[0.045] px-4 text-[12.5px] font-black text-slate-200 transition hover:bg-white/[0.075] hover:text-white"
        >
          Gérer la connexion
        </button>
      </div>
    </section>
  );
}

function getOpportunityBadge(score: number | null) {
  if (score !== null && score >= 75) return 'À reposter';
  if (score !== null && score >= 60) return 'Fort potentiel';
  return 'À surveiller';
}

function BestAIOpportunityCard({
  dashboard,
  states,
}: {
  dashboard: DashboardData;
  states: DashboardData['states'];
}) {
  const { language } = useLanguage();
  const score = dashboard.metrics.averageViralScore;
  const mainInsight = dashboard.insights[0];
  const recommendation = dashboard.recommendations[0];
  const title = states.hasAnalyses ? dashboard.latestVideo.title : 'Tes premières analyses sont prêtes à guider le repost.';
  const problem = mainInsight
    ? translateKnownPhrase(mainInsight.description, language)
    : 'Viralynz cherche le meilleur angle à republier sans inventer de score TikTok.';
  const action = recommendation && !recommendation.locked
    ? translateKnownPhrase(recommendation.description, language)
    : 'Analyse 2 ou 3 vidéos pour confirmer le pattern le plus rentable à retravailler.';

  return (
    <section className={`${shellCard} min-h-[252px] p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(232,121,249,0.18),transparent_34%),radial-gradient(circle_at_95%_12%,rgba(34,211,238,0.11),transparent_35%)]" />
      <div className="relative flex h-full flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-violet-200/16 bg-violet-400/12 text-violet-100">
                <Icon name="spark" className="h-4 w-4" />
              </span>
              <h2 className="text-[18px] font-black tracking-[-0.025em] text-white">Meilleure opportunité IA</h2>
            </div>
            <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-slate-300">{title}</p>
          </div>
          <span className="rounded-full border border-fuchsia-200/18 bg-fuchsia-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-fuchsia-100">
            {getOpportunityBadge(score)}
          </span>
        </div>

        <div className="mt-5 grid gap-3 min-[1180px]:grid-cols-[0.82fr_1fr_1fr]">
          <div className="rounded-[10px] border border-white/[0.075] bg-white/[0.04] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Score Viralynz</p>
            <p className="mt-2 text-[28px] font-black leading-none tracking-[-0.05em] text-white">{score === null ? 'À lancer' : `${score}/100`}</p>
          </div>
          <div className="rounded-[10px] border border-white/[0.075] bg-white/[0.035] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Problème principal</p>
            <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-slate-300">{problem}</p>
          </div>
          <div className="rounded-[10px] border border-white/[0.075] bg-white/[0.035] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Décision</p>
            <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-slate-300">{action}</p>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <Link href={dashboard.analysisCta.href} className={`inline-flex h-10 items-center gap-2 px-4 text-[12.5px] ${primaryButton}`}>
            {states.hasAnalyses ? 'Voir l’analyse' : 'Analyser une vidéo'}
            <Icon name="chevron" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ActionPlanCard({ states }: { states: DashboardData['states'] }) {
  const actions: Array<{ icon: IconName; title: string; description: string; state: string; href: string }> = [
    {
      icon: 'analysis',
      title: 'Analyser une nouvelle vidéo',
      description: 'Débloque un diagnostic concret : quoi couper, avancer, garder ou republier.',
      state: 'Recommandé',
      href: '/dashboard/analyze',
    },
    {
      icon: 'hook',
      title: 'Tester un nouveau hook',
      description: 'Réécris les premières secondes avant de remonter la V2.',
      state: states.hasAnalyses ? 'Recommandé' : 'Optionnel',
      href: '/dashboard/hooks',
    },
    {
      icon: 'bookmark',
      title: 'Comparer avec tes anciennes analyses',
      description: 'Repère les patterns qui reviennent avant de publier le prochain repost.',
      state: states.hasAnalyses ? 'Optionnel' : 'Bientôt',
      href: states.hasAnalyses ? '/dashboard/insights' : '/dashboard/analyze',
    },
  ];

  return (
    <section className={`${shellCard} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.025em] text-white">Plan d’action</h2>
        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Priorités</span>
      </div>
      <div className="mt-4 grid gap-3">
        {actions.map((action) => (
          <Link key={action.title} href={action.href} className="group flex items-start gap-3 rounded-[11px] border border-white/[0.075] bg-white/[0.035] p-3 transition hover:border-violet-200/18 hover:bg-white/[0.055]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] text-violet-100">
              <Icon name={action.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-black leading-tight text-white">{action.title}</span>
                <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">{action.state}</span>
              </span>
              <span className="mt-1.5 block text-[12px] leading-relaxed text-slate-400">{action.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LatestAnalysesCard({
  dashboard,
  states,
}: {
  dashboard: DashboardData;
  states: DashboardData['states'];
}) {
  if (!states.hasLatestAnalysis) {
    return (
      <section className={`${shellCard} p-5`}>
        <h2 className="text-[18px] font-black tracking-[-0.025em] text-white">Dernières analyses</h2>
        <div className="mt-4">
          <EmptyState
            title="Pas encore assez de données"
            message="Analyse 2 ou 3 vidéos pour débloquer tes tendances personnelles."
            cta="Lancer une analyse"
            href="/dashboard/analyze"
          />
        </div>
      </section>
    );
  }

  const score = dashboard.metrics.averageViralScore;
  return (
    <section className={`${shellCard} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-black tracking-[-0.025em] text-white">Dernières analyses</h2>
        <Link href={dashboard.analysisCta.href} className="text-[12px] font-black text-violet-200 hover:text-white">Voir</Link>
      </div>
      <div className="mt-4 rounded-[12px] border border-white/[0.075] bg-white/[0.035] p-3.5">
        <div className="flex items-start gap-3">
          <div className="h-[64px] w-[58px] shrink-0 overflow-hidden rounded-[12px] border border-white/[0.08]">
            <CreatorPortrait latestVideo={dashboard.latestVideo} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[13.5px] font-black leading-5 text-white">{dashboard.latestVideo.title}</h3>
            <p className="mt-1 text-[11.5px] text-slate-500">{dashboard.latestVideo.date} · {dashboard.latestVideo.duration}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-violet-200/14 bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-100">
                {score === null ? 'Score à lancer' : `${score}/100`}
              </span>
              <span className="rounded-full border border-cyan-200/14 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-black text-cyan-100">Analyse Viralynz</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function recommendationHref(item: DashboardRecommendation) {
  const key = `${item.title} ${item.cta}`.toLowerCase();
  if (key.includes('hook')) return '/dashboard/hooks';
  if (key.includes('horaire') || key.includes('tendance')) return '/dashboard/radar';
  if (key.includes('engagement') || key.includes('exemple')) return '/dashboard/library';
  return '/dashboard/analyze';
}

function MobileActionLink({
  href,
  children,
  tone = 'ghost',
}: {
  href: string;
  children: ReactNode;
  tone?: 'primary' | 'ghost' | 'dark';
}) {
  const toneClass = tone === 'primary'
    ? 'border-transparent bg-[linear-gradient(135deg,#d95df2_0%,#7c5cff_54%,#5b21e8_100%)] text-white shadow-[0_18px_42px_-22px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.2)]'
    : tone === 'dark'
      ? 'border-white/[0.09] bg-[#080d19]/72 text-white hover:border-violet-200/20 hover:bg-white/[0.06]'
      : 'border-cyan-200/18 bg-cyan-300/[0.075] text-cyan-100 hover:border-cyan-200/30 hover:bg-cyan-300/[0.11]';

  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-[15px] border px-4 text-[13px] font-black transition focus:outline-none focus:ring-2 focus:ring-violet-300/35 ${toneClass}`}
    >
      {children}
    </Link>
  );
}

function MobileWelcomeStatus({
  user,
  states,
  tiktokConnection,
}: {
  user: DashboardData['user'];
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
}) {
  const { language, t } = useLanguage();

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.085] bg-[linear-gradient(145deg,rgba(9,17,33,0.88),rgba(4,8,18,0.96))] p-4 shadow-[0_18px_54px_-38px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.055)] min-[1280px]:hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(168,85,247,0.18),transparent_36%),radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.09),transparent_34%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.72rem] font-black leading-[1.02] tracking-[-0.055em] text-white">{t('dashboard.welcome')}, {user.name} 👋</h1>
          <p className="mt-1.5 text-[0.88rem] leading-5 text-slate-400">{t('dashboard.performanceOverviewReady')}</p>
        </div>
        <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.68rem] font-black ${states.hasTikTokConnection ? 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100' : 'border-white/[0.09] bg-white/[0.045] text-slate-300'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${states.hasTikTokConnection ? 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]' : 'bg-slate-500'}`} />
          {states.hasTikTokConnection ? t('dashboard.tiktokConnected') : t('dashboard.tiktokNotConnected')}
        </span>
      </div>
      {states.hasTikTokConnection && tiktokConnection.displayName ? (
        <p className="relative mt-3 truncate text-[0.75rem] font-semibold text-emerald-100/70">{tiktokConnection.displayName}</p>
      ) : null}
    </section>
  );
}

function MobilePrimaryActions({ states }: { states: DashboardData['states'] }) {
  const { t } = useLanguage();

  return (
    <section className="grid gap-2.5 min-[1280px]:hidden">
      <MobileActionLink href="/dashboard/analyze" tone="primary">
        <Icon name="plus" className="h-4 w-4" />
        {t('dashboard.analyzeVideo')}
      </MobileActionLink>
      {!states.hasTikTokConnection ? (
        <div className="rounded-[18px] border border-cyan-200/[0.13] bg-cyan-300/[0.055] p-3">
          <p className="text-[0.78rem] leading-5 text-cyan-50/82">{t('dashboard.connectTikTokForAnalyses')}</p>
          <Link href="/api/tiktok/connect" className="mt-2 inline-flex h-9 items-center gap-2 rounded-[11px] border border-cyan-200/18 bg-cyan-300/10 px-3 text-[0.76rem] font-black text-cyan-100">
            <span className="text-[0.95rem] leading-none">♪</span>
            {t('dashboard.connectTikTok')}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function MobileNextMoveCard({
  recommendations,
  states,
}: {
  recommendations: DashboardRecommendation[];
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();
  const recommendation = recommendations[0];
  const title = states.hasAnalyses && recommendation ? translateKnownPhrase(recommendation.title, language) : t('dashboard.improveYourHook');
  const description = states.hasAnalyses && recommendation
    ? translateKnownPhrase(recommendation.description, language)
    : t('dashboard.analyzeForRepostDecision');
  const href = states.hasAnalyses && recommendation ? recommendationHref(recommendation) : '/dashboard/analyze';
  const cta = states.hasAnalyses && recommendation ? translateKnownPhrase(recommendation.cta, language) : t('dashboard.analyzeVideo');

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-violet-200/[0.14] bg-[linear-gradient(145deg,rgba(25,18,55,0.86),rgba(6,12,26,0.96)_62%,rgba(4,8,17,0.98))] p-4 shadow-[0_20px_58px_-36px_rgba(124,58,237,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] min-[1280px]:hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_0%,rgba(217,70,239,0.2),transparent_34%),radial-gradient(circle_at_94%_18%,rgba(34,211,238,0.1),transparent_32%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-violet-200/18 bg-violet-400/12 text-violet-100">
              <Icon name="spark" className="h-4 w-4" />
            </span>
            <span className="rounded-full border border-fuchsia-200/16 bg-fuchsia-300/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.15em] text-fuchsia-100">{t('dashboard.priority')}</span>
          </div>
          <h2 className="mt-3 text-[1.08rem] font-black leading-tight tracking-[-0.035em] text-white">{title}</h2>
          <p className="mt-1.5 line-clamp-2 text-[0.82rem] leading-5 text-slate-300">{description}</p>
        </div>
      </div>
      <Link href={href} className="relative mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-white/[0.075] px-3.5 text-[0.78rem] font-black text-white ring-1 ring-white/[0.09] transition hover:bg-white/[0.1]">
        {cta}
        <Icon name="chevron" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function MobilePerformanceSummary({
  dashboard,
  states,
}: {
  dashboard: DashboardData;
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();
  const retentionScore = dashboard.insights.find((item) => item.type === 'retention')?.score ?? null;
  const memoryScores = dashboard.insights.map((item) => item.score).filter((score): score is number => typeof score === 'number');
  const memoryScore = memoryScores.length > 0 ? Math.round(memoryScores.reduce((sum, score) => sum + score, 0) / memoryScores.length) : null;
  const items = [
    dashboard.metrics.averageViralScore !== null ? { label: t('dashboard.viralScore'), value: `${dashboard.metrics.averageViralScore}/100`, tone: 'text-violet-100' } : null,
    retentionScore !== null ? { label: t('dashboard.retention'), value: `${retentionScore}/100`, tone: 'text-orange-100' } : null,
    memoryScore !== null ? { label: 'Mémoire IA', value: `${memoryScore}/100`, tone: 'text-cyan-100' } : null,
    states.hasTikTokMetrics ? { label: t('tiktok.views'), value: dashboard.metrics.totalViews, tone: 'text-emerald-100' } : null,
  ].filter((item): item is { label: string; value: string; tone: string } => Boolean(item));

  return (
    <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1rem] font-black tracking-[-0.02em] text-white">{t('dashboard.performanceSummary')}</h2>
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">{t('dashboard.real')}</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3 text-[0.82rem] leading-5 text-slate-400">
          {t('dashboard.analyzeForMetrics')}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.slice(0, 4).map((item) => (
            <div key={item.label} className="rounded-[14px] border border-white/[0.075] bg-white/[0.04] p-3">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.11em] text-slate-500">{item.label}</p>
              <p className={`mt-2 text-[1.2rem] font-black leading-none tracking-[-0.04em] ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MobileLatestAnalysis({
  dashboard,
  states,
}: {
  dashboard: DashboardData;
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();

  if (!states.hasLatestAnalysis) {
    return (
      <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
        <h2 className="text-[1rem] font-black text-white">{t('dashboard.latestAnalysis')}</h2>
        <p className="mt-2 text-[0.82rem] leading-5 text-slate-400">{t('dashboard.firstAnalysisAppears')}</p>
        <Link href="/dashboard/analyze" className="mt-3 inline-flex h-10 items-center rounded-[12px] bg-white/[0.06] px-3.5 text-[0.78rem] font-black text-white ring-1 ring-white/[0.08]">{t('dashboard.analyzeVideo')}</Link>
      </section>
    );
  }

  const mainSignal = dashboard.insights[0]?.title ? translateKnownPhrase(dashboard.insights[0].title, language) : t('dashboard.signalToCheck');
  const score = dashboard.metrics.averageViralScore;

  return (
    <section className={`${shellCard} p-3.5 min-[1280px]:hidden`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[1rem] font-black text-white">{t('dashboard.latestAnalysis')}</h2>
        <Link href={dashboard.analysisCta.href} className="text-[0.74rem] font-black text-violet-200">{t('dashboard.view')}</Link>
      </div>
      <div className="flex gap-3">
        <div className="h-[86px] w-[78px] shrink-0 overflow-hidden rounded-[14px] border border-white/[0.08]">
          <CreatorPortrait latestVideo={dashboard.latestVideo} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[0.92rem] font-black leading-5 text-white">{dashboard.latestVideo.title}</h3>
          <p className="mt-1 text-[0.72rem] text-slate-500">{dashboard.latestVideo.date} · {dashboard.latestVideo.duration}</p>
          <div className="mt-2 grid gap-1 text-[0.75rem] leading-4 text-slate-300">
            <span>{t('dashboard.viralScore')} : <strong className="text-white">{score === null ? 'À lancer' : `${score}/100`}</strong></span>
            <span className="truncate">{t('dashboard.mainSignal')} : <strong className="text-white">{mainSignal}</strong></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileRecommendations({
  recommendations,
  states,
}: {
  recommendations: DashboardRecommendation[];
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();

  return (
    <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
      <div>
        <h2 className="text-[1rem] font-black text-white">{t('dashboard.recommendations')}</h2>
        <p className="mt-1 text-[0.78rem] text-slate-400">{t('dashboard.applyNextRepost')}</p>
      </div>
      <div className="mt-3 grid gap-2">
        {recommendations.slice(0, 3).map((item, index) => {
          const style = recommendationStyles[index] ?? recommendationStyles[0];
          const href = item.locked || !states.hasAnalyses ? '/dashboard/analyze' : recommendationHref(item);
          const title = translateKnownPhrase(item.title, language);
          const description = translateKnownPhrase(item.description, language);
          const cta = translateKnownPhrase(item.cta, language);
          return (
            <div key={item.title} className="flex items-start gap-2.5 rounded-[15px] border border-white/[0.075] bg-white/[0.04] p-2.5">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br ${style.tone} text-white`}>
                <Icon name={style.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[0.86rem] font-black leading-4 text-white">{title}</h3>
                <p className="mt-1 line-clamp-2 text-[0.72rem] leading-4 text-slate-400">{description}</p>
                <Link href={href} className="mt-2 inline-flex h-8 items-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] px-3 text-[0.68rem] font-black text-slate-200">
                  {item.locked || !states.hasAnalyses ? t('dashboard.analyzeVideo') : cta}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MobileMemoryCompact({
  insights,
  states,
}: {
  insights: DashboardInsight[];
  states: DashboardData['states'];
}) {
  const { language, t } = useLanguage();

  return (
    <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
      <div className="flex items-center gap-2">
        <h2 className="text-[1rem] font-black text-white">Mémoire IA</h2>
        <span className="rounded-full border border-violet-200/18 bg-violet-400/10 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-violet-100">{t('dashboard.new')}</span>
      </div>
      <p className="mt-1 text-[0.78rem] text-slate-400">{t('dashboard.memorySignalsLatest')}</p>
      {!states.hasRealInsights ? (
        <div className="mt-3 rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3 text-[0.78rem] leading-5 text-slate-400">
          {t('dashboard.analyzeForMemory')}
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {insights.slice(0, 3).map((item) => {
            const style = insightStyleByType[item.type];
            const title = translateKnownPhrase(item.title, language);
            const description = translateKnownPhrase(item.description, language);
            return (
              <div key={item.title} className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.07] bg-white/[0.04] p-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px]" style={{ background: `${style.color}22`, color: style.color }}>
                  <Icon name={style.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[0.82rem] font-black text-white">{title}</h3>
                  <p className="line-clamp-1 text-[0.7rem] text-slate-400">{description}</p>
                </div>
                <MiniScoreRing score={item.score} color={style.color} />
              </div>
            );
          })}
        </div>
      )}
      <Link href="/dashboard/insights" className="mt-3 inline-flex h-9 items-center rounded-[11px] border border-white/[0.08] bg-white/[0.045] px-3 text-[0.74rem] font-black text-white">{t('dashboard.viewFullMemory')}</Link>
    </section>
  );
}

function MobileRetentionSparkline({ retention }: { retention: DashboardData['retention'] }) {
  const points = retention.points.slice(0, 9);
  if (points.length < 2) return null;
  const coords = points.map((point, index) => {
    const x = 10 + (index * (180 / Math.max(points.length - 1, 1)));
    const y = 82 - (Math.max(0, Math.min(100, point.current)) / 100) * 64;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 200 92" className="h-[92px] w-full" fill="none" aria-hidden="true">
      <path d={`${coords} L190 88 L10 88 Z`} fill="url(#mobileRetentionFill)" />
      <path d={coords} stroke="url(#mobileRetentionLine)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="mobileRetentionLine" x1="10" y1="18" x2="190" y2="84">
          <stop stopColor="#e879f9" />
          <stop offset=".52" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="mobileRetentionFill" x1="100" y1="20" x2="100" y2="88">
          <stop stopColor="#8b5cf6" stopOpacity=".24" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MobileRetentionCompact({
  retention,
  states,
  cta,
}: {
  retention: DashboardData['retention'];
  states: DashboardData['states'];
  cta: DashboardData['analysisCta'];
}) {
  const { t } = useLanguage();

  return (
    <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[1rem] font-black text-white">{t('dashboard.retention')}</h2>
          <p className="mt-1 text-[0.78rem] text-slate-400">{t('dashboard.keyMomentsDetected')}</p>
        </div>
        <Link href={cta.href} className="shrink-0 text-[0.72rem] font-black text-violet-200">{t('dashboard.view')}</Link>
      </div>
      {states.hasRetentionData ? (
        <>
          <div className="mt-2 rounded-[14px] border border-white/[0.065] bg-white/[0.03] px-2">
            <MobileRetentionSparkline retention={retention} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {retention.keyMoments.slice(0, 3).map((moment) => (
              <span key={`${moment.label}-${moment.time}`} className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${moment.tone}`}>
                {moment.label} {moment.time}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3 text-[0.78rem] leading-5 text-slate-400">
          {t('dashboard.retentionAvailableAfterAnalysis')}
        </div>
      )}
    </section>
  );
}

function MobileUnlockModules({ states }: { states: DashboardData['states'] }) {
  const { t } = useLanguage();
  const modules = [
    t('dashboard.emotionalCurve'),
    t('dashboard.contentPillars'),
    t('dashboard.topPerformingVideos'),
  ];

  return (
    <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
      <h2 className="text-[1rem] font-black text-white">{t('dashboard.comingNext')}</h2>
      <p className="mt-1 text-[0.78rem] leading-5 text-slate-400">{t('dashboard.unlockModules')}</p>
      <div className="mt-3 grid gap-2">
        {modules.map((module) => (
          <div key={module} className="flex h-10 items-center justify-between rounded-[12px] border border-white/[0.065] bg-white/[0.035] px-3">
            <span className="text-[0.78rem] font-bold text-slate-300">{module}</span>
            <span className="text-[0.66rem] font-black uppercase tracking-[0.12em] text-slate-500">{t('dashboard.soon')}</span>
          </div>
        ))}
      </div>
      {!states.hasAnalyses ? (
        <Link href="/dashboard/analyze" className="mt-3 inline-flex h-9 items-center rounded-[11px] bg-white/[0.06] px-3 text-[0.74rem] font-black text-white ring-1 ring-white/[0.08]">{t('dashboard.analyzeVideo')}</Link>
      ) : null}
    </section>
  );
}

function MobileTopVideosCompact({
  videos,
  states,
}: {
  videos: DashboardTopVideo[];
  states: DashboardData['states'];
}) {
  const { t } = useLanguage();
  if (!states.hasRealTopVideos || videos.length === 0) return null;
  return (
    <section className={`${shellCard} p-4 min-[1280px]:hidden`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[1rem] font-black text-white">{t('dashboard.topPerformingVideos')}</h2>
        <Link href="/dashboard/library" className="text-[0.72rem] font-black text-violet-200">{t('dashboard.viewAll')}</Link>
      </div>
      <div className="mt-3 grid gap-2">
        {videos.slice(0, 3).map((video) => (
          <div key={video.id} className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-2">
            <div className="h-10 w-10 shrink-0 rounded-[10px] bg-violet-500/20" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8rem] font-black text-white">{video.title}</p>
              <p className="text-[0.68rem] text-slate-500">{video.date}</p>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[0.68rem] font-black text-emerald-100">{video.score ?? '—'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const mobileShellCard =
  'relative overflow-hidden rounded-[24px] border border-white/[0.095] bg-[linear-gradient(145deg,rgba(12,18,38,0.86),rgba(5,9,20,0.94)_62%,rgba(4,7,16,0.98))] shadow-[0_24px_70px_-46px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl';

function MobileSparkline({ tone = 'blue' }: { tone?: 'blue' | 'violet' | 'cyan' }) {
  const gradients = {
    blue: ['#38bdf8', '#4f46e5'],
    violet: ['#a855f7', '#d946ef'],
    cyan: ['#22d3ee', '#2dd4bf'],
  };
  const [from, to] = gradients[tone];

  return (
    <svg viewBox="0 0 92 42" className="h-12 w-24" fill="none" aria-hidden="true">
      <path d="M3 34 C13 34 17 30 24 31 C31 32 33 23 40 24 C48 25 48 15 56 16 C64 18 66 12 72 10 C80 8 80 4 89 4" stroke={`url(#spark-${tone})`} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 41 L3 34 C13 34 17 30 24 31 C31 32 33 23 40 24 C48 25 48 15 56 16 C64 18 66 12 72 10 C80 8 80 4 89 4 L89 41 Z" fill={`url(#spark-fill-${tone})`} />
      <defs>
        <linearGradient id={`spark-${tone}`} x1="3" x2="89" y1="34" y2="4">
          <stop stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`spark-fill-${tone}`} x1="46" x2="46" y1="4" y2="41">
          <stop stopColor={to} stopOpacity=".28" />
          <stop offset="1" stopColor={from} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MobilePlayIllustration() {
  return (
    <div className="pointer-events-none absolute right-3 top-7 hidden h-36 w-36 min-[390px]:block">
      <div className="absolute left-4 top-7 h-24 w-24 rotate-[-7deg] rounded-[28px] border border-cyan-200/30 bg-[linear-gradient(145deg,rgba(125,150,255,0.28),rgba(13,20,51,0.72))] shadow-[0_0_44px_-10px_rgba(59,130,246,0.9),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl" />
      <div className="absolute left-11 top-14 grid h-11 w-11 place-items-center rounded-[14px] border border-cyan-100/30 bg-cyan-300/12 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.52)]">
        <Icon name="play" className="h-6 w-6" />
      </div>
      <div className="absolute left-0 top-16 h-12 w-36 rotate-[-12deg] rounded-[100%] border-2 border-cyan-300/55 shadow-[0_0_24px_rgba(34,211,238,0.58)]" />
      <span className="absolute right-4 top-8 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
      <span className="absolute left-5 top-5 h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
      <span className="absolute bottom-5 right-7 h-1 w-1 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,0.9)]" />
    </div>
  );
}

function MobileOverviewHeader() {
  return (
    <header className="pt-[max(18px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoMark small />
          <span className="text-[1.45rem] font-black tracking-[-0.045em] text-white">Viralynz</span>
        </div>
        <button type="button" aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-[14px] border border-white/[0.075] bg-white/[0.035] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <Icon name="bell" className="h-[21px] w-[21px]" />
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.95)]" />
        </button>
      </div>
      <h1 className="mt-8 text-[2.45rem] font-black leading-[0.98] tracking-[-0.055em] text-white">Vue d&apos;ensemble</h1>
      <p className="mt-2 text-[1.04rem] font-medium leading-6 text-slate-300/82">Ton cockpit de performance.</p>
    </header>
  );
}

function MobileOverviewHeroCard({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const hero = dashboard.overview.heroOpportunity;
  const title = states.hasLatestAnalysis ? 'Meilleure opportunité' : hero.title;

  return (
    <section className={`${mobileShellCard} mt-6 min-h-[390px] border-violet-300/30 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_28px_90px_-48px_rgba(124,58,237,0.95)]`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_2%,rgba(168,85,247,0.32),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,0.18),transparent_38%),linear-gradient(135deg,rgba(78,14,145,0.2),transparent_50%)]" />
      <MobilePlayIllustration />
      <div className="relative max-w-[58%] min-[390px]:max-w-[54%]">
        <div className="flex items-start gap-3">
          <Icon name="spark" className="mt-1 h-8 w-8 shrink-0 text-white" />
          <h2 className="text-[1.2rem] font-black leading-[1.12] tracking-[-0.025em] text-white">{title}<br />{states.hasLatestAnalysis ? 'de repost' : 'Viralynz'}</h2>
        </div>
      </div>
      <div className="relative mt-6">
        <div className="flex items-end gap-1.5">
          <span className="bg-[linear-gradient(135deg,#22d3ee_0%,#3b82f6_38%,#a855f7_82%)] bg-clip-text text-[4.8rem] font-black leading-none tracking-[-0.085em] text-transparent">
            {hero.score === null ? '--' : hero.score}
          </span>
          <span className="pb-2 text-[2rem] font-black leading-none tracking-[-0.055em] text-slate-300">/100</span>
        </div>
        <span className="mt-3 inline-flex h-9 items-center gap-2 rounded-[12px] border border-violet-200/20 bg-violet-400/18 px-3 text-[0.88rem] font-black text-violet-100">
          <Icon name="insights" className="h-4 w-4" />
          Insight IA
        </span>
        <p className="mt-3 max-w-[260px] text-[0.95rem] font-medium leading-6 text-slate-100/86">{hero.description}</p>
        <Link href={hero.href} className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-[18px] bg-[linear-gradient(90deg,#22c7ff_0%,#4f6dff_50%,#b21fff_100%)] text-[1rem] font-black text-white shadow-[0_18px_48px_-22px_rgba(59,130,246,0.95),0_0_32px_-18px_rgba(168,85,247,0.95)] transition active:scale-[0.99]">
          {hero.ctaLabel}
          <Icon name="chevron" className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function MobileKpiCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  tone: 'blue' | 'violet' | 'cyan';
}) {
  const iconTone = tone === 'blue'
    ? 'border-sky-300/18 bg-sky-400/12 text-sky-100'
    : tone === 'cyan'
      ? 'border-cyan-300/18 bg-cyan-300/12 text-cyan-100'
      : 'border-violet-300/20 bg-violet-400/14 text-violet-100';

  return (
    <article className={`${mobileShellCard} min-h-[134px] rounded-[20px] p-3.5 min-[1024px]:min-h-[118px]`}>
      <div className="relative flex h-full flex-col gap-2.5 min-[1024px]:flex-row min-[1024px]:items-start min-[1024px]:gap-3">
        <div className="flex items-start gap-2.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border ${iconTone}`}>
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
          <p className="min-h-[34px] min-w-0 flex-1 text-[0.78rem] font-semibold leading-[1.25] text-slate-300/86 min-[390px]:text-[0.82rem] min-[1024px]:min-h-0 min-[1024px]:truncate">{label}</p>
        </div>
        <div className="min-w-0 flex-1 pr-12 min-[1024px]:pr-0">
          <p className="text-[1.45rem] font-black leading-none tracking-[-0.05em] text-white min-[1024px]:mt-1 min-[1024px]:text-[1.35rem]">{value}</p>
          <p className="mt-2 max-w-[120px] text-[0.72rem] font-black leading-tight text-emerald-300 min-[390px]:text-[0.75rem] min-[1024px]:text-[0.78rem]">{detail}</p>
        </div>
        <div className="absolute bottom-[-2px] right-[-18px] scale-75 opacity-80 min-[390px]:right-[-12px] min-[390px]:scale-90 min-[1024px]:bottom-[-4px] min-[1024px]:right-[-10px] min-[1024px]:scale-100 min-[1024px]:opacity-95">
          <MobileSparkline tone={tone} />
        </div>
      </div>
    </article>
  );
}

function kpiPresentation(kpi: OverviewKpi): { icon: IconName; tone: 'blue' | 'violet' | 'cyan' } {
  if (kpi.id === 'retention') return { icon: 'clock', tone: 'violet' };
  if (kpi.id === 'hooks') return { icon: 'spark', tone: 'cyan' };
  if (kpi.id === 'repostScore') return { icon: 'target', tone: 'blue' };
  return { icon: 'eye', tone: 'blue' };
}

function MobileKpiGridPremium({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const items = dashboard.overview.kpis.map((kpi) => ({
    label: kpi.label,
    value: kpi.value,
    detail: kpi.trendLabel ?? kpi.detail,
    ...kpiPresentation(kpi),
  }));

  return (
    <section className="mt-3 grid grid-cols-2 gap-2.5">
      {items.map((item) => <MobileKpiCard key={item.label} {...item} />)}
    </section>
  );
}

function formatMobileSyncTime(value: string | null) {
  if (!value) return 'Dernière sync non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Dernière sync non disponible';
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Dernière sync à l’instant';
  if (diffMinutes < 60) return `Dernière sync il y a ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `Dernière sync il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `Dernière sync il y a ${days} j`;
}

function MobileTikTokConnectionCard({
  connection,
  states,
}: {
  connection: DashboardData['tiktokConnection'];
  states: DashboardData['states'];
}) {
  if (!states.hasTikTokConnection) {
    return (
      <Link href="/api/tiktok/connect?review=1" className={`${mobileShellCard} mt-3 flex min-h-[92px] items-center gap-4 rounded-[22px] border-cyan-300/22 p-4 transition active:scale-[0.99]`}>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
          <span className="text-[1.25rem] font-black">TT</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[1.02rem] font-black text-white">Connecter TikTok</p>
          <p className="mt-1 text-[0.84rem] leading-5 text-slate-400">Connecte ton compte pour enrichir ton cockpit.</p>
        </div>
        <Icon name="chevron" className="h-6 w-6 shrink-0 text-slate-300" />
      </Link>
    );
  }

  const displayName = connection.displayName?.trim() || 'Compte TikTok';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Link href="/dashboard/settings" className={`${mobileShellCard} mt-3 flex min-h-[96px] items-center gap-4 rounded-[22px] border-emerald-300/45 p-4 shadow-[0_0_38px_-24px_rgba(16,185,129,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] transition active:scale-[0.99]`}>
      <div className="relative h-16 w-16 shrink-0">
        <div className="absolute -inset-1 rounded-full bg-[conic-gradient(#22d3ee,#8b5cf6,#22c55e,#22d3ee)] opacity-95 blur-[1px]" />
        <div className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.2),rgba(124,58,237,0.35))] text-[0.95rem] font-black text-white">
          {connection.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={connection.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full border-2 border-[#06101c] bg-black text-[0.8rem] font-black text-white">♪</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[1.02rem] font-black leading-tight text-white">Compte TikTok connecté</p>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-emerald-300/18 bg-emerald-300/12 px-2.5 text-[0.72rem] font-black text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Connecté
          </span>
        </div>
        <p className="mt-1 truncate text-[0.9rem] font-medium text-slate-300">{displayName}</p>
        <p className="mt-1 text-[0.78rem] font-medium text-slate-400">{formatMobileSyncTime(connection.lastSyncAt)}</p>
      </div>
      <Icon name="chevron" className="h-6 w-6 shrink-0 text-slate-300" />
    </Link>
  );
}

function MobileDailyAiPlanCard({ items }: { items: string[] }) {
  return (
    <section className={`${mobileShellCard} mt-3 min-h-[168px] rounded-[22px] border-violet-300/24 p-4`}>
      <div className="pointer-events-none absolute right-3 top-5 hidden h-28 w-28 rotate-12 rounded-[22px] border border-violet-200/20 bg-[linear-gradient(145deg,rgba(139,92,246,0.34),rgba(34,211,238,0.09))] shadow-[0_0_40px_-14px_rgba(139,92,246,0.95)] min-[390px]:block" />
      <div className="pointer-events-none absolute right-12 top-10 hidden space-y-3 min-[390px]:block">
        {[0, 1, 2].map((item) => (
          <span key={item} className="block h-3 w-14 rounded-full bg-cyan-200/20">
            <span className="block h-3 w-8 rounded-full bg-[linear-gradient(90deg,#22d3ee,#a855f7)]" />
          </span>
        ))}
      </div>
      <div className="relative max-w-[82%] min-[390px]:max-w-[76%] min-[1024px]:max-w-[78%]">
        <div className="mb-3 flex items-center gap-3">
          <Icon name="spark" className="h-6 w-6 text-white" />
          <h2 className="text-[1.22rem] font-black tracking-[-0.025em] text-white">Plan IA du jour</h2>
        </div>
        <div className="grid gap-2.5">
          {items.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#a855f7,#5b21e8)] text-white shadow-[0_0_18px_-8px_rgba(168,85,247,0.95)]">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 10 3 3 7-7" /></svg>
              </span>
              <span className="line-clamp-1 text-[0.93rem] font-medium leading-5 text-slate-100/88 min-[390px]:text-[0.95rem]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileScoreRingPremium({ score, tone }: { score: number; tone: 'green' | 'blue' }) {
  const color = tone === 'green' ? '#4ade80' : '#60a5fa';
  const r = 24;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * (score / 100);

  return (
    <div className="relative grid h-[66px] w-[66px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.09)" strokeWidth="6" fill="none" />
        <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <span className="text-center text-[1.15rem] font-black leading-[0.9] text-white">{score}<span className="block text-[0.62rem] font-bold text-slate-300">/100</span></span>
    </div>
  );
}

function MobileVideoThumb({ index, durationLabel }: { index: number; durationLabel?: string | null }) {
  const gradients = [
    'from-fuchsia-500/35 via-blue-500/25 to-cyan-400/20',
    'from-violet-500/35 via-fuchsia-500/22 to-blue-500/25',
  ];
  return (
    <div className={`relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-[14px] border border-white/[0.08] bg-gradient-to-br min-[390px]:w-[118px] min-[1024px]:h-[68px] ${gradients[index % gradients.length]}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.22),transparent_24%),radial-gradient(circle_at_72%_22%,rgba(34,211,238,0.2),transparent_26%),linear-gradient(180deg,transparent,rgba(0,0,0,0.48))]" />
      <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/36 text-white backdrop-blur-sm">
        <Icon name="play" className="h-4 w-4" />
      </div>
      {durationLabel ? <span className="absolute bottom-1.5 right-1.5 rounded-[7px] bg-black/72 px-1.5 py-1 text-[0.68rem] font-black leading-none text-white">{durationLabel}</span> : null}
    </div>
  );
}

function MobileRecentAnalysisCard({ video, index }: { video: OverviewAnalysisCard; index: number }) {
  const score = video.score === null ? null : Math.max(0, Math.min(100, Math.round(video.score)));
  const strong = (score ?? 0) >= 80;

  return (
    <Link href={video.href} className={`${mobileShellCard} flex min-h-[96px] items-center gap-3 rounded-[18px] p-3 transition active:scale-[0.99] min-[1024px]:min-h-[84px] min-[1024px]:p-2.5`}>
      {video.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.thumbnailUrl} alt="" className="h-[72px] w-[108px] shrink-0 rounded-[14px] object-cover min-[390px]:w-[118px] min-[1024px]:h-[68px]" />
      ) : (
        <MobileVideoThumb index={index} durationLabel={video.durationLabel} />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[0.92rem] font-black leading-5 text-white min-[390px]:text-[0.98rem]">{video.title}</h3>
        <p className="mt-1 text-[0.74rem] font-medium text-slate-400 min-[390px]:text-[0.78rem]">{video.createdAtLabel}</p>
        <span className={`mt-1.5 inline-flex h-6 items-center rounded-[7px] px-2 text-[0.68rem] font-black ${strong ? 'bg-emerald-300/12 text-emerald-200' : video.badgeTone === 'warning' ? 'bg-amber-300/12 text-amber-200' : 'bg-blue-400/12 text-blue-200'}`}>
          {video.badgeLabel}
        </span>
      </div>
      {score === null ? (
        <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-[1rem] font-black text-slate-300">—</span>
      ) : (
        <div className="scale-90 min-[390px]:scale-100">
          <MobileScoreRingPremium score={score} tone={strong ? 'green' : 'blue'} />
        </div>
      )}
      <Icon name="chevron" className="h-5 w-5 shrink-0 text-slate-400" />
    </Link>
  );
}

function MobileRecentAnalysesPremium({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const videos = dashboard.overview.recentAnalyses.slice(0, 2);

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[1.2rem] font-black tracking-[-0.025em] text-white">Analyses récentes</h2>
        <Link href="/dashboard/library" className="text-[0.98rem] font-black text-violet-300">Voir tout</Link>
      </div>
      {states.hasAnalyses && videos.length > 0 ? (
        <div className="grid gap-2.5">
          {videos.map((video, index) => <MobileRecentAnalysisCard key={video.id} video={video} index={index} />)}
          <Link href="/dashboard/library" className={`${mobileShellCard} mt-1 flex h-12 items-center justify-center gap-2 rounded-[18px] text-[0.94rem] font-medium text-slate-200 transition active:scale-[0.99] min-[1024px]:hidden`}>
            Voir toutes les analyses
            <Icon name="chevron" className="h-5 w-5 text-slate-400" />
          </Link>
        </div>
      ) : (
        <div className={`${mobileShellCard} p-5 text-center`}>
          <p className="text-[1rem] font-black text-white">Aucune analyse récente</p>
          <p className="mt-2 text-[0.9rem] leading-5 text-slate-400">Analyse une vidéo pour remplir cette section avec de vraies décisions de repost.</p>
          <Link href="/dashboard/analyze" className="mt-4 inline-flex h-11 items-center justify-center rounded-[14px] bg-white/[0.07] px-4 text-[0.86rem] font-black text-white ring-1 ring-white/[0.08]">Analyser une vidéo</Link>
        </div>
      )}
    </section>
  );
}

function MobileSectionHeading({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <Icon name={icon} className="h-5 w-5 shrink-0 text-white/90" /> : null}
        <h2 className="truncate text-[1.2rem] font-black tracking-[-0.025em] text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MobileMoreAnalysesSection({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const videos = dashboard.overview.recentAnalyses.slice(2, 5);
  if (!states.hasAnalyses || videos.length === 0) return null;

  return (
    <section className="mt-2">
      <div className="grid gap-2.5 min-[1024px]:grid-cols-3">
        {videos.map((video, index) => <MobileRecentAnalysisCard key={video.id} video={video} index={index + 2} />)}
      </div>
      <Link href="/dashboard/library" className={`${mobileShellCard} mt-2 flex h-12 items-center justify-center gap-2 rounded-[18px] text-[0.94rem] font-medium text-slate-200 transition active:scale-[0.99]`}>
        Voir toutes les analyses
        <Icon name="chevron" className="h-5 w-5 text-slate-400" />
      </Link>
    </section>
  );
}

function MobileOpportunityRows({
  opportunities,
}: {
  opportunities: OverviewOpportunity[];
}) {
  const tones = [
    { icon: 'play' as const, color: 'violet' },
    { icon: 'analysis' as const, color: 'blue' },
    { icon: 'message' as const, color: 'cyan' },
  ];

  return (
    <section>
      <MobileSectionHeading title="Opportunités à activer" />
      <div className="grid gap-2.5">
        {opportunities.map((item, index) => {
          const tone = tones[index % tones.length];
          const iconClass = tone.color === 'violet'
            ? 'border-violet-300/22 bg-violet-400/14 text-violet-200'
            : tone.color === 'cyan'
              ? 'border-cyan-300/22 bg-cyan-300/12 text-cyan-200'
              : 'border-sky-300/22 bg-sky-400/12 text-sky-200';
          const badgeClass = tone.color === 'violet'
            ? 'border-fuchsia-300/18 bg-fuchsia-400/10 text-fuchsia-200'
            : tone.color === 'cyan'
              ? 'border-cyan-300/18 bg-cyan-300/10 text-cyan-200'
              : 'border-amber-300/18 bg-amber-300/10 text-amber-200';

          return (
            <Link key={item.id} href={item.href} className={`${mobileShellCard} flex min-h-[102px] items-center gap-4 rounded-[18px] p-3.5 transition hover:border-violet-200/20 hover:bg-white/[0.035] active:scale-[0.99] min-[1024px]:items-start min-[1024px]:gap-3`}>
              <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-[16px] border ${iconClass}`}>
                <Icon name={tone.icon} className="h-8 w-8" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-[1.02rem] font-black leading-6 text-white">{item.title}</h3>
                <p className="mt-1 line-clamp-2 text-[0.82rem] font-medium leading-5 text-slate-300/86">{item.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3 min-[1024px]:self-stretch">
                <span className={`rounded-full border px-3 py-1 text-[0.75rem] font-black ${badgeClass}`}>{item.priority}</span>
                <span className="flex items-center gap-1 text-[0.95rem] font-black text-violet-300">
                  {item.actionLabel}
                  <Icon name="chevron" className="h-5 w-5 text-slate-400" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MobileMiniBars({ tone = 'blue', active = 5 }: { tone?: 'blue' | 'violet' | 'cyan' | 'green'; active?: number }) {
  const toneClass = {
    blue: 'bg-sky-400 shadow-[0_0_18px_-7px_rgba(56,189,248,0.95)]',
    violet: 'bg-violet-400 shadow-[0_0_18px_-7px_rgba(168,85,247,0.95)]',
    cyan: 'bg-cyan-300 shadow-[0_0_18px_-7px_rgba(34,211,238,0.95)]',
    green: 'bg-emerald-300 shadow-[0_0_18px_-7px_rgba(74,222,128,0.95)]',
  }[tone];

  return (
    <div className="flex h-9 items-end gap-1.5" aria-hidden="true">
      {[12, 16, 20, 22, 28, 30, 27, 22, 17].map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`w-2 rounded-sm ${index < active ? toneClass : 'bg-white/10'}`}
          style={{ height }}
        />
      ))}
    </div>
  );
}

function MobileFormatPerformanceSection({ items }: { items: OverviewFormatPerformance[] }) {
  return (
    <section>
      <MobileSectionHeading title="Performances par format" />
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1024px]:mx-0 min-[1024px]:grid min-[1024px]:grid-cols-3 min-[1024px]:overflow-visible min-[1024px]:px-0 min-[1024px]:pb-0">
        {items.map((item, index) => {
          const tone = index === 0 ? 'violet' : index === 1 ? 'blue' : 'cyan';
          const icon = index === 0 ? 'users' : index === 1 ? 'bookmark' : 'shield';
          return (
          <article key={item.id} className={`${mobileShellCard} min-h-[142px] min-w-[148px] snap-start rounded-[16px] p-3.5 min-[390px]:min-w-[158px] min-[1024px]:min-h-[120px] min-[1024px]:min-w-0 min-[1024px]:p-4`}>
            <span className={`grid h-10 w-10 place-items-center rounded-[12px] border ${
              tone === 'violet'
                ? 'border-violet-300/20 bg-violet-400/12 text-violet-200'
                : tone === 'cyan'
                  ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-200'
                  : 'border-sky-300/20 bg-sky-400/12 text-sky-200'
            }`}>
              <Icon name={icon} className="h-5 w-5" />
            </span>
            <p className="mt-2 truncate text-[0.83rem] font-black text-white">{item.format}</p>
            <p className="truncate text-[0.68rem] font-medium text-slate-400">{item.metricLabel}</p>
            <p className="mt-2 text-[1.35rem] font-black leading-none tracking-[-0.045em] text-white min-[1024px]:text-[1.55rem]">
              {item.value}
            </p>
            <p className={`mt-2 text-[0.68rem] font-black ${item.available ? 'text-emerald-300' : 'text-slate-400'}`}>{item.trendLabel ?? 'À mesurer'}</p>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function MobileAiObjectIllustration() {
  return (
    <div className="pointer-events-none absolute bottom-4 right-3 hidden h-32 w-32 min-[390px]:block" aria-hidden="true">
      <div className="absolute left-8 top-5 h-20 w-20 rotate-6 rounded-[18px] border border-cyan-200/20 bg-[linear-gradient(145deg,rgba(59,130,246,0.18),rgba(124,58,237,0.18))] shadow-[0_0_40px_-12px_rgba(59,130,246,0.95)]" />
      <div className="absolute left-10 top-8 h-14 w-16 rounded-[999px] border border-violet-200/30 bg-violet-300/12 shadow-[0_0_28px_-8px_rgba(168,85,247,0.95)]" />
      <div className="absolute left-5 top-20 h-9 w-28 rounded-[100%] border-2 border-cyan-300/50 shadow-[0_0_22px_rgba(34,211,238,0.55)]" />
      <Icon name="insights" className="absolute left-14 top-12 h-8 w-8 text-cyan-100" />
    </div>
  );
}

function MobileAiRecommendationCard({ block }: { block: DashboardData['overview']['aiRecommendation'] }) {
  return (
    <section className={`${mobileShellCard} mt-5 min-h-[206px] rounded-[22px] border-violet-300/30 p-4 shadow-[0_0_42px_-30px_rgba(168,85,247,0.95)]`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_0%,rgba(168,85,247,0.28),transparent_34%),radial-gradient(circle_at_88%_34%,rgba(34,211,238,0.14),transparent_40%)]" />
      <MobileAiObjectIllustration />
      <div className="relative max-w-[78%]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[1.24rem] font-black tracking-[-0.025em] text-white">{block.title}</h2>
          <span className="rounded-[10px] border border-violet-200/18 bg-violet-400/16 px-2.5 py-1 text-[0.75rem] font-black text-violet-200">Insight IA</span>
        </div>
        <p className="mt-3 text-[0.9rem] font-medium leading-5 text-slate-100/86">{block.description}</p>
        <div className="mt-3 grid gap-2">
          {block.items.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500 text-white">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 10 3 3 7-7" /></svg>
              </span>
              <span className="line-clamp-1 text-[0.78rem] font-medium text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function activityPresentation(activity: OverviewActivity): { icon: IconName; tone: 'violet' | 'cyan' | 'amber' } {
  if (activity.type === 'tiktok') return { icon: 'radar', tone: 'cyan' };
  if (activity.type === 'hook') return { icon: 'spark', tone: 'amber' };
  return { icon: 'target', tone: 'violet' };
}

function MobileActivitySection({ activities }: { activities: OverviewActivity[] }) {
  return (
    <section>
      <MobileSectionHeading title="Activité récente" />
      <div className={`${mobileShellCard} rounded-[20px] p-3.5`}>
        {activities.length > 0 ? (
          <div className="grid gap-1">
            {activities.map((activity) => {
              const style = activityPresentation(activity);
              return (
              <Link key={activity.id} href={activity.href} className="flex min-h-[66px] items-center gap-3 rounded-[14px] px-2 py-2 transition hover:bg-white/[0.03] active:scale-[0.99]">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[13px] border ${
                  style.tone === 'violet'
                    ? 'border-violet-300/20 bg-violet-400/12 text-violet-200'
                    : style.tone === 'cyan'
                      ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-200'
                      : 'border-amber-300/20 bg-amber-300/12 text-amber-200'
                }`}>
                  <Icon name={style.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-black text-white">{activity.title}</p>
                  <p className="truncate text-[0.8rem] font-medium text-slate-400">{activity.description}</p>
                </div>
                <span className="max-w-[78px] shrink-0 text-right text-[0.76rem] font-medium leading-4 text-slate-400">{activity.timeLabel}</span>
                <Icon name="chevron" className="h-5 w-5 shrink-0 text-slate-500" />
              </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-2 text-center">
            <p className="text-[0.95rem] font-black text-white">Aucune activité récente</p>
            <p className="mt-1 text-[0.82rem] leading-5 text-slate-400">Analyse une vidéo ou connecte TikTok pour remplir cette timeline.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function MobileWeeklyGoalsSection({ goals }: { goals: OverviewGoal[] }) {
  return (
    <section>
      <MobileSectionHeading title="Objectifs de la semaine" icon="target" />
      <div className={`${mobileShellCard} rounded-[20px] p-4`}>
      <div className="grid gap-3.5">
          {goals.map((goal, index) => {
            const tone = index === 0 ? 'violet' : index === 1 ? 'blue' : 'cyan';
            const icon = index === 0 ? 'analysis' : index === 1 ? 'hook' : 'target';
            return (
            <div key={goal.label} className="flex items-center gap-3">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[13px] border ${
                tone === 'violet'
                  ? 'border-violet-300/22 bg-violet-400/14 text-violet-200'
                  : tone === 'cyan'
                    ? 'border-cyan-300/22 bg-cyan-300/12 text-cyan-200'
                    : 'border-sky-300/22 bg-sky-400/12 text-sky-200'
              }`}>
                <Icon name={icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[0.93rem] font-medium text-white">{goal.label}</p>
                  <p className="shrink-0 text-[0.96rem] font-black text-white">{goal.current}/{goal.target}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${
                    tone === 'violet'
                      ? 'bg-[linear-gradient(90deg,#7c3aed,#c084fc)]'
                      : tone === 'cyan'
                        ? 'bg-[linear-gradient(90deg,#22c55e,#67e8f9)]'
                        : 'bg-[linear-gradient(90deg,#4f46e5,#38bdf8)]'
                  }`} style={{ width: `${goal.percent}%` }} />
                </div>
              </div>
              <p className="w-[64px] shrink-0 text-right text-[0.82rem] font-black text-violet-300">{goal.percent}%</p>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MobileHooksToTestSection({ hooks }: { hooks: OverviewHookSuggestion[] }) {
  return (
    <section>
      <MobileSectionHeading title="Hooks à tester" icon="target" />
      <div className="grid gap-2.5">
        {hooks.length > 0 ? hooks.map((hook, index) => (
          <Link key={hook.id} href={hook.href} className={`${mobileShellCard} flex min-h-[84px] items-center gap-3 rounded-[18px] p-3 transition active:scale-[0.99]`}>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border ${index === 0 ? 'border-violet-300/22 bg-violet-400/14 text-violet-200' : index === 1 ? 'border-sky-300/22 bg-sky-400/12 text-sky-200' : 'border-emerald-300/22 bg-emerald-300/12 text-emerald-200'}`}>
              <Icon name={index === 0 ? 'hook' : index === 1 ? 'play' : 'radar'} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-[0.92rem] font-black leading-5 text-white">{hook.text}</h3>
              <span className="mt-1 inline-flex rounded-[7px] bg-violet-400/12 px-2 py-0.5 text-[0.68rem] font-black text-violet-200">{hook.category}</span>
            </div>
            {hook.score !== null ? <MobileScoreRingPremium score={hook.score} tone={hook.score >= 80 ? 'green' : 'blue'} /> : <span className="text-[1.35rem] font-black text-slate-500">—</span>}
            <Icon name="chevron" className="h-5 w-5 shrink-0 text-slate-500" />
          </Link>
        )) : (
          <Link href="/dashboard/hooks" className={`${mobileShellCard} flex min-h-[92px] items-center gap-3 rounded-[18px] p-4 transition active:scale-[0.99]`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-violet-300/22 bg-violet-400/14 text-violet-200">
              <Icon name="hook" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[0.95rem] font-black leading-5 text-white">Aucun hook généré</h3>
              <p className="mt-1 text-[0.8rem] font-medium leading-5 text-slate-400">Génère des hooks depuis une vraie analyse ou une idée à tester.</p>
            </div>
            <Icon name="chevron" className="h-5 w-5 shrink-0 text-slate-500" />
          </Link>
        )}
      </div>
    </section>
  );
}

function MobileTimeSlotsSection({ slots }: { slots: OverviewTimeSlot[] }) {
  return (
    <section>
      <MobileSectionHeading title="Créneaux à privilégier" icon="clock" />
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[1024px]:mx-0 min-[1024px]:grid min-[1024px]:grid-cols-3 min-[1024px]:overflow-visible min-[1024px]:px-0 min-[1024px]:pb-0">
        {slots.map((slot, index) => (
          <article key={slot.label} className={`${mobileShellCard} min-h-[124px] min-w-[154px] snap-start rounded-[16px] p-3.5 min-[390px]:min-w-[164px] min-[1024px]:min-w-0 min-[1024px]:p-3`}>
            <div className="flex items-center gap-2">
              <Icon name="clock" className={`h-5 w-5 ${index === 0 ? 'text-violet-300' : index === 2 ? 'text-cyan-300' : 'text-sky-300'}`} />
              <p className="text-[0.95rem] font-black text-white">{slot.label}</p>
            </div>
            <div className="mt-3">
              <MobileMiniBars tone={index === 0 ? 'violet' : index === 1 ? 'blue' : 'cyan'} active={slot.available ? 6 + index : 0} />
            </div>
            <p className="mt-2 text-[0.76rem] font-black text-emerald-300">{slot.trendLabel}</p>
            <p className="mt-1 text-[0.7rem] font-medium text-slate-300">{slot.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobileMemoryCard({ memory }: { memory: DashboardData['overview']['memoryInsight'] }) {
  return (
    <section className={`${mobileShellCard} mt-5 min-h-[206px] rounded-[22px] border-violet-300/30 p-4`}>
      <MobileAiObjectIllustration />
      <div className="relative max-w-[78%]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[1.24rem] font-black tracking-[-0.025em] text-white">Mémoire IA</h2>
          <span className="rounded-[10px] border border-violet-200/18 bg-violet-400/16 px-2.5 py-1 text-[0.75rem] font-black text-violet-200">Insight IA</span>
        </div>
        <p className="mt-3 text-[0.9rem] font-medium leading-5 text-slate-100/82">{memory.description}</p>
        <div className="mt-3 grid gap-2">
          {memory.items.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500 text-white">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 10 3 3 7-7" /></svg>
              </span>
              <span className="line-clamp-1 text-[0.78rem] font-medium text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileQuickActionsSection() {
  const actions = [
    { title: 'Analyser une vidéo', detail: 'Obtenir un score et des décisions', href: '/dashboard/analyze', icon: 'play' as const, tone: 'violet' },
    { title: 'Générer des hooks', detail: 'Créer une V2 plus tendue', href: '/dashboard/hooks', icon: 'spark' as const, tone: 'blue' },
    { title: 'Voir les insights', detail: 'Mémoire et tendances', href: '/dashboard/insights', icon: 'analysis' as const, tone: 'cyan' },
    { title: 'Gérer TikTok', detail: 'Compte et permissions', href: '/dashboard/settings', icon: 'settings' as const, tone: 'pink' },
  ];

  return (
    <section>
      <MobileSectionHeading title="Raccourcis" icon="spark" />
      <div className="grid grid-cols-2 gap-2.5 min-[1024px]:gap-4">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className={`${mobileShellCard} flex min-h-[82px] items-center gap-3 rounded-[18px] p-3 transition hover:border-violet-200/20 hover:bg-white/[0.035] active:scale-[0.99] min-[1024px]:min-h-[104px] min-[1024px]:p-4`}>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border ${
              action.tone === 'violet'
                ? 'border-violet-300/22 bg-violet-400/14 text-violet-200'
                : action.tone === 'cyan'
                  ? 'border-cyan-300/22 bg-cyan-300/12 text-cyan-200'
                  : action.tone === 'pink'
                    ? 'border-fuchsia-300/22 bg-fuchsia-400/12 text-fuchsia-200'
                    : 'border-sky-300/22 bg-sky-400/12 text-sky-200'
            }`}>
              <Icon name={action.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[0.86rem] font-black text-white">{action.title}</p>
              <p className="mt-1 line-clamp-1 text-[0.68rem] font-medium text-slate-400">{action.detail}</p>
            </div>
            <Icon name="chevron" className="h-5 w-5 shrink-0 text-slate-500" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function MobileHelpSection() {
  return (
    <section>
      <MobileSectionHeading title="Besoin d’aide ?" icon="info" />
      <Link href="/dashboard/settings" className={`${mobileShellCard} flex min-h-[92px] items-center gap-4 rounded-[20px] border-violet-300/24 p-4 transition active:scale-[0.99]`}>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-violet-300/22 bg-violet-400/14 text-violet-200">
          <Icon name="shield" className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1rem] font-black text-white">Centre d’aide</p>
          <p className="mt-1 text-[0.78rem] font-medium text-slate-400">Guides, FAQ et assistance rapide</p>
        </div>
        <Icon name="chevron" className="h-6 w-6 shrink-0 text-slate-400" />
      </Link>
    </section>
  );
}

function MobileBottomNavPremium() {
  const items: Array<{ href: string; label: string; icon: IconName; active?: boolean }> = [
    { href: '/dashboard', label: 'Accueil', icon: 'home', active: true },
    { href: '/dashboard/analyze', label: 'Analyser', icon: 'spark' },
    { href: '/dashboard/hooks', label: 'Hooks', icon: 'hook' },
    { href: '/dashboard/settings', label: 'Compte', icon: 'users' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[180] mx-auto w-full max-w-[430px] px-3 pb-[max(10px,env(safe-area-inset-bottom))] min-[1024px]:hidden" aria-label="Navigation mobile">
      <div className="grid grid-cols-4 rounded-[22px] border border-white/[0.09] bg-[#071020]/88 p-1.5 shadow-[0_-18px_58px_-34px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-2xl">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`relative flex h-[62px] flex-col items-center justify-center gap-1 rounded-[18px] text-[0.74rem] font-medium transition ${item.active ? 'bg-[linear-gradient(135deg,rgba(37,99,235,0.32),rgba(91,33,182,0.42))] text-sky-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-slate-300/78'}`}>
            {item.active ? <span className="absolute -top-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.95)]" /> : null}
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function DesktopOverviewHeader({
  user,
  tiktokConnection,
}: {
  user: DashboardData['user'];
  tiktokConnection: DashboardData['tiktokConnection'];
}) {
  const displayName = tiktokConnection.displayName?.trim() || user.name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[34px] font-black leading-none tracking-[-0.05em] text-white min-[1440px]:text-[38px]">Vue d&apos;ensemble</h1>
        <p className="mt-2 text-[15px] font-medium text-slate-300/82">Ton cockpit de performance.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" aria-label="Notifications" className="relative grid h-12 w-12 place-items-center rounded-[14px] border border-white/[0.08] bg-white/[0.035] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-200/20 hover:bg-white/[0.055]">
          <Icon name="bell" className="h-5 w-5" />
          <span className="absolute right-3 top-2.5 h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(139,92,246,0.95)]" />
        </button>
        <Link href="/dashboard/settings" className="flex h-14 min-w-[210px] items-center gap-3 rounded-[14px] border border-white/[0.085] bg-white/[0.035] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-violet-200/20 hover:bg-white/[0.055]">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[0.78rem] font-black text-white">
            {tiktokConnection.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tiktokConnection.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-black text-white">{displayName}</span>
              <span className="text-sky-400">●</span>
            </span>
          </span>
          <Icon name="chevron" className="h-4 w-4 rotate-90 text-slate-400" />
        </Link>
      </div>
    </header>
  );
}

function DesktopPlayIllustration() {
  return (
    <div className="pointer-events-none absolute right-12 top-7 h-[260px] w-[430px]" aria-hidden="true">
      <div className="absolute right-16 top-7 h-44 w-44 rotate-[-7deg] rounded-[36px] border border-cyan-200/30 bg-[linear-gradient(145deg,rgba(125,150,255,0.3),rgba(13,20,51,0.72))] shadow-[0_0_78px_-18px_rgba(59,130,246,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl" />
      <div className="absolute right-[132px] top-[88px] grid h-20 w-20 place-items-center rounded-[22px] border border-cyan-100/30 bg-cyan-300/12 text-cyan-50 shadow-[0_0_42px_rgba(34,211,238,0.52)]">
        <Icon name="play" className="h-11 w-11" />
      </div>
      <div className="absolute right-6 top-[112px] h-[78px] w-[330px] rotate-[-12deg] rounded-[100%] border-2 border-cyan-300/55 shadow-[0_0_34px_rgba(34,211,238,0.6)]" />
      <div className="absolute right-8 top-[162px] h-[44px] w-[260px] rounded-[100%] border border-blue-500/25" />
      <span className="absolute right-12 top-10 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
      <span className="absolute left-20 top-4 h-1 w-1 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.9)]" />
      <span className="absolute bottom-10 right-24 h-1 w-1 rounded-full bg-fuchsia-300 shadow-[0_0_10px_rgba(232,121,249,0.9)]" />
    </div>
  );
}

function DesktopHeroOpportunityCard({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const hero = dashboard.overview.heroOpportunity;

  return (
    <section className={`${mobileShellCard} min-h-[330px] rounded-[22px] border-violet-300/30 p-7 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_28px_90px_-54px_rgba(124,58,237,0.95)]`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_0%,rgba(168,85,247,0.28),transparent_32%),radial-gradient(circle_at_74%_16%,rgba(34,211,238,0.14),transparent_40%),linear-gradient(135deg,rgba(78,14,145,0.15),transparent_50%)]" />
      <DesktopPlayIllustration />
      <div className="relative max-w-[455px]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-violet-200/18 bg-violet-400/14 text-white">
            <Icon name="spark" className="h-5 w-5" />
          </span>
          <h2 className="text-[18px] font-black tracking-[-0.02em] text-white">{states.hasLatestAnalysis ? 'Meilleure opportunité de repost' : hero.title}</h2>
        </div>
        <div className="mt-6 flex items-end gap-2">
          <span className="bg-[linear-gradient(135deg,#22d3ee_0%,#3b82f6_38%,#a855f7_82%)] bg-clip-text text-[76px] font-black leading-none tracking-[-0.085em] text-transparent">
            {hero.score === null ? '--' : hero.score}
          </span>
          <span className="pb-3 text-[36px] font-black leading-none tracking-[-0.055em] text-slate-300">/100</span>
        </div>
        <span className="mt-2 inline-flex h-8 items-center gap-2 rounded-[10px] border border-violet-200/20 bg-violet-400/18 px-3 text-[13px] font-black text-violet-100">
          <Icon name="insights" className="h-4 w-4" />
          Insight IA
        </span>
        <p className="mt-4 max-w-[390px] text-[15px] font-medium leading-7 text-slate-100/86">{hero.description}</p>
        <Link href={hero.href} className="mt-5 inline-flex h-12 min-w-[310px] items-center justify-center gap-3 rounded-[13px] bg-[linear-gradient(90deg,#22c7ff_0%,#4f6dff_50%,#b21fff_100%)] px-5 text-[14px] font-black text-white shadow-[0_18px_48px_-22px_rgba(59,130,246,0.95),0_0_32px_-18px_rgba(168,85,247,0.95)] transition hover:brightness-110 active:scale-[0.99]">
          {hero.ctaLabel}
          <Icon name="chevron" className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function DesktopKpiGridPremium({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const items = dashboard.overview.kpis.map((kpi) => ({
    label: kpi.label,
    value: kpi.value,
    detail: kpi.trendLabel ?? kpi.detail,
    ...kpiPresentation(kpi),
  }));

  return (
    <section className="grid grid-cols-4 gap-3">
      {items.map((item) => <MobileKpiCard key={item.label} {...item} />)}
    </section>
  );
}

function DesktopTikTokConnectionCard({
  connection,
  states,
}: {
  connection: DashboardData['tiktokConnection'];
  states: DashboardData['states'];
}) {
  return <MobileTikTokConnectionCard connection={connection} states={states} />;
}

function DesktopDailyAiPlanCard({ items }: { items: string[] }) {
  return <MobileDailyAiPlanCard items={items} />;
}

function DesktopRecentAnalysesSection({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const videos = dashboard.overview.recentAnalyses.slice(0, 3);

  return (
    <section className={`${mobileShellCard} rounded-[20px] p-5`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-black tracking-[-0.025em] text-white">Analyses récentes</h2>
        <Link href="/dashboard/library" className="text-[14px] font-black text-violet-300 transition hover:text-white">Voir tout</Link>
      </div>
      {states.hasAnalyses && videos.length > 0 ? (
        <div className="grid gap-2.5">
          {videos.map((video, index) => <MobileRecentAnalysisCard key={video.id} video={video} index={index} />)}
        </div>
      ) : (
        <div className="rounded-[16px] border border-white/[0.075] bg-white/[0.035] p-6 text-center">
          <p className="text-[1rem] font-black text-white">Aucune analyse récente</p>
          <p className="mt-2 text-[0.9rem] leading-5 text-slate-400">Analyse une vidéo pour remplir cette section avec de vraies décisions de repost.</p>
          <Link href="/dashboard/analyze" className="mt-4 inline-flex h-11 items-center justify-center rounded-[14px] bg-white/[0.07] px-4 text-[0.86rem] font-black text-white ring-1 ring-white/[0.08]">Analyser une vidéo</Link>
        </div>
      )}
    </section>
  );
}

function DesktopFooter({ dashboard }: { dashboard: DashboardData }) {
  return (
    <footer className={`${mobileShellCard} flex min-h-[74px] items-center justify-between gap-5 rounded-[18px] px-5 py-4 text-[12px] text-slate-400`}>
      <div className="flex min-w-0 items-center gap-3">
        <LogoMark small />
        <span className="font-black text-white">Viralynz Pro</span>
        <span className="hidden min-[1280px]:inline">— {dashboard.overview.tiktok.lastSyncLabel}</span>
      </div>
      <div className="hidden items-center gap-2 text-slate-300 min-[1180px]:flex">
        <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
        Tous les systèmes opérationnels
      </div>
      <nav className="flex shrink-0 items-center gap-5">
        <Link href="/legal/confidentialite" className="transition hover:text-white">Confidentialité</Link>
        <Link href="/legal/cgv" className="transition hover:text-white">Conditions</Link>
        <Link href="/dashboard/support" className="transition hover:text-white">Contact</Link>
        <span>v2.4.1</span>
      </nav>
    </footer>
  );
}

function DesktopOverviewDashboard({
  dashboard,
  states,
  tiktokConnection,
  onManageTikTok,
}: {
  dashboard: DashboardData;
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
  onManageTikTok: () => void;
}) {
  return (
    <div className="hidden min-[1024px]:block">
      <div className="mx-auto grid w-full max-w-[1380px] gap-4 pb-8 min-[1440px]:gap-5">
        <DesktopOverviewHeader user={dashboard.user} tiktokConnection={tiktokConnection} />
        {states.hasTikTokConnection && (!states.hasTikTokVideoPermissions || tiktokConnection.needsReconnect) ? (
          <TikTokStatusBanner states={states} connection={tiktokConnection} onManageTikTok={onManageTikTok} />
        ) : null}
        <DesktopHeroOpportunityCard dashboard={dashboard} states={states} />
        <DesktopKpiGridPremium dashboard={dashboard} states={states} />
        <section className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
          <DesktopTikTokConnectionCard connection={tiktokConnection} states={states} />
          <DesktopDailyAiPlanCard items={dashboard.overview.dailyPlan} />
        </section>
        <DesktopRecentAnalysesSection dashboard={dashboard} states={states} />
        <MobileMoreAnalysesSection dashboard={dashboard} states={states} />
        <MobileOpportunityRows opportunities={dashboard.overview.opportunities} />
        <MobileFormatPerformanceSection items={dashboard.overview.formatPerformance} />
        <MobileAiRecommendationCard block={dashboard.overview.aiRecommendation} />
        <section className="grid gap-4 min-[1180px]:grid-cols-2">
          <MobileActivitySection activities={dashboard.overview.activity} />
          <MobileWeeklyGoalsSection goals={dashboard.overview.weeklyGoals} />
        </section>
        <section className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <MobileHooksToTestSection hooks={dashboard.overview.hooksToTest} />
          <MobileTimeSlotsSection slots={dashboard.overview.bestTimeSlots} />
        </section>
        <MobileMemoryCard memory={dashboard.overview.memoryInsight} />
        <MobileQuickActionsSection />
        <MobileHelpSection />
        <DesktopFooter dashboard={dashboard} />
      </div>
    </div>
  );
}

function MobileOverviewDashboard({
  dashboard,
  states,
  tiktokConnection,
}: {
  dashboard: DashboardData;
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
}) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden px-1 pb-[124px] min-[1024px]:hidden">
      <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-violet-600/18 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-28 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative">
        <MobileOverviewHeader />
        <MobileOverviewHeroCard dashboard={dashboard} states={states} />
        <MobileKpiGridPremium dashboard={dashboard} states={states} />
        <MobileTikTokConnectionCard connection={tiktokConnection} states={states} />
        <MobileDailyAiPlanCard items={dashboard.overview.dailyPlan} />
        <MobileRecentAnalysesPremium dashboard={dashboard} states={states} />
        <MobileOpportunityRows opportunities={dashboard.overview.opportunities} />
        <MobileAiRecommendationCard block={dashboard.overview.aiRecommendation} />
        <MobileFormatPerformanceSection items={dashboard.overview.formatPerformance} />
        <MobileWeeklyGoalsSection goals={dashboard.overview.weeklyGoals} />
        <MobileHooksToTestSection hooks={dashboard.overview.hooksToTest} />
        <MobileTimeSlotsSection slots={dashboard.overview.bestTimeSlots} />
        <MobileMemoryCard memory={dashboard.overview.memoryInsight} />
        <MobileQuickActionsSection />
        <MobileHelpSection />
      </div>
      <MobileBottomNavPremium />
    </div>
  );
}

function DashboardV2Client({ dashboard, children }: { dashboard: DashboardData; children?: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [locallyDisconnected, setLocallyDisconnected] = useState(false);
  const [disconnectNotice, setDisconnectNotice] = useState(false);
  const router = useRouter();

  const visibleStates = locallyDisconnected
    ? {
        ...dashboard.states,
        hasTikTokConnection: false,
        hasTikTokMetrics: false,
        hasTikTokStats: false,
        hasTikTokVideoScope: false,
        hasTikTokVideoPermissions: false,
        hasSyncedTikTokVideos: false,
        hasRealTopVideos: false,
      }
    : dashboard.states;

  const visibleTikTokConnection: DashboardData['tiktokConnection'] = locallyDisconnected
    ? {
        ...dashboard.tiktokConnection,
        connected: false,
        displayName: null,
        avatarUrl: null,
        connectedAt: null,
        lastSyncAt: null,
        scopes: [],
        hasAdvancedMetrics: false,
        capabilities: {
          grantedScopes: [],
          hasBasicProfile: false,
          hasProfile: false,
          hasUserStats: false,
          hasVideoList: false,
          canFetchProfileStats: false,
          canFetchVideos: false,
          canFetchVideoMetrics: false,
          canFetchWatchTime: false,
          missingScopes: [],
          environment: 'unknown' as const,
          needsReconnect: false,
        },
        needsReconnect: false,
        syncStatus: null,
        syncError: null,
      }
    : dashboard.tiktokConnection;
  const showOverview = pathname === '/dashboard';
  const showAnalyzeMobileChrome = pathname === '/dashboard/analyze';

  useEffect(() => {
    document.body.setAttribute('data-dashboard-v2', 'true');
    return () => document.body.removeAttribute('data-dashboard-v2');
  }, []);

  useEffect(() => {
    if (!disconnectNotice) return;
    const timeout = window.setTimeout(() => setDisconnectNotice(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [disconnectNotice]);

  function handleTikTokDisconnected() {
    setLocallyDisconnected(true);
    setManagerOpen(false);
    setDisconnectNotice(true);
    router.refresh();
  }

  return (
    <main
      data-tiktok-connected={visibleStates.hasTikTokConnection ? 'true' : 'false'}
      data-has-analyses={dashboard.states.hasAnalyses ? 'true' : 'false'}
      data-dashboard-v2-root="true"
      className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden bg-[#020611] font-sans text-white antialiased min-[1024px]:overflow-hidden"
    >
        <div className="relative min-h-screen w-full min-w-0 overflow-x-hidden bg-[radial-gradient(ellipse_75%_52%_at_51%_-18%,rgba(56,189,248,0.08),transparent_58%),radial-gradient(ellipse_58%_44%_at_92%_8%,rgba(124,58,237,0.18),transparent_58%),linear-gradient(180deg,#020611_0%,#030711_100%)] min-[1024px]:h-screen min-[1024px]:min-h-0">
          <div className="pointer-events-none absolute inset-0 opacity-[0.018] [background-image:linear-gradient(rgba(255,255,255,.75)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.75)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="pointer-events-none absolute top-0 hidden h-full w-px bg-white/[0.02] transition-[left] lg:left-[84px] lg:block xl:left-[260px]" />
        {!showOverview && !showAnalyzeMobileChrome && <MobileDashboardHeader user={dashboard.user} onMenuOpen={() => setDrawerOpen(true)} />}
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={dashboard.user} states={visibleStates} tiktokConnection={visibleTikTokConnection} />
        <Sidebar
          user={dashboard.user}
          tiktokConnection={visibleTikTokConnection}
        />
        {!visibleStates.hasTikTokConnection && !locallyDisconnected && (
          <TikTokConnectModal
            isTikTokConnected={visibleStates.hasTikTokConnection}
            connectUrl="/api/tiktok/connect"
            analyzerUrl="/dashboard/analyze"
            hasAnalyses={visibleStates.hasAnalyses}
          />
        )}
        <TikTokConnectedSuccessModal
          enabled={visibleStates.hasTikTokConnection}
          connection={visibleTikTokConnection}
          analyzeUrl="/dashboard/analyze"
        />
        <TikTokConnectionManager
          open={managerOpen}
          connection={visibleTikTokConnection}
          onClose={() => setManagerOpen(false)}
          onDisconnected={handleTikTokDisconnected}
        />
        {disconnectNotice && (
          <div className="fixed right-4 top-4 z-[260] max-w-[330px] rounded-[14px] border border-cyan-200/[0.14] bg-[linear-gradient(135deg,rgba(12,18,34,0.96),rgba(4,8,18,0.98))] px-4 py-3 text-white shadow-[0_22px_70px_-38px_rgba(34,211,238,0.75),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-[13px] font-black">TikTok déconnecté</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">Ton dashboard est revenu en état non connecté.</p>
          </div>
        )}

        <div data-dashboard-main-area="true" className="relative min-w-0 overflow-x-hidden transition-[margin] duration-200 lg:ml-[84px] lg:flex lg:h-screen lg:flex-col xl:ml-[260px]">
          <div data-dashboard-topbar="global" className={`relative z-50 shrink-0 border-b border-white/[0.075] bg-[linear-gradient(180deg,rgba(3,8,20,0.94),rgba(4,9,20,0.88))] px-5 shadow-[0_22px_70px_-58px_rgba(15,23,42,0.95),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl min-[1440px]:px-6 min-[1680px]:px-8 ${showOverview ? 'hidden' : 'hidden min-[1024px]:block'}`}>
            <DashboardTopBar user={dashboard.user} states={visibleStates} tiktokConnection={visibleTikTokConnection} onManageTikTok={() => setManagerOpen(true)} pathname={pathname} />
          </div>

          <div data-dashboard-content="true" className="relative mx-auto w-full min-w-0 max-w-[1180px] px-4 pb-8 pt-5 sm:px-5 md:px-6 lg:px-8 min-[1024px]:mx-0 min-[1024px]:max-w-none min-[1024px]:flex-1 min-[1024px]:overflow-y-auto min-[1024px]:overscroll-contain min-[1024px]:px-5 min-[1024px]:pb-7 min-[1024px]:pt-4 min-[1440px]:px-6 min-[1680px]:px-8">
            {showOverview ? (
              <>
                <MobileOverviewDashboard dashboard={dashboard} states={visibleStates} tiktokConnection={visibleTikTokConnection} />

                <DesktopOverviewDashboard
                  dashboard={dashboard}
                  states={visibleStates}
                  tiktokConnection={visibleTikTokConnection}
                  onManageTikTok={() => setManagerOpen(true)}
                />
              </>
            ) : children}
          </div>
        </div>
      </div>
    </main>
  );
}

export default DashboardV2Client;
