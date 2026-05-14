'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';
import { clampScore } from '@/lib/reconstruction/scoring';

const premiumEase = [0.22, 1, 0.36, 1] as const;

export function RetentionSimulationChart({ plan, isProcessing = false }: { plan: ReconstructionPlan; isProcessing?: boolean }) {
  const chart = useMemo(() => {
    const points = plan.retentionSimulation;
    const current = points.map((point, index) => ({
      x: 16 + index * (204 / Math.max(1, points.length - 1)),
      y: 24 + (100 - clampScore(point.current, 18, 96)) * 1.04,
      meta: point,
    }));
    const optimized = points.map((point, index) => ({
      x: 16 + index * (204 / Math.max(1, points.length - 1)),
      y: 24 + (100 - clampScore(point.optimized, 18, 96)) * 1.04,
      meta: point,
    }));
    const toPath = (pathPoints: typeof current) => pathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    return { current, optimized, currentPath: toPath(current), optimizedPath: toPath(optimized) };
  }, [plan.retentionSimulation]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_88%_0%,rgba(52,211,153,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.018))] p-4 shadow-[0_28px_110px_-78px_rgba(52,211,153,0.62)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/75">Simulation de retention</p>
          <h3 className="mt-2 text-lg font-black text-white">Avant / apres structure</h3>
        </div>
        <motion.div
          animate={isProcessing ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.9, repeat: isProcessing ? Infinity : 0 }}
          className="rounded-2xl border border-emerald-300/18 bg-emerald-300/[0.055] px-3 py-2 text-right"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/70">Potentiel</p>
          <p className="text-xl font-black text-white">{plan.optimizedRetentionScore}<span className="text-xs text-gray-500">/100</span></p>
        </motion.div>
      </div>

      <svg viewBox="0 0 240 136" className="mt-4 h-44 w-full overflow-visible" role="img" aria-label="Simulation de retention actuelle et optimisee">
        <defs>
          <linearGradient id="retention-current" x1="0" x2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="retention-optimized" x1="0" x2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
          <linearGradient id="retention-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line key={line} x1="12" x2="228" y1={28 + line * 26} y2={28 + line * 26} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}
        <motion.path
          d={`${chart.optimizedPath} L 220 124 L 16 124 Z`}
          fill="url(#retention-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: isProcessing ? [0.12, 0.28, 0.12] : 1 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.55 }}
        />
        <motion.path
          d={chart.currentPath}
          fill="none"
          stroke="url(#retention-current)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.45 }}
          whileInView={{ pathLength: 1, opacity: 0.8 }}
          viewport={{ once: true }}
          transition={{ duration: 1.15, ease: premiumEase }}
        />
        <motion.path
          d={chart.optimizedPath}
          fill="none"
          stroke="url(#retention-optimized)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="drop-shadow(0 0 10px rgba(34,211,238,0.38))"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.35, delay: 0.18, ease: premiumEase }}
        />
        {chart.current.filter((point) => point.meta.type === 'drop' || point.meta.type === 'relaunch').map((point, index) => (
          <motion.g key={point.meta.id} initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 + index * 0.12, type: 'spring', stiffness: 180, damping: 16 }}>
            <circle cx={point.x} cy={point.y} r="8" fill="rgba(251,113,133,0.12)" stroke="rgba(251,113,133,0.55)" />
            <circle cx={point.x} cy={point.y} r="3" fill={point.meta.type === 'drop' ? '#fb7185' : '#34d399'}>
              <animate attributeName="r" values="3;6;3" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </motion.g>
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-rose-300/14 bg-rose-400/[0.055] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-100/70">Avant</p>
          <p className="mt-1 text-xs text-gray-300">Drop visible avant payoff</p>
        </div>
        <div className="rounded-xl border border-emerald-300/14 bg-emerald-300/[0.055] px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/70">Apres</p>
          <p className="mt-1 text-xs text-gray-300">Relances avant les creux</p>
        </div>
      </div>
    </div>
  );
}
