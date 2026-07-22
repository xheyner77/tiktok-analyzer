import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zodTextFormat } from 'openai/helpers/zod';

vi.mock('server-only', () => ({}));

import {
  ANALYSIS_SECTION_CRITERIA,
  VIRALYNZ_RUBRIC,
  type AnalysisCritique,
  type AnalysisSectionKey,
} from '@/lib/analysis-engine/index';
import type { DeterministicEvidenceBundle } from '@/lib/video-analysis/evidence';
import type { parseStructuredResponse } from '@/lib/video-analysis/openai-client';
import {
  FinalAnalysisQualityError,
  GeneratedAnalysisNarrativeSchema,
  buildFinalAnalysisCandidate,
  runCritiqueAndSynthesis,
  validateCrossCritique,
  validateCrossCritiqueOrFallback,
  type CritiqueAndSynthesisInput,
  type GeneratedAnalysisNarrative,
  type SynthesisCheckpoint,
} from '@/lib/video-analysis/synthesis';

const NOW = '2026-07-13T20:00:00.000Z';

function unavailable(reason: string) {
  return {
    status: 'unavailable' as const,
    reasonCode: 'not_measurable' as const,
    reason,
  };
}

function evidenceFixture(): DeterministicEvidenceBundle {
  return {
    creatorContext: {
      version: 'creator-context-v1',
      objective: 'views',
      platform: 'tiktok',
      niche: 'Montage vidéo',
      audience: 'Créateurs qui préparent une nouvelle version',
      audienceKnowledge: 'intermediate',
      format: 'facecam',
      tone: 'Direct et pédagogique',
      language: 'fr',
      memoryConsent: true,
    },
    video: {
      version: 'video-metadata-v1',
      fileName: 'source.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: 2_000_000,
      durationSec: 10,
      width: 1080,
      height: 1920,
      framesPerSecond: 30,
      container: 'mp4',
      videoCodec: 'h264',
      audioTrack: { status: 'absent', verifiedBy: 'ffmpeg' },
      probedAt: NOW,
    },
    frames: [
      {
        id: 'frame_start',
        timestampSec: 0,
        artifactRef: 'artifact:frame_start',
        width: 540,
        height: 960,
        samplingReason: 'opening',
        ocr: {
          status: 'observed',
          text: 'La preuve avant le contexte',
          confidence: 'high',
          method: 'Vision multimodale sur frame horodatée',
        },
      },
      {
        id: 'frame_end',
        timestampSec: 10,
        artifactRef: 'artifact:frame_end',
        width: 540,
        height: 960,
        samplingReason: 'ending',
        ocr: { status: 'unavailable', reason: 'Aucun texte lisible sur cette frame.' },
      },
    ],
    transcription: {
      status: 'unavailable',
      reasonCode: 'no_audio_track',
      reason: 'Aucune piste audio n’est présente.',
    },
    audioSignals: {
      version: 'audio-signals-v1',
      integratedLoudness: unavailable('Aucune piste audio mesurable.'),
      truePeak: unavailable('Aucune piste audio mesurable.'),
      meanVolumeDb: unavailable('Aucune piste audio mesurable.'),
      peakVolumeDb: unavailable('Aucune piste audio mesurable.'),
      silenceRatio: unavailable('Aucune piste audio mesurable.'),
      speechRatio: unavailable('Aucune piste audio mesurable.'),
      speakingRateWpm: unavailable('Aucune parole horodatée mesurable.'),
      averageSentenceLengthWords: unavailable('Aucune parole horodatée mesurable.'),
      wordDensityPerSecond: unavailable('Aucune parole horodatée mesurable.'),
      repeatedPhraseCount: unavailable('Aucune parole horodatée mesurable.'),
      hesitationCount: unavailable('Aucune parole horodatée mesurable.'),
      pauseIntervals: unavailable('Aucune piste audio mesurable.'),
      voiceMusicBalance: unavailable('Aucune piste audio mesurable.'),
    },
    visualSignals: {
      version: 'visual-signals-v1',
      averageLuma: unavailable('Signal visuel non mesuré.'),
      brightnessVariation: unavailable('Signal visuel non mesuré.'),
      blackFrameRatio: unavailable('Signal visuel non mesuré.'),
      freezeRatio: unavailable('Signal visuel non mesuré.'),
      sceneCutCount: unavailable('Signal visuel non mesuré.'),
      cutsPerMinute: unavailable('Signal visuel non mesuré.'),
      motionIntensity: unavailable('Signal visuel non mesuré.'),
      textCoverageRatio: unavailable('Signal visuel non mesuré.'),
      facePresenceRatio: unavailable('Signal visuel non mesuré.'),
    },
    observedMetrics: {
      status: 'unavailable',
      reason: 'Aucune métrique plateforme vérifiée.',
    },
    retention: {
      status: 'unavailable',
      reason: 'Aucune courbe de rétention plateforme.',
    },
  };
}

function requestFixture(): CritiqueAndSynthesisInput {
  return {
    jobId: 'job_123',
    analysisId: 'analysis_123',
    generatedAt: NOW,
    evidence: evidenceFixture(),
    specialists: [{
      id: 'specialist-hook',
      specialist: 'hook',
      summary: 'La première frame formule une promesse centrée sur la preuve.',
      findings: [{
        id: 'finding-hook-order',
        claim: 'Le texte visible annonce de placer la preuve avant le contexte.',
        implication: 'La promesse est immédiatement identifiable.',
        decision: 'Garde cette formulation dans la nouvelle ouverture.',
        severity: 'medium',
        confidence: 'high',
        timeRange: { startSec: 0, endSec: 3 },
        evidenceRefs: ['frame_start'],
      }],
      limitations: ['Aucune donnée de rétention réelle n’est disponible.'],
    }],
    timeline: [
      {
        id: 'timeline-opening',
        startTime: 0,
        endTime: 3,
        transcript: { status: 'unavailable', reason: 'Aucune piste audio.' },
        visualObservation: {
          status: 'available',
          text: 'Le texte annonce la preuve avant le contexte.',
          evidence: ['frame_start'],
        },
        audioObservation: { status: 'unavailable', reason: 'Aucune piste audio.' },
        editingObservation: {
          status: 'available',
          text: 'La première composition reste lisible.',
          evidence: ['frame_start'],
        },
        narrativeFunction: 'hook',
        observation: 'La promesse est affichée dès la première frame.',
        diagnostic: 'L’enjeu éditorial est nommé sans métrique de performance.',
        action: 'Garde la promesse et montre sa preuve dans le plan suivant.',
        objective: 'views',
        objectiveFit: 'Pour l’objectif vues, la promesse doit rester compréhensible dès l’ouverture.',
        example: 'Conserve le texte, puis coupe directement vers la démonstration visible.',
        transcriptCitation: {
          status: 'not_applicable',
          reasonCode: 'no_transcript',
          reason: 'La vidéo de cette fixture ne contient aucune parole.',
        },
        nature: 'observed',
        strengths: ['Le texte d’ouverture est lisible.'],
        problems: [],
        recommendedAction: 'Conserve le texte et avance le plan de démonstration.',
        evidence: ['frame_start'],
        confidence: 'high',
      },
      {
        id: 'timeline-body',
        startTime: 3,
        endTime: 10,
        transcript: { status: 'unavailable', reason: 'Aucune piste audio.' },
        visualObservation: {
          status: 'available',
          text: 'La frame finale ne porte aucun texte lisible.',
          evidence: ['frame_end'],
        },
        audioObservation: { status: 'unavailable', reason: 'Aucune piste audio.' },
        editingObservation: {
          status: 'available',
          text: 'Le dernier plan clôt la séquence sans rappel écrit.',
          evidence: ['frame_end'],
        },
        narrativeFunction: 'payoff',
        observation: 'La fin ne reformule pas la promesse affichée au début.',
        diagnostic: 'Le lien entre ouverture et conclusion reste implicite.',
        action: 'Ajoute une reformulation courte sur la dernière frame.',
        objective: 'views',
        objectiveFit: 'Pour l’objectif vues, la conclusion doit confirmer la proposition annoncée.',
        example: 'Affiche : « Voilà la preuve annoncée au début. »',
        transcriptCitation: {
          status: 'not_applicable',
          reasonCode: 'no_transcript',
          reason: 'La vidéo de cette fixture ne contient aucune parole.',
        },
        nature: 'observed',
        strengths: [],
        problems: ['La conclusion écrite est absente.'],
        recommendedAction: 'Affiche une phrase qui confirme la preuve annoncée.',
        evidence: ['frame_end'],
        confidence: 'high',
      },
    ],
  };
}

function critiqueFixture(): AnalysisCritique {
  return {
    version: 'analysis-critique-v1',
    verdict: 'pass',
    reviewedDiagnosticIds: ['specialist-hook'],
    issues: [],
    contradictionsResolved: [],
    limitations: ['La critique ne dispose d’aucune métrique plateforme.'],
  };
}

function sectionCriteria<TSection extends AnalysisSectionKey>(
  section: TSection,
  status: 'observed' | 'not_observed' | 'unavailable' = 'unavailable',
) {
  return ANALYSIS_SECTION_CRITERIA[section].map((criterionId) => ({
    criterionId,
    status,
    note: status === 'unavailable'
      ? 'Le signal necessaire n est pas disponible dans les preuves.'
      : 'La frame citee permet d etablir ce critere.',
    evidence: status === 'unavailable' ? [] : ['frame_start'],
    timeRange: status === 'unavailable' ? null : { startSec: 0, endSec: 3 },
    confidence: status === 'unavailable' ? 'low' as const : 'high' as const,
  }));
}

function unavailableSection(section: AnalysisSectionKey, reason: string) {
  return {
    section,
    status: 'unavailable' as const,
    reason,
    limitations: [reason],
    criteria: sectionCriteria(section),
  };
}

function unavailableContainer(reason: string) {
  return {
    status: 'unavailable' as const,
    reason,
    limitations: [reason],
  };
}

function groundedRecommendation(
  id: string,
  text: string,
  evidence: string[],
  timeRange: { startSec: number; endSec: number },
) {
  return {
    id,
    timeRange,
    observation: evidence.includes('frame_end')
      ? 'La fin ne reformule pas la promesse annoncée dans l’ouverture.'
      : 'La promesse est affichée dès la première frame de l’ouverture.',
    why: 'Cet ordre rend la conclusion moins explicite dans la version actuelle.',
    objective: 'views' as const,
    objectiveFit: 'Pour l’objectif vues, la proposition doit rester compréhensible du début à la fin.',
    text,
    example: `Version directement applicable : « ${text} »`,
    supportingSourceIds: [evidence.includes('frame_end') ? 'timeline-body' : 'timeline-opening'],
    transcriptCitation: {
      status: 'not_applicable' as const,
      reasonCode: 'visual_only' as const,
      reason: 'Aucune parole n’est disponible et cette décision porte sur la frame citée.',
    },
    nature: 'visual_observation' as const,
    evidence,
    confidence: 'high' as const,
  };
}

function narrativeFixture(): GeneratedAnalysisNarrative {
  const assessments = VIRALYNZ_RUBRIC.map((criterion) => ({
    criterionId: criterion.id,
    status: 'unavailable' as const,
    evidence: [],
    observation: 'Le signal nécessaire n’est pas disponible dans les preuves mesurées.',
    positive: null,
    penalty: null,
  }));
  return {
    strategicSummary: {
      status: 'available',
      diagnosis: 'L’ouverture affiche une promesse précise, mais la fin ne la reformule pas.',
      firstDecision: 'Garde la première frame et ajoute la confirmation sur la dernière.',
      whyNow: 'Cette décision relie les deux observations visuelles horodatées.',
      evidence: ['frame_start', 'frame_end'],
      limitations: ['Aucune performance réelle ne peut être déduite de ces frames.'],
    },
    hook: {
      section: 'hook',
      status: 'available',
      summary: 'Le texte de départ annonce la preuve avant le contexte.',
      strengths: ['La promesse est lisible dès la première frame.'],
      problems: [],
      recommendations: [groundedRecommendation(
        'hook-recommendation-keep-text',
        'Garde ce texte et enchaîne directement sur la démonstration.',
        ['frame_start'],
        { startSec: 0, endSec: 3 },
      )],
      evidence: ['frame_start'],
      limitations: ['Aucune rétention plateforme n’est disponible.'],
      criteria: sectionCriteria('hook', 'observed'),
    },
    script: unavailableSection('script', 'Aucune parole n’est disponible pour évaluer le script.'),
    editing: unavailableSection('editing', 'Deux frames seules ne suffisent pas pour détailler chaque coupe.'),
    visual: unavailableSection('visual', 'Les observations visuelles sont limitées aux frames échantillonnées.'),
    textAndCaptions: unavailableSection('textAndCaptions', 'Aucun sous-titre continu n’est observable.'),
    audio: unavailableSection('audio', 'La vidéo ne contient aucune piste audio.'),
    storytelling: unavailableSection('storytelling', 'Aucune parole ne permet de vérifier la progression narrative.'),
    conversion: unavailableSection('conversion', 'Aucun CTA vérifiable n’est présent dans les preuves disponibles.'),
    priorities: {
      status: 'available',
      critical: [groundedRecommendation(
        'priority-ending-text',
        'Ajoute une phrase finale qui confirme la preuve annoncée.',
        ['frame_end'],
        { startSec: 3, endSec: 10 },
      )],
      important: [],
      optimizations: [],
      limitations: ['La recommandation porte uniquement sur le texte observé.'],
    },
    correctionPlan: {
      status: 'available',
      steps: [{
        id: 'correction-ending-text',
        order: 1,
        observation: 'La dernière frame ne reformule pas la promesse du début.',
        action: 'Insère une reformulation courte sur la dernière frame.',
        rationale: 'La promesse visible au début n’est pas rappelée à la fin.',
        objective: 'views',
        objectiveFit: 'Pour l’objectif vues, la proposition doit rester explicite jusqu’à la conclusion.',
        example: 'Affiche : « La preuve était dans ce plan, pas dans mon introduction. »',
        supportingSourceIds: ['timeline-body'],
        transcriptCitation: {
          status: 'not_applicable',
          reasonCode: 'visual_only',
          reason: 'Aucune parole n’est disponible; la correction porte sur la frame finale.',
        },
        nature: 'visual_observation',
        timeRange: { startSec: 3, endSec: 10 },
        evidence: ['frame_end'],
        confidence: 'high',
      }],
      limitations: ['Le plan ne préjuge pas de la performance après republication.'],
    },
    improvedVersion: unavailableContainer('Le transcript est absent; une réécriture complète serait inventée.'),
    rubric: {
      version: 'viralynz-rubric-v1',
      assessments,
    },
  };
}

function callMetrics(model: string) {
  return {
    model,
    inputTokens: 100,
    outputTokens: 50,
    retries: 0,
    durationMs: 25,
  };
}

type StructuredCall = typeof parseStructuredResponse;

function fakeStructuredCall(outputs: unknown[], calls: Array<Record<string, unknown>>): StructuredCall {
  return (async (input: Record<string, unknown>) => {
    calls.push(input);
    const value = outputs.shift();
    return { value, metrics: callMetrics('model-qa') };
  }) as unknown as StructuredCall;
}

function structuredOutputComplexity(schema: unknown) {
  let objectProperties = 0;
  let maximumObjectDepth = 0;
  const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );
  const visit = (node: unknown, parentObjectDepth: number) => {
    if (!isRecord(node)) return;
    const properties = isRecord(node.properties) ? node.properties : null;
    const currentObjectDepth = node.type === 'object' && properties
      ? parentObjectDepth + 1
      : parentObjectDepth;
    if (properties) {
      objectProperties += Object.keys(properties).length;
      maximumObjectDepth = Math.max(maximumObjectDepth, currentObjectDepth);
      Object.values(properties).forEach((child) => visit(child, currentObjectDepth));
    }
    if (node.items) visit(node.items, currentObjectDepth);
    for (const unionKey of ['anyOf', 'allOf', 'oneOf'] as const) {
      const branches = node[unionKey];
      if (Array.isArray(branches)) branches.forEach((branch) => visit(branch, currentObjectDepth));
    }
    const definitions = isRecord(node.$defs) ? node.$defs : null;
    if (definitions) Object.values(definitions).forEach((definition) => visit(definition, 0));
  };

  visit(schema, 0);
  return {
    objectProperties,
    maximumObjectDepth,
    characters: JSON.stringify(schema).length,
  };
}

describe('critique croisée et synthèse finale', () => {
  beforeEach(() => {
    delete process.env.OPENAI_MODEL_PRICING_JSON;
  });

  it('interdit au modèle de produire preuves, timeline ou scores', () => {
    const narrative = narrativeFixture();
    expect(GeneratedAnalysisNarrativeSchema.safeParse(narrative).success).toBe(true);
    expect(GeneratedAnalysisNarrativeSchema.safeParse({ ...narrative, scores: {} }).success).toBe(false);
    expect(GeneratedAnalysisNarrativeSchema.safeParse({ ...narrative, evidence: {} }).success).toBe(false);
    expect(GeneratedAnalysisNarrativeSchema.safeParse({ ...narrative, timeline: [] }).success).toBe(false);
  });

  it('reste sous les limites Structured Outputs actuelles', () => {
    const format = zodTextFormat(GeneratedAnalysisNarrativeSchema, 'viralynz_final_narrative');
    const complexity = structuredOutputComplexity(format.schema);
    expect(complexity.objectProperties).toBeLessThanOrEqual(5_000);
    expect(complexity.maximumObjectDepth).toBeLessThanOrEqual(10);
    expect(complexity.characters).toBeLessThanOrEqual(120_000);
  });

  it('exige que la critique couvre tous les spécialistes avec des cibles connues', () => {
    const request = requestFixture();
    expect(validateCrossCritique(critiqueFixture(), request).verdict).toBe('pass');
    expect(() => validateCrossCritique({
      ...critiqueFixture(),
      reviewedDiagnosticIds: [],
    }, request)).toThrow();
    expect(() => validateCrossCritique({
      ...critiqueFixture(),
      verdict: 'revise',
      issues: [{
        id: 'issue-unknown',
        category: 'invalid_evidence',
        severity: 'error',
        message: 'La cible n’existe pas.',
        targetIds: ['invented-target'],
      }],
    }, request)).toThrow('CROSS_CRITIQUE_UNKNOWN_TARGET');
    expect(() => validateCrossCritique({
      ...critiqueFixture(),
      verdict: 'revise',
      issues: [{
        id: 'issue-supported-target-but-unresolved',
        category: 'unsupported_claim',
        severity: 'error',
        message: 'Cette erreur doit être résolue avant toute synthèse.',
        targetIds: ['frame_start'],
      }],
    }, request)).toThrow('CROSS_CRITIQUE_UNRESOLVED_ERROR');
  });

  it('remplace une critique fournisseur invalide par une limite serveur explicite', () => {
    const request = requestFixture();
    const critique = validateCrossCritiqueOrFallback({
      ...critiqueFixture(),
      reviewedDiagnosticIds: ['specialist-invented'],
    }, request);

    expect(critique).toMatchObject({
      verdict: 'revise',
      reviewedDiagnosticIds: request.specialists.map((diagnostic) => diagnostic.id),
      issues: [],
    });
    expect(critique.limitations[0]).toContain('identifiants de preuve validés par le serveur');
  });

  it('fusionne les blocs déterministes et calcule les scores côté serveur', () => {
    const request = requestFixture();
    const result = buildFinalAnalysisCandidate({
      request,
      critique: critiqueFixture(),
      narrative: narrativeFixture(),
      generatedAt: NOW,
    });
    expect(result.evidence.frames).toEqual(request.evidence.frames);
    expect(result.timeline).toEqual(request.timeline);
    expect(result.specialists).toEqual(request.specialists);
    expect(result.scores.overall.status).toBe('unavailable');
    expect(result.scores.overall.evidenceCoverage).toBe(0);
  });

  it('répare une formulation générique une seule fois puis retourne les métriques', async () => {
    const generic = narrativeFixture();
    if (generic.hook.status !== 'available') throw new Error('Fixture hook indisponible');
    generic.hook.summary = 'Optimise ton contenu et améliore le hook.';
    const calls: Array<Record<string, unknown>> = [];
    const response = await runCritiqueAndSynthesis(requestFixture(), {
      structuredCall: fakeStructuredCall([
        critiqueFixture(),
        generic,
        narrativeFixture(),
      ], calls),
    });

    expect(response.repaired).toBe(true);
    expect(response.quality.validForPersistence).toBe(true);
    expect(response.metrics).toMatchObject({
      providerCalls: 3,
      inputTokens: 300,
      outputTokens: 150,
      retries: 0,
      estimatedCostUsd: null,
    });
    expect(response.metrics.calls.map((call) => call.stage)).toEqual([
      'critique',
      'synthesis',
      'repair',
    ]);
    expect(calls.map((call) => call.idempotencyKey)).toEqual([
      'job_123:critique:video-coach-2026-07-13.1',
      'job_123:synthesis:video-coach-2026-07-13.1',
      'job_123:synthesis-repair:video-coach-2026-07-13.1',
    ]);
    expect(calls.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ maxOutputTokens: 5_000, timeoutMs: 240_000, maxRetries: 0 }),
      expect.objectContaining({ maxOutputTokens: 2_200, timeoutMs: 240_000, maxRetries: 0 }),
    ]));
    expect(JSON.stringify(response.metrics)).not.toContain('Optimise ton contenu');
  });

  it('refuse la sortie si la réparation unique reste générique', async () => {
    const generic = narrativeFixture();
    if (generic.hook.status !== 'available') throw new Error('Fixture hook indisponible');
    generic.hook.summary = 'Optimise ton contenu et améliore le hook.';
    const calls: Array<Record<string, unknown>> = [];
    const response = await runCritiqueAndSynthesis(requestFixture(), {
      structuredCall: fakeStructuredCall([critiqueFixture(), generic, generic], calls),
    });
    expect(response.quality.validForPersistence).toBe(true);
    expect(response.result.hook.status).toBe('unavailable');
    expect(calls).toHaveLength(3);
  });

  it('reprend le checkpoint sans rappeler une synthese deja reussie', async () => {
    let checkpoint: SynthesisCheckpoint | null = null;
    const firstCalls: Array<Record<string, unknown>> = [];
    await expect(runCritiqueAndSynthesis(requestFixture(), {
      structuredCall: fakeStructuredCall([critiqueFixture(), narrativeFixture()], firstCalls),
      persistCheckpoint: async (value) => {
        checkpoint = value;
        if (value.narrative) throw new Error('WORKFLOW_INTERRUPTED_AFTER_SYNTHESIS');
      },
    })).rejects.toThrow('WORKFLOW_INTERRUPTED_AFTER_SYNTHESIS');
    expect(firstCalls).toHaveLength(2);
    expect(checkpoint).toMatchObject({ narrative: expect.any(Object) });

    const resumedCall = vi.fn(async () => {
      throw new Error('PROVIDER_MUST_NOT_BE_CALLED');
    });
    const resumed = await runCritiqueAndSynthesis(requestFixture(), {
      structuredCall: resumedCall as unknown as StructuredCall,
      checkpoint,
    });
    expect(resumedCall).not.toHaveBeenCalled();
    expect(resumed.quality.validForPersistence).toBe(true);
    expect(resumed.metrics.providerCalls).toBe(2);
  });

  it('produit un fallback valide si la sortie de synthese est tronquee', async () => {
    let index = 0;
    const structuredCall = vi.fn(async () => {
      index += 1;
      if (index === 1) return { value: critiqueFixture(), metrics: callMetrics('model-qa') };
      throw new Error('OPENAI_STRUCTURED_OUTPUT_TRUNCATED');
    }) as unknown as StructuredCall;
    const response = await runCritiqueAndSynthesis(requestFixture(), { structuredCall });
    expect(response.result.hook.status).toBe('unavailable');
    expect(response.quality.validForPersistence).toBe(true);
    expect(structuredCall).toHaveBeenCalledTimes(2);
  });
});
