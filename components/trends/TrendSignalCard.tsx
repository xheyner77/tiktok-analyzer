'use client';

import { getRecommendedAction, getTrendHealth } from '@/lib/trends/trend-scoring';
import type { Trend } from '@/lib/trends/trend-types';
import { ActionButton, Badge, ScoreRing, categoryLabels, healthStyles, stageLabels, stageStyles, urgencyLabels, verdictLabels, verdictStyles } from './trend-ui';

export function TrendSignalCard({ trend, onSelect, onNotify }: { trend: Trend; onSelect: (trend: Trend) => void; onNotify: (message: string) => void }) {
  const health = getTrendHealth(trend);

  return (
    <section className="overflow-hidden rounded-[24px] border border-cyan-200/[0.11] bg-[linear-gradient(135deg,rgba(8,17,34,0.96),rgba(6,8,19,0.99)_62%,rgba(22,16,50,0.9))] p-5 shadow-[0_30px_96px_-74px_rgba(34,211,238,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_150px] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={verdictStyles[trend.verdict]}>{verdictLabels[trend.verdict]}</Badge>
            <Badge className={stageStyles[trend.stage]}>{stageLabels[trend.stage]}</Badge>
            <Badge className="border-white/[0.09] bg-white/[0.04] text-slate-300">{categoryLabels[trend.category]}</Badge>
            <Badge className="border-cyan-200/16 bg-cyan-300/[0.065] text-cyan-100">Urgence : {urgencyLabels[trend.timeWindow.urgency]}</Badge>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/70">Signal du jour</p>
              <h2 className="mt-2 text-[29px] font-black tracking-[-0.05em] text-white sm:text-[38px]">{trend.name}</h2>
              <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-300">{trend.explanation}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Fenêtre</p>
                  <p className="mt-2 text-[15px] font-black leading-5 text-white">{trend.timeWindow.label}</p>
                </div>
                <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Format</p>
                  <p className="mt-2 text-[15px] font-black leading-5 text-white">{trend.recommendedFormats[0]?.label}</p>
                </div>
                <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Action</p>
                  <p className="mt-2 text-[15px] font-black leading-5 text-white">{getRecommendedAction(trend)}</p>
                </div>
              </div>
              <div className="mt-5 rounded-[18px] border border-violet-200/[0.12] bg-violet-300/[0.055] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/75">Angle recommandé</p>
                <p className="mt-2 text-[15px] font-black leading-6 text-white">{trend.angles[0]}</p>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/75">Hook recommandé</p>
                <p className="mt-2 text-[18px] font-black leading-7 text-white">“{trend.hooks[0]}”</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <ActionButton tone="primary" onClick={() => { onSelect(trend); onNotify('Signal du jour sélectionné.'); }}>Utiliser cette tendance</ActionButton>
                <ActionButton onClick={() => onNotify('3 hooks prêts à adapter dans le générateur.')}>Générer 3 hooks</ActionButton>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-5">
                <ScoreRing score={trend.opportunityScore} label="score" />
                <p className="mt-4 text-[13px] font-black text-white">Pourquoi ça monte</p>
                <p className="mt-2 text-[12px] leading-6 text-slate-400">{trend.whyNow}</p>
              </div>
              <div className={`rounded-[18px] border p-4 ${healthStyles[health.tone]}`}>
                <p className="text-[12px] font-black">{health.label}</p>
                <p className="mt-1 text-[12px] leading-5 opacity-80">{health.explanation}</p>
              </div>
            </div>
          </div>
        </div>
        <ScoreRing score={trend.opportunityScore} label="final" />
      </div>
    </section>
  );
}
