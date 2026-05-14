'use client';

import { motion } from 'framer-motion';
import type { ReconstructionSequence } from '@/types/reconstruction';
import { moveLabel, sequenceTone } from '@/lib/reconstruction/scoring';

const premiumEase = [0.22, 1, 0.36, 1] as const;

export function ReconstructionSequenceCard({
  sequence,
  index,
  active,
  onActivate,
}: {
  sequence: ReconstructionSequence;
  index: number;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <motion.button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      variants={{
        hidden: { opacity: 0, y: 18, filter: 'blur(7px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
      }}
      transition={{ type: 'spring', stiffness: 160, damping: 22, mass: 0.8 }}
      whileHover={{ x: 5, scale: 1.01 }}
      className={`group relative grid w-full gap-3 rounded-2xl border p-3 text-left transition duration-300 sm:grid-cols-[6.4rem_1fr_auto] sm:items-center ${
        active
          ? 'border-cyan-300/35 bg-white/[0.065] shadow-[0_0_42px_-24px_rgba(34,211,238,0.95)]'
          : 'border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.022))] hover:border-cyan-300/24 hover:bg-white/[0.045]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border text-[10px] font-black shadow-[0_0_30px_-12px_rgba(34,211,238,0.95)] ${active ? 'border-cyan-200/60 bg-cyan-200/18 text-white' : 'border-cyan-300/32 bg-cyan-300/10 text-cyan-100'}`}>
          {index + 1}
        </span>
        <span className="text-xs font-black text-cyan-100">{sequence.start}-{sequence.end}</span>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-white">{sequence.type}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${sequenceTone(sequence.type)}`}>
            {moveLabel(sequence.move)}
          </span>
        </div>
        <p className="mt-1 text-xs font-black leading-5 text-white/90">{sequence.title}</p>
        <p className="mt-1 text-xs leading-5 text-gray-300">{sequence.recommendation}</p>
        <p className="mt-1 text-[11px] leading-4 text-cyan-100/72">{sequence.expectedImpact}</p>
        {sequence.sourceIssue ? (
          <p className="mt-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-[11px] leading-4 text-gray-500 transition group-hover:border-cyan-300/18 group-hover:text-gray-300">
            Signal source: {sequence.sourceIssue}
          </p>
        ) : null}
      </div>
      <div className="hidden h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-black/24 text-cyan-100 transition group-hover:border-cyan-300/25 sm:grid">
        <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_16px_currentColor]" />
      </div>
    </motion.button>
  );
}
