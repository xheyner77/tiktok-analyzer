import type { AnalysisResult, DiagnosticSeverity } from './types';

export interface RepostPriorityInput {
  id: string;
  created_at: string;
  video_url: string;
  result: AnalysisResult;
}

export interface RepostPriorityItem {
  id: string;
  title: string;
  category: 'top_priority' | 'easy_win' | 'high_risk' | 'strong_topic_weak_hook';
  label: string;
  repostScore: number;
  watchtimePotential: number;
  commentPotential: number;
  correctionDifficulty: number;
  confidence: number;
  reason: string;
  recommendedFix: string;
  status: 'a_retravailler' | 'repost_conseille' | 'surveiller';
  createdAt: string;
  videoUrl: string;
}

function clamp(value: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function severityWeight(severity?: DiagnosticSeverity) {
  if (severity === 'critique') return 18;
  if (severity === 'important') return 10;
  return 4;
}

function firstProblem(result: AnalysisResult) {
  return result.coachAnalysis?.detectedProblems?.[0];
}

export function scoreRepostPriority(item: RepostPriorityInput): RepostPriorityItem {
  const { result } = item;
  const engine = result.coachAnalysis?.repostEngine;
  const subScores = result.coachAnalysis?.subScores;
  const problem = firstProblem(result);
  const hookGap = Math.max(0, 76 - result.hook.score);
  const retentionGap = Math.max(0, 74 - result.retention.score);
  const subjectStrength = Math.max(result.viralityScore, subScores?.repostPotential ?? 0, engine?.repostPotentialCeiling ?? 0);
  const estimatedGain = engine?.estimatedGain ?? clamp((hookGap + retentionGap) / 2, 4, 24);
  const confidence = result.coachAnalysis?.formatConfidence?.score
    ?? result.videoIntelligence?.confidence.score
    ?? engine?.improvementProbability
    ?? 58;
  const watchtimePotential = clamp((subScores?.rewatchPotential ?? result.retention.score) + hookGap * 0.25 + estimatedGain * 0.4);
  const commentPotential = clamp((subScores?.engagementPotential ?? result.viralityScore) + (subScores?.cta && subScores.cta < 66 ? 9 : 0));
  const correctionDifficulty = clamp(34 + (result.editing.score < 55 ? 18 : 0) + (result.retention.score < 50 ? 14 : 0) - (result.hook.score < 68 ? 7 : 0));
  const repostScore = clamp(
    subjectStrength * 0.38
    + (subScores?.repostPotential ?? subjectStrength) * 0.26
    + estimatedGain * 0.9
    + severityWeight(problem?.severity)
    - correctionDifficulty * 0.14
  );

  const category = result.hook.score < 64 && subjectStrength >= 68
    ? 'strong_topic_weak_hook'
    : correctionDifficulty <= 46 && repostScore >= 64
      ? 'easy_win'
      : confidence < 48 || result.retention.score < 48
        ? 'high_risk'
        : 'top_priority';

  const label = category === 'strong_topic_weak_hook'
    ? 'Tres bon sujet, hook faible'
    : category === 'easy_win'
      ? 'Facile a ameliorer'
      : category === 'high_risk'
        ? 'Risque eleve'
        : 'Top priorite';

  return {
    id: item.id,
    title: result.coachAnalysis?.repostEngine.bestOpportunity?.title ?? result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'Video a retravailler',
    category,
    label,
    repostScore,
    watchtimePotential,
    commentPotential,
    correctionDifficulty,
    confidence: clamp(confidence),
    reason: problem?.explanation ?? engine?.bestOpportunity?.why ?? 'Le sujet est exploitable, mais le packaging doit etre plus direct avant repost.',
    recommendedFix: problem?.action ?? engine?.priorityChanges?.[0] ?? result.actionPlan?.[0] ?? 'Raccourcir le hook, avancer la preuve et finir par une question claire.',
    status: repostScore >= 72 ? 'repost_conseille' : repostScore >= 55 ? 'a_retravailler' : 'surveiller',
    createdAt: item.created_at,
    videoUrl: item.video_url,
  };
}

export function rankRepostPriorities(items: RepostPriorityInput[]) {
  return items
    .map(scoreRepostPriority)
    .sort((a, b) => b.repostScore - a.repostScore || b.watchtimePotential - a.watchtimePotential);
}
