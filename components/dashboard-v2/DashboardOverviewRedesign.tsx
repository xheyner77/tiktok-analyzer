'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DashboardData } from '@/lib/dashboard-data';

type IconName =
  | 'home'
  | 'analysis'
  | 'spark'
  | 'target'
  | 'clock'
  | 'eye'
  | 'hook'
  | 'play'
  | 'chevron'
  | 'settings'
  | 'radar'
  | 'users'
  | 'shield'
  | 'message'
  | 'pen'
  | 'share'
  | 'crown';

type OverviewProps = {
  dashboard: DashboardData;
  states: DashboardData['states'];
  tiktokConnection: DashboardData['tiktokConnection'];
  onManageTikTok: () => void;
};

const card =
  'relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(10,17,34,0.9),rgba(5,9,20,0.96)_64%,rgba(4,7,15,0.98))] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.065)] backdrop-blur-xl';

const mutedCard =
  'relative overflow-hidden rounded-[16px] border border-white/[0.07] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]';

const primaryCta =
  'inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[linear-gradient(135deg,#22d3ee_0%,#6d5dfc_48%,#bd34fe_100%)] px-5 text-[0.9rem] font-black text-white shadow-[0_18px_44px_-24px_rgba(34,211,238,0.85),0_0_28px_-18px_rgba(168,85,247,0.9)] transition hover:brightness-110 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-cyan-200/35';

const secondaryCta =
  'inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-white/[0.09] bg-white/[0.045] px-5 text-[0.9rem] font-black text-slate-100 transition hover:border-cyan-200/20 hover:bg-white/[0.065] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-violet-200/25';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  const stroke = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'home') return <svg {...stroke}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === 'analysis') return <svg {...stroke}><path d="M4 19V5" /><path d="M8 17V9" /><path d="M12 17V4" /><path d="M16 17v-6" /><path d="M20 17V7" /></svg>;
  if (name === 'spark') return <svg {...stroke}><path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" /></svg>;
  if (name === 'target') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>;
  if (name === 'clock') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'eye') return <svg {...stroke}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (name === 'hook') return <svg {...stroke}><path d="M18 8a6 6 0 1 0-12 0v8a4 4 0 0 0 8 0v-1" /><path d="M14 15h4" /></svg>;
  if (name === 'play') return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M8 5.2v13.6c0 .82.92 1.3 1.58.82l9.47-6.8a1 1 0 0 0 0-1.64L9.58 4.38C8.92 3.9 8 4.38 8 5.2Z" /></svg>;
  if (name === 'chevron') return <svg {...stroke}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'settings') return <svg {...stroke}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
  if (name === 'radar') return <svg {...stroke}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 12 18 6" /><path d="M12 4v2" /><path d="M20 12h-2" /><path d="M4 12h2" /></svg>;
  if (name === 'users') return <svg {...stroke}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === 'shield') return <svg {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === 'message') return <svg {...stroke}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /></svg>;
  if (name === 'pen') return <svg {...stroke}><path d="m15.5 5.5 3 3" /><path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /></svg>;
  if (name === 'share') return <svg {...stroke}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v14" /></svg>;
  if (name === 'crown') return <svg {...stroke}><path d="m3 8 4 4 5-8 5 8 4-4v10H3V8Z" /><path d="M3 18h18" /></svg>;
  return null;
}

function SectionTitle({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-cyan-200/62">{eyebrow}</p> : null}
        <h2 className="truncate text-[1.06rem] font-black tracking-[-0.02em] text-white min-[1024px]:text-[1.15rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function LogoMark() {
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-violet-300/20 bg-[#050816] shadow-[0_0_24px_-14px_rgba(124,58,237,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]">
      <Image src="/viralynz-logo-1024.png" alt="" width={36} height={36} className="h-full w-full object-cover" priority />
    </span>
  );
}

function clampScore(score: number | null) {
  if (score === null || !Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreTone(score: number | null) {
  if (score === null) return 'text-slate-300';
  if (score >= 75) return 'text-emerald-200';
  if (score >= 55) return 'text-cyan-200';
  return 'text-amber-200';
}

function initialsFrom(value: string | null | undefined) {
  const source = value?.trim() || 'TikTok';
  return source.slice(0, 2).toUpperCase();
}

function Header({ dashboard }: { dashboard: DashboardData }) {
  const remaining = dashboard.overview.plan.quotaAnalyses.remaining;
  const quotaLabel = remaining === null ? 'Analyses illimit?es' : `${remaining} analyse${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`;

  return (
    <header className="pt-[max(18px,env(safe-area-inset-top))] min-[1024px]:pt-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark />
          <div className="min-w-0">
            <p className="truncate text-[0.78rem] font-black uppercase tracking-[0.16em] text-slate-500">Viralynz</p>
            <p className="truncate text-[0.86rem] font-bold text-slate-300">{dashboard.user.planLabel}</p>
          </div>
        </div>
        <Link href="/dashboard/analyze" className="hidden h-10 items-center justify-center gap-2 rounded-[11px] border border-cyan-200/18 bg-cyan-300/9 px-3 text-[0.8rem] font-black text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] min-[360px]:inline-flex">
          <Icon name="spark" className="h-4 w-4" />
          Analyser
        </Link>
      </div>
      <div className="mt-7 min-[1024px]:mt-0 min-[1024px]:flex min-[1024px]:items-end min-[1024px]:justify-between min-[1024px]:gap-8">
        <div>
          <h1 className="text-[2.18rem] font-black leading-[0.96] tracking-[-0.055em] text-white min-[390px]:text-[2.36rem] min-[1024px]:text-[2.55rem]">Vue d&apos;ensemble</h1>
          <p className="mt-2 max-w-[520px] text-[0.98rem] font-medium leading-6 text-slate-300/82 min-[1024px]:text-[1rem]">Tes meilleures actions IA du jour, sans m?trique invent?e.</p>
        </div>
        <div className="mt-4 hidden items-center gap-2 rounded-[12px] border border-white/[0.075] bg-white/[0.035] px-3 py-2 text-[0.78rem] font-bold text-slate-300 min-[1024px]:flex">
          <Icon name="shield" className="h-4 w-4 text-cyan-200" />
          {quotaLabel}
        </div>
      </div>
    </header>
  );
}

function HeroCard({ dashboard, states }: { dashboard: DashboardData; states: DashboardData['states'] }) {
  const hero = dashboard.overview.heroOpportunity;
  const score = clampScore(hero.score);
  const hasAnalysis = states.hasLatestAnalysis;
  const primaryHref = hasAnalysis ? '/dashboard/rewrite' : hero.href;
  const primaryLabel = hasAnalysis ? 'Pr?parer la V2' : hero.ctaLabel;
  const secondaryHref = hasAnalysis ? hero.href : '/api/tiktok/connect?review=1';
  const secondaryLabel = hasAnalysis ? "Voir l'analyse" : 'Connecter TikTok';

  return (
    <section className={cn(card, 'mt-5 border-cyan-200/14 p-5 min-[1024px]:mt-0 min-[1024px]:min-h-[360px] min-[1024px]:p-7')}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_0%,rgba(34,211,238,0.12),transparent_46%),radial-gradient(ellipse_at_96%_8%,rgba(168,85,247,0.14),transparent_45%),linear-gradient(135deg,rgba(14,165,233,0.07),transparent_48%)]" />
      <div className="pointer-events-none absolute right-5 top-5 hidden h-40 w-40 rotate-6 rounded-[28px] border border-cyan-200/16 bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] min-[390px]:block min-[1024px]:right-8 min-[1024px]:top-8 min-[1024px]:h-52 min-[1024px]:w-52" />
      <div className="pointer-events-none absolute right-12 top-16 hidden h-14 w-14 place-items-center rounded-[18px] border border-cyan-200/24 bg-cyan-300/10 text-cyan-100 shadow-[0_0_36px_-18px_rgba(34,211,238,0.9)] min-[390px]:grid min-[1024px]:right-24 min-[1024px]:top-24 min-[1024px]:h-20 min-[1024px]:w-20">
        <Icon name="play" className="h-7 w-7 min-[1024px]:h-10 min-[1024px]:w-10" />
      </div>

      <div className="relative max-w-[310px] min-[1024px]:max-w-[580px]">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] border border-violet-200/18 bg-violet-400/12 text-violet-100">
            <Icon name="target" className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-violet-100/78">
            {hasAnalysis ? 'Action prioritaire' : 'Cockpit en attente'}
          </span>
        </div>

        <div className="mt-5 flex items-end gap-2">
          <span
            className={cn(
              'text-[4.35rem] font-black leading-none tracking-[-0.085em] min-[1024px]:text-[5.6rem]',
              score === null
                ? 'text-slate-300'
                : 'bg-[linear-gradient(135deg,#dffaff_0%,#67e8f9_35%,#8b5cf6_86%)] bg-clip-text text-transparent',
            )}
          >
            {score === null ? '?' : score}
          </span>
          <span className="pb-2 text-[1.7rem] font-black leading-none tracking-[-0.04em] text-slate-300 min-[1024px]:pb-3 min-[1024px]:text-[2.2rem]">/100</span>
        </div>
        <p className="mt-1 text-[0.78rem] font-black uppercase tracking-[0.16em] text-slate-500">
          {score === null ? 'Score disponible apr?s analyse' : 'Score de repost'}
        </p>

        <div className="mt-5 max-w-[540px]">
          <p className="text-[0.82rem] font-black uppercase tracking-[0.16em] text-cyan-200/72">Meilleure opportunit?</p>
          <h2 className="mt-1 text-[1.24rem] font-black leading-[1.1] tracking-[-0.025em] text-white min-[1024px]:text-[1.55rem]">
            {hasAnalysis ? hero.title : 'Aucune opportunit? d?tect?e sans analyse'}
          </h2>
          <p className="mt-3 text-[0.93rem] font-medium leading-6 text-slate-200/86 min-[1024px]:max-w-[500px] min-[1024px]:text-[1rem]">{hero.description}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row min-[1024px]:mt-7">
          <Link href={primaryHref} className={cn(primaryCta, 'w-full sm:w-auto')}>
            {primaryLabel}
            <Icon name="chevron" className="h-[18px] w-[18px]" />
          </Link>
          <Link href={secondaryHref} className={cn(secondaryCta, 'w-full sm:w-auto')}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

function MissionCard({ items }: { items: string[] }) {
  const visible = items.slice(0, 3);

  return (
    <section className={cn(card, 'mt-4 p-4 min-[1024px]:mt-0 min-[1024px]:p-5')}>
      <SectionTitle title="Mission du jour" eyebrow="3 actions maximum" />
      <div className="grid gap-3">
        {visible.map((item, index) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] border border-violet-200/18 bg-violet-400/12 text-[0.74rem] font-black text-violet-100">
              {index + 1}
            </span>
            <p className="min-w-0 text-[0.92rem] font-semibold leading-5 text-slate-100/92">{item}</p>
          </div>
        ))}
      </div>
      <Link href="/dashboard/analyze" className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-white/[0.08] bg-white/[0.045] px-3 text-[0.8rem] font-black text-slate-100 transition hover:bg-white/[0.065]">
        Lancer un diagnostic
        <Icon name="chevron" className="h-4 w-4 text-slate-400" />
      </Link>
    </section>
  );
}

function KpiIcon({ id }: { id: DashboardData['overview']['kpis'][number]['id'] }) {
  const icon: Record<DashboardData['overview']['kpis'][number]['id'], IconName> = {
    views: 'eye',
    retention: 'clock',
    hooks: 'hook',
    repostScore: 'target',
  };
  return <Icon name={icon[id]} className="h-[18px] w-[18px]" />;
}

function KpiBoard({ kpis }: { kpis: DashboardData['overview']['kpis'] }) {
  return (
    <section className={cn(card, 'mt-4 p-4 min-[1024px]:mt-0 min-[1024px]:p-5')}>
      <SectionTitle title="Signaux cl?s" eyebrow="Donn?es disponibles" />
      <div className="grid grid-cols-2 border-t border-white/[0.07]">
        {kpis.map((kpi, index) => (
          <div
            key={kpi.id}
            className={cn(
              'min-h-[104px] px-1 py-4',
              index % 2 === 0 ? 'pr-3' : 'border-l border-white/[0.07] pl-3',
              index > 1 && 'border-t border-white/[0.07]',
            )}
          >
            <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-[10px] border', kpi.available ? 'border-cyan-200/18 bg-cyan-300/10 text-cyan-100' : 'border-white/[0.08] bg-white/[0.035] text-slate-500')}>
              <KpiIcon id={kpi.id} />
            </div>
            <p className="truncate text-[0.74rem] font-bold text-slate-400">{kpi.label}</p>
            <p className={cn('mt-1 text-[1.42rem] font-black leading-none tracking-[-0.04em]', kpi.available ? 'text-white' : 'text-slate-400')}>{kpi.value}</p>
            <p className={cn('mt-2 line-clamp-1 text-[0.72rem] font-bold', kpi.available ? 'text-emerald-200/86' : 'text-slate-500')}>{kpi.trendLabel ?? kpi.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function VideoThumb({ video, index }: { video: DashboardData['overview']['recentAnalyses'][number]; index: number }) {
  if (video.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={video.thumbnailUrl} alt="" className="h-16 w-20 shrink-0 rounded-[12px] object-cover min-[390px]:w-24 min-[1024px]:h-[74px] min-[1024px]:w-[108px]" />;
  }

  const tone = index % 2 === 0
    ? 'from-cyan-400/18 via-violet-500/20 to-fuchsia-400/12'
    : 'from-violet-400/22 via-blue-500/16 to-cyan-300/14';

  return (
    <div className={cn('relative h-16 w-20 shrink-0 overflow-hidden rounded-[12px] border border-white/[0.08] bg-gradient-to-br min-[390px]:w-24 min-[1024px]:h-[74px] min-[1024px]:w-[108px]', tone)}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.32))]" />
      <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/34 text-white backdrop-blur-sm">
        <Icon name="play" className="h-4 w-4" />
      </div>
      {video.durationLabel ? <span className="absolute bottom-1.5 right-1.5 rounded-[6px] bg-black/70 px-1.5 py-0.5 text-[0.64rem] font-black text-white">{video.durationLabel}</span> : null}
    </div>
  );
}

function AnalysisRow({ video, index }: { video: DashboardData['overview']['recentAnalyses'][number]; index: number }) {
  const score = clampScore(video.score);
  const badgeClass = video.badgeTone === 'success'
    ? 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100'
    : video.badgeTone === 'warning'
      ? 'border-amber-300/18 bg-amber-300/10 text-amber-100'
      : video.badgeTone === 'danger'
        ? 'border-rose-300/18 bg-rose-300/10 text-rose-100'
        : 'border-cyan-300/16 bg-cyan-300/9 text-cyan-100';

  return (
    <Link href={video.href} className={cn(mutedCard, 'flex min-h-[92px] items-center gap-3 p-3 transition hover:border-cyan-200/16 hover:bg-white/[0.05] active:scale-[0.99]')}>
      <VideoThumb video={video} index={index} />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[0.9rem] font-black leading-5 text-white min-[1024px]:text-[0.95rem]">{video.title}</h3>
        <p className="mt-1 text-[0.72rem] font-semibold text-slate-500">{video.createdAtLabel}</p>
        <span className={cn('mt-2 inline-flex h-6 items-center rounded-[7px] border px-2 text-[0.66rem] font-black', badgeClass)}>{video.badgeLabel}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={cn('text-[1rem] font-black leading-none', scoreTone(score))}>{score === null ? '?' : score}</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.12em] text-slate-500">Voir</span>
      </div>
      <Icon name="chevron" className="h-[18px] w-[18px] shrink-0 text-slate-500" />
    </Link>
  );
}

function RecentAnalyses({ dashboard, states, limit }: { dashboard: DashboardData; states: DashboardData['states']; limit: number }) {
  const analyses = dashboard.overview.recentAnalyses.slice(0, limit);

  return (
    <section className="mt-5 min-[1024px]:mt-0">
      <SectionTitle
        title="Analyses r?centes"
        eyebrow="Historique utile"
        action={<Link href="/dashboard/library" className="text-[0.78rem] font-black text-violet-200 transition hover:text-white">Voir tout</Link>}
      />
      {states.hasAnalyses && analyses.length > 0 ? (
        <div className="grid gap-2.5">
          {analyses.map((video, index) => <AnalysisRow key={video.id} video={video} index={index} />)}
        </div>
      ) : (
        <div className={cn(card, 'p-5 text-left')}>
          <p className="text-[1rem] font-black text-white">Aucune analyse pour le moment</p>
          <p className="mt-2 text-[0.86rem] leading-5 text-slate-400">Viralynz attend une vraie vid?o avant d?afficher scores, vues ou d?cisions de repost.</p>
          <Link href="/dashboard/analyze" className={cn(primaryCta, 'mt-4 h-11')}>Analyser une vid?o</Link>
        </div>
      )}
    </section>
  );
}

function AiRecommendation({ dashboard }: { dashboard: DashboardData }) {
  const block = dashboard.overview.aiRecommendation;
  const href = block.available ? '/dashboard/rewrite' : '/dashboard/analyze';

  return (
    <section className={cn(card, 'mt-5 border-violet-200/16 p-5 min-[1024px]:mt-0 min-[1024px]:p-6')}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_8%_0%,rgba(168,85,247,0.14),transparent_42%),radial-gradient(ellipse_at_94%_20%,rgba(34,211,238,0.09),transparent_44%)]" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] border border-violet-200/18 bg-violet-400/12 text-violet-100">
            <Icon name="spark" className="h-[18px] w-[18px]" />
          </span>
          <p className="text-[0.7rem] font-black uppercase tracking-[0.17em] text-violet-100/74">{block.available ? 'Copilote de repost' : 'Aucune donn?e invent?e'}</p>
        </div>
        <h2 className="mt-4 text-[1.28rem] font-black leading-tight tracking-[-0.025em] text-white min-[1024px]:text-[1.45rem]">{block.title}</h2>
        <p className="mt-3 max-w-[620px] text-[0.92rem] font-medium leading-6 text-slate-200/86">{block.description}</p>
        <div className="mt-4 grid gap-2.5">
          {block.items.slice(0, 3).map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.68)]" />
              <p className="min-w-0 text-[0.84rem] font-semibold leading-5 text-slate-100/90">{item}</p>
            </div>
          ))}
        </div>
        <Link href={href} className={cn(secondaryCta, 'mt-5 h-11 px-4')}>{block.available ? 'Transformer en V2' : 'Analyser une vid?o'}</Link>
      </div>
    </section>
  );
}

function HooksToTest({ hooks }: { hooks: DashboardData['overview']['hooksToTest'] }) {
  const visibleHooks = hooks.slice(0, 3);
  const toneByIndex = ['text-violet-100 border-violet-200/18 bg-violet-400/12', 'text-cyan-100 border-cyan-200/18 bg-cyan-300/10', 'text-emerald-100 border-emerald-200/18 bg-emerald-300/10'];

  return (
    <section className="mt-5 min-[1024px]:mt-0">
      <SectionTitle
        title="Hooks ? tester"
        eyebrow="Top 3"
        action={<Link href="/dashboard/hooks" className="text-[0.78rem] font-black text-violet-200 transition hover:text-white">Voir tous</Link>}
      />
      {visibleHooks.length > 0 ? (
        <div className="grid gap-2.5">
          {visibleHooks.map((hook, index) => (
            <Link key={hook.id} href={hook.href} className={cn(mutedCard, 'flex min-h-[82px] items-center gap-3 p-3 transition hover:border-violet-200/18 hover:bg-white/[0.05] active:scale-[0.99]')}>
              <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border', toneByIndex[index] ?? toneByIndex[0])}>
                <Icon name={index === 1 ? 'message' : 'hook'} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-[0.9rem] font-black leading-5 text-white">{hook.text}</h3>
                <p className="mt-1 text-[0.72rem] font-black uppercase tracking-[0.1em] text-slate-500">{hook.category || 'Angle ? tester'}</p>
              </div>
              <Icon name="chevron" className="h-[18px] w-[18px] shrink-0 text-slate-500" />
            </Link>
          ))}
        </div>
      ) : (
        <Link href="/dashboard/hooks" className={cn(card, 'flex min-h-[92px] items-center gap-3 p-4 transition active:scale-[0.99]')}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[13px] border border-violet-200/18 bg-violet-400/12 text-violet-100">
            <Icon name="hook" className="h-[22px] w-[22px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.95rem] font-black text-white">Aucun hook g?n?r?</p>
            <p className="mt-1 text-[0.82rem] leading-5 text-slate-400">G?n?re des hooks depuis une analyse ou une id?e ? tester.</p>
          </div>
          <Icon name="chevron" className="h-[18px] w-[18px] shrink-0 text-slate-500" />
        </Link>
      )}
    </section>
  );
}

function WeeklyGoals({ goals }: { goals: DashboardData['overview']['weeklyGoals'] }) {
  return (
    <section className={cn(card, 'mt-5 p-4 min-[1024px]:mt-0 min-[1024px]:p-5')}>
      <SectionTitle title="Objectifs de la semaine" eyebrow="Progression" />
      <div className="grid gap-3.5">
        {goals.map((goal, index) => {
          const bar = index === 0
            ? 'bg-[linear-gradient(90deg,#8b5cf6,#67e8f9)]'
            : index === 1
              ? 'bg-[linear-gradient(90deg,#22d3ee,#7c3aed)]'
              : 'bg-[linear-gradient(90deg,#10b981,#67e8f9)]';
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[0.84rem] font-bold text-slate-200">{goal.label}</p>
                <p className="shrink-0 text-[0.78rem] font-black text-white">{goal.current}/{goal.target}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={cn('h-full rounded-full', bar)} style={{ width: `${goal.percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TikTokAccountCard({
  connection,
  states,
}: {
  connection: DashboardData['tiktokConnection'];
  states: DashboardData['states'];
}) {
  const connected = states.hasTikTokConnection;
  const displayName = connection.displayName?.trim() || 'Compte TikTok';

  if (!connected) {
    return (
      <Link href="/api/tiktok/connect?review=1" className={cn(card, 'mt-5 flex min-h-[104px] items-center gap-3 p-4 transition active:scale-[0.99] min-[1024px]:mt-0')}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-cyan-200/18 bg-cyan-300/10 text-[0.78rem] font-black text-cyan-100">TT</span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.96rem] font-black text-white">Connecter TikTok</p>
          <p className="mt-1 text-[0.8rem] leading-5 text-slate-400">Ajoute tes vraies m?triques au cockpit.</p>
        </div>
        <Icon name="chevron" className="h-[18px] w-[18px] text-slate-500" />
      </Link>
    );
  }

  return (
    <Link href="/dashboard/settings" className={cn(card, 'mt-5 flex min-h-[104px] items-center gap-3 p-4 transition active:scale-[0.99] min-[1024px]:mt-0')}>
      <span className="relative grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-full border border-white/12 bg-white/[0.05] text-[0.78rem] font-black text-white">
        {connection.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={connection.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFrom(displayName)
        )}
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#07101f] bg-emerald-300" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[0.96rem] font-black text-white">{displayName}</p>
          <span className="rounded-[7px] border border-emerald-300/16 bg-emerald-300/10 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-emerald-100">Connect?</span>
        </div>
        <p className="mt-1 line-clamp-1 text-[0.78rem] font-semibold text-slate-400">{connection.lastSyncAt ? dashboardSyncLabel(connection.lastSyncAt) : 'Derni?re sync non disponible'}</p>
      </div>
      <Icon name="chevron" className="h-[18px] w-[18px] text-slate-500" />
    </Link>
  );
}

function dashboardSyncLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Derni?re sync non disponible';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Sync ? l?instant';
  if (minutes < 60) return `Sync il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Sync il y a ${hours} h`;
  return `Sync il y a ${Math.round(hours / 24)} j`;
}

function QuickActions() {
  const actions: Array<{ title: string; href: string; icon: IconName }> = [
    { title: 'Analyser', href: '/dashboard/analyze', icon: 'play' },
    { title: 'Hooks', href: '/dashboard/hooks', icon: 'hook' },
    { title: 'Rewrite', href: '/dashboard/rewrite', icon: 'pen' },
    { title: 'Publier', href: '/dashboard/share', icon: 'share' },
  ];

  return (
    <section className="mt-5 min-[1024px]:mt-0">
      <SectionTitle title="Raccourcis" eyebrow="Acc?s rapides" />
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className={cn(mutedCard, 'flex h-[72px] items-center gap-3 px-3 transition hover:border-cyan-200/14 hover:bg-white/[0.05] active:scale-[0.99]')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-white/[0.08] bg-white/[0.04] text-slate-200">
              <Icon name={action.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 truncate text-[0.86rem] font-black text-white">{action.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PermissionBanner({
  states,
  connection,
  onManageTikTok,
}: {
  states: DashboardData['states'];
  connection: DashboardData['tiktokConnection'];
  onManageTikTok: () => void;
}) {
  if (!states.hasTikTokConnection || (states.hasTikTokVideoPermissions && !connection.needsReconnect)) return null;

  return (
    <section className={cn(card, 'mt-4 flex items-start gap-3 border-amber-200/14 p-4 min-[1024px]:mt-0')}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-amber-200/18 bg-amber-300/10 text-amber-100">
        <Icon name="shield" className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.92rem] font-black text-white">Permissions TikTok ? v?rifier</p>
        <p className="mt-1 text-[0.8rem] leading-5 text-slate-400">Certaines m?triques restent masqu?es tant que les scopes vid?o ne sont pas disponibles.</p>
      </div>
      <button type="button" onClick={onManageTikTok} className="shrink-0 rounded-[10px] border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-[0.74rem] font-black text-slate-100 transition hover:bg-white/[0.065]">
        G?rer
      </button>
    </section>
  );
}

function MobileBottomNav() {
  const items: Array<{ href: string; label: string; icon: IconName; active?: boolean }> = [
    { href: '/dashboard', label: 'Accueil', icon: 'home', active: true },
    { href: '/dashboard/analyze', label: 'Analyser', icon: 'spark' },
    { href: '/dashboard/hooks', label: 'Hooks', icon: 'hook' },
    { href: '/dashboard/settings', label: 'Compte', icon: 'users' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[180] mx-auto w-full max-w-[430px] px-3 pb-[max(10px,env(safe-area-inset-bottom))] min-[1024px]:hidden" aria-label="Navigation mobile">
      <div className="grid grid-cols-4 rounded-[18px] border border-white/[0.09] bg-[#071020]/90 p-1.5 shadow-[0_-18px_58px_-36px_rgba(124,58,237,0.75),inset_0_1px_0_rgba(255,255,255,0.075)] backdrop-blur-2xl">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={cn('relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-[14px] text-[0.7rem] font-bold transition', item.active ? 'bg-white/[0.07] text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-slate-400')}>
            {item.active ? <span className="absolute -top-1 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" /> : null}
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function MobileOverview(props: OverviewProps) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden px-1 pb-[118px] min-[1024px]:hidden">
      <div className="relative">
        <Header dashboard={props.dashboard} />
        <PermissionBanner states={props.states} connection={props.tiktokConnection} onManageTikTok={props.onManageTikTok} />
        <HeroCard dashboard={props.dashboard} states={props.states} />
        <MissionCard items={props.dashboard.overview.dailyPlan} />
        <KpiBoard kpis={props.dashboard.overview.kpis} />
        <RecentAnalyses dashboard={props.dashboard} states={props.states} limit={2} />
        <AiRecommendation dashboard={props.dashboard} />
        <HooksToTest hooks={props.dashboard.overview.hooksToTest} />
        <WeeklyGoals goals={props.dashboard.overview.weeklyGoals} />
        <TikTokAccountCard connection={props.tiktokConnection} states={props.states} />
        <QuickActions />
      </div>
      <MobileBottomNav />
    </div>
  );
}

function DesktopOverview(props: OverviewProps) {
  return (
    <div className="hidden min-[1024px]:block">
      <div className="mx-auto grid w-full max-w-[1240px] gap-5 pb-8">
        <Header dashboard={props.dashboard} />
        <PermissionBanner states={props.states} connection={props.tiktokConnection} onManageTikTok={props.onManageTikTok} />
        <section className="grid gap-5 min-[1180px]:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
          <HeroCard dashboard={props.dashboard} states={props.states} />
          <div className="grid gap-5">
            <MissionCard items={props.dashboard.overview.dailyPlan} />
            <TikTokAccountCard connection={props.tiktokConnection} states={props.states} />
          </div>
        </section>
        <KpiBoard kpis={props.dashboard.overview.kpis} />
        <section className="grid gap-5 min-[1180px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <RecentAnalyses dashboard={props.dashboard} states={props.states} limit={3} />
          <AiRecommendation dashboard={props.dashboard} />
        </section>
        <section className="grid gap-5 min-[1180px]:grid-cols-[minmax(0,1fr)_330px]">
          <HooksToTest hooks={props.dashboard.overview.hooksToTest} />
          <div className="grid gap-5">
            <WeeklyGoals goals={props.dashboard.overview.weeklyGoals} />
            <QuickActions />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardOverviewRedesign(props: OverviewProps) {
  return (
    <>
      <MobileOverview {...props} />
      <DesktopOverview {...props} />
    </>
  );
}
