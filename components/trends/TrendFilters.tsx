'use client';

import { cx, filterOptions, sortOptions, type TrendFilterKey, type TrendSortKey } from './trend-ui';

export function TrendFilters({
  filter,
  sort,
  niche,
  niches,
  onFilterChange,
  onSortChange,
  onNicheChange,
}: {
  filter: TrendFilterKey;
  sort: TrendSortKey;
  niche: string;
  niches: string[];
  onFilterChange: (filter: TrendFilterKey) => void;
  onSortChange: (sort: TrendSortKey) => void;
  onNicheChange: (niche: string) => void;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(7,14,29,0.94),rgba(3,7,18,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/70">Tendances scorées</p>
          <h2 className="mt-2 text-[24px] font-black tracking-[-0.045em] text-white">Table de décision</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={niche}
            onChange={(event) => onNicheChange(event.target.value)}
            className="min-h-[40px] rounded-[10px] border border-white/[0.09] bg-[#07101f] px-3 text-[12px] font-bold text-slate-200 outline-none focus:ring-2 focus:ring-cyan-200/25"
          >
            {niches.map((item) => (
              <option key={item} value={item}>{item === 'Toutes' ? 'Par niche' : item}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as TrendSortKey)}
            className="min-h-[40px] rounded-[10px] border border-white/[0.09] bg-[#07101f] px-3 text-[12px] font-bold text-slate-200 outline-none focus:ring-2 focus:ring-cyan-200/25"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={cx(
              'shrink-0 rounded-[10px] border px-3.5 py-2 text-[12px] font-black transition',
              filter === item.id
                ? 'border-cyan-200/25 bg-cyan-300/[0.105] text-cyan-100'
                : 'border-white/[0.07] bg-white/[0.035] text-slate-400 hover:text-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
