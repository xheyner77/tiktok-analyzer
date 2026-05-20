'use client';

import type { TrendCluster } from '@/lib/trends/types';
import { verdictLabel } from '@/lib/trends/formatters';

export function TrendTopOpportunities({ clusters, selectedId, onSelect }: { clusters: TrendCluster[]; selectedId: string | null; onSelect: (cluster: TrendCluster) => void }) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-100/70">Top 5 opportunites</p>
      <div className="mt-3 space-y-2">
        {clusters.slice(0, 5).map((cluster, index) => (
          <button
            key={cluster.id}
            type="button"
            onClick={() => onSelect(cluster)}
            className={`w-full rounded-[14px] border p-3 text-left transition hover:bg-white/[0.06] ${selectedId === cluster.id ? 'border-cyan-200/30 bg-cyan-200/[0.06]' : 'border-white/[0.07] bg-black/15'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-slate-500">#{index + 1} · {verdictLabel(cluster.recommendation.verdict)}</p>
                <h3 className="mt-1 text-[14px] font-black text-white">{cluster.title}</h3>
              </div>
              <span className="font-mono text-[18px] font-black text-cyan-100">{cluster.scores.finalScore}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">Preuve : {cluster.sampleSize} videos · {cluster.uniqueCreators} createurs · {cluster.country}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
