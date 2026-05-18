import type { CreatorMemoryRecord, MemoryAnalysisSource } from './types';
import { buildCreatorMemoryShortSummary } from './buildCreatorMemoryContext';
import { extractMemoryInsights } from './extractMemoryInsights';
import { mergeCreatorMemory } from './mergeCreatorMemory';
import { getCreatorMemory, insertCreatorMemoryEvent, upsertCreatorMemory } from './store';

export async function learnCreatorMemoryFromAnalysis(source: MemoryAnalysisSource): Promise<CreatorMemoryRecord | null> {
  try {
    const previous = await getCreatorMemory(source.userId);
    const beforeSummary = buildCreatorMemoryShortSummary(previous);
    const insights = await extractMemoryInsights({ source, previousMemory: previous });
    const merged = mergeCreatorMemory({ previous, insights, source });
    const saved = await upsertCreatorMemory(merged);
    if (!saved) return null;

    await insertCreatorMemoryEvent({
      userId: source.userId,
      analysisId: source.analysisId,
      eventType: 'analysis_learned',
      insights,
      beforeSummary,
      afterSummary: buildCreatorMemoryShortSummary(saved),
      confidenceDelta: Math.round(((saved.confidence_score ?? 0) - (previous?.confidence_score ?? 0)) * 1000) / 1000,
    });

    console.info('[creator-memory-v2] learned from analysis', {
      userId: source.userId,
      analysisId: source.analysisId,
      memoryLevel: saved.memory_level,
      totalAnalyses: saved.total_analyses_learned_from,
    });

    return saved;
  } catch (error) {
    console.warn('[creator-memory-v2] learning skipped:', error instanceof Error ? error.message : error);
    return null;
  }
}
