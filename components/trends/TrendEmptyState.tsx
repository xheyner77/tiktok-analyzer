'use client';

import type { TrendSourceStatus } from '@/lib/trends/types';

export function TrendEmptyState({ status, onScan, onOpenSources }: { status: TrendSourceStatus; onScan: () => void; onOpenSources: () => void }) {
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(10,18,34,0.95),rgba(3,7,18,0.99))] p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="max-w-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/75">Radar sans cache exploitable</p>
        <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em]">Connecte une source, puis lance un scan.</h2>
        <p className="mt-3 text-[13px] leading-6 text-slate-400">{status.detail}</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button onClick={status.canScan ? onScan : onOpenSources} className="rounded-[12px] bg-cyan-200 px-4 py-3 text-[13px] font-black text-slate-950 transition hover:brightness-110">
          {status.canScan ? 'Scanner maintenant' : 'Connecter une source'}
        </button>
        <button onClick={onOpenSources} className="rounded-[12px] border border-white/[0.1] bg-white/[0.045] px-4 py-3 text-[13px] font-black text-white transition hover:bg-white/[0.07]">
          Configurer les sources
        </button>
      </div>
    </section>
  );
}
