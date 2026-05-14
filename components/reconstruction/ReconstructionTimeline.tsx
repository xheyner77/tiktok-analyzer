'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';
import { ReconstructionSequenceCard } from './ReconstructionSequenceCard';

export function ReconstructionTimeline({ plan }: { plan: ReconstructionPlan }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/18 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.15),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(232,121,249,0.15),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-4 shadow-[0_34px_130px_-82px_rgba(34,211,238,0.92)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/75">Timeline optimisee</p>
          <h3 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">Nouvel ordre de montage</h3>
        </div>
        <span className="w-fit rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-gray-300">
          {plan.optimizedStructure.length} sequences
        </span>
      </div>

      <div className="relative">
        <div className="absolute bottom-7 left-[1.85rem] top-7 w-px bg-gradient-to-b from-cyan-300/10 via-cyan-300/50 to-fuchsia-300/10" />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.22 }}
          variants={{ visible: { transition: { staggerChildren: 0.075 } } }}
          className="space-y-3"
        >
          {plan.optimizedStructure.map((sequence, index) => (
            <ReconstructionSequenceCard
              key={sequence.id}
              sequence={sequence}
              index={index}
              active={activeIndex === index}
              onActivate={() => setActiveIndex(index)}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
