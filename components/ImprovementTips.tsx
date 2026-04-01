import { useEffect } from 'react';
import Link from 'next/link';
import { Improvement, Priority } from '@/lib/types';

interface ImprovementTipsProps {
  improvements: Improvement[];
  plan: 'free' | 'pro' | 'elite';
}

const VISIBLE_FREE = 3;

const priorityConfig: Record<Priority, { label: string; className: string; dot: string }> = {
  haute: {
    label: 'Priorité haute',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  },
  moyenne: {
    label: 'Priorité moyenne',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  basse: {
    label: 'Priorité basse',
    className: 'bg-vn-indigo/10 text-vn-indigo/80 border border-vn-indigo/20',
    dot: 'bg-vn-indigo/70',
  },
};

const fallbackConfig = {
  label: 'Recommandation',
  className: 'bg-white/[0.06] text-gray-400 border border-white/[0.08]',
  dot: 'bg-gray-500',
};

function TipItem({ item, index }: { item: Improvement; index: number }) {
  const config = priorityConfig[item.priority as Priority] ?? fallbackConfig;
  return (
    <li className="flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] transition-colors">
      <span className="shrink-0 w-6 h-6 rounded-full bg-white/[0.07] flex items-center justify-center text-xs font-bold text-gray-400 mt-0.5">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 leading-relaxed">{item.tip}</p>
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>
        </div>
      </div>
    </li>
  );
}

export default function ImprovementTips({ improvements, plan }: ImprovementTipsProps) {
  useEffect(() => {
    if (!Array.isArray(improvements)) {
      console.error('[DEBUG][ImprovementTips] improvements is not an array:', improvements);
      return;
    }
    console.log('[DEBUG][ImprovementTips] received', improvements.length, 'improvements — priorities:',
      improvements.map((i, idx) => `[${idx}] ${i.priority}`)
    );
    const VALID = ['haute', 'moyenne', 'basse'];
    improvements.forEach((imp, i) => {
      if (!VALID.includes(imp.priority)) {
        console.error(`[DEBUG][ImprovementTips] improvements[${i}].priority INVALID:`, imp.priority);
      }
      if (!imp.tip) {
        console.error(`[DEBUG][ImprovementTips] improvements[${i}].tip is missing:`, imp.tip);
      }
    });
  }, [improvements]);

  const isFreePlan = plan === 'free';
  const visible = isFreePlan ? improvements.slice(0, VISIBLE_FREE) : improvements;
  const locked = isFreePlan ? improvements.slice(VISIBLE_FREE) : [];

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vn-fuchsia/20 to-vn-violet/20 border border-vn-fuchsia/15 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-vn-fuchsia/80">
            <path d="M10 1a6 6 0 0 1 3.196 11.064.75.75 0 0 1-.064.372l-1.154 2.83a.75.75 0 0 1-.697.47H8.72a.75.75 0 0 1-.698-.47l-1.153-2.83a.75.75 0 0 1-.064-.372A6 6 0 0 1 10 1zm.75 8a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0V9zm0-4.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5zM8.75 16.5a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-sm text-white">Conseils d&apos;amélioration</p>
          <p className="text-xs text-gray-500">
            {isFreePlan
              ? `${VISIBLE_FREE} sur ${improvements.length} recommandations`
              : `${improvements.length} recommandations personnalisées`}
          </p>
        </div>
      </div>

      {/* Visible tips */}
      <ul className="space-y-2.5">
        {visible.map((item, i) => (
          <TipItem key={i} item={item} index={i} />
        ))}
      </ul>

      {/* Locked tips (Free plan) */}
      {locked.length > 0 && (
        <div className="relative mt-2.5">
          <ul className="space-y-2.5 blur-sm pointer-events-none select-none" aria-hidden>
            {locked.map((item, i) => (
              <TipItem key={i} item={item} index={VISIBLE_FREE + i} />
            ))}
          </ul>

          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gradient-to-b from-transparent via-vn-bg/70 to-vn-bg/96">
            <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-vn-violet/15 border border-vn-violet/25 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-vn-violet">
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {locked.length} conseil{locked.length > 1 ? 's' : ''} verrouillé{locked.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                  Passe en premium pour débloquer tous les conseils
                </p>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-vn-fuchsia/40 to-vn-indigo/40 opacity-60 blur-md group-hover:opacity-90 transition-all duration-300" aria-hidden />
                <Link
                  href="/pricing"
                  className="relative inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-[0_4px_20px_-4px_rgba(232,121,249,0.5)]"
                >
                  Débloquer tous les conseils →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
