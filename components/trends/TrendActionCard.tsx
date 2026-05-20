'use client';

import type { TrendActionIdea } from '@/lib/trends/types';

export function TrendActionCard({ ideas, onNotify }: { ideas: TrendActionIdea[]; onNotify: (message: string) => void }) {
  return (
    <section className="rounded-[22px] border border-violet-200/[0.12] bg-[linear-gradient(135deg,rgba(21,16,50,0.9),rgba(3,7,18,0.99))] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-100/70">Ton plan aujourd'hui</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {ideas.slice(0, 3).map((idea) => (
          <button key={idea.clusterId} type="button" onClick={() => onNotify('Script prêt a générer depuis cette tendance.')} className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-4 text-left transition hover:border-violet-200/20 hover:bg-white/[0.06]">
            <h3 className="text-[14px] font-black text-white">{idea.title}</h3>
            <p className="mt-2 text-[12px] font-black leading-5 text-cyan-50">"{idea.hook}"</p>
            <p className="mt-3 text-[11px] text-slate-400">{idea.format} · {idea.duration} · {idea.objective}</p>
            <p className="mt-3 text-[11px] font-bold text-slate-300">CTA : {idea.cta}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
