import type { AnalysisResult, RepostVersion } from '@/lib/types';
import type { ReconstructionInput, ReconstructionPlan } from '@/types/reconstruction';
import { buildReconstructionIA, buildReconstructionPromptInput } from '@/lib/ai-reconstruction-engine';
import { normalizeReconstructionPlan } from './normalize';
import { buildReconstructionPrompts } from './prompts';

export function buildReconstructionInputFromAnalysis(
  result: AnalysisResult,
  body: Record<string, unknown> = {}
): ReconstructionInput {
  const promptInput = buildReconstructionPromptInput(result, body);
  return {
    niche: promptInput.niche,
    objective: promptInput.objective,
    durationSec: promptInput.durationSec,
    currentStructure: promptInput.currentStructure,
    drops: promptInput.dropsDetected,
    hookScore: promptInput.hookScore,
    ctaScore: promptInput.ctaScore,
    rhythm: promptInput.rhythm,
    contentType: promptInput.contentType,
  };
}

export function buildStructuredReconstruction({
  result,
  repost,
  body = {},
}: {
  result: AnalysisResult;
  repost: RepostVersion;
  body?: Record<string, unknown>;
}): ReconstructionPlan {
  const input = buildReconstructionInputFromAnalysis(result, body);
  const prompts = buildReconstructionPrompts(input);
  void prompts;

  const legacy = result.reconstructionIA ?? buildReconstructionIA(result, body);
  return normalizeReconstructionPlan({
    legacy,
    repost,
    currentRetentionScore: result.retention?.score ?? result.viralityScore,
    currentViralityScore: result.viralityScore,
  });
}
