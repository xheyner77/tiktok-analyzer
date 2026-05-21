import { supabase } from '@/lib/supabase';
import type { MemoryOperation, MemoryPlan } from './types';

export async function logMemoryUsage(input: {
  userId: string;
  plan: MemoryPlan;
  operation: MemoryOperation;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}): Promise<void> {
  const { error } = await supabase.from('creator_memory_usage').insert({
    user_id: input.userId,
    plan: input.plan,
    operation: input.operation,
    model: input.model ?? null,
    input_tokens: Math.max(0, Math.round(input.inputTokens ?? 0)),
    output_tokens: Math.max(0, Math.round(input.outputTokens ?? 0)),
    estimated_cost_usd: Math.max(0, input.estimatedCostUsd ?? 0),
  });

  if (error) {
    console.warn('[memory] usage log failed:', error.message);
  }
}
