'use client';

import { useEffect, useRef, useState } from 'react';
import { AnalysisSection } from '@/lib/types';
import { getScoreColor, getRatingColors } from '@/lib/utils';

interface AnalysisCardProps {
  title: string;
  icon: React.ReactNode;
  data: AnalysisSection;
  delay?: number;
}

export default function AnalysisCard({
  title,
  icon,
  data,
  delay = 0,
}: AnalysisCardProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) {
      console.error(`[DEBUG][AnalysisCard "${title}"] data prop is MISSING:`, data);
      return;
    }
    const issues: string[] = [];
    if (typeof data.score !== 'number')       issues.push(`score=${data.score}`);
    if (!data.rating)                          issues.push(`rating=${data.rating}`);
    if (!data.analysis)                        issues.push(`analysis=${data.analysis}`);
    if (!Array.isArray(data.strengths))        issues.push(`strengths=${data.strengths}`);
    if (!Array.isArray(data.weaknesses))       issues.push(`weaknesses=${data.weaknesses}`);

    if (issues.length > 0) {
      console.error(`[DEBUG][AnalysisCard "${title}"] unexpected props:`, issues.join(' | '), '— full data:', data);
    } else {
      console.log(`[DEBUG][AnalysisCard "${title}"] OK — score:${data.score} rating:${data.rating}`);
    }
  }, [title, data]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setAnimatedScore(data.score), 200);
    }, delay);
    return () => clearTimeout(timeout);
  }, [data.score, delay]);

  const scoreColor = getScoreColor(data.score);

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${scoreColor}18`, color: scoreColor }}
          >
            {icon}
          </div>
          <span className="font-semibold text-sm text-white">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-black tabular-nums" style={{ color: scoreColor }}>
            {data.score}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getRatingColors(data.rating)}`}>
            {data.rating}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full bg-white/[0.07] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${animatedScore}%`,
            backgroundColor: scoreColor,
            boxShadow: `0 0 10px ${scoreColor}50`,
          }}
        />
      </div>

      {/* Analysis text */}
      <p className="text-gray-400 text-xs leading-relaxed mb-4">{data.analysis}</p>

      {/* Strengths */}
      {(data.strengths?.length ?? 0) > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.18em] mb-2">Points forts</p>
          <ul className="space-y-1.5">
            {(data.strengths ?? []).map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 text-xs shrink-0 mt-0.5 font-bold">✓</span>
                <span className="text-xs text-gray-400">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {(data.weaknesses?.length ?? 0) > 0 && (
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.18em] mb-2">Points faibles</p>
          <ul className="space-y-1.5">
            {(data.weaknesses ?? []).map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-400 text-xs shrink-0 mt-0.5 font-bold">×</span>
                <span className="text-xs text-gray-400">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
