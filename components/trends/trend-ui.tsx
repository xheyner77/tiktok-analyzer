'use client';

import type { TrendCategory, TrendEffort, TrendStage, TrendUrgency, TrendVerdict } from '@/lib/trends/trend-types';

export type TrendFilterKey = 'all' | 'post_now' | 'early_signal' | 'growth' | 'twist_it' | 'avoid' | 'saturated';
export type TrendSortKey = 'opportunity' | 'momentum' | 'low_saturation' | 'urgency' | 'easy';

export const filterOptions: Array<{ id: TrendFilterKey; label: string }> = [
  { id: 'all', label: 'Toutes' },
  { id: 'post_now', label: 'À poster maintenant' },
  { id: 'early_signal', label: 'Early' },
  { id: 'growth', label: 'En croissance' },
  { id: 'twist_it', label: 'À détourner' },
  { id: 'avoid', label: 'À éviter' },
  { id: 'saturated', label: 'Saturées' },
];

export const sortOptions: Array<{ id: TrendSortKey; label: string }> = [
  { id: 'opportunity', label: 'Meilleur score' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'low_saturation', label: 'Moins saturé' },
  { id: 'urgency', label: 'Urgence' },
  { id: 'easy', label: 'Plus facile à produire' },
];

export const categoryLabels: Record<TrendCategory, string> = {
  hook_format: 'Hook / format',
  storytelling: 'Storytelling',
  business: 'Business',
  ecommerce: 'E-commerce',
  education: 'Éducation',
  creator_growth: 'Creator growth',
  entertainment: 'Entertainment',
  visual_format: 'Format visuel',
  audio_pattern: 'Audio pattern',
  carousel: 'Carrousel',
};

export const stageLabels: Record<TrendStage, string> = {
  early_signal: 'Early signal',
  growth: 'Growth',
  peak: 'Peak',
  saturated: 'Saturated',
  declining: 'Declining',
  unstable: 'Unstable',
};

export const verdictLabels: Record<TrendVerdict, string> = {
  post_now: 'À poster maintenant',
  good_potential: 'Bon potentiel',
  watch: 'À surveiller',
  twist_it: 'À détourner',
  avoid: 'À éviter',
};

export const urgencyLabels: Record<TrendUrgency, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

export const urgencyWeight: Record<TrendUrgency, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const effortLabels: Record<TrendEffort, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
};

export const difficultyLabels = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

export const stageStyles: Record<TrendStage, string> = {
  early_signal: 'border-cyan-200/25 bg-cyan-300/[0.11] text-cyan-100 shadow-[0_0_24px_-14px_rgba(34,211,238,0.9)]',
  growth: 'border-violet-200/25 bg-violet-400/[0.12] text-violet-100 shadow-[0_0_24px_-14px_rgba(139,92,246,0.95)]',
  peak: 'border-amber-200/25 bg-amber-300/[0.105] text-amber-100 shadow-[0_0_24px_-14px_rgba(251,191,36,0.72)]',
  saturated: 'border-rose-200/25 bg-rose-400/[0.105] text-rose-100 shadow-[0_0_24px_-14px_rgba(244,63,94,0.78)]',
  declining: 'border-slate-200/16 bg-slate-300/[0.08] text-slate-200 shadow-[0_0_24px_-14px_rgba(148,163,184,0.55)]',
  unstable: 'border-fuchsia-200/25 bg-fuchsia-400/[0.105] text-fuchsia-100 shadow-[0_0_24px_-14px_rgba(217,70,239,0.82)]',
};

export const verdictStyles: Record<TrendVerdict, string> = {
  post_now: 'border-emerald-200/25 bg-emerald-300/[0.1] text-emerald-100',
  good_potential: 'border-cyan-200/20 bg-cyan-300/[0.085] text-cyan-100',
  watch: 'border-slate-200/14 bg-white/[0.045] text-slate-300',
  twist_it: 'border-amber-200/22 bg-amber-300/[0.09] text-amber-100',
  avoid: 'border-rose-200/22 bg-rose-300/[0.09] text-rose-100',
};

export const healthStyles = {
  strong: 'border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-100',
  good: 'border-violet-200/20 bg-violet-300/[0.08] text-violet-100',
  watch: 'border-slate-200/14 bg-white/[0.045] text-slate-300',
  risky: 'border-amber-200/22 bg-amber-300/[0.09] text-amber-100',
  dead: 'border-rose-200/22 bg-rose-300/[0.09] text-rose-100',
};

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function percent(value: number) {
  return `${Math.max(4, Math.min(96, value))}%`;
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]', className)}>
      {children}
    </span>
  );
}

export function Progress({ value, tone = 'cyan' }: { value: number; tone?: 'cyan' | 'violet' | 'amber' | 'rose' }) {
  const fills = {
    cyan: 'from-cyan-300 to-violet-400',
    violet: 'from-violet-300 to-fuchsia-400',
    amber: 'from-amber-200 to-orange-400',
    rose: 'from-rose-300 to-fuchsia-500',
  };

  return (
    <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.075]">
      <div className={cx('h-full rounded-full bg-gradient-to-r shadow-[0_0_18px_-8px_currentColor]', fills[tone])} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ScoreRing({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-[82px] w-[82px] p-[6px]' : 'h-[118px] w-[118px] p-[8px]';
  const scoreSize = size === 'sm' ? 'text-[23px]' : 'text-[31px]';

  return (
    <div
      className={cx('grid shrink-0 place-items-center rounded-full shadow-[0_0_42px_-22px_rgba(34,211,238,0.95)]', dimension)}
      style={{ background: `conic-gradient(from 220deg,#22d3ee 0 ${score}%,rgba(255,255,255,0.08) ${score}% 100%)` }}
    >
      <div className="grid h-full w-full place-items-center rounded-full border border-white/[0.07] bg-[#06101f]">
        <div className="text-center leading-none">
          <p className={cx('font-black tracking-[-0.055em] text-white', scoreSize)}>{score}</p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100/75">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function ActionButton({ children, onClick, tone = 'dark' }: { children: React.ReactNode; onClick: () => void; tone?: 'primary' | 'dark' | 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'min-h-[40px] rounded-[10px] px-4 text-[12px] font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-200/25',
        tone === 'primary' && 'bg-[linear-gradient(135deg,#22d3ee,#8b5cf6_58%,#d946ef)] text-white shadow-[0_18px_38px_-24px_rgba(34,211,238,0.95)] hover:brightness-110',
        tone === 'dark' && 'border border-white/[0.085] bg-white/[0.045] text-slate-200 hover:border-cyan-200/20 hover:bg-white/[0.075] hover:text-white',
        tone === 'danger' && 'border border-rose-200/18 bg-rose-300/[0.08] text-rose-100 hover:bg-rose-300/[0.12]',
      )}
    >
      {children}
    </button>
  );
}

export function SignalMetric({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'violet' | 'amber' | 'rose' }) {
  return (
    <div className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p>
        <p className="font-mono text-[12px] font-black text-white">{value}</p>
      </div>
      <div className="mt-2">
        <Progress value={value} tone={tone} />
      </div>
    </div>
  );
}
