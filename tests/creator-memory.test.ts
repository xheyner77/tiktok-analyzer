import { describe, expect, it } from 'vitest';
import { buildCreatorMemoryContext } from '@/lib/creator-memory/buildCreatorMemoryContext';
import { mergeCreatorMemory } from '@/lib/creator-memory/mergeCreatorMemory';
import { emptyCreatorMemory, normalizeMemoryInsights } from '@/lib/creator-memory/validation';
import type { AnalysisResult } from '@/lib/types';

const minimalResult: AnalysisResult = {
  viralityScore: 52,
  hook: { score: 45, rating: 'Moyen', analysis: 'Hook trop explicatif', strengths: [], weaknesses: ['Le hook explique avant de créer une tension.'] },
  editing: { score: 58, rating: 'Moyen', analysis: 'Rythme moyen', strengths: [], weaknesses: [] },
  retention: { score: 48, rating: 'Moyen', analysis: 'Drop probable', strengths: [], weaknesses: ['La preuve arrive trop tard.'] },
  improvements: [{ priority: 'haute', tip: 'Avancer la preuve avant 0:03.' }],
  comparativeInsight: '',
  comparativePriority: '',
};

describe('creator memory engine', () => {
  it('merges insights without duplicating repeated patterns', () => {
    const previous = emptyCreatorMemory('user_1');
    previous.strongest_patterns = ['Preuve rapide avant contexte'];
    previous.total_analyses_learned_from = 2;
    previous.confidence_score = 0.6;

    const insights = normalizeMemoryInsights({
      new_learnings: [
        {
          type: 'hook_pattern',
          insight: 'Preuve rapide avant contexte',
          evidence: 'Analyse source',
          confidence: 0.8,
        },
      ],
      winning_patterns: ['Preuve rapide avant contexte', 'Hook tension + exemple concret'],
      weak_patterns: ['Intro trop explicative'],
      next_experiments: ['Ouvrir avec une objection'],
    });

    const merged = mergeCreatorMemory({
      previous,
      insights,
      source: { userId: 'user_1', analysisId: 'analysis_1', result: minimalResult },
    });

    expect(merged.total_analyses_learned_from).toBe(3);
    expect(merged.strongest_patterns.filter((item) => item === 'Preuve rapide avant contexte')).toHaveLength(1);
    expect(merged.memory_level).toBeGreaterThan(previous.memory_level);
    expect(merged.next_experiments[0]).toBe('Ouvrir avec une objection');
  });

  it('builds a compact prompt context when memory exists', () => {
    const memory = emptyCreatorMemory('user_1');
    memory.memory_level = 42;
    memory.total_analyses_learned_from = 4;
    memory.creator_voice = 'Direct, phrases courtes';
    memory.weakest_patterns = ['Hooks trop explicatifs'];
    memory.strongest_patterns = ['Preuve rapide'];

    const context = buildCreatorMemoryContext(memory);

    expect(context).toContain('Memoire Createur Viralynz');
    expect(context).toContain('42/100');
    expect(context).toContain('Hooks trop explicatifs');
    expect(context.length).toBeLessThan(2401);
  });

  it('returns an empty context when memory is empty', () => {
    expect(buildCreatorMemoryContext(emptyCreatorMemory('user_1'))).toBe('');
  });
});
