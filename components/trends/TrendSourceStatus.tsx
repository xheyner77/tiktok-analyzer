'use client';

import type { TrendSourceStatus as TrendSourceStatusType } from '@/lib/trends/types';

export function TrendSourceStatus({ status }: { status: TrendSourceStatusType }) {
  const tone =
    status.status === 'connected'
      ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
      : status.status === 'demo'
        ? 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
        : 'border-rose-300/18 bg-rose-300/[0.07] text-rose-100';

  return (
    <div className={`rounded-[14px] border px-3.5 py-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.14em]">{status.label}</span>
        <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_16px_currentColor]" />
      </div>
      <p className="mt-1.5 text-[12px] leading-5 text-slate-300">{status.detail}</p>
    </div>
  );
}
