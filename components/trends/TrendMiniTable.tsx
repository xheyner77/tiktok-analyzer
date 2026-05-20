'use client';

import type { TrendCluster } from '@/lib/trends/types';
import { verdictLabel } from '@/lib/trends/formatters';

export function TrendMiniTable({ clusters, onSelect }: { clusters: TrendCluster[]; onSelect: (cluster: TrendCluster) => void }) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(7,14,29,0.94),rgba(3,7,18,0.99))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Clusters detectes</p>
          <h2 className="mt-1 text-[20px] font-black tracking-[-0.035em] text-white">10 tendances max</h2>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <th className="px-3">Tendance</th>
              <th className="px-3">Preuve</th>
              <th className="px-3">Score</th>
              <th className="px-3">Momentum</th>
              <th className="px-3">Saturation</th>
              <th className="px-3">Confiance</th>
              <th className="px-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((cluster) => (
              <tr key={cluster.id} className="rounded-[14px] bg-white/[0.035] text-[12px] text-slate-300">
                <td className="rounded-l-[14px] border-y border-l border-white/[0.07] px-3 py-3">
                  <button type="button" onClick={() => onSelect(cluster)} className="text-left font-black text-white hover:text-cyan-100">
                    {cluster.title}
                    <span className="mt-1 block text-[11px] font-bold text-slate-500">{cluster.niche} · {cluster.country}</span>
                  </button>
                </td>
                <td className="border-y border-white/[0.07] px-3 py-3">{cluster.sampleSize} videos · {cluster.uniqueCreators} createurs</td>
                <td className="border-y border-white/[0.07] px-3 py-3 font-mono font-black text-cyan-100">{cluster.scores.finalScore}</td>
                <td className="border-y border-white/[0.07] px-3 py-3">{cluster.scores.velocityScore}</td>
                <td className="border-y border-white/[0.07] px-3 py-3">{cluster.scores.saturationScore}</td>
                <td className="border-y border-white/[0.07] px-3 py-3">{cluster.scores.confidenceScore}</td>
                <td className="rounded-r-[14px] border-y border-r border-white/[0.07] px-3 py-3">
                  <button type="button" onClick={() => onSelect(cluster)} className="rounded-[10px] border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-2 text-[11px] font-black text-cyan-100">
                    {verdictLabel(cluster.recommendation.verdict)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
