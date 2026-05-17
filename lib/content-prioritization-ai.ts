import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';

export interface ContentPriorityDecision {
  id: string;
  decision: 'repost_immediatement' | 'abandonner' | 'fort_potentiel' | 'meilleur_hook' | 'cta_detruit_conversion' | 'format_court';
  label: string;
  reason: string;
  nextAction: string;
  effort: 'faible' | 'moyen' | 'eleve';
}

export function contentPrioritizationAI(items: RepostPriorityInput[]): ContentPriorityDecision[] {
  const ranked = rankRepostPriorities(items);
  return ranked.map((priority) => {
    const source = items.find((item) => item.id === priority.id)?.result;
    const cta = source?.coachAnalysis?.subScores.cta ?? source?.viralityScore ?? 0;
    const duration = source?.detectedVideoMeta?.durationSec ?? source?.videoIntelligence?.metadata.durationSec;
    const decision = priority.repostScore >= 78
      ? 'repost_immediatement'
      : priority.category === 'strong_topic_weak_hook'
        ? 'meilleur_hook'
        : cta < 55
          ? 'cta_detruit_conversion'
          : duration && duration > 34
            ? 'format_court'
            : priority.repostScore < 45
              ? 'abandonner'
              : 'fort_potentiel';
    const label = {
      repost_immediatement: 'Repost immediatement',
      abandonner: 'Ne merite pas ton temps',
      fort_potentiel: 'Fort potentiel',
      meilleur_hook: 'Manque surtout un meilleur hook',
      cta_detruit_conversion: 'CTA a corriger',
      format_court: 'Transformer en format court',
    }[decision];

    return {
      id: priority.id,
      decision,
      label,
      reason: priority.reason,
      nextAction: decision === 'abandonner' ? 'Archiver ou garder comme reference.' : priority.recommendedFix,
      effort: priority.correctionDifficulty >= 62 ? 'eleve' : priority.correctionDifficulty >= 44 ? 'moyen' : 'faible',
    };
  });
}
