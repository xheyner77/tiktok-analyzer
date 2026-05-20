'use client';

import type { TrendVerdict } from '@/lib/trends/types';

export interface TrendFilterState {
  niche: string;
  country: string;
  period: '24h' | '7d' | '30d';
  verdict: TrendVerdict | 'all';
  sort: 'score' | 'freshness' | 'confidence' | 'low_saturation' | 'sample_size';
}

export function TrendFilters({ value, onChange }: { value: TrendFilterState; onChange: (value: TrendFilterState) => void }) {
  const update = (patch: Partial<TrendFilterState>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <select value={value.niche} onChange={(event) => update({ niche: event.target.value })} className="h-10 rounded-[12px] border border-white/[0.08] bg-[#070c18] px-3 text-[12px] font-bold text-white">
        {['all', 'business', 'creator_growth', 'coaching', 'ecommerce', 'fitness', 'beauty', 'education', 'lifestyle'].map((niche) => (
          <option key={niche} value={niche}>{niche === 'all' ? 'Toutes niches' : niche}</option>
        ))}
      </select>
      <select value={value.country} onChange={(event) => update({ country: event.target.value })} className="h-10 rounded-[12px] border border-white/[0.08] bg-[#070c18] px-3 text-[12px] font-bold text-white">
        {['all', 'FR', 'BE', 'CA'].map((country) => <option key={country} value={country}>{country === 'all' ? 'Tous pays' : country}</option>)}
      </select>
      <select value={value.period} onChange={(event) => update({ period: event.target.value as TrendFilterState['period'] })} className="h-10 rounded-[12px] border border-white/[0.08] bg-[#070c18] px-3 text-[12px] font-bold text-white">
        <option value="24h">24h</option>
        <option value="7d">7j</option>
        <option value="30d">30j</option>
      </select>
      <select value={value.verdict} onChange={(event) => update({ verdict: event.target.value as TrendFilterState['verdict'] })} className="h-10 rounded-[12px] border border-white/[0.08] bg-[#070c18] px-3 text-[12px] font-bold text-white">
        <option value="all">Tous verdicts</option>
        <option value="post_now">A poster</option>
        <option value="good_potential">Potentiel</option>
        <option value="watch">Surveiller</option>
        <option value="twist_it">Detourner</option>
        <option value="avoid">Eviter</option>
      </select>
      <select value={value.sort} onChange={(event) => update({ sort: event.target.value as TrendFilterState['sort'] })} className="h-10 rounded-[12px] border border-white/[0.08] bg-[#070c18] px-3 text-[12px] font-bold text-white">
        <option value="score">Score</option>
        <option value="freshness">Fraicheur</option>
        <option value="confidence">Confiance</option>
        <option value="low_saturation">Saturation basse</option>
        <option value="sample_size">Sample size</option>
      </select>
    </div>
  );
}
