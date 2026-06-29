'use client';

import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';

export function ReconstructionMetrics({ plan, isProcessing = false }: { plan: ReconstructionPlan; isProcessing?: boolean }) {
  const displayMetrics = plan.metrics.map((metric) => {
    const improves = metric.after >= metric.before;
    return {
      ...metric,
      improves,
      afterLabel: improves ? String(metric.after) : '—',
      description: improves ? metric.description : 'Projection non disponible.',
    };
  });

  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-black/22 p-2 sm:grid-cols-4 lg:grid-cols-2">
      {displayMetrics.map((metric, index) => (
        <motion.div
          key={metric.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="rounded-xl bg-white/[0.045] px-3 py-3 text-center"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{metric.label}</p>
          <div className="mt-1 flex items-baseline justify-center gap-1.5">
            <span className="text-sm font-black text-gray-500">{metric.before}</span>
            <span className="text-[10px] text-gray-700">{'->'}</span>
            <motion.span
              animate={isProcessing ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
              transition={{ duration: 0.8, repeat: isProcessing ? Infinity : 0 }}
              className="text-xl font-black text-white"
            >
              {metric.afterLabel}
            </motion.span>
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-600">{metric.description}</p>
        </motion.div>
      ))}
    </div>
  );
}
