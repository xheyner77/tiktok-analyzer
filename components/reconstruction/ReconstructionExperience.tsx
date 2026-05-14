'use client';

import { motion } from 'framer-motion';
import type { ReconstructionPlan } from '@/types/reconstruction';
import { useReconstructionFlow } from '@/hooks/reconstruction/useReconstructionFlow';
import { AIReasoningPanel } from './AIReasoningPanel';
import { AlternativeHooksCarousel } from './AlternativeHooksCarousel';
import { OptimizedCTASection } from './OptimizedCTASection';
import { ReconstructionHeader } from './ReconstructionHeader';
import { ReconstructionTimeline } from './ReconstructionTimeline';
import { RetentionSimulationChart } from './RetentionSimulationChart';

export function ReconstructionExperience({
  plan,
  scaleMode = false,
}: {
  plan: ReconstructionPlan;
  scaleMode?: boolean;
}) {
  const flow = useReconstructionFlow(plan.flow);
  const showOutput = flow.isComplete;

  return (
    <div className="space-y-5">
      <ReconstructionHeader
        plan={plan}
        status={flow.status}
        progress={flow.progress}
        activeIndex={flow.activeIndex}
        onGenerate={flow.start}
      />

      <motion.div
        initial={false}
        animate={{
          opacity: flow.status === 'idle' ? 0.72 : 1,
          filter: flow.status === 'idle' ? 'blur(1.5px)' : 'blur(0px)',
        }}
        className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"
      >
        <ReconstructionTimeline plan={plan} />
        <RetentionSimulationChart plan={plan} isProcessing={flow.isProcessing} />
      </motion.div>

      {showOutput ? (
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 130, damping: 20 }}
          className="space-y-5"
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_0.86fr]">
            <AlternativeHooksCarousel plan={plan} scaleMode={scaleMode} />
            <OptimizedCTASection plan={plan} />
          </div>
          <AIReasoningPanel plan={plan} />
        </motion.div>
      ) : (
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 text-center">
          <p className="text-sm font-black text-white">
            Clique sur Generer reconstruction IA pour lancer le moteur: detection, reordre, hooks, CTA et simulation.
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            La preview montre deja la structure calculee, puis les blocs finaux apparaissent quand le flow est termine.
          </p>
        </div>
      )}
    </div>
  );
}
