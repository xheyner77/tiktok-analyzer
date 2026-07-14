import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

import {
  ANALYSIS_SECTION_CRITERIA,
  FinalAnalysisResultSchema,
  VIRALYNZ_RUBRIC,
  computeDeterministicScores,
  validateAnalysisQuality,
  type AnalysisSectionKey,
  type FinalAnalysisResult,
  type RubricAssessment,
} from '@/lib/analysis-engine/index';
import {
  CREATOR_MEMORY_V2_CANONICAL_COLUMNS,
  CREATOR_MEMORY_V2_EVENT_TYPE,
  buildCreatorMemoryV2Context,
  buildCreatorMemoryV2Event,
  learnCreatorMemoryV2,
  loadCreatorMemoryV2,
  type CreatorMemoryV2Event,
  type CreatorMemoryV2EventInsert,
  type CreatorMemoryV2Store,
  type OwnedCanonicalAnalysisV2,
} from '@/lib/creator-memory/v2-adapter';

const NOW = '2026-07-13T21:00:00.000Z';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ANALYSIS_ID = '33333333-3333-4333-8333-333333333333';

function unavailableSignal(reason: string) {
  return {
    status: 'unavailable' as const,
    reasonCode: 'not_measurable' as const,
    reason,
  };
}

function unavailableSection(reason: string) {
  return {
    status: 'unavailable' as const,
    reason,
    limitations: [reason],
  };
}

function unavailableAnalysisSection(section: AnalysisSectionKey, reason: string) {
  return {
    section,
    status: 'unavailable' as const,
    reason,
    limitations: [reason],
    criteria: ANALYSIS_SECTION_CRITERIA[section].map((criterionId) => ({
      criterionId,
      status: 'unavailable' as const,
      note: 'Le signal necessaire n est pas disponible dans les preuves.',
      evidence: [],
      timeRange: null,
      confidence: 'low' as const,
    })),
  };
}

function canonicalResult(memoryConsent = true): FinalAnalysisResult {
  const assessments: RubricAssessment[] = VIRALYNZ_RUBRIC.map((criterion, index) => index === 0
    ? {
      criterionId: criterion.id,
      status: 'met',
      evidence: ['frame_start', 'frame_end'],
      observation: 'L’enjeu est lisible sur la première frame et reste cohérent avec la frame finale.',
      positive: 'L’enjeu éditorial est formulé dès la première frame.',
      penalty: null,
    }
    : {
      criterionId: criterion.id,
      status: 'unavailable',
      evidence: [],
      observation: 'Le signal nécessaire n’est pas disponible dans les preuves de cette vidéo.',
      positive: null,
      penalty: null,
    });

  const reason = 'Les preuves disponibles ne suffisent pas pour produire ce bloc sans invention.';
  return FinalAnalysisResultSchema.parse({
    version: 'viralynz-analysis-v2',
    schemaVersion: '2.0.0',
    engineVersion: 'video-engine-2.0.0',
    analysisId: ANALYSIS_ID,
    generatedAt: NOW,
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
      memoryConsent,
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
    evidence: {
      frames: [
        {
          id: 'frame_start',
          timestampSec: 0,
          artifactRef: `${ANALYSIS_ID}/frame_start.jpg`,
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
          artifactRef: `${ANALYSIS_ID}/frame_end.jpg`,
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
        integratedLoudness: unavailableSignal('Aucune piste audio mesurable.'),
        truePeak: unavailableSignal('Aucune piste audio mesurable.'),
        meanVolumeDb: unavailableSignal('Aucune piste audio mesurable.'),
        peakVolumeDb: unavailableSignal('Aucune piste audio mesurable.'),
        silenceRatio: unavailableSignal('Aucune piste audio mesurable.'),
        speechRatio: unavailableSignal('Aucune piste audio mesurable.'),
        speakingRateWpm: unavailableSignal('Aucune parole horodatée mesurable.'),
        averageSentenceLengthWords: unavailableSignal('Aucune parole horodatée mesurable.'),
        wordDensityPerSecond: unavailableSignal('Aucune parole horodatée mesurable.'),
        repeatedPhraseCount: unavailableSignal('Aucune parole horodatée mesurable.'),
        hesitationCount: unavailableSignal('Aucune parole horodatée mesurable.'),
        pauseIntervals: unavailableSignal('Aucune piste audio mesurable.'),
        voiceMusicBalance: unavailableSignal('Aucune piste audio mesurable.'),
      },
      visualSignals: {
        version: 'visual-signals-v1',
        averageLuma: unavailableSignal('Signal visuel non mesuré.'),
        brightnessVariation: unavailableSignal('Signal visuel non mesuré.'),
        blackFrameRatio: unavailableSignal('Signal visuel non mesuré.'),
        freezeRatio: unavailableSignal('Signal visuel non mesuré.'),
        sceneCutCount: unavailableSignal('Signal visuel non mesuré.'),
        cutsPerMinute: unavailableSignal('Signal visuel non mesuré.'),
        motionIntensity: unavailableSignal('Signal visuel non mesuré.'),
        textCoverageRatio: unavailableSignal('Signal visuel non mesuré.'),
        facePresenceRatio: unavailableSignal('Signal visuel non mesuré.'),
      },
      observedMetrics: {
        status: 'unavailable',
        reason: 'Aucune métrique plateforme vérifiée.',
      },
      retention: {
        status: 'unavailable',
        reason: 'Aucune courbe de rétention plateforme.',
      },
    },
    specialists: [{
      id: 'specialist_hook',
      specialist: 'hook',
      summary: 'La première frame formule un enjeu éditorial concret.',
      findings: [{
        id: 'finding_hook',
        claim: 'Le texte visible annonce de placer la preuve avant le contexte.',
        implication: 'La décision de montage est identifiable dès l’ouverture.',
        decision: 'Garde cette formulation dans la nouvelle ouverture.',
        severity: 'medium',
        confidence: 'high',
        timeRange: { startSec: 0, endSec: 3 },
        evidenceRefs: ['frame_start'],
      }],
      limitations: ['Aucune donnée plateforme réelle n’est disponible.'],
    }],
    critique: {
      version: 'analysis-critique-v1',
      verdict: 'pass',
      reviewedDiagnosticIds: ['specialist_hook'],
      issues: [],
      contradictionsResolved: [],
      limitations: ['La critique ne dispose d’aucune métrique plateforme.'],
    },
    strategicSummary: unavailableSection(reason),
    hook: unavailableAnalysisSection('hook', reason),
    script: unavailableAnalysisSection('script', reason),
    editing: unavailableAnalysisSection('editing', reason),
    visual: unavailableAnalysisSection('visual', reason),
    textAndCaptions: unavailableAnalysisSection('textAndCaptions', reason),
    audio: unavailableAnalysisSection('audio', reason),
    storytelling: unavailableAnalysisSection('storytelling', reason),
    conversion: unavailableAnalysisSection('conversion', reason),
    timeline: [{
      id: 'timeline_full',
      startTime: 0,
      endTime: 10,
      transcript: { status: 'unavailable', reason: 'Aucune piste audio.' },
      visualObservation: {
        status: 'available',
        text: 'L’enjeu est visible au début et la frame finale clôt la démonstration.',
        evidence: ['frame_start', 'frame_end'],
      },
      audioObservation: { status: 'unavailable', reason: 'Aucune piste audio.' },
      editingObservation: {
        status: 'available',
        text: 'Les frames de début et de fin bornent la séquence.',
        evidence: ['frame_start', 'frame_end'],
      },
      narrativeFunction: 'hook',
      observation: 'La première frame porte l’enjeu éditorial.',
      diagnostic: 'L’ouverture nomme l’enjeu sans inventer de performance.',
      action: 'Garde cet enjeu et vérifie sa continuité au montage.',
      objective: 'views',
      objectiveFit: 'Pour l’objectif vues, la première frame doit garder l’enjeu immédiatement lisible.',
      example: 'Réutilise exactement la première frame avant d’enchaîner sur la preuve.',
      transcriptCitation: {
        status: 'not_applicable',
        reasonCode: 'no_transcript',
        reason: 'Cette analyse canonique ne dispose d’aucun transcript.',
      },
      nature: 'observed',
      strengths: ['L’enjeu est lisible sur la première frame.'],
      problems: [],
      recommendedAction: 'Conserve la première frame dans la prochaine version.',
      evidence: ['frame_start', 'frame_end'],
      confidence: 'high',
    }],
    priorities: unavailableSection(reason),
    correctionPlan: unavailableSection(reason),
    improvedVersion: unavailableSection(reason),
    rubric: { version: 'viralynz-rubric-v1', assessments },
    scores: computeDeterministicScores(assessments),
  });
}

interface StoreHarness {
  store: CreatorMemoryV2Store;
  counters: {
    canonicalReads: number;
    canonicalBatchReads: number;
    eventReads: number;
    eventLists: number;
    inserts: number;
  };
  rows: unknown[];
  setOwned(value: OwnedCanonicalAnalysisV2 | null): void;
}

function eventRow(event: CreatorMemoryV2Event, overrides: Record<string, unknown> = {}) {
  return {
    id: event.event_id,
    user_id: event.user_id,
    analysis_id: event.source_analysis_id,
    event_type: CREATOR_MEMORY_V2_EVENT_TYPE,
    extracted_insights_json: event,
    created_at: NOW,
    ...overrides,
  };
}

function storeHarness(result: FinalAnalysisResult): StoreHarness {
  let owned: OwnedCanonicalAnalysisV2 | null = {
    userId: USER_ID,
    analysisId: result.analysisId,
    schemaVersion: '2.0.0',
    engineResult: result,
  };
  const rows: unknown[] = [];
  const counters = {
    canonicalReads: 0,
    canonicalBatchReads: 0,
    eventReads: 0,
    eventLists: 0,
    inserts: 0,
  };

  const store: CreatorMemoryV2Store = {
    async readOwnedCanonicalAnalysis() {
      counters.canonicalReads += 1;
      return owned;
    },
    async readOwnedCanonicalAnalyses(userId, analysisIds) {
      counters.canonicalBatchReads += 1;
      if (!owned || owned.userId !== userId || !analysisIds.includes(owned.analysisId)) return [];
      return [owned];
    },
    async listOwnedEvents() {
      counters.eventLists += 1;
      return rows;
    },
    async readOwnedEvent(userId, eventId) {
      counters.eventReads += 1;
      return rows.find((raw) => {
        if (!raw || typeof raw !== 'object') return false;
        const row = raw as Record<string, unknown>;
        return row.id === eventId && row.user_id === userId;
      }) ?? null;
    },
    async insertOwnedEvent(input: CreatorMemoryV2EventInsert) {
      counters.inserts += 1;
      if (rows.some((raw) => (raw as Record<string, unknown>).id === input.id)) return 'conflict';
      rows.push(eventRow(input.payload));
      return 'inserted';
    },
  };

  return {
    store,
    counters,
    rows,
    setOwned(value) {
      owned = value;
    },
  };
}

describe('mémoire créateur V2 sûre', () => {
  it('reste alignée sur la colonne canonique créée par la migration analyses', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260713180000_video_analysis_jobs.sql'),
      'utf8',
    );
    expect(CREATOR_MEMORY_V2_CANONICAL_COLUMNS).toContain('analysis_schema_version');
    expect(CREATOR_MEMORY_V2_CANONICAL_COLUMNS).not.toMatch(/(?:^|,\s*)schema_version(?:,|$)/u);
    expect(migration).toMatch(/add column if not exists analysis_schema_version text/iu);
  });
  it('ne lit et n’écrit rien sans consentement explicite', async () => {
    const result = canonicalResult(false);
    const harness = storeHarness(result);

    const learned = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: false,
      result,
      store: harness.store,
    });
    const loaded = await loadCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: false,
      store: harness.store,
    });

    expect(learned).toEqual({ status: 'skipped', reason: 'consent_missing' });
    expect(loaded).toBeNull();
    expect(harness.counters).toEqual({
      canonicalReads: 0,
      canonicalBatchReads: 0,
      eventReads: 0,
      eventLists: 0,
      inserts: 0,
    });
  });

  it('apprend avec consentement depuis le résultat V2 canonique owner-bound', async () => {
    const result = canonicalResult(true);
    expect(validateAnalysisQuality(result).validForPersistence).toBe(true);
    const harness = storeHarness(result);

    const learned = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      result,
      store: harness.store,
    });

    expect(learned.status).toBe('learned');
    expect(harness.counters.canonicalReads).toBe(1);
    expect(harness.counters.inserts).toBe(1);
    const persisted = harness.rows[0] as Record<string, unknown>;
    const payload = persisted.extracted_insights_json as CreatorMemoryV2Event;
    expect(payload.source_schema_version).toBe(2);
    expect(payload.audit_id).toMatch(/^cmv2_[a-f0-9]{32}$/);
    expect(payload.user_id).toBe(USER_ID);
    expect(payload.facts).toHaveLength(1);
    expect(payload.facts[0]).toMatchObject({
      source_analysis_id: ANALYSIS_ID,
      source_evidence_refs: ['frame_start', 'frame_end'],
      kind: 'editorial_strength',
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('observedMetrics');
    expect(serialized).not.toContain('retention');
    expect(serialized).not.toContain('scores');
    expect(serialized).not.toContain('creator_profile');
    expect(serialized).not.toContain('snapshot');
  });

  it('refuse une analyse étrangère, une source legacy et un plan inconnu', async () => {
    const result = canonicalResult(true);
    const harness = storeHarness(result);
    harness.setOwned({
      userId: OTHER_USER_ID,
      analysisId: ANALYSIS_ID,
      schemaVersion: '2.0.0',
      engineResult: result,
    });

    const foreign = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      result,
      store: harness.store,
    });
    const legacy = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      result: { viralityScore: 91, retention: { score: 88 } },
      store: harness.store,
    });
    const unknownPlan = await loadCreatorMemoryV2({
      userId: USER_ID,
      plan: 'enterprise_unknown',
      consent: true,
      store: harness.store,
    });

    expect(foreign).toEqual({ status: 'skipped', reason: 'analysis_not_owned_or_missing' });
    expect(legacy).toEqual({ status: 'skipped', reason: 'not_canonical_v2' });
    expect(unknownPlan).toBeNull();
    expect(harness.counters.inserts).toBe(0);
    expect(harness.counters.eventLists).toBe(0);
  });

  it('ignore les événements legacy, étrangers ou blanchis lors de la lecture', async () => {
    const result = canonicalResult(true);
    const harness = storeHarness(result);
    const event = buildCreatorMemoryV2Event(USER_ID, result);
    if (!event) throw new Error('Fixture mémoire V2 indisponible.');
    const laundered: CreatorMemoryV2Event = {
      ...event,
      event_id: '77777777-7777-4777-8777-777777777777',
      facts: event.facts.map((fact, index) => index === 0
        ? { ...fact, statement: 'Ancien fait arbitraire blanchi en mémoire V2.' }
        : fact),
    };

    harness.rows.push(
      eventRow(laundered),
      eventRow(event),
      {
        ...eventRow(event),
        id: '44444444-4444-4444-8444-444444444444',
        event_type: 'analysis_learned',
        extracted_insights_json: {
          winning_hooks: ['Ancien faux fait'],
          retention_patterns: ['Ancienne rétention'],
        },
      },
      eventRow(event, {
        id: '55555555-5555-4555-8555-555555555555',
        user_id: OTHER_USER_ID,
      }),
      eventRow(event, {
        id: '66666666-6666-4666-8666-666666666666',
        extracted_insights_json: {
          ...event,
          event_id: '66666666-6666-4666-8666-666666666666',
          user_id: USER_ID,
          source_schema_version: 1,
        },
      }),
    );

    const snapshot = await loadCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      store: harness.store,
    });

    expect(snapshot?.analysis_count).toBe(1);
    expect(snapshot?.facts).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain('Ancien faux fait');
    expect(JSON.stringify(snapshot)).not.toContain('Ancienne rétention');
    expect(JSON.stringify(snapshot)).not.toContain('Ancien fait arbitraire blanchi');
  });

  it('n’expose jamais les preuves historiques comme preuves ou scores courants', async () => {
    const result = canonicalResult(true);
    const harness = storeHarness(result);
    const event = buildCreatorMemoryV2Event(USER_ID, result);
    if (!event) throw new Error('Fixture mémoire V2 indisponible.');
    harness.rows.push(eventRow(event));

    const snapshot = await loadCreatorMemoryV2({
      userId: USER_ID,
      plan: 'starter',
      consent: true,
      store: harness.store,
    });
    const context = buildCreatorMemoryV2Context(snapshot, { consent: true, userId: USER_ID });

    expect(context).toContain('contexte historique uniquement');
    expect(context).toContain('Toute décision sur la vidéo courante');
    expect(context).not.toContain('frame_start');
    expect(context).not.toContain('frame_end');
    expect(context).not.toMatch(/\b\d{1,3}\/100\b/);
    expect(buildCreatorMemoryV2Context(snapshot, { consent: false, userId: USER_ID })).toBe('');
    expect(buildCreatorMemoryV2Context(snapshot, { consent: true, userId: OTHER_USER_ID })).toBe('');
  });

  it('est idempotent avec un event ID déterministe et refuse les conflits blanchis', async () => {
    const result = canonicalResult(true);
    const harness = storeHarness(result);
    const first = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      result,
      store: harness.store,
    });
    const second = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      result,
      store: harness.store,
    });

    expect(first.status).toBe('learned');
    expect(second.status).toBe('already_learned');
    expect(harness.rows).toHaveLength(1);

    const row = harness.rows[0] as Record<string, unknown>;
    const payload = row.extracted_insights_json as CreatorMemoryV2Event;
    row.extracted_insights_json = { ...payload, audit_id: 'cmv2_00000000000000000000000000000000' };
    const conflict = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'pro',
      consent: true,
      result,
      store: harness.store,
    });
    expect(conflict).toEqual({ status: 'skipped', reason: 'event_conflict' });
  });

  it('refuse un résultat fourni différent du canon persisté', async () => {
    const result = canonicalResult(true);
    const harness = storeHarness(result);
    const changed = { ...result, generatedAt: '2026-07-13T21:00:01.000Z' };

    const outcome = await learnCreatorMemoryV2({
      userId: USER_ID,
      plan: 'lifetime',
      consent: true,
      result: changed,
      store: harness.store,
    });

    expect(outcome).toEqual({ status: 'skipped', reason: 'canonical_integrity_mismatch' });
    expect(harness.counters.inserts).toBe(0);
  });
});
