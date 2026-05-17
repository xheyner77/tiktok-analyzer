import type { RepostPriorityInput } from './repost-priority-engine';

export interface AdvancedVideoSignals {
  videoId: string;
  ocrAdvanced: { available: boolean; density: number; firstFrameText?: string };
  cutDetection: { available: boolean; cutDensity: number; rhythm: 'faible' | 'moyen' | 'eleve' | 'unknown' };
  motionIntensity: number;
  silenceDetection: { available: boolean; speechDensity: number; likelySilent: boolean };
  subtitleDensity: number;
  faceTracking: { available: boolean; presence: 'detected' | 'not_detected' | 'unknown'; confidence?: number };
  emotionalIntensity: number;
  objectDetection: { available: boolean; note: string };
  shotChanges: number;
  pacingAnalysis: string;
  limitations: string[];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function advancedVideoSignals(items: RepostPriorityInput[]): AdvancedVideoSignals[] {
  return items.map((item) => {
    const vi = item.result.videoIntelligence;
    const visual = vi?.visualSignals;
    const transcript = item.result.coachAnalysis?.transcriptAnalysis;
    const textDensity = vi?.onScreenText.textDensity ?? visual?.textDensityEstimate ?? 0;
    const motion = visual?.motionEstimate ?? visual?.visualEnergy ?? item.result.editing.score;
    const speechDensity = vi?.audioSignals.speechDensity ?? (transcript?.available ? 55 : 0);
    const hasObjectDetection = false;
    const cutRhythm = String(visual?.cutRhythm ?? 'unknown');

    return {
      videoId: item.id,
      ocrAdvanced: {
        available: !!vi?.onScreenText.available,
        density: clamp(textDensity),
        firstFrameText: vi?.onScreenText.firstFrameText,
      },
      cutDetection: {
        available: !!visual?.available,
        cutDensity: clamp(visual?.cutDensityEstimate ?? item.result.editing.score),
        rhythm: cutRhythm.includes('lev') ? 'eleve' : cutRhythm === 'moyen' ? 'moyen' : cutRhythm === 'faible' ? 'faible' : 'unknown',
      },
      motionIntensity: clamp(motion),
      silenceDetection: {
        available: !!vi?.audioSignals.available || !!transcript,
        speechDensity: clamp(speechDensity),
        likelySilent: !transcript?.available && speechDensity < 18,
      },
      subtitleDensity: clamp(textDensity),
      faceTracking: {
        available: visual?.facePresence !== undefined && visual.facePresence !== 'unknown',
        presence: visual?.facePresence ?? 'unknown',
        confidence: visual?.faceConfidence,
      },
      emotionalIntensity: clamp((item.result.coachAnalysis?.subScores.tension ?? item.result.hook.score) * 0.55 + (item.result.coachAnalysis?.subScores.rewatchPotential ?? item.result.retention.score) * 0.45),
      objectDetection: {
        available: hasObjectDetection,
        note: hasObjectDetection ? 'Objects detected.' : 'Object detection prepared, not connected yet.',
      },
      shotChanges: Math.max(0, Math.round((visual?.cutDensityEstimate ?? item.result.editing.score) / 12)),
      pacingAnalysis: item.result.editing.score >= 72 ? 'Rythme exploitable, optimiser les ruptures.' : 'Pacing a renforcer avec cuts ou pattern interrupt.',
      limitations: [
        ...(!vi ? ['Video intelligence absente: signaux estimes depuis analyse sauvegardee.'] : []),
        ...(!hasObjectDetection ? ['Object detection non branchee.'] : []),
      ],
    };
  });
}
