'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { TikTokDashboardState } from '@/lib/tiktok-accounts';
import type { TrendOpportunity, TrendOpportunityType } from '@/lib/trend-radar-engine';
import type { AppPlan } from '@/lib/plans';

type Plan = AppPlan;

const filters: Array<{ id: 'all' | TrendOpportunityType | 'now' | 'fit' | 'momentum'; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'hook', label: 'Hooks' },
  { id: 'format', label: 'Formats' },
  { id: 'cta', label: 'CTA' },
  { id: 'repost', label: 'Structure' },
  { id: 'niche', label: 'Niche' },
  { id: 'now', label: 'À tester maintenant' },
  { id: 'fit', label: 'Meilleur fit' },
  { id: 'momentum', label: 'Momentum' },
];

function sourceLabel(item: TrendOpportunity) {
  if (item.source === 'fallback_demo') return 'Exemple';
  if (item.source === 'creator_data') return 'Basé sur tes analyses';
  if (item.source === 'tiktok_sync') return 'Basé sur ton compte TikTok';
  return 'À confirmer';
}

function momentumLabel(momentum: TrendOpportunity['momentum']) {
  if (momentum === 'up') return 'En hausse';
  if (momentum === 'down') return 'À surveiller';
  if (momentum === 'stable') return 'Stable';
  return 'À tester';
}

export default function TrendRadarClient({
  opportunities,
  sourceLabel: radarSource,
  hasPersonalData,
  tiktok,
  plan,
}: {
  opportunities: TrendOpportunity[];
  sourceLabel: string;
  hasPersonalData: boolean;
  tiktok: TikTokDashboardState;
  plan: Plan;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all');
  const [sort, setSort] = useState<'score' | 'fit' | 'confidence' | 'momentum'>('score');

  const visible = useMemo(() => {
    const filtered = opportunities.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'now') return item.opportunityScore >= 78;
      if (filter === 'fit') return item.fitScore >= 75;
      if (filter === 'momentum') return item.momentum === 'up';
      return item.type === filter;
    });

    const confidenceValue = { faible: 1, moyenne: 2, élevée: 3 };
    return [...filtered].sort((a, b) => {
      if (sort === 'fit') return b.fitScore - a.fitScore;
      if (sort === 'confidence') return confidenceValue[b.confidence] - confidenceValue[a.confidence];
      if (sort === 'momentum') return (b.momentum === 'up' ? 2 : b.momentum === 'stable' ? 1 : 0) - (a.momentum === 'up' ? 2 : a.momentum === 'stable' ? 1 : 0);
      return b.opportunityScore - a.opportunityScore;
    });
  }, [filter, opportunities, sort]);

  return (
    <main className="min-h-screen bg-[#020611] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_62%),radial-gradient(ellipse_60%_45%_at_100%_18%,rgba(34,211,238,0.12),transparent_58%)]" />
      <div className="relative mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[1.7rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025)_50%,rgba(34,211,238,0.06))] p-5 shadow-[0_28px_120px_-82px_rgba(124,58,237,0.95)] sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                {['Hooks', 'Formats', 'Structure', 'Niche', 'IA'].map((badge) => (
                  <span key={badge} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-300">{badge}</span>
                ))}
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">Radar Tendances</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-base">
                Repère les hooks, formats et angles à tester avant de remonter. Viralynz distingue clairement les opportunités issues de tes données et les exemples à tester.
              </p>
              <p className="mt-3 text-xs font-bold text-cyan-200">{radarSource}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/analyze" className="rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-4 py-3 text-sm font-black text-white transition hover:brightness-110">Analyser une vidéo</Link>
              <Link href="/api/tiktok/connect" className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-300/15">Connecter TikTok</Link>
              <Link href="/dashboard/hooks" className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.07]">Générer des hooks</Link>
            </div>
          </div>
        </header>

        {!hasPersonalData && (
          <section className="mt-4 rounded-2xl border border-amber-300/16 bg-amber-300/[0.045] p-4">
            <p className="text-sm font-black text-white">Analyse quelques vidéos pour obtenir des tendances personnalisées.</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">Les cartes ci-dessous sont des exemples premium à tester, pas des tendances globales TikTok.</p>
          </section>
        )}

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filters.map((item) => (
                  <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition ${filter === item.id ? 'bg-vn-violet/25 text-white' : 'bg-white/[0.04] text-gray-400 hover:text-white'}`}>{item.label}</button>
                ))}
              </div>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-xl border border-white/[0.08] bg-[#080c18] px-3 py-2 text-xs font-bold text-gray-200 outline-none">
                <option value="score">Score opportunité</option>
                <option value="fit">Fit avec ton compte</option>
                <option value="confidence">Confiance</option>
                <option value="momentum">Momentum</option>
              </select>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {visible.map((item) => (
                <article key={item.id} className="rounded-[1.45rem] border border-white/[0.08] bg-[radial-gradient(circle_at_0%_0%,rgba(168,85,247,0.13),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.022))] p-5 shadow-[0_24px_90px_-72px_rgba(124,58,237,0.85)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md bg-vn-violet/18 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-vn-violet">{item.type}</span>
                        <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.isRealData ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-200'}`}>{sourceLabel(item)}</span>
                      </div>
                      <h2 className="mt-3 text-xl font-black leading-tight text-white">{item.title}</h2>
                    </div>
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-lg font-black text-white">{item.opportunityScore}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-[10px] text-gray-500">Fit</p><p className="text-sm font-black">{item.fitScore}/100</p></div>
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-[10px] text-gray-500">Momentum</p><p className="text-sm font-black">{momentumLabel(item.momentum)}</p></div>
                    <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-[10px] text-gray-500">Confiance</p><p className="text-sm font-black">{item.confidence}</p></div>
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed">
                    <p><span className="font-black text-white">Pourquoi : </span><span className="text-gray-400">{item.whyItWorks}</span></p>
                    <p><span className="font-black text-white">À tester : </span><span className="text-gray-400">{item.howToUse}</span></p>
                    <div className="rounded-2xl border border-vn-violet/18 bg-vn-violet/[0.055] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-vn-violet/80">Hook</p>
                      <p className="mt-1 text-base font-black text-white">"{item.hookExample}"</p>
                      <p className="mt-2 text-xs text-gray-400">Texte écran : {item.onScreenTextExample}</p>
                    </div>
                    <p><span className="font-black text-white">Action structure : </span><span className="text-gray-400">{item.repostAction}</span></p>
                    <p className="text-xs text-amber-200/85">Risque : {item.risk}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/dashboard/hooks?trendType=${encodeURIComponent(item.type)}&trendHook=${encodeURIComponent(item.hookExample)}&trendTitle=${encodeURIComponent(item.title)}`} className="rounded-xl bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:bg-white/[0.1]">Générer des hooks</Link>
                    <Link href="/dashboard/analyze" className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-black text-gray-300 transition hover:text-white">Appliquer à une vidéo</Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-5">
              <h2 className="text-base font-black text-white">État du radar</h2>
              <div className="mt-4 grid gap-2">
                <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-[10px] text-gray-500">Comptes TikTok</p><p className="text-sm font-black">{tiktok.active}/{tiktok.limitLabel} connectés</p></div>
                <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-[10px] text-gray-500">Vidéos sync</p><p className="text-sm font-black">{tiktok.totalVideos}</p></div>
                <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-[10px] text-gray-500">Plan</p><p className="text-sm font-black">{plan}</p></div>
              </div>
              {!tiktok.active && <p className="mt-3 text-xs leading-relaxed text-gray-500">Connecte TikTok pour prioriser avec tes vidéos publiées. Les analytics avancées restent masquées tant qu’elles ne sont pas disponibles.</p>}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
