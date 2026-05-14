import type { AnalysisResult } from '../types';
import type { AnalysisEngineContext } from '../analysis-engine';
import { analyzeCta } from './cta-analyzer';
import { analyzeCreatorMemory } from './creator-memory-engine';
import { analyzeHook } from './hook-analyzer';
import { analyzeRetention } from './retention-analyzer';
import { buildRepostStrategy } from './repost-strategist';
import { composeBrainScore } from './scoring';
import type { ViralynzBrainResult } from './types';
import { buildBrainInput } from './utils';

export function runViralynzBrain(result: AnalysisResult, context: AnalysisEngineContext = {}): ViralynzBrainResult {
  const input = buildBrainInput(result, context);
  const hook = analyzeHook(input);
  const retention = analyzeRetention(input);
  const cta = analyzeCta(input);
  const memory = analyzeCreatorMemory(input);
  const repost = buildRepostStrategy(input, hook, retention, cta);
  const scoring = composeBrainScore(hook, retention, cta, repost);
  const diagnostics = [...hook.diagnostics, ...retention.diagnostics, ...cta.diagnostics, ...memory.diagnostics, ...repost.diagnostics]
    .filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index)
    .slice(0, 8);

  return {
    input,
    hook,
    retention,
    cta,
    repost,
    memory,
    scoring,
    diagnostics,
    engineMeta: {
      version: 'viralynz-brain-v1',
      modules: ['hook_analyzer', 'retention_analyzer', 'cta_analyzer', 'creator_memory_engine', 'repost_strategist'],
      strictJsonContracts: true,
      fallbackMode: diagnostics.some((item) => item.confidence < 0.45) ? 'mixed' : 'local_structured',
    },
  };
}

export type { ViralynzBrainResult } from './types';
