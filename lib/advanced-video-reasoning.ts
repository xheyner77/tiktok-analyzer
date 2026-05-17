import type { RepostPriorityInput } from './repost-priority-engine';

export interface VideoReasoning {
  videoId: string;
  rootCause: string;
  limitingFactors: string[];
  contradictions: string[];
  overloadSignals: string[];
  payoffIssues: string[];
  promiseIssues: string[];
  pacingIssues: string[];
  reasoningSummary: string;
}

export function advancedVideoReasoning(items: RepostPriorityInput[]): VideoReasoning[] {
  return items.map((item) => {
    const problems = item.result.coachAnalysis?.detectedProblems ?? [];
    const fusion = item.result.coachAnalysis?.multimodalFusion;
    const transcript = item.result.coachAnalysis?.transcriptAnalysis;
    const rootCause = problems[0]?.title ?? (item.result.hook.score < 62 ? 'Hook trop faible' : 'Structure a optimiser');
    const overload = transcript?.mentalFriction && transcript.mentalFriction > 65 ? ['Script mentalement lourd'] : [];
    const payoff = problems.filter((problem) => /payoff|preuve|resultat/i.test(problem.title)).map((problem) => problem.title);
    const promise = problems.filter((problem) => /promesse|hook|clarte/i.test(problem.title)).map((problem) => problem.title);
    const pacing = item.result.editing.score < 62 ? ['Rythme incoherent ou trop plat'] : [];

    return {
      videoId: item.id,
      rootCause,
      limitingFactors: [...new Set([rootCause, ...problems.map((problem) => problem.impact)])].slice(0, 5),
      contradictions: fusion?.contradictions ?? [],
      overloadSignals: overload,
      payoffIssues: payoff,
      promiseIssues: promise,
      pacingIssues: pacing,
      reasoningSummary: `${rootCause}: ${problems[0]?.explanation ?? 'le systeme recommande de clarifier hook, payoff et CTA.'}`,
    };
  });
}
