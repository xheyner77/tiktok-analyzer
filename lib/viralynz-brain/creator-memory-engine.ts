import type { BrainInput, CreatorMemoryEngineResult } from './types';
import { confidenceLevel, diagnostic, evidence, score20, strictJsonContract } from './utils';

export const CREATOR_MEMORY_ENGINE_PROMPT = strictJsonContract('creator_memory_engine', [
  'recurringPatterns',
  'personalizationNotes',
  'diagnostics',
  'confidence',
]);

export function analyzeCreatorMemory(input: BrainInput): CreatorMemoryEngineResult {
  const previous = input.context.previousAnalyses ?? [];
  const recurrentDiagnostics = previous
    .flatMap((analysis) => analysis.structuredDiagnostics?.map((item) => item.title) ?? analysis.improvements?.map((item) => item.tip) ?? [])
    .filter(Boolean);
  const recurrentHooks = previous.map((analysis) => analysis.hook?.analysis || analysis.repostVersion?.hook).filter(Boolean).slice(0, 4);
  const avgScore = previous.length
    ? Math.round(previous.reduce((sum, analysis) => sum + (analysis.viralityScore || 0), 0) / previous.length)
    : undefined;
  const recurringPatterns = [
    recurrentDiagnostics[0] ? `Probleme recurrent: ${recurrentDiagnostics[0]}` : '',
    recurrentHooks[0] ? `Hooks deja observes: ${recurrentHooks.slice(0, 2).join(' / ')}` : '',
    avgScore ? `Score moyen recent: ${avgScore}/100` : '',
  ].filter(Boolean);
  const hasMemory = previous.length > 0;
  const confidence = Math.min(0.86, hasMemory ? 0.42 + Math.min(previous.length, 8) * 0.06 : 0.24);
  const score = score20(hasMemory ? 10 + Math.min(previous.length, 10) : 5);
  const diagnostics = [];

  if (hasMemory && recurrentDiagnostics[0]) {
    diagnostics.push(diagnostic('creator_memory_engine', 'memory_recurrent_pattern', {
      severity: 'optimisation',
      title: 'Pattern createur recurrent',
      explanation: 'La memoire retrouve un probleme deja observe dans les analyses precedentes.',
      timestamp: undefined,
      evidence: recurrentDiagnostics[0],
      impact: 'La prochaine recommandation peut etre personnalisee au lieu de rester generique.',
      fix: 'Comparer ce TikTok aux derniers formats et prioriser la correction recurrente.',
      confidence,
    }));
  }

  return {
    module: 'creator_memory_engine',
    score,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    diagnostics,
    evidence: [
      evidence('previous_analysis_count', previous.length),
      evidence('average_recent_score', avgScore),
      evidence('creator_memory_context', input.creatorMemoryContext),
    ],
    fallbackUsed: !hasMemory,
    recurringPatterns,
    personalizationNotes: hasMemory
      ? [
          previous.length >= 4
            ? `Ce probleme revient dans plusieurs analyses recentes; Viralynz doit le traiter comme une habitude de structure.`
            : `Memoire courte: Viralynz commence a apprendre les choix de hook et de CTA.`,
        ]
      : ['Memoire encore courte: les prochaines analyses rendront les patterns plus fiables.'],
  };
}
