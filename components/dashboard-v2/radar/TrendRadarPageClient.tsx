'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Trend, TrendRadarModel } from '@/lib/trends/trend-types';
import { TrendDetailsPanel } from '@/components/trends/TrendDetailsPanel';
import { TrendFilters } from '@/components/trends/TrendFilters';
import { TrendRadarMap } from '@/components/trends/TrendRadarMap';
import { TrendSignalCard } from '@/components/trends/TrendSignalCard';
import { TrendTable } from '@/components/trends/TrendTable';
import { ActionButton, Badge, SignalMetric, urgencyWeight, type TrendFilterKey, type TrendSortKey } from '@/components/trends/trend-ui';

interface TrendRadarPageClientProps {
  model: TrendRadarModel;
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.075] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.42),transparent)]" />
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-[28px] font-black tracking-[-0.045em] text-white">{value}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function filterTrend(trend: Trend, filter: TrendFilterKey, niche: string) {
  const filterMatch = filter === 'all' || trend.verdict === filter || trend.stage === filter;
  const nicheMatch = niche === 'Toutes' || trend.recommendedNiches.includes(niche);
  return filterMatch && nicheMatch;
}

function sortTrends(trends: Trend[], sort: TrendSortKey) {
  return [...trends].sort((a, b) => {
    if (sort === 'momentum') return b.velocityScore + b.accelerationScore - (a.velocityScore + a.accelerationScore);
    if (sort === 'low_saturation') return a.saturationScore - b.saturationScore;
    if (sort === 'urgency') return urgencyWeight[b.timeWindow.urgency] - urgencyWeight[a.timeWindow.urgency];
    if (sort === 'easy') return a.difficultyScore - b.difficultyScore;
    return b.opportunityScore - a.opportunityScore;
  });
}

export default function TrendRadarPageClient({ model }: TrendRadarPageClientProps) {
  const [filter, setFilter] = useState<TrendFilterKey>('all');
  const [sort, setSort] = useState<TrendSortKey>('opportunity');
  const [selectedNiche, setSelectedNiche] = useState('Toutes');
  const [selectedTrendId, setSelectedTrendId] = useState(model.summary.bestTrendId || model.trends[0]?.id || '');
  const [hoveredTrendId, setHoveredTrendId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedTrend = model.trends.find((trend) => trend.id === selectedTrendId) ?? model.trends[0];
  const signalTrend = model.trends.find((trend) => trend.id === model.summary.bestTrendId) ?? selectedTrend;
  const strongestMomentum = useMemo(() => sortTrends(model.trends, 'momentum')[0], [model.trends]);
  const niches = useMemo(() => ['Toutes', ...Array.from(new Set(model.trends.flatMap((trend) => trend.recommendedNiches)))], [model.trends]);
  const visibleTrends = useMemo(() => sortTrends(model.trends.filter((trend) => filterTrend(trend, filter, selectedNiche)), sort), [filter, model.trends, selectedNiche, sort]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function notify(message: string) {
    setToast(message);
  }

  if (!selectedTrend || !signalTrend) return null;

  return (
    <section className="relative mx-auto w-full max-w-[1480px] pb-10 pt-4 text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-[260] max-w-[340px] rounded-[14px] border border-cyan-200/[0.16] bg-[linear-gradient(135deg,rgba(10,18,34,0.97),rgba(4,8,18,0.99))] px-4 py-3 text-[13px] font-bold text-white shadow-[0_24px_80px_-42px_rgba(34,211,238,0.8)]">
          {toast}
        </div>
      )}

      <header className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(10,18,34,0.96),rgba(3,7,18,0.995)_55%,rgba(22,16,50,0.96))] p-5 shadow-[0_34px_116px_-78px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.17),transparent_30%),radial-gradient(circle_at_16%_4%,rgba(168,85,247,0.2),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(139,92,246,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-cyan-200/25 bg-cyan-300/[0.105] text-cyan-100">
                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.95)]" />
                Scan en direct
              </Badge>
              <Badge className="border-white/[0.1] bg-white/[0.045] text-slate-300">Dernière mise à jour : {model.summary.lastUpdatedLabel}</Badge>
              <Badge className="border-violet-200/18 bg-violet-300/[0.08] text-violet-100">Scoring calculé</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-[38px] font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-[58px]">
              Radar tendances
            </h1>
            <p className="mt-4 max-w-3xl text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              Détecte les angles TikTok à poster avant saturation. Le radar classe les signaux, calcule le risque et transforme chaque tendance en plan de publication.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ActionButton tone="primary" onClick={() => notify('Scan relancé : les scores ont été recalculés côté moteur.')}>Scanner maintenant</ActionButton>
              <ActionButton onClick={() => notify('Tendance ajoutée au plan de contenu.')}>Ajouter au plan de contenu</ActionButton>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_26px_74px_-62px_rgba(34,211,238,0.65)]">
            <div className="absolute right-5 top-5 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            <div className="grid gap-3">
              <MetricTile label="Tendances analysées" value={String(model.trends.length)} detail="Scores recalculés à chaque chargement." />
              <MetricTile label="Opportunités early" value={String(model.summary.earlyCount)} detail="Fenêtre encore exploitable." />
              <MetricTile label="Tendances à éviter" value={String(model.summary.avoidCount)} detail="Saturation ou risque trop élevé." />
            </div>
          </aside>
        </div>
      </header>

      <section className="mt-5 rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(8,15,30,0.94),rgba(3,7,18,0.99))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-violet-200/20 bg-violet-300/[0.08] text-violet-100">Résumé IA du jour</Badge>
              <Badge className="border-emerald-200/18 bg-emerald-300/[0.08] text-emerald-100">{model.summary.postNowCount} à poster maintenant</Badge>
            </div>
            <p className="mt-4 text-[18px] font-black leading-7 tracking-[-0.02em] text-white">{model.summary.marketSummary}</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-400">
              Momentum le plus fort : {strongestMomentum?.name}. Les formats à forte preuve visuelle dominent tant que la saturation reste sous contrôle.
            </p>
          </div>
          <div className="rounded-[18px] border border-cyan-200/[0.12] bg-cyan-300/[0.045] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/75">Lecture rapide</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SignalMetric label="Meilleur score" value={signalTrend.opportunityScore} tone="cyan" />
              <SignalMetric label="Momentum" value={Math.round(((strongestMomentum?.velocityScore ?? 0) + (strongestMomentum?.accelerationScore ?? 0)) / 2)} tone="violet" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <TrendSignalCard trend={signalTrend} onSelect={(trend) => setSelectedTrendId(trend.id)} onNotify={notify} />
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <main className="space-y-5">
          <TrendRadarMap
            trends={model.trends}
            selectedId={selectedTrend.id}
            hoveredId={hoveredTrendId}
            onHover={setHoveredTrendId}
            onSelect={(trend) => setSelectedTrendId(trend.id)}
          />

          <section className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(7,14,29,0.94),rgba(3,7,18,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
            <TrendFilters
              filter={filter}
              sort={sort}
              niche={selectedNiche}
              niches={niches}
              onFilterChange={setFilter}
              onSortChange={setSort}
              onNicheChange={setSelectedNiche}
            />
            <div className="mt-5">
              <TrendTable trends={visibleTrends} selectedId={selectedTrend.id} onSelect={(trend) => setSelectedTrendId(trend.id)} />
            </div>
          </section>

          <section className="rounded-[22px] border border-white/[0.075] bg-white/[0.032] p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Opportunités par niche</p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.045em] text-white">Quelle tendance utiliser selon ton marché</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {model.nicheOpportunities.map((niche) => (
                <button
                  key={niche.niche}
                  type="button"
                  onClick={() => {
                    setSelectedTrendId(niche.trendId);
                    notify(`${niche.niche} : tendance sélectionnée.`);
                  }}
                  className="rounded-[17px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/18 hover:bg-white/[0.055]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[16px] font-black text-white">{niche.niche}</h3>
                    <span className="rounded-[10px] border border-cyan-200/18 bg-cyan-300/[0.08] px-2.5 py-1 text-[12px] font-black text-cyan-100">{niche.score}/100</span>
                  </div>
                  <p className="mt-3 text-[12px] font-black uppercase tracking-[0.12em] text-violet-100/75">{niche.trendName}</p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">{niche.action}</p>
                  <div className="mt-3 rounded-[13px] border border-white/[0.07] bg-black/18 p-3">
                    <p className="text-[11px] font-black text-white">“{niche.hook}”</p>
                    <p className="mt-2 text-[11px] text-slate-500">{niche.format}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-rose-200/[0.12] bg-[linear-gradient(180deg,rgba(76,5,25,0.16),rgba(4,8,18,0.97))] p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100/75">Tendances à éviter</p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.045em] text-white">Ce qui coûte de l’attention</h2>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {model.avoidTrends.map((trend) => (
                <button
                  key={trend.trendId}
                  type="button"
                  onClick={() => setSelectedTrendId(trend.trendId)}
                  className="rounded-[17px] border border-white/[0.07] bg-white/[0.035] p-4 text-left transition hover:border-rose-200/18 hover:bg-white/[0.055]"
                >
                  <Badge className="border-rose-200/22 bg-rose-300/[0.09] text-rose-100">À éviter</Badge>
                  <h3 className="mt-3 text-[16px] font-black text-white">{trend.name}</h3>
                  <p className="mt-3 text-[12px] leading-5 text-slate-400">{trend.reason}</p>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100/70">Alternative recommandée</p>
                  <p className="mt-2 text-[12px] font-bold leading-5 text-white">{trend.twist}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-violet-200/[0.12] bg-[linear-gradient(135deg,rgba(21,16,50,0.92),rgba(3,7,18,0.99))] p-4 shadow-[0_28px_92px_-72px_rgba(139,92,246,0.95)] sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100/75">Plan d’action 24h</p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.045em] text-white">Ce que tu peux produire aujourd’hui</h2>
            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {model.dailyIdeas.map((idea, index) => (
                <button
                  key={idea.trendId}
                  type="button"
                  onClick={() => setSelectedTrendId(idea.trendId)}
                  className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-200/20 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] font-black text-cyan-100">Idée {index + 1}</span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-300">{idea.effort === 'low' ? 'Faible' : idea.effort === 'medium' ? 'Moyen' : 'Élevé'}</span>
                  </div>
                  <h3 className="mt-4 text-[16px] font-black text-white">{idea.trendName}</h3>
                  <p className="mt-3 text-[13px] font-black leading-5 text-cyan-50">“{idea.hook}”</p>
                  <div className="mt-4 space-y-2">
                    {idea.structure.map((step, stepIndex) => (
                      <div key={`${idea.trendId}-${step}`} className="flex gap-2 text-[12px] leading-5 text-slate-400">
                        <span className="font-mono text-cyan-100">{stepIndex + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[12px] bg-black/18 p-3">
                      <p className="text-[10px] text-slate-500">Format</p>
                      <p className="mt-1 text-[12px] font-black text-white">{idea.format}</p>
                    </div>
                    <div className="rounded-[12px] bg-black/18 p-3">
                      <p className="text-[10px] text-slate-500">Durée</p>
                      <p className="mt-1 text-[12px] font-black text-white">{idea.duration}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-[12px] font-bold leading-5 text-slate-300">CTA : {idea.cta}</p>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="space-y-5 2xl:sticky 2xl:top-5 2xl:self-start">
          <TrendDetailsPanel trend={selectedTrend} onNotify={notify} />
        </aside>
      </div>
    </section>
  );
}
