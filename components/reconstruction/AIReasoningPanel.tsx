'use client';

import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';

const premiumEase = [0.22, 1, 0.36, 1] as const;

export function AIReasoningPanel({ plan }: { plan: ReconstructionPlan }) {
  return (
    <motion.div whileHover={{ y: -3, scale: 1.004 }} className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-[0_24px_90px_-70px_rgba(168,85,247,0.7)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/75">Pourquoi cette structure performera mieux</p>
      <div className="mt-4 grid gap-3">
        {plan.aiReasoning.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: index * 0.08, ease: premiumEase }}
            className="rounded-2xl border border-white/[0.07] bg-black/18 p-3"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-vn-fuchsia/75">{item.title}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-gray-200">{item.body}</p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-600">Signal: {item.signal}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
