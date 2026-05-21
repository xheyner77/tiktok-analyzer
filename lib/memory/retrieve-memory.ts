import { getMemoryPlanLimits } from './limits';
import { listMemoryFacts, listMemorySnapshots, getMemoryProfile } from './repository';
import type { CreatorMemoryFact, MemoryContext, MemoryFactType, MemoryTask } from './types';

const TASK_TYPES: Record<MemoryTask, MemoryFactType[]> = {
  analyze_video: ['mistake', 'retention', 'structure', 'hook', 'v2'],
  generate_hook: ['hook', 'mistake', 'format', 'style', 'v2'],
  generate_v2: ['v2', 'mistake', 'retention', 'structure', 'cta'],
  dashboard_memory: ['hook', 'mistake', 'format', 'v2', 'retention'],
  radar_future: ['format', 'audience', 'style', 'risk'],
};

function rankFacts(facts: CreatorMemoryFact[], preferredTypes: MemoryFactType[], query?: string): CreatorMemoryFact[] {
  const q = (query ?? '').toLowerCase();
  return [...facts].sort((a, b) => {
    const aType = preferredTypes.includes(a.type) ? 30 : 0;
    const bType = preferredTypes.includes(b.type) ? 30 : 0;
    const aQuery = q && `${a.title} ${a.content}`.toLowerCase().includes(q) ? 20 : 0;
    const bQuery = q && `${b.title} ${b.content}`.toLowerCase().includes(q) ? 20 : 0;
    const aScore = a.importance_score + a.occurrence_count * 3 + aType + aQuery;
    const bScore = b.importance_score + b.occurrence_count * 3 + bType + bQuery;
    return bScore - aScore;
  });
}

function compactFact(fact: CreatorMemoryFact): string {
  const evidence = fact.evidence ? ` Preuve: ${fact.evidence}` : '';
  return `- [${fact.type}] ${fact.title}: ${fact.content}${evidence}`.slice(0, 420);
}

export async function getMemoryContextForUser(input: {
  userId: string;
  plan: string;
  task: MemoryTask;
  query?: string;
  limit?: number;
}): Promise<MemoryContext> {
  const limits = getMemoryPlanLimits(input.plan);
  if (!limits.canLearn) {
    return {
      enabled: false,
      tier: limits.tier,
      profileSummary: '',
      facts: [],
      warnings: ['Mémoire IA verrouillée sur le plan Free.'],
      commonMistakes: [],
      v2Opportunities: [],
      recommendedStyleConstraints: [],
      prompt: '',
    };
  }

  const [profile, facts, snapshots] = await Promise.all([
    getMemoryProfile(input.userId),
    listMemoryFacts(input.userId, { limit: 80, query: input.query }),
    limits.canUseSnapshots ? listMemorySnapshots(input.userId, 2) : Promise.resolve([]),
  ]);
  const preferredTypes = TASK_TYPES[input.task] ?? TASK_TYPES.dashboard_memory;
  const limit = Math.min(input.limit ?? limits.retrievalLimit, limits.retrievalLimit);
  const rankedFacts = rankFacts(facts, preferredTypes, input.query).slice(0, limit);
  const commonMistakes = rankedFacts.filter((fact) => fact.type === 'mistake').map((fact) => fact.content).slice(0, 4);
  const v2Opportunities = rankedFacts.filter((fact) => fact.type === 'v2').map((fact) => fact.content).slice(0, 4);
  const recommendedStyleConstraints = rankedFacts
    .filter((fact) => fact.type === 'hook' || fact.type === 'style' || fact.type === 'format')
    .map((fact) => fact.content)
    .slice(0, 5);

  const profileSummary = [
    profile?.creator_style_summary,
    profile?.hook_style_summary,
    profile?.common_mistakes_summary,
    profile?.strongest_formats_summary,
    profile?.weak_patterns_summary,
    profile?.v2_opportunities_summary,
  ].filter(Boolean).join(' ');

  const snapshotText = snapshots.length
    ? `\nSnapshots long terme:\n${snapshots.map((snapshot) => `- ${snapshot.title}: ${snapshot.summary}`).join('\n')}`
    : '';
  const prompt = rankedFacts.length || profileSummary
    ? [
        `Mémoire Viralynz (${limits.tierLabel}) - utilise uniquement ces signaux réels.`,
        profileSummary ? `Profil: ${profileSummary}` : '',
        rankedFacts.length ? `Souvenirs pertinents:\n${rankedFacts.map(compactFact).join('\n')}` : '',
        snapshotText,
        'Contraintes: ne prétends jamais connaître des métriques absentes. Utilise la mémoire pour éviter les conseils génériques.',
      ].filter(Boolean).join('\n')
    : '';

  return {
    enabled: true,
    tier: limits.tier,
    profileSummary,
    facts: rankedFacts,
    warnings: rankedFacts.length ? [] : ['Aucun souvenir pertinent confirmé pour cette demande.'],
    commonMistakes,
    v2Opportunities,
    recommendedStyleConstraints,
    prompt,
  };
}
