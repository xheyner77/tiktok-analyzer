import type { BrainScoreBreakdown, CtaAnalyzerResult, HookAnalyzerResult, RetentionAnalyzerResult, RepostStrategistResult } from './types';
import { from20To100, score20 } from './utils';

function verdictForScore(score: number) {
  if (score >= 84) return 'Excellent potentiel, a optimiser finement';
  if (score >= 72) return 'Bon potentiel, repost pertinent';
  if (score >= 58) return 'Potentiel moyen, structure a renforcer';
  if (score >= 44) return 'Risque de retention, correction conseillee';
  return 'Structure fragile, repost prioritaire';
}

export function composeBrainScore(
  hook: HookAnalyzerResult,
  retention: RetentionAnalyzerResult,
  cta: CtaAnalyzerResult,
  repost: RepostStrategistResult,
): BrainScoreBreakdown {
  const clarityScore = score20(
    hook.score * 0.35
      + retention.score * 0.25
      + cta.score * 0.2
      + (hook.detectedHook.length > 8 ? 2 : 0)
      + (cta.clarity === 'clear' ? 2 : 0)
      + 5,
  );
  const repostPotential = score20(repost.repostPotential);
  const normalizedGlobal = Math.round(hook.score + retention.score + cta.score + clarityScore + repostPotential);
  const verdict = verdictForScore(normalizedGlobal);

  const uiBreakdown = [
    {
      label: 'Hook',
      score: from20To100(hook.score),
      weight: 20,
      reason: hook.diagnostics[0]?.fix || 'Mesure la clarte, la tension et la vitesse du stop-scroll.',
    },
    {
      label: 'Retention',
      score: from20To100(retention.score),
      weight: 20,
      reason: retention.diagnostics[0]?.fix || 'Mesure le rythme, les moments faibles et les risques de drop.',
    },
    {
      label: 'CTA',
      score: from20To100(cta.score),
      weight: 20,
      reason: cta.diagnostics[0]?.fix || 'Mesure la clarte et la force de l appel a l action.',
    },
    {
      label: 'Clarte',
      score: from20To100(clarityScore),
      weight: 20,
      reason: 'Score compose a partir de la promesse, du hook et de la comprehension probable.',
    },
    {
      label: 'Potentiel repost',
      score: from20To100(repostPotential),
      weight: 20,
      reason: repost.orderedMoves[0] || 'Estime le gain possible en gardant le sujet mais en changeant l ordre.',
    },
  ];

  return {
    hookScore: hook.score,
    retentionScore: retention.score,
    ctaScore: cta.score,
    clarityScore,
    repostPotential,
    globalScore: normalizedGlobal,
    verdict,
    reasons: uiBreakdown.map((item) => `${item.label}: ${item.reason}`),
    uiBreakdown,
    subScores: {
      hook: from20To100(hook.score),
      retention: from20To100(retention.score),
      clarity: from20To100(clarityScore),
      tension: Math.round((from20To100(hook.score) + from20To100(retention.score)) / 2),
      cta: from20To100(cta.score),
      repostPotential: from20To100(repostPotential),
      engagementPotential: Math.round((from20To100(cta.score) + from20To100(hook.score)) / 2),
      rewatchPotential: Math.round((from20To100(retention.score) + from20To100(repostPotential)) / 2),
    },
  };
}
