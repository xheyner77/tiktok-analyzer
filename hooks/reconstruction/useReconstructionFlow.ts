'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReconstructionFlowStep } from '@/types/reconstruction';

const DEFAULT_STEP_DURATION = 520;

export type ReconstructionFlowStatus = 'idle' | 'processing' | 'complete';

export function useReconstructionFlow(flow: ReconstructionFlowStep[], autoStart = false) {
  const [status, setStatus] = useState<ReconstructionFlowStatus>(autoStart ? 'processing' : 'idle');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (status !== 'processing') return;
    if (activeIndex >= flow.length - 1) {
      const doneTimer = window.setTimeout(() => setStatus('complete'), DEFAULT_STEP_DURATION);
      return () => window.clearTimeout(doneTimer);
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => Math.min(flow.length - 1, current + 1));
    }, DEFAULT_STEP_DURATION);

    return () => window.clearTimeout(timer);
  }, [activeIndex, flow.length, status]);

  const progress = useMemo(() => {
    if (!flow.length) return 100;
    if (status === 'complete') return 100;
    if (status === 'idle') return 0;
    return Math.round(((activeIndex + 0.55) / flow.length) * 100);
  }, [activeIndex, flow.length, status]);

  const start = () => {
    setActiveIndex(0);
    setStatus('processing');
  };

  const reset = () => {
    setActiveIndex(0);
    setStatus('idle');
  };

  return {
    activeStep: flow[activeIndex],
    activeIndex,
    progress,
    status,
    isProcessing: status === 'processing',
    isComplete: status === 'complete',
    start,
    reset,
  };
}
