'use client';

import { useMemo, useState } from 'react';
import type { TrendCluster, TrendOverview } from '@/lib/trends/types';
import { TrendActionCard } from '@/components/trends/TrendActionCard';
import { TrendEmptyState } from '@/components/trends/TrendEmptyState';
import { TrendEvidenceDrawer } from '@/components/trends/TrendEvidenceDrawer';
import { TrendFilters, type TrendFilterState } from '@/components/trends/TrendFilters';
import { TrendLoadingState } from '@/components/trends/TrendLoadingState';
import { TrendMiniTable } from '@/components/trends/TrendMiniTable';
import { TrendRadarCompact } from '@/components/trends/TrendRadarCompact';
import { TrendSourceStatus } from '@/components/trends/TrendSourceStatus';
import { TrendTopOpportunities } from '@/components/trends/TrendTopOpportunities';
import { verdictLabel } from '@/lib/trends/formatters';

interface TrendCommandCenterProps {
  initialOverview: TrendOverview;
}

function DecisionCard({
  label,
  cluster,
  onSelect,
}: {
  label: string;
  cluster: TrendCluster | null;
  onSelect: (cluster: TrendCluster) => void;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      {cluster ? (
        <>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h3 className="text-[16px] font-black leading-tight text-white">{cluster.title}</h3>
            <span className="font-mono text-[22px] font-black text-cyan-100">{cluster.scores.finalScore}</span>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-slate-400">{cluster.recommendation.shortReason}</p>
          <p className="mt-2 text-[11px] font-bold text-slate-500">Preuve : {cluster.sampleSize} videos / {cluster.uniqueCreators} createurs</p>
          <button onClick={() => onSelect(cluster)} className="mt-3 rounded-[10px] border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-2 text-[11px] font-black text-cyan-100">
            Voir preuves
          </button>
        </>
      ) : (
        <p className="mt-3 text-[12px] leading-5 text-slate-500">Aucun cluster assez solide pour cette decision.</p>
      )}
    </div>
  );
}

function SourceSettingsDrawer({
  open,
  onClose,
  onScan,
  scanning,
}: {
  open: boolean;
  onClose: () => void;
  onScan: () => void;
  scanning: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[270] bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <aside onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-[460px] overflow-y-auto border-l border-white/[0.09] bg-[#050a14] p-5 text-white">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-black text-slate-300">Fermer</button>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Sources Radar</p>
        <h2 className="mt-2 pr-20 text-[26px] font-black tracking-[-0.045em]">Configurer la collecte</h2>
        <div className="mt-5 space-y-3">
          {[
            ['Pays', 'FR, BE, CA'],
            ['Niches', 'business, coaching, ecommerce, creator_growth'],
            ['Mots-cles', 'hook viral, avant apres, erreur createur'],
            ['Hashtags', '#businessfr, #tiktokfrance'],
            ['Frequence', 'Cache recommande : 180 minutes'],
          ].map(([label, value]) => (
            <label key={label} className="block rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</span>
              <input defaultValue={value} className="mt-2 h-10 w-full rounded-[10px] border border-white/[0.08] bg-black/20 px-3 text-[12px] font-bold text-white outline-none focus:border-cyan-200/30" />
            </label>
          ))}
        </div>
        <button onClick={onScan} disabled={scanning} className="mt-5 w-full rounded-[12px] bg-cyan-200 px-4 py-3 text-[13px] font-black text-slate-950 disabled:opacity-50">
          {scanning ? 'Scan en cours...' : 'Scanner maintenant'}
        </button>
      </aside>
    </div>
  );
}

export default function TrendCommandCenter({ initialOverview }: TrendCommandCenterProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [selectedCluster, setSelectedCluster] = useState<TrendCluster | null>(initialOverview.topOpportunity);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState<TrendFilterState>({
    niche: 'all',
    country: 'all',
    period: '7d',
    verdict: 'all',
    sort: 'score',
  });

  const filteredClusters = useMemo(() => {
    const rows = overview.clusters.filter((cluster) => {
      if (filters.niche !== 'all' && cluster.niche !== filters.niche) return false;
      if (filters.country !== 'all' && cluster.country !== filters.country) return false;
      if (filters.verdict !== 'all' && cluster.recommendation.verdict !== filters.verdict) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (filters.sort === 'freshness') return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
      if (filters.sort === 'confidence') return b.scores.confidenceScore - a.scores.confidenceScore;
      if (filters.sort === 'low_saturation') return a.scores.saturationScore - b.scores.saturationScore;
      if (filters.sort === 'sample_size') return b.sampleSize - a.sampleSize;
      return b.scores.finalScore - a.scores.finalScore;
    });
  }, [filters, overview.clusters]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  function openCluster(cluster: TrendCluster) {
    setSelectedCluster(cluster);
    setDrawerOpen(true);
  }

  async function refreshOverview() {
    const response = await fetch('/api/trends/overview', { cache: 'no-store' });
    if (response.ok) setOverview((await response.json()) as TrendOverview);
  }

  async function scanNow() {
    setLoading(true);
    try {
      const response = await fetch('/api/trends/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          niches: filters.niche === 'all' ? ['business', 'creator_growth'] : [filters.niche],
          countries: filters.country === 'all' ? ['FR'] : [filters.country],
          keywords: ['createur TikTok', 'hook viral', 'avant apres', 'erreur createur'],
          force: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Scan impossible.');
      await refreshOverview();
      notify('Scan termine. Les clusters ont ete recalcules.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Scan impossible.');
    } finally {
      setLoading(false);
    }
  }

  const hasClusters = overview.clusters.length > 0;

  return (
    <section className="relative mx-auto w-full max-w-[1360px] pb-8 pt-4 text-white">
      {toast && <div className="fixed right-4 top-4 z-[300] rounded-[14px] border border-cyan-200/20 bg-[#07101d] px-4 py-3 text-[13px] font-bold shadow-2xl">{toast}</div>}

      <header className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(10,18,34,0.96),rgba(3,7,18,0.99)_58%,rgba(20,18,48,0.94))] p-5 shadow-[0_34px_116px_-84px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/75">Trend Intelligence</p>
            <h1 className="mt-2 text-[38px] font-black leading-none tracking-[-0.06em] sm:text-[52px]">Radar tendances</h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-300">Les signaux TikTok reels, classes par opportunite, saturation et preuve.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button onClick={scanNow} disabled={loading || !overview.sourceStatus.canScan} className="rounded-[12px] bg-cyan-200 px-4 py-3 text-[13px] font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
                {loading ? 'Scan en cours...' : 'Scanner maintenant'}
              </button>
              <button onClick={() => setSettingsOpen(true)} className="rounded-[12px] border border-white/[0.1] bg-white/[0.045] px-4 py-3 text-[13px] font-black text-white transition hover:bg-white/[0.07]">
                Configurer mes sources
              </button>
            </div>
          </div>
          <TrendSourceStatus status={overview.sourceStatus} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ['Dernier scan', overview.freshnessLabel],
            ['Videos analysees', String(overview.totalRawItems)],
            ['Createurs observes', String(overview.totalCreators)],
            ['Confiance', `${overview.scanConfidence}/100`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
              <p className="mt-1 text-[18px] font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      </header>

      {!hasClusters ? (
        <div className="mt-5">
          {loading ? <TrendLoadingState /> : <TrendEmptyState status={overview.sourceStatus} onScan={scanNow} onOpenSources={() => setSettingsOpen(true)} />}
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-[13px] font-bold leading-6 text-slate-300">{overview.marketSummary}</p>
            {!overview.tiktokConnected && <p className="mt-2 text-[12px] text-slate-500">Connecte TikTok pour ajuster le creatorFitScore a tes videos recentes.</p>}
          </section>

          <section className="mt-5 grid gap-3 lg:grid-cols-3">
            <DecisionCard label="A poster maintenant" cluster={overview.topOpportunity} onSelect={openCluster} />
            <DecisionCard label="A detourner" cluster={overview.twistTrend} onSelect={openCluster} />
            <DecisionCard label="A eviter" cluster={overview.avoidTrend} onSelect={openCluster} />
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <TrendRadarCompact clusters={overview.clusters} selectedId={selectedCluster?.id ?? null} onSelect={openCluster} />
            <TrendTopOpportunities clusters={overview.clusters} selectedId={selectedCluster?.id ?? null} onSelect={openCluster} />
          </div>

          <section className="mt-5 rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
            <TrendFilters value={filters} onChange={setFilters} />
          </section>

          <div className="mt-5">
            <TrendMiniTable clusters={filteredClusters.slice(0, 10)} onSelect={openCluster} />
          </div>

          <div className="mt-5">
            <TrendActionCard ideas={overview.plan24h} onNotify={notify} />
          </div>
        </>
      )}

      <TrendEvidenceDrawer cluster={selectedCluster} open={drawerOpen} onClose={() => setDrawerOpen(false)} onNotify={notify} />
      <SourceSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} onScan={scanNow} scanning={loading} />
    </section>
  );
}
