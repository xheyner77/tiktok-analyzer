'use client';

import type { TrendCluster } from '@/lib/trends/types';

const verdictTone: Record<string, string> = {
  post_now: 'bg-cyan-200 shadow-[0_0_22px_rgba(103,232,249,0.85)]',
  good_potential: 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.65)]',
  watch: 'bg-slate-300 shadow-[0_0_14px_rgba(203,213,225,0.45)]',
  twist_it: 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.65)]',
  avoid: 'bg-rose-300 shadow-[0_0_18px_rgba(253,164,175,0.65)]',
};

export function TrendRadarCompact({
  clusters,
  selectedId,
  onSelect,
}: {
  clusters: TrendCluster[];
  selectedId: string | null;
  onSelect: (cluster: TrendCluster) => void;
}) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,15,30,0.95),rgba(3,7,18,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Radar decisionnel</p>
          <h2 className="mt-1 text-[20px] font-black tracking-[-0.035em] text-white">Opportunite vs saturation</h2>
        </div>
        <div className="hidden gap-2 text-[10px] font-bold text-slate-500 sm:flex">
          <span>Y = opportunite</span>
          <span>X = saturation</span>
        </div>
      </div>

      <div className="relative mt-4 aspect-[1.25] min-h-[290px] overflow-hidden rounded-[18px] border border-white/[0.075] bg-[#030713]">
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:25%_25%]" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.08]" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/[0.08]" />
        <div className="absolute left-3 top-3 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-2.5 py-1 text-[10px] font-black text-cyan-100">Hidden gems</div>
        <div className="absolute right-3 top-3 rounded-full border border-emerald-200/20 bg-emerald-200/[0.07] px-2.5 py-1 text-[10px] font-black text-emerald-100">Growth</div>
        <div className="absolute right-3 bottom-3 rounded-full border border-rose-200/20 bg-rose-200/[0.07] px-2.5 py-1 text-[10px] font-black text-rose-100">Saturated</div>
        <div className="absolute left-3 bottom-3 rounded-full border border-amber-200/20 bg-amber-200/[0.07] px-2.5 py-1 text-[10px] font-black text-amber-100">Risky</div>

        {clusters.map((cluster) => {
          const size = Math.max(10, Math.min(24, 8 + cluster.sampleSize * 0.7));
          const left = Math.max(6, Math.min(94, cluster.scores.saturationScore));
          const top = Math.max(6, Math.min(94, 100 - cluster.scores.finalScore));
          const opacity = Math.max(0.35, cluster.scores.confidenceScore / 100);
          return (
            <button
              key={cluster.id}
              type="button"
              onClick={() => onSelect(cluster)}
              title={`${cluster.title} - ${cluster.scores.finalScore}/100 - preuve ${cluster.sampleSize} videos`}
              className={`group absolute rounded-full ${verdictTone[cluster.recommendation.verdict]} transition hover:scale-125 focus:outline-none focus:ring-2 focus:ring-cyan-200 ${selectedId === cluster.id ? 'ring-2 ring-white' : ''}`}
              style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, opacity, transform: 'translate(-50%, -50%)' }}
            >
              <span className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 hidden w-56 -translate-x-1/2 rounded-[12px] border border-white/[0.1] bg-[#070c18]/95 p-3 text-left text-white shadow-2xl group-hover:block">
                <span className="block text-[12px] font-black">{cluster.title}</span>
                <span className="mt-1 block text-[11px] text-slate-400">{cluster.sampleSize} videos · {cluster.uniqueCreators} createurs · confiance {cluster.scores.confidenceScore}/100</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
