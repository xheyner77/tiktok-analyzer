import 'server-only';

import type { ComputedScore, FinalAnalysisResult } from '@/lib/analysis-engine/index';

function computedScoreOrNull(score: ComputedScore): number | null {
  return score.status === 'computed' ? score.value : null;
}

function rating(score: number | null): 'Excellent' | 'Bon' | 'Moyen' | 'Faible' | 'Indisponible' {
  if (score === null) return 'Indisponible';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Bon';
  if (score >= 50) return 'Moyen';
  return 'Faible';
}

function availableSection(
  section: FinalAnalysisResult['hook'],
  score: number | null,
  unavailableLabel: string,
  availablePrefix?: string,
) {
  if (section.status === 'unavailable') {
    return {
      score,
      rating: rating(score),
      analysis: `${unavailableLabel} ${section.reason}`,
      strengths: [],
      weaknesses: section.limitations,
    };
  }
  return {
    score,
    rating: rating(score),
    analysis: availablePrefix ? `${availablePrefix} ${section.summary}` : section.summary,
    strengths: section.strengths,
    weaknesses: section.problems,
  };
}

/**
 * Keeps historical readers operational while the canonical, lossless result
 * lives in analyses.engine_result. Every numeric value below comes from the
 * deterministic rubric; the legacy `retention` slot is explicitly labelled as
 * an editorial-structure score and never as measured TikTok retention.
 */
export function toHonestLegacyAnalysisResult(result: FinalAnalysisResult): Record<string, unknown> {
  const overall = computedScoreOrNull(result.scores.overall);
  const hookScore = computedScoreOrNull(result.scores.hook);
  const rhythmScore = computedScoreOrNull(result.scores.rhythm);
  const structureScore = computedScoreOrNull(result.scores.structure);
  const strategic = result.strategicSummary.status === 'available' ? result.strategicSummary : null;
  const correctionSteps = result.correctionPlan.status === 'available' ? result.correctionPlan.steps : [];
  const improved = result.improvedVersion.status === 'available' ? result.improvedVersion : null;
  const bestHook = improved
    ? improved.hooks.find((hook) => hook.id === improved.bestHook.hookId) ?? null
    : null;
  const confidenceScore = Math.round(result.scores.overall.evidenceCoverage * 100);
  const criticalPriority = result.priorities.status === 'available'
    ? result.priorities.critical[0]?.text
    : undefined;
  const sectionEntries = [
    ['hook', result.hook],
    ['script', result.script],
    ['montage', result.editing],
    ['visuel', result.visual],
    ['texte et sous-titres', result.textAndCaptions],
    ['audio', result.audio],
    ['storytelling', result.storytelling],
    ['conversion', result.conversion],
  ] as const;
  const missingSignals = sectionEntries.flatMap(([label, section]) => {
    const safeSection = section as FinalAnalysisResult['hook'] | undefined;
    if (!safeSection) return [`Rubrique ${label} absente du résultat.`];
    if (safeSection.status === 'unavailable') {
      return [`Rubrique ${label} indisponible : ${safeSection.reason}`];
    }

    const criteria = Array.isArray(safeSection.criteria) ? safeSection.criteria : [];
    const unavailableCriteria = criteria.filter(
      (criterion) => criterion.status === 'unavailable',
    );
    const warnings: string[] = [];
    if (criteria.length === 0) {
      warnings.push(`Rubrique ${label} sans matrice de critères vérifiable.`);
    } else if (unavailableCriteria.length > 0) {
      warnings.push(
        `Rubrique ${label} partielle : ${unavailableCriteria.length}/${criteria.length} critères indisponibles.`,
      );
    }
    const limitations = Array.isArray(safeSection.limitations) ? safeSection.limitations : [];
    if (limitations.length > 0) {
      warnings.push(`Rubrique ${label} limitée : ${limitations.join(' ')}`);
    }
    return warnings;
  });
  if (result.evidence.frames.length === 0) missingSignals.push('Aucune frame horodatée disponible.');
  if (result.video.audioTrack.status === 'present' && result.evidence.transcription.status !== 'available') {
    missingSignals.push(`Transcription indisponible : ${result.evidence.transcription.reason}`);
  }
  const completeForAvailableTracks = missingSignals.length === 0;

  return {
    analysisSource: 'vision_upload',
    analysisSchemaVersion: result.schemaVersion,
    scoreSemantics: 'deterministic_editorial_rubric',
    viralityScore: overall,
    structureScore,
    observedStatsSource: 'none',
    unavailableObservedStats: ['views', 'likes', 'comments', 'shares', 'watch_time', 'retention'],
    finalVerdict: strategic?.diagnosis ?? criticalPriority ?? 'Diagnostic enregistré.',
    comparativeInsight: strategic ? `${strategic.firstDecision} ${strategic.whyNow}` : undefined,
    comparativePriority: criticalPriority,
    detectedVideoMeta: {
      durationSec: result.video.durationSec,
    },
    hook: availableSection(result.hook, hookScore, 'Signal hook indisponible.'),
    editing: availableSection(result.editing, rhythmScore, 'Signal de montage indisponible.'),
    retention: availableSection(
      result.storytelling,
      structureScore,
      'Score interne de structure éditoriale uniquement ; aucune rétention TikTok n’est mesurée.',
      'Score interne de structure éditoriale uniquement ; aucune rétention TikTok n’est mesurée.',
    ),
    improvements: correctionSteps.map((step, index) => ({
      priority: index < 3 ? 'haute' : index < 6 ? 'moyenne' : 'basse',
      tip: step.action,
    })),
    analyzerMeta: {
      objective: result.creatorContext.objective,
      objectiveLabel: result.creatorContext.objectiveDetails ?? result.creatorContext.objective,
      niche: result.creatorContext.niche,
      nicheLabel: result.creatorContext.niche,
      fileName: result.video.fileName,
      fileSizeMb: Number((result.video.fileSizeBytes / 1024 / 1024).toFixed(2)),
      status: 'completed',
      verdictShort: strategic?.diagnosis,
      recommendations: correctionSteps.map((step) => step.action),
      analysisMode: 'vision',
      analysisModeLabel: completeForAvailableTracks
        ? result.video.audioTrack.status === 'present'
          ? 'Upload entier examiné : piste audio, transcription et frames horodatées'
          : 'Upload entier examiné : aucune piste audio présente, frames horodatées disponibles'
        : result.video.audioTrack.status === 'absent'
          ? 'Upload entier couvert sans piste audio, mais certains signaux sont indisponibles'
          : 'Upload entier couvert, mais certains signaux sont indisponibles',
      validationWarnings: missingSignals,
      analysisCompleteness: completeForAvailableTracks ? 'complete' : 'partial',
      analysisConfidence: {
        score: confidenceScore,
        level: confidenceScore >= 80 ? 'elevee' : confidenceScore >= 55 ? 'moyenne' : 'faible',
        reasons: [
          `${result.evidence.frames.length} frames analysées sur toute la durée`,
          result.evidence.transcription.status === 'available'
            ? `${result.evidence.transcription.normalized.segments.length} segments de transcription horodatés`
            : result.evidence.transcription.reason,
        ],
      },
      signalDisclosure: {
        observedData: [
          'Frames horodatées',
          'Métadonnées FFmpeg',
          'Signaux FFmpeg disponibles',
          result.evidence.transcription.status === 'available' ? 'Transcription horodatée' : 'Transcription non disponible',
        ],
        aiHypotheses: ['Diagnostics éditoriaux citant les preuves du rapport'],
        simulations: [],
        previews: [],
      },
    },
    actionPlan: correctionSteps.map((step) => step.action),
    repostVersion: improved ? {
      hook: bestHook?.text ?? improved.hooks[0].text,
      hookVariants: improved.hooks.map((hook) => hook.text),
      structure: improved.editPlan.map((step) => step.text),
      onScreenText: improved.onScreenText.map((step) => step.text),
      cta: improved.cta.text,
      angle: strategic?.diagnosis ?? improved.bestHook.why,
      shortVersion: improved.fullRewrittenScript.fullText,
    } : undefined,
    structuredDiagnostics: result.timeline.flatMap((segment) => segment.problems.slice(0, 1).map((problem) => ({
      title: problem,
      explanation: segment.diagnostic,
      timestamp: `${segment.startTime.toFixed(1)}–${segment.endTime.toFixed(1)} s`,
      evidence: segment.evidence.join(', '),
      impact: segment.diagnostic,
      fix: segment.recommendedAction,
      confidence: segment.confidence === 'high' ? 90 : segment.confidence === 'medium' ? 65 : 40,
    }))),
  };
}
