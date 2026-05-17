import type { RepostPriorityInput } from './repost-priority-engine';

export interface AdvancedAnalytics {
  engagementTrend: number;
  watchtimeTrend: number;
  repostSuccessTracking: number;
  hookSuccessTracking: number;
  ctaSuccessTracking: number;
  comparisons: string[];
}

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function buildAdvancedAnalytics(items: RepostPriorityInput[]): AdvancedAnalytics {
  const results = items.map((item) => item.result);
  const firstHalf = results.slice(Math.ceil(results.length / 2));
  const recentHalf = results.slice(0, Math.ceil(results.length / 2));
  const recentScore = avg(recentHalf.map((result) => result.viralityScore));
  const previousScore = avg(firstHalf.map((result) => result.viralityScore));

  return {
    engagementTrend: avg(results.map((result) => result.coachAnalysis?.subScores.engagementPotential ?? result.viralityScore)),
    watchtimeTrend: avg(results.map((result) => result.coachAnalysis?.subScores.rewatchPotential ?? result.retention.score)),
    repostSuccessTracking: avg(results.map((result) => result.coachAnalysis?.repostEngine.improvementProbability ?? 0)),
    hookSuccessTracking: avg(results.map((result) => result.hook.score)),
    ctaSuccessTracking: avg(results.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore)),
    comparisons: [
      results.length >= 2 ? `Periode recente: ${recentScore}/100 vs ${previousScore || recentScore}/100.` : 'Comparaison periode en attente.',
      'Comparaison formats prete via patternLabel.',
      'Comparaison hooks et CTA prete via hook library.',
      'Comparaison comptes prete avec multi-account TikTok.',
    ],
  };
}
