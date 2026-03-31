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
    const timeout = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setAnimatedScore(data.score), 200);
    }, delay);
    return () => clearTimeout(timeout);
  }, [data.score, delay]);

  return (
    <div
      ref={ref}
      className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 card-glow transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-gray-400">
            {icon}
          </div>
          <span className="font-semibold text-sm text-white">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: getScoreColor(data.score) }}
          >
            {data.score}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getRatingColors(data.rating)}`}>
            {data.rating}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${animatedScore}%`,
            backgroundColor: getScoreColor(data.score),
            boxShadow: `0 0 8px ${getScoreColor(data.score)}60`,
          }}
        />
      </div>

      {/* Analysis */}
      <p className="text-gray-400 text-xs leading-relaxed mb-4">
        {data.analysis}
      </p>

      {/* Strengths */}
      {data.strengths.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Points forts
          </p>
          <ul className="space-y-1.5">
            {data.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs text-gray-400">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {data.weaknesses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Points faibles
          </p>
          <ul className="space-y-1.5">
            {data.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0"
                >
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
                <span className="text-xs text-gray-400">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
