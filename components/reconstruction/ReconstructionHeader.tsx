'use client';

import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';
import type { ReconstructionFlowStatus } from '@/hooks/reconstruction/useReconstructionFlow';
import { ReconstructionMetrics } from './ReconstructionMetrics';

export function ReconstructionHeader({
  plan,
  status,
  progress,
  activeIndex,
  onGenerate,
}: {
  plan: ReconstructionPlan;
  status: ReconstructionFlowStatus;
  progress: number;
  activeIndex: number;
  onGenerate: () => void;
}) {
  const isProcessing = status === 'processing';
  const isComplete = status === 'complete';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-300/18 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(232,121,249,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-4 shadow-[0_34px_130px_-82px_rgba(34,211,238,0.92)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="grid gap-5 lg:grid-cols-[1fr_0.86fr] lg:items-start">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.95)]" />
            Reconstruction IA
          </div>
          <h3 className="mt-4 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">
            Viralynz reconstruit l'ordre, pas la video finale.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
            Structure optimisee, hooks alternatifs, cuts recommandes, relances d'attention et CTA places au moment ou le viewer est encore present.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isProcessing}
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white shadow-[0_18px_65px_-34px_rgba(232,121,249,0.95)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
            >
              {isProcessing ? 'Generation en cours...' : isComplete ? 'Regenerer reconstruction IA' : '✨ Generer reconstruction IA'}
            </button>
            <span className="text-xs font-semibold text-gray-500">{plan.mainIssue.title}: {plan.mainIssue.description}</span>
          </div>
        </div>
        <ReconstructionMetrics plan={plan} isProcessing={isProcessing} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-vn-fuchsia"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-7">
          {plan.flow.map((step, index) => (
            <motion.div
              key={step.id}
              animate={{
                opacity: status === 'idle' ? 0.42 : index <= activeIndex || isComplete ? 1 : 0.42,
                y: isProcessing && index === activeIndex ? -2 : 0,
              }}
              className={`rounded-xl border px-2.5 py-2 ${
                index === activeIndex && isProcessing
                  ? 'border-cyan-300/35 bg-cyan-300/[0.08]'
                  : index <= activeIndex || isComplete
                    ? 'border-white/[0.1] bg-white/[0.045]'
                    : 'border-white/[0.06] bg-white/[0.025]'
              }`}
            >
              <p className="text-[10px] font-black uppercase leading-4 text-white">{step.label}</p>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-gray-500">{step.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
