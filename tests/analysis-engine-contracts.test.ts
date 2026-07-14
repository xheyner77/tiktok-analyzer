import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_SECTION_CRITERIA,
  AudioAnalysisSectionSchema,
  AudioSignalsSchema,
  CreatorContextSchema,
  FinalAnalysisResultSchema,
  ObservedMetricSchema,
  SpecialistDiagnosticSchema,
  VIRALYNZ_RUBRIC,
  computeDeterministicScores,
  findGenericPhrases,
  validateAnalysisQuality,
} from '@/lib/analysis-engine/index';
import type {
  AnalysisSectionKey,
  FinalAnalysisResult,
  RubricAssessment,
} from '@/lib/analysis-engine/index';

const NOW = '2026-07-13T10:00:00.000Z';

function rubricAssessments(status: RubricAssessment['status'] = 'met'): RubricAssessment[] {
  return VIRALYNZ_RUBRIC.map((criterion) => ({
    criterionId: criterion.id,
    status,
    evidence: status === 'unavailable' ? [] : ['frame_start'],
    observation: status === 'unavailable'
      ? 'Le signal nécessaire n’est pas disponible.'
      : 'Le critère est observable dans la preuve citée.',
    positive: status === 'met' ? 'Le signal observé soutient la décision.' : null,
    penalty: status === 'not_met' ? 'Le signal observé contredit le critère.' : null,
  }));
}

function grounded(id: string, text: string) {
  return {
    id,
    timeRange: { startSec: 0, endSec: 3 },
    observation: 'L’ouverture annonce la preuve avant la démonstration.',
    text,
    why: 'Cette version s’appuie sur le message visible dans la première frame.',
    objective: 'views' as const,
    objectiveFit: 'Pour générer des vues, la proposition doit être comprise dès l’ouverture.',
    example: `Version directement applicable : « ${text} »`,
    supportingSourceIds: ['finding_hook_1'],
    transcriptCitation: {
      status: 'not_applicable' as const,
      reasonCode: 'visual_only' as const,
      reason: 'Cette recommandation porte uniquement sur la première frame.',
    },
    nature: 'visual_observation' as const,
    evidence: ['frame_start'],
    confidence: 'high' as const,
  };
}

function sectionCriteria<TSection extends AnalysisSectionKey>(
  section: TSection,
  status: 'observed' | 'not_observed' | 'unavailable' = 'observed',
) {
  return ANALYSIS_SECTION_CRITERIA[section].map((criterionId) => ({
    criterionId,
    status,
    note: status === 'unavailable'
      ? 'Le signal necessaire n est pas disponible dans les preuves.'
      : 'Le critere est etabli par la frame de debut citee.',
    evidence: status === 'unavailable' ? [] : ['frame_start'],
    timeRange: status === 'unavailable' ? null : { startSec: 0, endSec: 3 },
    confidence: status === 'unavailable' ? 'low' as const : 'high' as const,
  }));
}

function availableSection(section: AnalysisSectionKey, id: string, summary: string) {
  return {
    section,
    status: 'available' as const,
    summary,
    strengths: ['Le sujet est identifiable dans la première frame.'],
    problems: ['La preuve arrive après l’explication.'],
    recommendations: [grounded(
      `${id}_recommendation`,
      `Applique cette correction au passage observé : ${summary}`,
    )],
    evidence: ['frame_start', 'segment_intro'],
    limitations: [],
    criteria: sectionCriteria(section),
  };
}

function unavailableAnalysisSection(section: AnalysisSectionKey, reason: string) {
  return {
    section,
    status: 'unavailable' as const,
    reason,
    limitations: [reason],
    criteria: sectionCriteria(section, 'unavailable'),
  };
}

function availableAudioSection() {
  const evidenceByCriterion = new Map<string, string>([
    ['audio.voice', 'metric_speech'],
    ['audio.delivery_rate', 'metric_speaking_rate'],
    ['audio.pauses', 'metric_pauses'],
    ['audio.energy', 'metric_loudness'],
    ['audio.problematic_moments', 'metric_peak_volume'],
  ]);
  const criteria = ANALYSIS_SECTION_CRITERIA.audio.map((criterionId) => {
    const evidence = evidenceByCriterion.get(criterionId);
    if (!evidence) {
      return {
        criterionId,
        status: 'unavailable' as const,
        note: 'Ce signal audio ne peut pas etre isole par les mesures disponibles.',
        evidence: [],
        timeRange: null,
        confidence: 'low' as const,
      };
    }
    return {
      criterionId,
      status: criterionId === 'audio.problematic_moments' ? 'not_observed' as const : 'observed' as const,
      note: 'Le signal audio est etabli par la mesure ou le segment cite.',
      evidence: [evidence],
      timeRange: { startSec: 0, endSec: 3 },
      confidence: 'high' as const,
    };
  });
  return {
    section: 'audio' as const,
    status: 'available' as const,
    summary: 'La voix et son rythme sont mesurables; la separation voix-musique reste indisponible.',
    strengths: ['La parole est presente dans le segment d ouverture.'],
    problems: [],
    recommendations: [],
    evidence: [...evidenceByCriterion.values()],
    limitations: ['Aucun classifieur voix-musique fiable n a ete execute.'],
    criteria,
  };
}

function validResult(): FinalAnalysisResult {
  const assessments = rubricAssessments();
  return {
    version: 'viralynz-analysis-v2',
    schemaVersion: '2.0.0',
    engineVersion: 'video-engine-2.0.0',
    analysisId: 'analysis_123',
    generatedAt: NOW,
    creatorContext: {
      version: 'creator-context-v1',
      objective: 'views',
      platform: 'tiktok',
      niche: 'Création de contenu',
      audience: 'Créateurs qui republient leurs vidéos',
      audienceKnowledge: 'intermediate',
      format: 'facecam',
      tone: 'Direct et pédagogique',
      language: 'fr',
      memoryConsent: true,
    },
    video: {
      version: 'video-metadata-v1',
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: 1_024_000,
      durationSec: 10,
      width: 1080,
      height: 1920,
      framesPerSecond: 30,
      container: 'mov,mp4,m4a,3gp,3g2,mj2',
      videoCodec: 'h264',
      bitrateBitsPerSec: 800_000,
      audioTrack: { status: 'present', codec: 'aac' },
      probedAt: NOW,
    },
    evidence: {
      frames: [
        {
          id: 'frame_start',
          timestampSec: 0,
          artifactRef: 'analysis_123/frame_start.jpg',
          width: 540,
          height: 960,
          samplingReason: 'opening',
          ocr: {
            status: 'measured',
            text: 'Pourquoi ta preuve arrive trop tard',
            confidence: 0.91,
            method: 'vision-ocr-v1',
          },
        },
        {
          id: 'frame_end',
          timestampSec: 10,
          artifactRef: 'analysis_123/frame_end.jpg',
          width: 540,
          height: 960,
          samplingReason: 'ending',
          ocr: { status: 'unavailable', reason: 'Aucun texte lisible sur cette frame.' },
        },
      ],
      transcription: {
        status: 'available',
        source: 'openai',
        model: 'whisper-1',
        timingPrecision: 'word',
        raw: {
          text: 'Voici la preuve',
          language: 'fr',
          providerRequestId: 'request_transcript_1',
        },
        normalized: {
          text: 'Voici la preuve',
          language: { status: 'measured', code: 'fr', confidence: 0.98, method: 'provider' },
          segments: [{
            id: 'segment_intro',
            startSec: 0,
            endSec: 3,
            text: 'Voici la preuve',
            wordIds: ['word_1', 'word_2', 'word_3'],
          }],
          words: [
            { id: 'word_1', segmentId: 'segment_intro', startSec: 0, endSec: 0.6, text: 'Voici' },
            { id: 'word_2', segmentId: 'segment_intro', startSec: 0.6, endSec: 1, text: 'la' },
            { id: 'word_3', segmentId: 'segment_intro', startSec: 1, endSec: 1.6, text: 'preuve' },
          ],
        },
        generatedAt: NOW,
      },
      audioSignals: {
        version: 'audio-signals-v1',
        integratedLoudness: {
          status: 'measured',
          id: 'metric_loudness',
          value: -16,
          unit: 'LUFS',
          method: 'ffmpeg-ebur128',
          evidenceRefs: ['segment_intro'],
        },
        truePeak: {
          status: 'unavailable',
          reasonCode: 'not_measurable',
          reason: 'La mesure true peak n’a pas été produite.',
        },
        meanVolumeDb: {
          status: 'measured',
          id: 'metric_mean_volume',
          value: -20,
          unit: 'dBFS',
          method: 'ffmpeg-volumedetect',
          evidenceRefs: ['segment_intro'],
        },
        peakVolumeDb: {
          status: 'measured',
          id: 'metric_peak_volume',
          value: -3,
          unit: 'dBFS',
          method: 'ffmpeg-volumedetect',
          evidenceRefs: ['segment_intro'],
        },
        silenceRatio: {
          status: 'measured',
          id: 'metric_silence',
          value: 0.1,
          unit: 'ratio',
          method: 'ffmpeg-silencedetect',
          evidenceRefs: ['segment_intro'],
        },
        speechRatio: {
          status: 'measured',
          id: 'metric_speech',
          value: 0.7,
          unit: 'ratio',
          method: 'transcript-segments',
          evidenceRefs: ['segment_intro'],
        },
        speakingRateWpm: {
          status: 'measured',
          id: 'metric_speaking_rate',
          value: 132,
          unit: 'words_per_minute',
          method: 'transcript-word-timestamps',
          evidenceRefs: ['segment_intro'],
        },
        averageSentenceLengthWords: {
          status: 'measured',
          id: 'metric_sentence_length',
          value: 3,
          unit: 'words',
          method: 'transcript-sentence-segmentation',
          evidenceRefs: ['segment_intro'],
        },
        wordDensityPerSecond: {
          status: 'measured',
          id: 'metric_word_density',
          value: 1.5,
          unit: 'words_per_second',
          method: 'transcript-segments',
          evidenceRefs: ['segment_intro'],
        },
        repeatedPhraseCount: {
          status: 'measured',
          id: 'metric_repeated_phrases',
          value: 0,
          unit: 'count',
          method: 'normalized-transcript-ngram-count',
          evidenceRefs: ['segment_intro'],
        },
        hesitationCount: {
          status: 'measured',
          id: 'metric_hesitations',
          value: 0,
          unit: 'count',
          method: 'normalized-transcript-lexicon',
          evidenceRefs: ['segment_intro'],
        },
        pauseIntervals: {
          status: 'measured',
          id: 'metric_pauses',
          value: [{ id: 'pause_1', startSec: 2, endSec: 2.2 }],
          unit: 'seconds',
          method: 'ffmpeg-silencedetect',
          evidenceRefs: ['segment_intro'],
        },
        voiceMusicBalance: {
          status: 'unavailable',
          reasonCode: 'not_measurable',
          reason: 'Aucun classifieur voix-musique fiable n’a été exécuté.',
        },
      },
      visualSignals: {
        version: 'visual-signals-v1',
        averageLuma: {
          status: 'measured',
          id: 'metric_luma',
          value: 48,
          unit: 'YAVG',
          method: 'ffmpeg-signalstats',
          evidenceRefs: ['frame_start', 'frame_end'],
        },
        brightnessVariation: {
          status: 'measured',
          id: 'metric_brightness_variation',
          value: 18,
          unit: 'YAVG_stddev',
          method: 'ffmpeg-signalstats-yavg-stddev',
          evidenceRefs: ['frame_start', 'frame_end'],
        },
        blackFrameRatio: {
          status: 'unavailable',
          reasonCode: 'insufficient_samples',
          reason: 'Pas assez de frames pour une mesure fiable.',
        },
        freezeRatio: {
          status: 'unavailable',
          reasonCode: 'insufficient_samples',
          reason: 'Pas assez de frames pour une mesure fiable.',
        },
        sceneCutCount: {
          status: 'measured',
          id: 'metric_scene_cuts',
          value: 2,
          unit: 'count',
          method: 'ffmpeg-scene-detection',
          evidenceRefs: ['frame_start', 'frame_end'],
        },
        cutsPerMinute: {
          status: 'unavailable',
          reasonCode: 'insufficient_samples',
          reason: 'La durée observée ne permet pas cette extrapolation.',
        },
        motionIntensity: {
          status: 'measured',
          id: 'metric_motion',
          value: 44,
          unit: 'percent',
          method: 'frame-difference-v1',
          evidenceRefs: ['frame_start', 'frame_end'],
        },
        textCoverageRatio: {
          status: 'unavailable',
          reasonCode: 'tool_error',
          reason: 'La surface OCR n’a pas été calculée.',
        },
        facePresenceRatio: {
          status: 'unavailable',
          reasonCode: 'not_measurable',
          reason: 'Aucun détecteur de visage n’a été exécuté.',
        },
      },
      observedMetrics: {
        status: 'unavailable',
        reason: 'Aucune métrique plateforme n’est reliée à cette vidéo.',
      },
      retention: {
        status: 'unavailable',
        reason: 'Aucune courbe de rétention plateforme n’est disponible.',
      },
    },
    specialists: [{
      id: 'diagnostic_hook',
      specialist: 'hook',
      summary: 'L’ouverture nomme le sujet avant de montrer son enjeu concret.',
      findings: [{
        id: 'finding_hook_1',
        claim: 'Le texte d’ouverture pose une question centrée sur la preuve.',
        implication: 'La promesse reste lisible, mais la démonstration est retardée.',
        decision: 'Montre le résultat avant la phrase explicative.',
        severity: 'high',
        confidence: 'high',
        timeRange: { startSec: 0, endSec: 3 },
        evidenceRefs: ['frame_start', 'segment_intro'],
      }],
      limitations: ['Aucune donnée de rétention réelle n’est disponible.'],
    }],
    critique: {
      version: 'analysis-critique-v1',
      verdict: 'pass',
      reviewedDiagnosticIds: ['diagnostic_hook'],
      issues: [],
      contradictionsResolved: [],
      limitations: ['La critique ne remplace pas une courbe plateforme.'],
    },
    strategicSummary: {
      status: 'available',
      diagnosis: 'La question est lisible, mais la preuve arrive après le contexte.',
      firstDecision: 'Ouvre sur le résultat puis replace la question.',
      whyNow: 'Cette inversion répond directement à l’ordre observé dans l’ouverture.',
      evidence: ['frame_start', 'segment_intro'],
      limitations: ['La rétention réelle reste indisponible.'],
    },
    hook: availableSection('hook', 'hook', 'Le hook annonce la preuve sans encore la montrer.'),
    script: availableSection('script', 'script', 'Le script place une phrase de contexte avant la démonstration.'),
    editing: availableSection('editing', 'editing', 'Le montage conserve un plan explicatif avant le résultat.'),
    visual: availableSection('visual', 'visual', 'La première frame porte une question lisible.'),
    textAndCaptions: availableSection('textAndCaptions', 'captions', 'Le texte écran est cohérent avec la phrase prononcée.'),
    audio: availableAudioSection(),
    storytelling: availableSection('storytelling', 'storytelling', 'La preuve tient le rôle de payoff mais arrive après le contexte.'),
    conversion: availableSection('conversion', 'conversion', 'L’action attendue n’est pas formulée à la fin.'),
    timeline: [
      {
        id: 'timeline_opening',
        startTime: 0,
        endTime: 3,
        transcript: { status: 'available', text: 'Voici la preuve', evidence: ['segment_intro'] },
        visualObservation: { status: 'available', text: 'Une question occupe la première frame.', evidence: ['frame_start'] },
        audioObservation: { status: 'available', text: 'La parole est présente dans ce segment.', evidence: ['metric_speech'] },
        editingObservation: { status: 'available', text: 'Le plan reste continu pendant l’ouverture.', evidence: ['frame_start'] },
        narrativeFunction: 'hook',
        observation: 'La question précède la démonstration.',
        diagnostic: 'L’enjeu est annoncé avant d’être matérialisé.',
        action: 'Place la preuve visuelle au début du segment.',
        objective: 'views',
        objectiveFit: 'Pour l’objectif vues, la preuve doit rendre la proposition compréhensible dès l’ouverture.',
        example: 'Commence par : « Voici la preuve », pendant que le résultat occupe la première frame.',
        transcriptCitation: { status: 'available', segmentId: 'segment_intro', quote: 'Voici la preuve' },
        nature: 'observed',
        strengths: ['La question est lisible.'],
        problems: ['La démonstration est différée.'],
        recommendedAction: 'Commence par le résultat, puis pose la question.',
        evidence: ['frame_start', 'segment_intro'],
        confidence: 'high',
      },
      {
        id: 'timeline_body',
        startTime: 3,
        endTime: 10,
        transcript: { status: 'unavailable', reason: 'Aucun segment vocal horodaté après l’ouverture.' },
        visualObservation: { status: 'available', text: 'La fin de la vidéo ne contient pas de texte lisible.', evidence: ['frame_end'] },
        audioObservation: { status: 'unavailable', reason: 'Aucun signal audio localisé sur cette plage.' },
        editingObservation: { status: 'available', text: 'La frame finale clôt la démonstration.', evidence: ['frame_end'] },
        narrativeFunction: 'payoff',
        observation: 'La démonstration se termine sans texte écran.',
        diagnostic: 'Le payoff visuel manque de reformulation finale.',
        action: 'Ajoute une phrase courte qui nomme le résultat.',
        objective: 'views',
        objectiveFit: 'Pour l’objectif vues, la conclusion doit fermer clairement la promesse initiale.',
        example: 'Affiche sur la frame finale : « Voilà la preuve annoncée au début. »',
        transcriptCitation: {
          status: 'not_applicable',
          reasonCode: 'visual_only',
          reason: 'Aucun segment vocal horodaté n’est disponible sur cette plage.',
        },
        nature: 'mixed',
        strengths: ['La démonstration est visible.'],
        problems: ['Le résultat final n’est pas nommé.'],
        recommendedAction: 'Fige le résultat et ajoute une conclusion lisible.',
        evidence: ['frame_end'],
        confidence: 'medium',
      },
    ],
    priorities: {
      status: 'available',
      critical: [grounded('priority_critical', 'Avance la preuve avant la question.')],
      important: [grounded('priority_important', 'Raccourcis la phrase de contexte.')],
      optimizations: [grounded('priority_optimization', 'Nomme le résultat sur la dernière frame.')],
      limitations: [],
    },
    correctionPlan: {
      status: 'available',
      steps: [{
        id: 'correction_step_1',
        order: 1,
        observation: 'L’ouverture annonce la preuve sans montrer la démonstration.',
        action: 'Déplace la démonstration au tout début.',
        rationale: 'La première frame annonce actuellement la preuve sans la montrer.',
        objective: 'views',
        objectiveFit: 'L’ouverture doit rendre la proposition immédiatement compréhensible pour l’objectif vues.',
        example: 'Ouvre sur le résultat final, puis enchaîne avec : « Voici ce qui change quand je coupe cette phrase. »',
        supportingSourceIds: ['finding_hook_1'],
        transcriptCitation: {
          status: 'not_applicable',
          reasonCode: 'visual_only',
          reason: 'La décision est fondée sur l’ordre des plans visibles.',
        },
        nature: 'visual_observation',
        timeRange: { startSec: 0, endSec: 3 },
        evidence: ['frame_start'],
        confidence: 'high',
      }],
      limitations: [],
    },
    improvedVersion: {
      status: 'available',
      hooks: [
        grounded('improved_hook_1', 'Regarde la preuve avant l’explication.'),
        grounded('improved_hook_2', 'Le résultat change quand tu coupes cette phrase.'),
        grounded('improved_hook_3', 'Cette démonstration devait ouvrir la vidéo.'),
      ],
      bestHook: {
        hookId: 'improved_hook_1',
        why: 'Cette variante montre la preuve avant toute explication.',
        evidence: ['frame_start'],
      },
      fullRewrittenScript: {
        fullText: 'Voici le résultat. La phrase que j’ai coupée retardait toute la démonstration. Garde la preuve devant le contexte.',
        segments: [
          { id: 'script_segment_hook', purpose: 'hook', text: 'Voici le résultat.' },
          { id: 'script_segment_proof', purpose: 'proof', text: 'Regarde la démonstration.' },
          { id: 'script_segment_cta', purpose: 'cta', text: 'Quelle phrase couperais-tu en premier ?' },
        ],
      },
      editPlan: [grounded('edit_plan_1', 'Ouvre sur la démonstration.')],
      shotList: [grounded('shot_list_1', 'Plan serré sur le résultat final.')],
      onScreenText: [grounded('onscreen_text_1', 'LA PREUVE D’ABORD')],
      effectsAndBRoll: [grounded('broll_1', 'Ajoute le plan résultat sans transition décorative.')],
      cta: grounded('improved_cta', 'Quelle phrase couperais-tu ?'),
      caption: grounded('improved_caption', 'La preuve doit arriver avant le contexte.'),
      firstLine: grounded('improved_first_line', 'Voici le résultat.'),
      abTests: [{
        id: 'ab_test_hook',
        variable: 'hook',
        versionA: 'Regarde la preuve avant l’explication.',
        versionB: 'Cette démonstration devait ouvrir la vidéo.',
        successCriterion: 'Comparer le signal plateforme choisi après publication des deux versions.',
        evidence: ['frame_start'],
      }],
      limitations: ['Les variantes doivent être testées en publication réelle.'],
    },
    rubric: {
      version: 'viralynz-rubric-v1',
      assessments,
    },
    scores: computeDeterministicScores(assessments),
  };
}

function requireStrategicSummary(result: FinalAnalysisResult) {
  if (result.strategicSummary.status !== 'available') {
    throw new Error('Fixture invalide : résumé stratégique indisponible.');
  }
  return result.strategicSummary;
}

describe('contrats stricts du moteur vidéo', () => {
  it('accepte un résultat complet, versionné et strict', () => {
    expect(FinalAnalysisResultSchema.safeParse(validResult()).success).toBe(true);
  });

  it('refuse les champs inconnus et les valeurs nulles', () => {
    const extra = { ...validResult(), unexpected: true };
    expect(FinalAnalysisResultSchema.safeParse(extra).success).toBe(false);

    const source = validResult();
    const summary = requireStrategicSummary(source);
    const withNull = {
      ...source,
      strategicSummary: { ...summary, diagnosis: null },
    };
    expect(FinalAnalysisResultSchema.safeParse(withNull).success).toBe(false);
  });

  it('impose des fallbacks audio explicitement indisponibles', () => {
    const audio = validResult().evidence.audioSignals;
    const incomplete = {
      ...audio,
      voiceMusicBalance: undefined,
    };
    expect(AudioSignalsSchema.safeParse(incomplete).success).toBe(false);
  });

  it('accepte un OCR observé sans probabilité numérique inventée', () => {
    const frame = validResult().evidence.frames[0];
    const observed = {
      ...frame,
      ocr: {
        status: 'observed' as const,
        text: 'Texte lu par le modèle de vision',
        confidence: 'medium' as const,
        method: 'vision-observation-v1',
      },
    };
    const candidate = validResult();
    candidate.evidence.frames[0] = observed;
    expect(FinalAnalysisResultSchema.safeParse(candidate).success).toBe(true);
  });

  it('refuse les unités incohérentes pour les métriques plateforme', () => {
    expect(ObservedMetricSchema.safeParse({
      id: 'metric_views',
      key: 'views',
      value: 12.5,
      unit: 'ratio',
    }).success).toBe(false);
    expect(ObservedMetricSchema.safeParse({
      id: 'metric_completion',
      key: 'completion_rate',
      value: 72,
      unit: 'ratio',
    }).success).toBe(false);
  });

  it('autorise un spécialiste sans constat seulement si la limite est explicite', () => {
    const unavailableAudio = {
      id: 'diagnostic_audio_unavailable',
      specialist: 'audio',
      summary: 'Le diagnostic audio ne peut pas être établi.',
      findings: [],
      limitations: ['La vidéo ne contient aucune piste audio mesurable.'],
    };
    expect(SpecialistDiagnosticSchema.safeParse(unavailableAudio).success).toBe(true);
    expect(SpecialistDiagnosticSchema.safeParse({ ...unavailableAudio, limitations: [] }).success).toBe(false);
  });

  it('aligne le contexte sur les objectifs et exige le détail pour other', () => {
    const context = validResult().creatorContext;
    expect(CreatorContextSchema.safeParse(context).success).toBe(true);
    expect(CreatorContextSchema.safeParse({ ...context, objective: 'repost' }).success).toBe(false);
    expect(CreatorContextSchema.safeParse({ ...context, objective: 'other' }).success).toBe(false);
    expect(CreatorContextSchema.safeParse({
      ...context,
      objective: 'other',
      objectiveDetails: 'Tester une promesse éditoriale précise',
    }).success).toBe(true);
  });

  it('exige chaque sous-critère exactement une fois dans sa section', () => {
    const missing = validResult();
    missing.hook.criteria.pop();
    expect(FinalAnalysisResultSchema.safeParse(missing).success).toBe(false);

    const duplicated = validResult();
    duplicated.hook.criteria[duplicated.hook.criteria.length - 1] = {
      ...duplicated.hook.criteria[0],
    };
    expect(FinalAnalysisResultSchema.safeParse(duplicated).success).toBe(false);

    const wrongSection = validResult();
    wrongSection.hook.criteria[0] = {
      ...wrongSection.hook.criteria[0],
      criterionId: 'script.clarity',
    };
    expect(FinalAnalysisResultSchema.safeParse(wrongSection).success).toBe(false);
  });

  it('verrouille l’identité de la section sur la propriété finale', () => {
    const candidate = validResult();
    candidate.hook.section = 'script';
    expect(FinalAnalysisResultSchema.safeParse(candidate).success).toBe(false);
  });

  it('conserve une matrice complète et honnête quand une section est indisponible', () => {
    const candidate = unavailableAnalysisSection(
      'audio',
      'Aucune piste audio ne permet d examiner cette rubrique.',
    );
    expect(candidate.criteria).toHaveLength(ANALYSIS_SECTION_CRITERIA.audio.length);
    expect(candidate.criteria.every((criterion) => (
      criterion.status === 'unavailable'
      && criterion.evidence.length === 0
      && criterion.timeRange === null
    ))).toBe(true);
    expect(AudioAnalysisSectionSchema.safeParse(candidate).success).toBe(true);

    candidate.criteria[0] = {
      ...candidate.criteria[0],
      status: 'observed',
      evidence: [],
    };
    expect(AudioAnalysisSectionSchema.safeParse(candidate).success).toBe(false);

    const inventedEvidence = unavailableAnalysisSection(
      'audio',
      'Aucune piste audio ne permet d examiner cette rubrique.',
    );
    inventedEvidence.criteria[0].evidence = ['frame_start'];
    expect(AudioAnalysisSectionSchema.safeParse(inventedEvidence).success).toBe(false);
  });
});

describe('rubrique déterministe et transparente', () => {
  it('calcule les neuf dimensions et le total sans score fourni par le modèle', () => {
    const scores = computeDeterministicScores(rubricAssessments('met'));
    expect(scores.overall).toMatchObject({ status: 'computed', value: 100, confidence: 'high' });
    expect(scores.rhythm.status).toBe('computed');
    expect(scores.audio.status).toBe('computed');
    expect(scores.objectiveFit.status).toBe('computed');
    expect(scores.hook.criteria).toHaveLength(2);
    expect(scores.hook.positives.length).toBeGreaterThan(0);
  });

  it('rend le score indisponible quand la couverture de preuves est insuffisante', () => {
    const scores = computeDeterministicScores(rubricAssessments('unavailable'));
    expect(scores.overall.status).toBe('unavailable');
    expect(scores.overall.evidenceCoverage).toBe(0);
    expect(scores.audio.status).toBe('unavailable');
  });

  it('refuse un critère dupliqué au lieu de produire un score incohérent', () => {
    const assessments = rubricAssessments();
    assessments[1] = { ...assessments[0] };
    expect(() => computeDeterministicScores(assessments)).toThrow(/dupliqu/iu);
  });
});

describe('gate qualité fondée sur les preuves', () => {
  it('valide la fixture complète et couvre toute la vidéo', () => {
    const report = validateAnalysisQuality(validResult());
    expect(report.issues).toEqual([]);
    expect(report.status).toBe('pass');
    expect(report.validForPersistence).toBe(true);
    expect(report.checkedEvidenceCount).toBeGreaterThan(10);
    expect(report.checkedClaimCount).toBeGreaterThan(10);
  });

  it('rejette un timecode situé après la durée réelle', () => {
    const candidate = validResult();
    candidate.evidence.frames[1].timestampSec = 11;
    const report = validateAnalysisQuality(candidate);
    expect(report.status).toBe('reject');
    expect(report.issues.some((issue) => issue.code === 'timestamp_out_of_bounds')).toBe(true);
  });

  it('rejette une preuve référencée qui n’existe pas', () => {
    const candidate = validResult();
    candidate.specialists[0].findings[0].evidenceRefs = ['frame_missing'];
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'evidence_reference')).toBe(true);
  });

  it('valide les preuves, timecodes, affirmations et textes affichables des matrices', () => {
    const invalidReference = validResult();
    invalidReference.hook.criteria[0].evidence = ['frame_missing'];
    expect(validateAnalysisQuality(invalidReference).issues.some((issue) => (
      issue.code === 'evidence_reference'
      && issue.targetId === invalidReference.hook.criteria[0].criterionId
    ))).toBe(true);

    const invalidTimeRange = validResult();
    invalidTimeRange.hook.criteria[0].timeRange = { startSec: 0, endSec: 11 };
    expect(validateAnalysisQuality(invalidTimeRange).issues.some((issue) => (
      issue.code === 'timestamp_out_of_bounds'
      && issue.targetId === invalidTimeRange.hook.criteria[0].criterionId
    ))).toBe(true);

    const inventedRetention = validResult();
    inventedRetention.hook.criteria[0].note = 'La rétention chute à trois secondes.';
    expect(validateAnalysisQuality(inventedRetention).issues.some((issue) => (
      issue.code === 'unsupported_retention_claim'
      && issue.targetId === inventedRetention.hook.criteria[0].criterionId
    ))).toBe(true);

    const invalidDisplay = validResult();
    invalidDisplay.hook.criteria[0].note = 'Le signal vaut undefined.';
    expect(validateAnalysisQuality(invalidDisplay).issues.some((issue) => (
      issue.code === 'invalid_display_value'
      && issue.path?.includes('hook.criteria')
    ))).toBe(true);
  });

  it('rejette un mot rattaché à un segment inexistant', () => {
    const candidate = validResult();
    if (candidate.evidence.transcription.status !== 'available') throw new Error('Fixture transcript indisponible');
    candidate.evidence.transcription.normalized.words[0].segmentId = 'segment_missing';
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'transcript_integrity')).toBe(true);
  });

  it('rejette les trous dans la timeline complète', () => {
    const candidate = validResult();
    candidate.timeline[1].startTime = 4;
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'timeline_coverage')).toBe(true);
  });

  it('rejette les valeurs techniques affichables', () => {
    const candidate = validResult();
    candidate.timeline[0].diagnostic = 'Le diagnostic vaut undefined.';
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'invalid_display_value')).toBe(true);
  });

  it('rejette une paraphrase générique même si une preuve hors sujet est jointe', () => {
    const candidate = validResult();
    if (candidate.hook.status !== 'available') throw new Error('Fixture hook indisponible');
    const recommendation = candidate.hook.recommendations[0];
    recommendation.text = 'Renforce ton ouverture pour attirer davantage l’attention.';
    recommendation.nature = 'audio_observation';
    recommendation.evidence = ['frame_start'];
    const report = validateAnalysisQuality(candidate);
    expect(report.validForPersistence).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'generic_text')).toBe(true);
    expect(report.issues.some((issue) => issue.code === 'recommendation_integrity')).toBe(true);
  });

  it('rejette une citation transcript inventée et un objectif différent de celui choisi', () => {
    const candidate = validResult();
    if (candidate.script.status !== 'available') throw new Error('Fixture script indisponible');
    const recommendation = candidate.script.recommendations[0];
    recommendation.nature = 'transcript_observation';
    recommendation.evidence = ['segment_intro'];
    recommendation.objective = 'sales';
    recommendation.transcriptCitation = {
      status: 'available',
      segmentId: 'segment_intro',
      quote: 'Une phrase qui n’existe pas dans la vidéo',
    };
    const report = validateAnalysisQuality(candidate);
    expect(report.validForPersistence).toBe(false);
    expect(report.issues.filter((issue) => issue.code === 'recommendation_integrity').length).toBeGreaterThanOrEqual(2);
  });

  it('rejette une inférence éditoriale vague ancrée sur un constat hors sujet', () => {
    const candidate = validResult();
    if (candidate.hook.status !== 'available') throw new Error('Fixture hook indisponible');
    const recommendation = candidate.hook.recommendations[0];
    recommendation.observation = 'L’ouverture manque de force.';
    recommendation.text = 'Commence de façon plus percutante.';
    recommendation.example = 'Ouvre avec une phrase plus forte.';
    recommendation.nature = 'editorial_inference';
    recommendation.supportingSourceIds = ['timeline_body'];
    const report = validateAnalysisQuality(candidate);
    expect(report.validForPersistence).toBe(false);
    expect(report.issues.some((issue) => (
      issue.code === 'recommendation_integrity'
      && issue.targetId === recommendation.id
      && issue.message.includes('constat spécialiste')
    ))).toBe(true);
  });

  it('interdit une affirmation de rétention réelle sans donnée plateforme', () => {
    const candidate = validResult();
    const summary = requireStrategicSummary(candidate);
    summary.diagnosis = 'La rétention chute à 3 secondes.';
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'unsupported_retention_claim')).toBe(true);
  });

  it('autorise une hypothèse de risque clairement qualifiée', () => {
    const candidate = validResult();
    const summary = requireStrategicSummary(candidate);
    summary.diagnosis = 'Il existe un risque de rétention à tester quand la preuve arrive après le contexte.';
    expect(validateAnalysisQuality(candidate).status).toBe('pass');
  });

  it('autorise une observation de rétention si la courbe plateforme est citée', () => {
    const candidate = validResult();
    candidate.evidence.retention = {
      status: 'available',
      source: 'platform_export',
      sourceReference: 'export-retention-123',
      observedAt: NOW,
      points: [
        { id: 'retention_0', timestampSec: 0, retainedRatio: 1 },
        { id: 'retention_5', timestampSec: 5, retainedRatio: 0.72 },
        { id: 'retention_10', timestampSec: 10, retainedRatio: 0.61 },
      ],
    };
    const summary = requireStrategicSummary(candidate);
    summary.diagnosis = 'La rétention baisse à 72 % au point observé.';
    summary.evidence.push('retention_5');
    expect(validateAnalysisQuality(candidate).status).toBe('pass');
  });

  it('rejette une métrique chiffrée sans mesure citée', () => {
    const candidate = validResult();
    const summary = requireStrategicSummary(candidate);
    summary.diagnosis = 'Le silence mesuré atteint 10 %.';
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'unsupported_metric_claim')).toBe(true);
  });

  it('autorise une métrique chiffrée lorsque son signal est cité', () => {
    const candidate = validResult();
    const summary = requireStrategicSummary(candidate);
    summary.diagnosis = 'Le silence mesuré atteint 10 %.';
    summary.evidence.push('metric_silence');
    expect(validateAnalysisQuality(candidate).status).toBe('pass');
  });

  it('relie le débit verbal déterministe à son propre signal', () => {
    const missingEvidence = validResult();
    const missingSummary = requireStrategicSummary(missingEvidence);
    missingSummary.diagnosis = 'Le débit verbal mesuré atteint 132 mots par minute.';
    expect(validateAnalysisQuality(missingEvidence).issues.some((issue) => (
      issue.code === 'unsupported_metric_claim'
    ))).toBe(true);

    const supported = validResult();
    const supportedSummary = requireStrategicSummary(supported);
    supportedSummary.diagnosis = 'Le débit verbal mesuré atteint 132 mots par minute.';
    supportedSummary.evidence.push('metric_speaking_rate');
    expect(validateAnalysisQuality(supported).status).toBe('pass');
  });

  it('refuse de justifier une métrique avec un signal d’une autre nature', () => {
    const candidate = validResult();
    const summary = requireStrategicSummary(candidate);
    summary.diagnosis = 'Le silence mesuré atteint 10 %.';
    summary.evidence.push('metric_luma');
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'unsupported_metric_claim')).toBe(true);
  });

  it('détecte les formulations génériques et refuse leur persistance', () => {
    const candidate = validResult();
    if (candidate.priorities.status !== 'available') throw new Error('Fixture priorités indisponibles');
    candidate.priorities.critical[0].text = 'Optimise ton contenu et améliore le hook.';
    const report = validateAnalysisQuality(candidate);
    expect(findGenericPhrases(candidate.priorities.critical[0].text).length).toBeGreaterThan(0);
    expect(report.status).toBe('reject');
    expect(report.validForPersistence).toBe(false);
  });

  it('rejette un score altéré après le calcul de la rubrique', () => {
    const candidate = validResult();
    if (candidate.scores.overall.status !== 'computed') throw new Error('Fixture score indisponible');
    candidate.scores.overall.value = 42;
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'score_mismatch')).toBe(true);
  });

  it('rejette une critique qui oublie un diagnostic spécialiste', () => {
    const candidate = validResult();
    candidate.specialists.push({
      id: 'diagnostic_audio_unreviewed',
      specialist: 'audio',
      summary: 'Le diagnostic audio reste indisponible.',
      findings: [],
      limitations: ['Aucun signal voix-musique fiable.'],
    });
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'critique_inconsistent')).toBe(true);
  });

  it('rejette NaN au niveau du schéma avant toute persistance', () => {
    const candidate = validResult();
    if (candidate.scores.overall.status !== 'computed') throw new Error('Fixture score indisponible');
    candidate.scores.overall.value = Number.NaN;
    const report = validateAnalysisQuality(candidate);
    expect(report.issues.some((issue) => issue.code === 'schema_invalid')).toBe(true);
  });
});
