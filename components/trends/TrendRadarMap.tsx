'use client';

import { getRecommendedAction } from '@/lib/trends/trend-scoring';
import type { Trend, TrendStage } from '@/lib/trends/trend-types';
import { cx, percent, stageLabels, stageStyles, verdictLabels } from './trend-ui';

export function TrendRadarMap({
  trends,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
}: {
  trends: Trend[];
  selectedId: string;
  hoveredId: string | null;
  onHover: (trendId: string | null) => void;
  onSelect: (trend: Trend) => void;
}) {
  const hoveredTrend = trends.find((trend) => trend.id === hoveredId) ?? null;

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(7,14,29,0.94),rgba(3,7,18,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Radar décisionnel</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.045em] text-white">Opportunité, saturation, risque</h2>
        </div>
        <p className="max-w-lg text-[12px] leading-5 text-slate-500">
          Taille = volume. Position = maturité, saturation et risque. Clique un point pour ouvrir sa stratégie.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_285px]">
        <div className="relative min-h-[455px] overflow-hidden rounded-[20px] border border-cyan-200/[0.08] bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.12),transparent_31%),radial-gradient(circle_at_72%_40%,rgba(139,92,246,0.12),transparent_34%),rgba(255,255,255,0.025)]">
          <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.08)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="pointer-events-none absolute inset-[8%] rounded-full border border-white/[0.08]" />
          <div className="pointer-events-none absolute inset-[20%] rounded-full border border-cyan-200/[0.09]" />
          <div className="pointer-events-none absolute inset-[33%] rounded-full border border-violet-200/[0.09]" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-200/16 to-transparent" />
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-200/18 to-transparent" />
          <div className="pointer-events-none absolute inset-[3%] animate-[spin_14s_linear_infinite] rounded-full bg-[conic-gradient(from_20deg,transparent_0deg,rgba(34,211,238,0.18)_30deg,transparent_68deg,transparent_360deg)] opacity-75" />

          {[
            { label: 'Early signal', className: 'left-5 top-5 text-cyan-100' },
            { label: 'Growth', className: 'right-5 top-5 text-violet-100' },
            { label: 'Peak', className: 'right-5 bottom-16 text-amber-100' },
            { label: 'Saturated', className: 'left-5 bottom-5 text-rose-100' },
            { label: 'Unstable', className: 'right-5 bottom-5 text-fuchsia-100' },
          ].map((zone) => (
            <span key={zone.label} className={cx('absolute rounded-full border border-white/[0.08] bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur', zone.className)}>
              {zone.label}
            </span>
          ))}

          {trends.map((trend) => (
            <button
              key={trend.id}
              type="button"
              aria-label={`Voir la stratégie ${trend.name}`}
              onClick={() => onSelect(trend)}
              onMouseEnter={() => onHover(trend.id)}
              onMouseLeave={() => onHover(null)}
              className={cx(
                'group absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-200/35',
                stageStyles[trend.stage],
                selectedId === trend.id && 'scale-125 ring-2 ring-white/35',
              )}
              style={{ left: percent(trend.radar.x), top: percent(trend.radar.y), width: trend.radar.radius, height: trend.radar.radius }}
            >
              <span className="absolute -inset-2 rounded-full bg-current opacity-10 blur-md transition group-hover:opacity-25" />
            </button>
          ))}

          {hoveredTrend && (
            <div
              className="pointer-events-none absolute z-20 w-[275px] rounded-[14px] border border-white/[0.12] bg-[linear-gradient(180deg,rgba(8,15,30,0.98),rgba(3,7,18,0.99))] p-3 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.96)] backdrop-blur"
              style={{ left: percent(hoveredTrend.radar.x + 5), top: percent(hoveredTrend.radar.y - 8) }}
            >
              <p className="text-[13px] font-black text-white">{hoveredTrend.name}</p>
              <p className="mt-1 text-[11px] font-bold text-cyan-100">{stageLabels[hoveredTrend.stage]} · {verdictLabels[hoveredTrend.verdict]}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <span className="rounded-[8px] bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-300">Score {hoveredTrend.opportunityScore}</span>
                <span className="rounded-[8px] bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-300">Sat. {hoveredTrend.saturationScore}</span>
                <span className="rounded-[8px] bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-300">Mom. {Math.round((hoveredTrend.velocityScore + hoveredTrend.accelerationScore) / 2)}</span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-400">{getRecommendedAction(hoveredTrend)}</p>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          {[
            ['early_signal', 'Early = meilleur moment'],
            ['growth', 'Growth = bon potentiel'],
            ['peak', 'Peak = attention concurrence'],
            ['saturated', 'Saturated = détourner ou éviter'],
            ['unstable', 'Unstable = risque de copie élevé'],
            ['declining', 'Declining = signal qui retombe'],
          ].map(([stage, label]) => {
            const count = trends.filter((trend) => trend.stage === stage).length;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => {
                  const first = trends.find((trend) => trend.stage === stage);
                  if (first) onSelect(first);
                }}
                className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.055]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cx('rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em]', stageStyles[stage as TrendStage])}>
                    {stageLabels[stage as TrendStage]}
                  </span>
                  <span className="font-mono text-[13px] text-slate-300">{count}</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">{label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
