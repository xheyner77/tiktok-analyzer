import type { CreatorMemoryFact, MemoryProfileUpdates } from './types';

function joinFacts(facts: CreatorMemoryFact[], type: CreatorMemoryFact['type'], limit = 3): string | undefined {
  const items = facts
    .filter((fact) => fact.type === type)
    .sort((a, b) => b.importance_score - a.importance_score || b.occurrence_count - a.occurrence_count)
    .slice(0, limit)
    .map((fact) => fact.content.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return items.length ? items.join(' ') : undefined;
}

export function buildProfileUpdatesFromFacts(facts: CreatorMemoryFact[]): MemoryProfileUpdates {
  return {
    creatorStyleSummary: joinFacts(facts, 'style') ?? joinFacts(facts, 'audience'),
    hookStyleSummary: joinFacts(facts, 'hook'),
    commonMistakesSummary: joinFacts(facts, 'mistake'),
    strongestFormatsSummary: joinFacts(facts, 'format'),
    weakPatternsSummary: joinFacts([...facts.filter((fact) => fact.type === 'retention'), ...facts.filter((fact) => fact.type === 'structure')], 'retention') ?? joinFacts(facts, 'structure'),
    v2OpportunitiesSummary: joinFacts(facts, 'v2'),
  };
}
