import { useEffect } from 'react';
import Link from 'next/link';
import { Improvement, Priority } from '@/lib/types';

interface ImprovementTipsProps {
  improvements: Improvement[];
  plan: 'free' | 'pro' | 'elite';
}

const VISIBLE_FREE = 3;

const priorityConfig: Record<
  Priority,
  { label: string; className: string; dot: string }
> = {
  haute: {
    label: 'Priorité haute',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-500',
  },
  moyenne: {
    label: 'Priorité moyenne',
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-500',
  },
  basse: {
    label: 'Priorité basse',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-500',
  },
};

const fallbackConfig = {
  label: 'Recommandation',
  className: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  dot: 'bg-gray-500',
};

function TipItem({ item, index }: { item: Improvement; index: number }) {
  const config = priorityConfig[item.priority as Priority] ?? fallbackConfig;
  return (
    <li className="flex items-start gap-3 p-3 rounded-xl bg-[#0e0e0e] border border-[#1a1a1a]">
      <span className="shrink-0 w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-gray-500 mt-0.5">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 leading-relaxed">{item.tip}</p>
        <div className="mt-2">
        <li className="flex items-start gap-3 p-3 rounded-xl bg-[#0e0e0e] border border-[#1a1a1a]">
  <span className="shrink-0 w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-gray-500 mt-0.5">
    {index + 1}
  </span>
  <div className="flex-1 min-w-0">
    <p className="text-xs text-gray-300 leading-relaxed">{item.tip}</p>
    <div className="mt-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        Recommandation
      </span>
    </div>
  </div>
</li>
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
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 card-glow">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff0050]/20 to-[#7928ca]/20 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#ff0050]">
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
      <ul className="space-y-3">
        {visible.map((item, i) => (
          <TipItem key={i} item={item} index={i} />
        ))}
      </ul>

      {/* Locked tips (Free plan) */}
      {locked.length > 0 && (
        <div className="relative mt-3">
          {/* Blurred tips — real content behind the lock */}
          <ul className="space-y-3 blur-sm pointer-events-none select-none" aria-hidden>
            {locked.map((item, i) => (
              <TipItem key={i} item={item} index={VISIBLE_FREE + i} />
            ))}
          </ul>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gradient-to-b from-[#111]/50 to-[#111]/96">
            <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#7928ca]/15 border border-[#7928ca]/25 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#b060ff]">
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
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 transition-opacity shadow-md shadow-[#ff0050]/20"
              >
                Débloquer tous les conseils →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
