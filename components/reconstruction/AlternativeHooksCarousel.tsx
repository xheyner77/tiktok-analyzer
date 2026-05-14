'use client';

import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';

function formatAngle(angle: string) {
  return angle.replace('_', ' ');
}

export function AlternativeHooksCarousel({ plan, scaleMode = false }: { plan: ReconstructionPlan; scaleMode?: boolean }) {
  const hooks = plan.alternativeHooks.slice(0, scaleMode ? 4 : 3);

  return (
    <div className="overflow-hidden rounded-3xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.045] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-vn-fuchsia/80">Hooks alternatifs</p>
          <h3 className="mt-2 text-lg font-black text-white">Angles a tester</h3>
        </div>
        <span className="rounded-full border border-white/[0.1] bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase text-gray-300">
          {hooks.length} variantes
        </span>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
        {hooks.map((item) => (
          <motion.article
            key={item.id}
            whileHover={{ y: -4, scale: 1.015 }}
            className="min-w-[17rem] rounded-2xl border border-white/[0.08] bg-black/22 p-4 shadow-[0_18px_70px_-56px_rgba(232,121,249,0.85)]"
          >
            <span className="rounded-full border border-cyan-300/18 bg-cyan-300/[0.08] px-2.5 py-1 text-[10px] font-black uppercase text-cyan-100">
              {formatAngle(item.angle)}
            </span>
            <p className="mt-3 text-base font-black leading-6 text-white">"{item.hook}"</p>
            <p className="mt-3 text-xs leading-5 text-gray-400">{item.why}</p>
            <p className="mt-2 text-[11px] font-bold leading-4 text-vn-fuchsia/75">{item.bestFor}</p>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
