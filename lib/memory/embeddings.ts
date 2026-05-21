import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import type { CreatorMemoryFact, MemoryPlan } from './types';
import { logMemoryUsage } from './usage';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here');
}

export function getMemoryEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export async function createEmbeddingForFact(fact: CreatorMemoryFact, plan: MemoryPlan): Promise<void> {
  if (!hasOpenAIKey()) return;

  const model = getMemoryEmbeddingModel();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = `${fact.type}: ${fact.title}\n${fact.content}\nPreuve: ${fact.evidence ?? ''}`.slice(0, 1800);

  try {
    const response = await openai.embeddings.create({
      model,
      input,
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding?.length) return;

    const { error } = await supabase.from('creator_memory_embeddings').insert({
      user_id: fact.user_id,
      memory_fact_id: fact.id,
      embedding,
      embedding_model: model,
    });

    if (error) {
      console.warn('[memory] embedding insert failed, retrieval will use fallback ranking:', error.message);
    }

    await logMemoryUsage({
      userId: fact.user_id,
      plan,
      operation: 'embedding',
      model,
      inputTokens: Math.ceil(input.length / 4),
      estimatedCostUsd: 0,
    });
  } catch (error) {
    console.warn('[memory] embedding failed:', error instanceof Error ? error.message : error);
  }
}

export async function createEmbeddingsForFacts(facts: CreatorMemoryFact[], plan: MemoryPlan): Promise<void> {
  for (const fact of facts) {
    await createEmbeddingForFact(fact, plan);
  }
}
