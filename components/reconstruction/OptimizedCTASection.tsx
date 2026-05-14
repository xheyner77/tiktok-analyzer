'use client';

import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';

export function OptimizedCTASection({ plan }: { plan: ReconstructionPlan }) {
  const primary = plan.optimizedCTAs[0];
  const metrics = primary
    ? [
      ['Moment optimal', primary.optimalMoment],
      ['Objectif engagement', primary.engagementGoal],
      ['Objectif commentaires', primary.commentGoal],
      ['Objectif watch time', primary.watchTimeGoal],
    ]
    : [];

  return (
    <motion.div whileHover={{ y: -3, scale: 1.004 }} className="rounded-3xl border border-cyan-300/16 bg-cyan-300/[0.045] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/80">CTA optimise</p>
      <p className="mt-3 text-lg font-black leading-7 text-white">"{primary?.cta ?? plan.source.repost.cta}"</p>
      <p className="mt-2 text-xs leading-5 text-gray-400">{primary?.why ?? 'CTA aligne sur le moment ou le viewer a deja recu la preuve.'}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/18 p-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</p>
            <p className="mt-1 text-xs font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
