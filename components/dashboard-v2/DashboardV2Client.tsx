'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DashboardData, DashboardInsight, DashboardRecommendation, DashboardTopVideo } from '@/lib/dashboard-data';
import TikTokConnectModal from '@/components/dashboard-v2/TikTokConnectModal';
import { TikTokConnectionManager } from '@/components/dashboard-v2/TikTokConnectionManager';
import { TikTokConnectedSuccessModal } from '@/components/dashboard-v2/TikTokConnectedSuccessModal';

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

const NAV_ITEMS: { label: string; href: string; icon: IconName; badge?: string }[] = [
  { label: "Vue d'ensemble", href: '/dashboard', icon: 'home' },
  { label: 'Analyses', href: '/dashboard/analyze', icon: 'analysis' },
  { label: 'Insights IA', href: '/dashboard/insights', icon: 'insights' },
  { label: 'Générateur de hooks', href: '/dashboard/hooks', icon: 'pen' },
  { label: 'Rewrite / V2', href: '/dashboard/rewrite', icon: 'hook' },
  { label: 'Publication', href: '/dashboard/share', icon: 'share' },
  { label: 'Radar tendances', href: '/dashboard/radar', icon: 'radar' },
  { label: 'Bibliothèque contenu', href: '/dashboard/library', icon: 'folder' },
  { label: 'Collections', href: '/dashboard/collections', icon: 'box' },
  { label: 'Concurrents', href: '/dashboard/competitors', icon: 'users' },
  { label: 'Alertes', href: '/dashboard/alerts', icon: 'bell', badge: 'Nouveau' },
  { label: 'Exports', href: '/dashboard/exports', icon: 'export' },
  { label: 'Nouveautés', href: '/dashboard/updates', icon: 'rocket' },
  { label: 'Support / Contact', href: '/dashboard/support', icon: 'message' },
  { label: 'Paramètres', href: '/dashboard/settings', icon: 'settings' },
  { label: 'Abonnement', href: '/dashboard/billing', icon: 'crown' },
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
    <div className={`${small ? 'h-8 w-8 rounded-[9px]' : 'h-10 w-10 rounded-[11px]'} relative flex shrink-0 items-center justify-center overflow-hidden border border-[#9b5cff]/35 bg-[radial-gradient(circle_at_30%_20%,rgba(244,114,255,0.42),rgba(88,50,178,0.16)_48%,rgba(10,14,32,0.96)_100%)] shadow-[0_0_26px_rgba(154,92,255,0.34),inset_0_1px_0_rgba(255,255,255,0.18)]`}>
      <span className={`${small ? 'text-[24px]' : 'text-[30px]'} font-black leading-none text-white drop-shadow-[0_0_12px_rgba(232,121,249,0.82)]`}>V</span>
      <span className="absolute bottom-1 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-fuchsia-300/70 blur-[4px]" />
    </div>
  );
}

function DashboardNav({ onSelect }: { onSelect?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
        <Link
          key={item.href}
          href={item.href}
          className={`group flex h-[43px] w-full items-center gap-3 rounded-[7px] px-3 text-left text-[14px] font-medium transition ${
            active
              ? 'border border-[#8b5cf6]/35 bg-[linear-gradient(90deg,rgba(124,58,237,0.9),rgba(76,29,149,0.42))] text-white shadow-[0_0_34px_-10px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.12)]'
              : 'text-slate-300/92 hover:bg-white/[0.035] hover:text-white'
          }`}
          onClick={onSelect}
        >
          <Icon name={item.icon} className={`h-[18px] w-[18px] ${active ? 'text-white' : 'text-slate-300/86 group-hover:text-violet-200'}`} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && <span className="rounded-[5px] bg-[#4c1d95] px-2 py-0.5 text-[10px] font-bold text-violet-100">{item.badge}</span>}
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

function ProfileCard({ user }: { user: DashboardData['user'] }) {
  return (
    <div className="flex min-h-[104px] items-center gap-3 rounded-[9px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(7,12,24,0.98))] px-4 py-4">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_45%_28%,#ffd6b0,#b46a45_50%,#162032_51%)]">
        <div className="absolute left-[13px] top-[11px] h-3 w-3 rounded-full bg-[#1b1110]" />
        <div className="absolute right-[13px] top-[11px] h-3 w-3 rounded-full bg-[#1b1110]" />
        <div className="absolute bottom-0 left-0 h-5 w-full bg-[#182237]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-white">{user.name}</div>
        <div className="mt-1 truncate text-[11px] text-slate-400">{user.email}</div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-violet-200">
          <span>Plan {user.planLabel}</span>
          <span className="rounded-[5px] bg-[#51219a] px-2 py-0.5 text-[10px] font-black">{user.planLabel}</span>
        </div>
      </div>
      <Icon name="chevron" className="h-4 w-4 rotate-90 text-slate-400" />
    </div>
  );
}

function Sidebar({ user }: { user: DashboardData['user'] }) {
  return (
    <aside data-dashboard-sidebar="desktop" className="fixed inset-y-0 left-0 z-20 hidden w-[260px] flex-col border-r border-white/[0.065] bg-[linear-gradient(180deg,rgba(3,8,20,0.985),rgba(2,5,12,0.998))] shadow-[28px_0_90px_-46px_rgba(109,40,217,0.68)] min-[1280px]:flex">
      <div className="flex h-[76px] items-center gap-3 px-6">
        <div className="text-[38px] font-black leading-none text-[#8b5cff] drop-shadow-[0_0_18px_rgba(124,58,237,0.75)]">ϟ</div>
        <div className="text-[24px] font-black tracking-[-0.04em] text-white">Viralynz</div>
        <span className="ml-auto rounded-[6px] bg-[#6d28d9] px-2 py-1 text-[11px] font-black text-white shadow-[0_0_22px_rgba(124,58,237,0.55)]">{user.planLabel}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1">
        <DashboardNav />
      </div>

      <div className="space-y-4 px-5 pb-6 pt-2">
        <PlanUsageCard user={user} />
        <ProfileCard user={user} />
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
          <span className="shrink-0 rounded-[5px] border border-amber-200/16 bg-amber-200/[0.07] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">
            {connection.modeLabel}
          </span>
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

function HeaderDashboard({
  user,
  states,
  tiktokConnection,
  onManageTikTok,
}: {
  user: DashboardData['user'];
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
  onManageTikTok: () => void;
}) {
  return (
    <header className="flex h-[52px] items-start justify-between">
      <div>
        <h1 className="text-[24px] font-semibold leading-[1.05] tracking-[-0.035em] text-white">Bienvenue, {user.name} 👋</h1>
        <p className="mt-2 text-[15px] text-slate-400">Voici ton aperçu de performance</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="flex h-[44px] items-center gap-2 rounded-[8px] border border-white/[0.09] bg-[#071120]/82 px-4 text-[14px] font-medium text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" type="button">
          <Icon name="calendar" className="h-4 w-4 text-slate-300" />
          Période actuelle
          <Icon name="chevron" className="h-3.5 w-3.5 rotate-90 text-slate-500" />
        </button>
        <button className="relative flex h-[44px] w-[44px] items-center justify-center rounded-[8px] border border-white/[0.09] bg-[#071120]/82 text-slate-300" type="button">
          <Icon name="bell" className="h-[17px] w-[17px]" />
          <span className="absolute right-[9px] top-[8px] h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.9)]" />
        </button>
        {states.hasTikTokConnection ? (
          <TikTokConnectedBadge connection={tiktokConnection} onManage={onManageTikTok} />
        ) : (
          <Link href="/api/tiktok/connect" className="flex h-[44px] items-center gap-2 rounded-[8px] border border-cyan-300/18 bg-cyan-300/10 px-4 text-[13px] font-bold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/14">
            <span className="text-[16px] leading-none">♪</span>
            Connecter TikTok
          </Link>
        )}
        <Link href="/dashboard/analyze" className={`flex h-[44px] items-center gap-2 px-5 text-[14px] ${primaryButton}`}>
          <Icon name="plus" className="h-4 w-4" />
          Analyser une vidéo
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
    <header data-mobile-dashboard-header="true" className="sticky top-0 z-40 border-b border-white/[0.065] bg-[#020611]/88 px-4 py-3 backdrop-blur-xl min-[1280px]:hidden">
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={onMenuOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
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
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/75">Plan {user.planLabel}</div>
          </div>
        </div>
        <Link href="/dashboard/analyze" aria-label="Nouvelle analyse" className={`grid h-10 w-10 shrink-0 place-items-center ${primaryButton}`}>
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
    <div data-mobile-dashboard-drawer="true" className={`fixed inset-0 z-[190] min-[1280px]:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
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
          <DashboardNav onSelect={onClose} />
        </div>

        <div className="mt-6 grid gap-3">
          <Link href="/dashboard/analyze" onClick={onClose} className={`flex h-[44px] items-center justify-center gap-2 px-5 text-[14px] ${primaryButton}`}>
            <Icon name="plus" className="h-4 w-4" />
            Analyser une vidéo
          </Link>
          {!states.hasTikTokConnection && (
            <Link href="/api/tiktok/connect" onClick={onClose} className="flex h-[44px] items-center justify-center gap-2 rounded-[9px] border border-cyan-300/18 bg-cyan-300/10 px-4 text-[13px] font-bold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/14">
              <span className="text-[16px] leading-none">â™ª</span>
              Connecter TikTok
            </Link>
          )}
          {states.hasTikTokConnection && <TikTokConnectedBadge connection={tiktokConnection} compact />}
        </div>

        <div className="mt-6 space-y-4">
          <PlanUsageCard user={user} />
          <ProfileCard user={user} />
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
        <p className="mt-2 text-[14px] leading-relaxed text-slate-400 sm:text-[15px]">Voici ton aperçu de performance</p>
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
  delta: string | null;
  note: string;
  icon: IconName;
  tone: 'green' | 'ring';
  score?: number | null;
  real: boolean;
};

function buildKpis(metrics: DashboardData['metrics'], states: DashboardData['states']): KpiItem[] {
  const tikTokNote = states.hasTikTokConnection
    ? 'Permissions performances non activées'
    : 'Connecte TikTok pour relier ton profil';
  const analysisNote = states.hasAnalyses
    ? 'calculé depuis tes analyses'
    : 'analyse ta première vidéo';

  return [
    { label: 'Vues totales', value: metrics.totalViews, delta: null, note: states.hasTikTokMetrics ? 'données TikTok importées' : tikTokNote, icon: 'analysis', tone: 'green', real: states.hasTikTokMetrics },
    { label: "Taux d'engagement", value: metrics.engagementRate, delta: null, note: states.hasTikTokMetrics ? 'données TikTok importées' : tikTokNote, icon: 'clock', tone: 'green', real: states.hasTikTokMetrics },
    { label: 'Temps moyen de visionnage', value: metrics.averageWatchTime, delta: null, note: states.hasTikTokMetrics ? 'données TikTok importées' : tikTokNote, icon: 'info', tone: 'green', real: states.hasTikTokMetrics },
    { label: 'Score viral (moy.)', value: metrics.averageViralScore === null ? '—' : String(metrics.averageViralScore), delta: metrics.viralScoreChange, note: analysisNote, icon: 'target', tone: 'ring', score: metrics.averageViralScore, real: metrics.averageViralScore !== null },
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

function StatCard({ item }: { item: KpiItem }) {
  if (item.tone === 'ring') {
    const score = item.score;
    return (
      <div className={`${shellCard} min-h-[124px] p-4 sm:h-[128px] sm:p-5`}>
        <div className="text-[13px] text-white/88">{item.label}</div>
        <div className="mt-4 flex items-center gap-4">
          <div
            className={`grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full p-[4px] sm:h-[60px] sm:w-[60px] ${score === null ? 'bg-white/[0.07]' : 'shadow-[0_0_30px_rgba(168,85,247,0.42)]'}`}
            style={score === null ? undefined : { background: `conic-gradient(#a855f7 0 ${score}%, rgba(255,255,255,0.07) ${score}% 100%)` }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-[#06101f]">
              <span className="text-[25px] font-bold leading-none tracking-[-0.05em] text-white sm:text-[29px]">{score ?? '—'}</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[18px] text-slate-300">/100 {item.delta && <span className="ml-2 text-[13px] font-semibold text-[#7CFF59]">↗ {item.delta}</span>}</div>
            <div className="mt-1 text-[13px] text-slate-400">{item.note}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shellCard} min-h-[124px] p-4 sm:h-[128px] sm:p-5`}>
      <div className="flex items-center justify-between text-[13px] text-white/88">
        <span>{item.label}</span>
        <Icon name={item.icon} className="h-4 w-4 text-white/80" />
      </div>
      <div className="mt-4 flex items-end gap-3">
        <div className={`text-[29px] font-semibold leading-none tracking-[-0.045em] sm:text-[33px] ${item.real ? 'text-white' : 'text-slate-500'}`}>{item.value}</div>
        {item.delta && <div className="pb-1 text-[14px] font-semibold text-[#7CFF59]">↗ {item.delta}</div>}
      </div>
      <div className="mt-2 text-[13px] text-slate-400">{item.note}</div>
      {item.real && <Sparkline />}
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

function KpiGrid({ metrics, states }: { metrics: DashboardData['metrics']; states: DashboardData['states'] }) {
  const kpis = buildKpis(metrics, states);
  return (
    <section data-dashboard-kpi-grid="true" className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 min-[1280px]:grid-cols-[repeat(4,minmax(0,1fr))_minmax(200px,0.95fr)] min-[1440px]:grid-cols-[repeat(4,minmax(0,1fr))_minmax(250px,1.05fr)] min-[1680px]:grid-cols-[repeat(4,minmax(0,1fr))_minmax(330px,1.22fr)] min-[1680px]:gap-4">
      {kpis.map((item) => <StatCard key={item.label} item={item} />)}
      <OpportunityCard metrics={metrics} className="min-[420px]:col-span-2 lg:col-span-1 min-[1280px]:col-span-1 min-[1680px]:col-span-1" />
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
      <div className="absolute right-[58px] top-[96px] grid h-[50px] w-[50px] place-items-center rounded-full bg-black/48 text-white backdrop-blur-md shadow-[0_12px_34px_rgba(0,0,0,0.42)] sm:right-[62px] sm:top-[138px] sm:h-[58px] sm:w-[58px]">
        <Icon name="play" className="h-6 w-6 sm:h-7 sm:w-7" />
      </div>
      <div className="absolute right-2.5 top-[92px] flex flex-col items-center gap-3 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] sm:top-[134px] sm:gap-4">
        <div className="text-center">
          <Icon name="heart" className="mx-auto h-6 w-6" />
          <div className="mt-1 text-[9px] font-bold">{latestVideo.likes}</div>
        </div>
        <div className="text-center">
          <Icon name="message" className="mx-auto h-5 w-5" />
          <div className="mt-1 text-[9px] font-bold">{latestVideo.comments}</div>
        </div>
        <div className="text-center">
          <Icon name="share" className="mx-auto h-5 w-5" />
          <div className="mt-1 text-[9px] font-bold">{latestVideo.shares}</div>
        </div>
      </div>
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
      <div className="h-[198px] overflow-hidden rounded-[10px] border border-white/[0.08] shadow-[0_18px_48px_-28px_rgba(124,58,237,0.62)] sm:h-[254px]">
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
          {score ?? '—'}<span className="text-[8.5px] text-slate-400">/100</span>
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
  return (
    <aside className={`${shellCard} min-h-[380px] p-4 sm:h-[488px] sm:p-5`}>
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_88%_14%,rgba(124,58,237,.24),transparent_23%),linear-gradient(rgba(139,92,246,.13)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.13)_1px,transparent_1px)] [background-size:100%_100%,36px_36px,36px_36px]" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-semibold text-white">Insights IA</h2>
          <span className="rounded-[5px] bg-[#4c1d95] px-2.5 py-0.5 text-[11px] font-bold text-violet-100">Nouveau</span>
        </div>
        {!states.hasRealInsights ? (
          <div className="mt-5 min-h-[260px] flex-1 sm:min-h-0">
            <EmptyState
              title={states.hasTikTokConnection ? 'Compte connecté. Analyse une vidéo pour débloquer tes insights.' : 'Analyse ta première vidéo pour débloquer tes insights IA.'}
              message={states.hasTikTokConnection ? 'TikTok est relié. Viralynz attend une vraie vidéo avant d’afficher des décisions de montage.' : 'Aucun score de hook, rétention ou engagement ne sera affiché tant qu’il ne vient pas d’une vraie analyse.'}
              cta="Analyser une vidéo"
              href="/dashboard/analyze"
            />
          </div>
        ) : (
          <>
            <p className="mt-2.5 text-[14.75px] leading-[1.32] text-white">
              Ces signaux viennent de ta dernière analyse Viralynz. Les champs absents restent neutres.
            </p>

            <div className="mt-3 space-y-2">
              {insights.map((item) => {
                const style = insightStyleByType[item.type];
                return (
                <div key={item.title} className="flex min-h-[58px] items-center gap-3 rounded-[10px] border border-white/[0.065] bg-white/[0.035] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full" style={{ background: `${style.color}22`, color: style.color }}>
                    <Icon name={style.icon} className="h-[16px] w-[16px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.6px] font-semibold leading-tight text-white">{item.title}</div>
                    <p className="mt-1 line-clamp-2 text-[12.25px] leading-[1.36] text-slate-300/92">{item.description}</p>
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

  return (
    <div className={`${shellCard} min-h-[226px] p-4 sm:h-[244px] sm:p-5`}>
      <SectionTitle>Potentiel viral</SectionTitle>
      {score === null ? (
        <div className="mt-4 min-h-[150px] sm:h-[165px]">
          <EmptyState
            title="À débloquer"
            message={states.hasAnalyses ? 'Aucun score viral exploitable dans tes analyses actuelles.' : 'Analyse ta première vidéo pour débloquer cette métrique.'}
            cta="Analyser une vidéo"
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
                  <div className="text-[12.25px] font-medium leading-none text-slate-200">Score moyen</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-2.5 text-center text-[12.75px] leading-none text-slate-400">Basé sur tes analyses Viralynz</div>
          <div className="mt-3 flex justify-center">
            <span className="rounded-[7px] border border-fuchsia-400/12 bg-[#2e0f59] px-3 py-1 text-[12px] font-semibold leading-none text-fuchsia-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">Aucune portée inventée</span>
          </div>
        </>
      )}
    </div>
  );
}

function EmotionalCurveCard({ states }: { states: DashboardData['states'] }) {
  return (
    <div className={`${shellCard} min-h-[226px] p-4 sm:h-[244px] sm:p-5`}>
      <SectionTitle>Courbe émotionnelle</SectionTitle>
      <div className="mt-4 min-h-[150px] sm:h-[165px]">
        <EmptyState
          title="Aucune courbe réelle"
          message={states.hasAnalyses ? 'Cette analyse ne contient pas de signaux émotionnels mesurables.' : 'Analyse une vidéo pour détecter les moments émotionnels.'}
          cta="Analyser une vidéo"
          href="/dashboard/analyze"
        />
      </div>
    </div>
  );
}

function ContentPillarsCard({ states }: { states: DashboardData['states'] }) {
  return (
    <div className={`${shellCard} min-h-[226px] p-4 sm:h-[244px] sm:p-5`}>
      <SectionTitle>Performance des piliers de contenu</SectionTitle>
      <div className="mt-4 min-h-[150px] sm:h-[165px]">
        <EmptyState
          title="Catégories à construire"
          message={states.hasAnalyses ? 'Il faut plus de données réelles pour classer tes piliers de contenu.' : 'Les catégories apparaîtront après plusieurs analyses.'}
          cta="Analyser une vidéo"
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

  return (
    <aside className={`${shellCard} min-h-[292px] p-4 sm:h-[318px] sm:p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-white">Vidéos les plus performantes</h2>
        <button className="rounded-[6px] px-2 py-1 text-[12.5px] font-medium text-fuchsia-300 transition hover:bg-fuchsia-400/10 hover:text-fuchsia-200" type="button">Voir tout</button>
      </div>
      {!states.hasTikTokConnection ? (
        <div className="mt-4 min-h-[218px] sm:h-[242px]">
          <EmptyState
            title="Connecte TikTok"
            message="Relie ton profil TikTok à Viralynz. Les vidéos demandent des permissions avancées."
            cta="Connecter TikTok"
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
            <div className="grid h-10 w-10 place-items-center rounded-full border border-green-400/45 bg-green-400/10 text-[13px] font-semibold text-green-300">{video.score}</div>
            <div className="w-[52px] text-right text-[11.75px] leading-tight text-slate-300">
              <div>{video.views}</div>
              <div className="text-slate-500">vues</div>
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
  return (
    <section className={`${shellCard} min-h-[176px] p-4`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[470px] bg-[radial-gradient(circle_at_18%_40%,rgba(124,58,237,0.22),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(232,121,249,0.42),transparent)]" />
      <div className="flex h-full flex-col gap-4 min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:gap-5">
        <div className="hidden min-[1180px]:block">
          <BotMascot />
        </div>
        <div className="relative w-full shrink-0 min-[1180px]:w-[226px]">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Recommandations</h2>
            <Icon name="info" className="h-[13px] w-[13px] text-slate-400" />
          </div>
          <p className="mt-2 text-[13.5px] leading-[1.45] text-slate-300 min-[1180px]:mt-3">{context}</p>
        </div>
        <div className="relative grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 min-[1180px]:grid-cols-4 min-[1180px]:gap-3.5">
          {recommendations.map((item, index) => {
            const style = recommendationStyles[index] ?? recommendationStyles[0];
            return (
            <div key={item.title} className={`${softPanel} flex min-h-[136px] flex-col border-white/[0.095] bg-white/[0.048] p-3.5 min-[1180px]:h-[144px]`}>
              <div className="flex items-center gap-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br ${style.tone} text-white shadow-[0_12px_28px_-14px_rgba(124,58,237,0.88)]`}>
                  <Icon name={style.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 text-[13.5px] font-bold leading-tight text-white">{item.title}</div>
              </div>
              <p className={`mt-2.5 flex-1 text-[12.05px] leading-[1.38] ${item.locked ? 'text-slate-500' : 'text-slate-300/92'}`}>{item.description}</p>
              {item.locked || !states.hasAnalyses ? (
              <Link href="/dashboard/analyze" className="mt-2 flex h-[30px] w-full items-center justify-center rounded-[8px] border border-white/[0.08] bg-white/[0.05] text-[11.85px] font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                  Analyser une vidéo
                </Link>
              ) : (
                <button className={`mt-2 h-[30px] w-full text-[11.85px] ${primaryButton}`} type="button">{item.cta}</button>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </section>
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
        hasRealTopVideos: false,
      }
    : dashboard.states;

  const visibleTikTokConnection = locallyDisconnected
    ? {
        ...dashboard.tiktokConnection,
        connected: false,
        displayName: null,
        avatarUrl: null,
        connectedAt: null,
        scopes: [],
        hasAdvancedMetrics: false,
      }
    : dashboard.tiktokConnection;
  const showOverview = pathname === '/dashboard';

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
      className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden bg-[#020611] font-sans text-white antialiased"
    >
      <div className="relative min-h-screen w-full min-w-0 overflow-x-hidden bg-[radial-gradient(ellipse_75%_52%_at_51%_-18%,rgba(56,189,248,0.08),transparent_58%),radial-gradient(ellipse_58%_44%_at_92%_8%,rgba(124,58,237,0.18),transparent_58%),linear-gradient(180deg,#020611_0%,#030711_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.018] [background-image:linear-gradient(rgba(255,255,255,.75)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.75)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="pointer-events-none absolute left-[260px] top-0 hidden h-full w-px bg-white/[0.02] min-[1280px]:block" />
        <MobileDashboardHeader user={dashboard.user} onMenuOpen={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} user={dashboard.user} states={visibleStates} tiktokConnection={visibleTikTokConnection} />
        <Sidebar user={dashboard.user} />
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

        <div data-dashboard-content="true" className="relative mx-auto w-full min-w-0 max-w-[1180px] px-4 pb-8 pt-5 sm:px-5 md:px-6 lg:px-8 min-[1280px]:ml-[260px] min-[1280px]:mr-0 min-[1280px]:w-[calc(100%-260px)] min-[1280px]:max-w-none min-[1280px]:px-6 min-[1280px]:py-5 min-[1440px]:px-8 min-[1680px]:px-9">
          <div className="hidden min-[1280px]:block">
            <HeaderDashboard user={dashboard.user} states={visibleStates} tiktokConnection={visibleTikTokConnection} onManageTikTok={() => setManagerOpen(true)} />
          </div>
          {showOverview ? (
            <>
              <ResponsiveIntro user={dashboard.user} states={visibleStates} tiktokConnection={visibleTikTokConnection} />
              <KpiGrid metrics={dashboard.metrics} states={visibleStates} />

              <section data-dashboard-main-grid="true" className="mt-3.5 grid grid-cols-1 gap-3.5 min-[1280px]:grid-cols-[minmax(0,1fr)_320px] min-[1440px]:grid-cols-[minmax(0,1fr)_390px] min-[1680px]:grid-cols-[minmax(0,1fr)_430px]">
                <div className="min-w-0 space-y-3.5">
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 min-[1680px]:grid-cols-[minmax(0,1fr)_290px]">
                    <RetentionChartCard retention={dashboard.retention} states={visibleStates} cta={dashboard.analysisCta} />
                    <VideoPreviewCard latestVideo={dashboard.latestVideo} states={visibleStates} cta={dashboard.analysisCta} />
                  </div>

                  <div className="min-[1280px]:hidden">
                    <InsightsIACard insights={dashboard.insights} cta={dashboard.analysisCta} states={visibleStates} />
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 min-[1680px]:grid-cols-[250px_minmax(0,1fr)_360px]">
                    <ViralPotentialCard metrics={dashboard.metrics} states={visibleStates} />
                    <EmotionalCurveCard states={visibleStates} />
                    <ContentPillarsCard states={visibleStates} />
                  </div>

                  <RecommendationsSection recommendations={dashboard.recommendations} context={dashboard.metrics.recommendationsContext} states={visibleStates} />

                  <div className="min-[1280px]:hidden">
                    <TopVideosCard videos={dashboard.topVideos} states={visibleStates} />
                  </div>
                </div>

                <div data-dashboard-right-rail="true" className="hidden min-w-0 space-y-3.5 min-[1280px]:block">
                  <InsightsIACard insights={dashboard.insights} cta={dashboard.analysisCta} states={visibleStates} />
                  <TopVideosCard videos={dashboard.topVideos} states={visibleStates} />
                </div>
              </section>
            </>
          ) : children}
        </div>
      </div>
    </main>
  );
}

export default DashboardV2Client;
