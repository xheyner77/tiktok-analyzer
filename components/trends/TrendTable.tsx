'use client';

import { getRecommendedAction } from '@/lib/trends/trend-scoring';
import type { Trend } from '@/lib/trends/trend-types';
import { Badge, Progress, categoryLabels, cx, stageLabels, stageStyles, verdictLabels, verdictStyles } from './trend-ui';

export function TrendTable({ trends, selectedId, onSelect }: { trends: Trend[]; selectedId: string; onSelect: (trend: Trend) => void }) {
  return (
    <div className="space-y-3">
      {trends.map((trend) => (
        <button
          key={trend.id}
          type="button"
          onClick={() => onSelect(trend)}
          className={cx(
            'group w-full rounded-[17px] border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/18 hover:bg-white/[0.052]',
            selectedId === trend.id ? 'border-cyan-200/22 bg-cyan-300/[0.055]' : 'border-white/[0.07] bg-white/[0.032]',
          )}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.1fr)_96px_110px_110px_100px_minmax(150px,0.75fr)_112px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge className={stageStyles[trend.stage]}>{stageLabels[trend.stage]}</Badge>
                <Badge className={verdictStyles[trend.verdict]}>{verdictLabels[trend.verdict]}</Badge>
              </div>
              <h3 className="mt-3 text-[17px] font-black tracking-[-0.025em] text-white">{trend.name}</h3>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-400">{getRecommendedAction(trend)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Catégorie</p>
              <p className="mt-1 text-[12px] font-black leading-5 text-white">{categoryLabels[trend.category]}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Score</p>
              <p className="mt-1 text-[20px] font-black text-white">{trend.opportunityScore}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Momentum</p>
              <p className="mt-1 text-[13px] font-black text-white">{Math.round((trend.velocityScore + trend.accelerationScore) / 2)}/100</p>
              <div className="mt-2"><Progress value={(trend.velocityScore + trend.accelerationScore) / 2} tone="cyan" /></div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Saturation</p>
              <p className="mt-1 text-[13px] font-black text-white">{trend.saturationScore}/100</p>
              <div className="mt-2"><Progress value={trend.saturationScore} tone={trend.saturationScore >= 70 ? 'rose' : 'violet'} /></div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Difficulté</p>
              <p className="mt-1 text-[13px] font-black text-white">{trend.difficultyScore}/100</p>
              <div className="mt-2"><Progress value={trend.difficultyScore} tone={trend.difficultyScore >= 65 ? 'amber' : 'violet'} /></div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Fenêtre</p>
              <p className="mt-1 text-[12px] font-black leading-5 text-white">{trend.timeWindow.label}</p>
              <span className="mt-2 inline-flex rounded-[8px] border border-white/[0.08] bg-white/[0.045] px-2.5 py-1 text-[11px] font-black text-slate-300 group-hover:text-white">
                Voir détail
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
