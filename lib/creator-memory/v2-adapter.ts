import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  FinalAnalysisResultSchema,
  RubricCriterionIdSchema,
  VIRALYNZ_RUBRIC,
  validateAnalysisQuality,
  type FinalAnalysisResult,
  type RubricCriterionId,
} from '@/lib/analysis-engine/index';
import { getCreatorMemoryLimit } from '@/lib/plan-limits';
import { supabase, type Plan } from '@/lib/supabase';

const MEMORY_EVENT_TYPE = 'analysis_v2_learned';
export const CREATOR_MEMORY_V2_CANONICAL_COLUMNS = 'id, user_id, analysis_schema_version, engine_result';
const MEMORY_EVENT_SCHEMA = 'viralynz-creator-memory-event-v2';
const MEMORY_FACT_SCHEMA = 'viralynz-creator-memory-fact-v2';
const SOURCE_SCHEMA_VERSION = 2 as const;
const SOURCE_SCHEMA_ID = '2.0.0' as const;
const MAX_CONTEXT_FACTS = 10;
const MAX_CONTEXT_LENGTH = 3_600;

const KNOWN_PLANS = new Set<Plan>([
  'free',
  'starter',
  'pro',
  'lifetime',
  'creator',
  'scale',
]);

const BoundedIdentifierSchema = z.string().trim().min(1).max(160);
const AuditIdentifierSchema = z.string().regex(/^cmv2_[a-f0-9]{32}$/);

export const CreatorMemoryV2FactSchema = z.object({
  fact_schema: z.literal(MEMORY_FACT_SCHEMA),
  source_schema_version: z.literal(SOURCE_SCHEMA_VERSION),
  source_schema_id: z.literal(SOURCE_SCHEMA_ID),
  fact_id: z.string().regex(/^cmf2_[a-f0-9]{32}$/),
  audit_id: AuditIdentifierSchema,
  source_analysis_id: BoundedIdentifierSchema,
  criterion_id: RubricCriterionIdSchema,
  kind: z.enum(['editorial_strength', 'editorial_risk']),
  assessment_status: z.enum(['met', 'partial', 'not_met']),
  statement: z.string().trim().min(1).max(500),
  source_evidence_refs: z.array(BoundedIdentifierSchema).min(1).max(100),
  confidence: z.enum(['medium', 'high']),
}).strict();

export const CreatorMemoryV2EventSchema = z.object({
  event_schema: z.literal(MEMORY_EVENT_SCHEMA),
  source_schema_version: z.literal(SOURCE_SCHEMA_VERSION),
  source_schema_id: z.literal(SOURCE_SCHEMA_ID),
  event_id: z.string().uuid(),
  audit_id: AuditIdentifierSchema,
  user_id: BoundedIdentifierSchema,
  source_analysis_id: BoundedIdentifierSchema,
  source_generated_at: z.string().datetime({ offset: true }),
  facts: z.array(CreatorMemoryV2FactSchema).min(1).max(18),
}).strict();

const CreatorMemoryV2EventRowSchema = z.object({
  id: z.string().uuid(),
  user_id: BoundedIdentifierSchema,
  analysis_id: BoundedIdentifierSchema.nullable(),
  event_type: z.string(),
  extracted_insights_json: z.unknown(),
  created_at: z.string().datetime({ offset: true }),
}).strict();

export type CreatorMemoryV2Fact = z.infer<typeof CreatorMemoryV2FactSchema>;
export type CreatorMemoryV2Event = z.infer<typeof CreatorMemoryV2EventSchema>;

export interface CreatorMemoryV2Snapshot {
  version: 'creator-memory-context-v2';
  source_schema_version: 2;
  user_id: string;
  analysis_count: number;
  audit_ids: string[];
  facts: CreatorMemoryV2Fact[];
}

export interface OwnedCanonicalAnalysisV2 {
  userId: string;
  analysisId: string;
  schemaVersion: string;
  engineResult: unknown;
}

export interface CreatorMemoryV2EventInsert {
  id: string;
  userId: string;
  analysisId: string;
  payload: CreatorMemoryV2Event;
}

export interface CreatorMemoryV2Store {
  readOwnedCanonicalAnalysis(userId: string, analysisId: string): Promise<OwnedCanonicalAnalysisV2 | null>;
  readOwnedCanonicalAnalyses(userId: string, analysisIds: string[]): Promise<OwnedCanonicalAnalysisV2[]>;
  listOwnedEvents(userId: string, limit: number): Promise<unknown[]>;
  readOwnedEvent(userId: string, eventId: string): Promise<unknown | null>;
  insertOwnedEvent(input: CreatorMemoryV2EventInsert): Promise<'inserted' | 'conflict'>;
}

export type LearnCreatorMemoryV2Result =
  | {
    status: 'learned' | 'already_learned';
    auditId: string;
    eventId: string;
    factCount: number;
  }
  | {
    status: 'skipped';
    reason:
      | 'consent_missing'
      | 'plan_ineligible'
      | 'not_canonical_v2'
      | 'canonical_quality_rejected'
      | 'analysis_not_owned_or_missing'
      | 'canonical_integrity_mismatch'
      | 'no_grounded_fact'
      | 'event_conflict';
  };

const defaultStore: CreatorMemoryV2Store = {
  async readOwnedCanonicalAnalysis(userId, analysisId) {
    const { data, error } = await supabase
      .from('analyses')
      .select(CREATOR_MEMORY_V2_CANONICAL_COLUMNS)
      .eq('id', analysisId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[creator-memory-v2-safe] canonical_read_failed', {
        analysisId,
        code: error.code,
      });
      throw new Error('CREATOR_MEMORY_V2_CANONICAL_READ_FAILED');
    }
    if (!data) return null;

    const row = data as Record<string, unknown>;
    if (row.user_id !== userId || row.id !== analysisId) return null;
    return {
      userId,
      analysisId,
      schemaVersion: typeof row.analysis_schema_version === 'string' ? row.analysis_schema_version : '',
      engineResult: row.engine_result,
    };
  },

  async readOwnedCanonicalAnalyses(userId, analysisIds) {
    const uniqueIds = [...new Set(analysisIds)].slice(0, 300);
    if (uniqueIds.length === 0) return [];

    const owned: OwnedCanonicalAnalysisV2[] = [];
    for (let index = 0; index < uniqueIds.length; index += 50) {
      const chunk = uniqueIds.slice(index, index + 50);
      const { data, error } = await supabase
        .from('analyses')
        .select(CREATOR_MEMORY_V2_CANONICAL_COLUMNS)
        .eq('user_id', userId)
        .in('id', chunk);

      if (error) {
        console.warn('[creator-memory-v2-safe] canonical_batch_read_failed', { code: error.code });
        throw new Error('CREATOR_MEMORY_V2_CANONICAL_READ_FAILED');
      }
      for (const value of data ?? []) {
        const row = value as Record<string, unknown>;
        if (row.user_id !== userId || typeof row.id !== 'string') continue;
        owned.push({
          userId,
          analysisId: row.id,
          schemaVersion: typeof row.analysis_schema_version === 'string' ? row.analysis_schema_version : '',
          engineResult: row.engine_result,
        });
      }
    }
    return owned;
  },

  async listOwnedEvents(userId, limit) {
    const { data, error } = await supabase
      .from('creator_memory_events')
      .select('id, user_id, analysis_id, event_type, extracted_insights_json, created_at')
      .eq('user_id', userId)
      .eq('event_type', MEMORY_EVENT_TYPE)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[creator-memory-v2-safe] event_read_failed', { code: error.code });
      throw new Error('CREATOR_MEMORY_V2_EVENT_READ_FAILED');
    }
    return data ?? [];
  },

  async readOwnedEvent(userId, eventId) {
    const { data, error } = await supabase
      .from('creator_memory_events')
      .select('id, user_id, analysis_id, event_type, extracted_insights_json, created_at')
      .eq('id', eventId)
      .eq('user_id', userId)
      .eq('event_type', MEMORY_EVENT_TYPE)
      .maybeSingle();

    if (error) {
      console.warn('[creator-memory-v2-safe] event_conflict_read_failed', {
        eventId,
        code: error.code,
      });
      throw new Error('CREATOR_MEMORY_V2_EVENT_READ_FAILED');
    }
    return data ?? null;
  },

  async insertOwnedEvent(input) {
    const { error } = await supabase.from('creator_memory_events').insert({
      id: input.id,
      user_id: input.userId,
      analysis_id: input.analysisId,
      event_type: MEMORY_EVENT_TYPE,
      extracted_insights_json: input.payload,
      memory_before_summary: '',
      memory_after_summary: '',
      confidence_delta: 0,
    });

    if (!error) return 'inserted';
    if (error.code === '23505') return 'conflict';
    console.warn('[creator-memory-v2-safe] event_insert_failed', {
      analysisId: input.analysisId,
      auditId: input.payload.audit_id,
      code: error.code,
    });
    throw new Error('CREATOR_MEMORY_V2_EVENT_INSERT_FAILED');
  },
};

function eligibleMemoryLimit(plan: Plan | string): number {
  if (!KNOWN_PLANS.has(plan as Plan)) return 0;
  const configured = getCreatorMemoryLimit(plan);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(300, Math.floor(configured))
    : 0;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function deterministicUuid(seed: string): string {
  const bytes = Buffer.from(sha256(seed).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeCanonicalFingerprint(result: FinalAnalysisResult): string {
  return sha256(JSON.stringify({
    version: result.version,
    schemaVersion: result.schemaVersion,
    analysisId: result.analysisId,
    generatedAt: result.generatedAt,
    rubricVersion: result.rubric.version,
    assessments: result.rubric.assessments.map((assessment) => ({
      criterionId: assessment.criterionId,
      status: assessment.status,
      evidence: assessment.evidence,
      observation: assessment.observation,
      positive: assessment.positive,
      penalty: assessment.penalty,
    })),
  }));
}

function auditIdFor(result: FinalAnalysisResult): string {
  return `cmv2_${safeCanonicalFingerprint(result).slice(0, 32)}`;
}

function factIdFor(analysisId: string, criterionId: RubricCriterionId): string {
  return `cmf2_${sha256(`${analysisId}:${criterionId}`).slice(0, 32)}`;
}

function eventIdFor(userId: string, analysisId: string): string {
  return deterministicUuid(`${MEMORY_EVENT_SCHEMA}:${SOURCE_SCHEMA_ID}:${userId}:${analysisId}`);
}

function cleanStatement(value: string): string {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

/**
 * Extrait uniquement les évaluations éditoriales déterministes de la rubrique V2.
 * Les métriques plateforme, la rétention et tous les profils/snapshots legacy sont hors périmètre.
 */
export function extractCreatorMemoryV2Facts(result: FinalAnalysisResult): CreatorMemoryV2Fact[] {
  const auditId = auditIdFor(result);
  return result.rubric.assessments.flatMap((assessment) => {
    if (assessment.status === 'unavailable' || assessment.evidence.length === 0) return [];
    const kind = assessment.status === 'met' ? 'editorial_strength' : 'editorial_risk';
    const statement = cleanStatement(
      kind === 'editorial_strength'
        ? assessment.positive ?? assessment.observation
        : assessment.penalty ?? assessment.observation,
    );
    if (!statement) return [];

    return [CreatorMemoryV2FactSchema.parse({
      fact_schema: MEMORY_FACT_SCHEMA,
      source_schema_version: SOURCE_SCHEMA_VERSION,
      source_schema_id: SOURCE_SCHEMA_ID,
      fact_id: factIdFor(result.analysisId, assessment.criterionId),
      audit_id: auditId,
      source_analysis_id: result.analysisId,
      criterion_id: assessment.criterionId,
      kind,
      assessment_status: assessment.status,
      statement,
      source_evidence_refs: [...new Set(assessment.evidence)],
      confidence: result.critique.verdict === 'pass' && assessment.evidence.length >= 2
        ? 'high'
        : 'medium',
    })];
  });
}

export function buildCreatorMemoryV2Event(
  userId: string,
  result: FinalAnalysisResult,
): CreatorMemoryV2Event | null {
  const facts = extractCreatorMemoryV2Facts(result);
  if (facts.length === 0) return null;
  const eventId = eventIdFor(userId, result.analysisId);
  return CreatorMemoryV2EventSchema.parse({
    event_schema: MEMORY_EVENT_SCHEMA,
    source_schema_version: SOURCE_SCHEMA_VERSION,
    source_schema_id: SOURCE_SCHEMA_ID,
    event_id: eventId,
    audit_id: auditIdFor(result),
    user_id: userId,
    source_analysis_id: result.analysisId,
    source_generated_at: result.generatedAt,
    facts,
  });
}

function parseOwnedEventRow(raw: unknown, expectedUserId: string): CreatorMemoryV2Event | null {
  const row = CreatorMemoryV2EventRowSchema.safeParse(raw);
  if (!row.success) return null;
  if (row.data.user_id !== expectedUserId || row.data.event_type !== MEMORY_EVENT_TYPE) return null;

  const payload = CreatorMemoryV2EventSchema.safeParse(row.data.extracted_insights_json);
  if (!payload.success) return null;
  if (
    payload.data.user_id !== expectedUserId
    || payload.data.event_id !== row.data.id
    || payload.data.source_analysis_id !== row.data.analysis_id
  ) {
    return null;
  }
  return payload.data;
}

function sameMemoryEvent(left: CreatorMemoryV2Event, right: CreatorMemoryV2Event): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function loadCreatorMemoryV2(input: {
  userId: string;
  plan: Plan | string;
  consent: boolean;
  store?: CreatorMemoryV2Store;
}): Promise<CreatorMemoryV2Snapshot | null> {
  if (input.consent !== true) return null;
  const limit = eligibleMemoryLimit(input.plan);
  if (limit === 0) return null;

  const store = input.store ?? defaultStore;
  const rows = await store.listOwnedEvents(input.userId, limit);
  const candidates = rows
    .map((raw) => parseOwnedEventRow(raw, input.userId))
    .filter((event): event is CreatorMemoryV2Event => Boolean(event));
  if (candidates.length === 0) return null;

  // Les policies historiques autorisent l'insertion d'événements owner-bound.
  // On recalcule donc chaque payload depuis l'analyse canonique avant toute utilisation.
  const ownedAnalyses = await store.readOwnedCanonicalAnalyses(
    input.userId,
    candidates.map((event) => event.source_analysis_id),
  );
  const canonicalById = new Map<string, FinalAnalysisResult>();
  for (const owned of ownedAnalyses) {
    if (
      owned.userId !== input.userId
      || owned.schemaVersion !== SOURCE_SCHEMA_ID
      || owned.analysisId.trim() === ''
    ) continue;
    const parsed = FinalAnalysisResultSchema.safeParse(owned.engineResult);
    if (
      !parsed.success
      || parsed.data.analysisId !== owned.analysisId
      || parsed.data.creatorContext.memoryConsent !== true
      || !validateAnalysisQuality(parsed.data).validForPersistence
    ) continue;
    canonicalById.set(owned.analysisId, parsed.data);
  }

  const seenAudits = new Set<string>();
  const events: CreatorMemoryV2Event[] = [];
  for (const event of candidates) {
    const canonical = canonicalById.get(event.source_analysis_id);
    if (!canonical) continue;
    const expected = buildCreatorMemoryV2Event(input.userId, canonical);
    if (!expected || !sameMemoryEvent(event, expected) || seenAudits.has(event.audit_id)) continue;
    seenAudits.add(event.audit_id);
    events.push(event);
  }
  if (events.length === 0) return null;

  return {
    version: 'creator-memory-context-v2',
    source_schema_version: SOURCE_SCHEMA_VERSION,
    user_id: input.userId,
    analysis_count: new Set(events.map((event) => event.source_analysis_id)).size,
    audit_ids: events.map((event) => event.audit_id),
    facts: events.flatMap((event) => event.facts),
  };
}

function normalizeMemoryKey(value: string): string {
  return value
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Le contexte n'expose aucun identifiant de preuve historique et ne contient aucun score.
 * Il ne peut donc jamais compléter les evidenceRefs de l'analyse courante.
 */
export function buildCreatorMemoryV2Context(
  snapshot: CreatorMemoryV2Snapshot | null | undefined,
  input: { consent: boolean; userId: string },
): string {
  if (
    input.consent !== true
    || !snapshot
    || snapshot.version !== 'creator-memory-context-v2'
    || snapshot.source_schema_version !== SOURCE_SCHEMA_VERSION
    || snapshot.user_id !== input.userId
  ) return '';

  const criterionLabels = new Map(VIRALYNZ_RUBRIC.map((criterion) => [criterion.id, criterion.label]));
  const groups = new Map<string, { latest: CreatorMemoryV2Fact; occurrences: number }>();
  for (const fact of snapshot.facts) {
    const parsed = CreatorMemoryV2FactSchema.safeParse(fact);
    if (!parsed.success || parsed.data.source_schema_version !== SOURCE_SCHEMA_VERSION) continue;
    const key = `${parsed.data.kind}:${parsed.data.criterion_id}:${normalizeMemoryKey(parsed.data.statement)}`;
    const previous = groups.get(key);
    groups.set(key, {
      latest: previous?.latest ?? parsed.data,
      occurrences: (previous?.occurrences ?? 0) + 1,
    });
  }

  const facts = [...groups.values()]
    .sort((left, right) => right.occurrences - left.occurrences
      || left.latest.criterion_id.localeCompare(right.latest.criterion_id))
    .slice(0, MAX_CONTEXT_FACTS);
  if (facts.length === 0) return '';

  const lines = [
    'Mémoire créateur V2 — contexte historique uniquement :',
    '- Interdit : utiliser cette mémoire comme preuve, evidenceRef, mesure, rétention ou entrée de score.',
    '- Toute décision sur la vidéo courante doit rester justifiée par ses propres preuves V2.',
    `- Analyses V2 consenties prises en compte : ${snapshot.analysis_count}.`,
    ...facts.map(({ latest, occurrences }) => {
      const label = criterionLabels.get(latest.criterion_id) ?? latest.criterion_id;
      const nature = latest.kind === 'editorial_strength' ? 'Point à préserver' : 'Risque à vérifier';
      return `- ${nature} — ${label} : ${latest.statement} (historique : ${occurrences} analyse${occurrences > 1 ? 's' : ''}).`;
    }),
    `- Audits mémoire : ${snapshot.audit_ids.slice(0, 5).join(', ')}.`,
  ];
  return lines.join('\n').slice(0, MAX_CONTEXT_LENGTH);
}

export async function learnCreatorMemoryV2(input: {
  userId: string;
  plan: Plan | string;
  consent: boolean;
  result: unknown;
  store?: CreatorMemoryV2Store;
}): Promise<LearnCreatorMemoryV2Result> {
  if (input.consent !== true) return { status: 'skipped', reason: 'consent_missing' };
  if (eligibleMemoryLimit(input.plan) === 0) return { status: 'skipped', reason: 'plan_ineligible' };

  const supplied = FinalAnalysisResultSchema.safeParse(input.result);
  if (!supplied.success || supplied.data.creatorContext.memoryConsent !== true) {
    return { status: 'skipped', reason: supplied.success ? 'consent_missing' : 'not_canonical_v2' };
  }
  const suppliedQuality = validateAnalysisQuality(supplied.data);
  if (!suppliedQuality.validForPersistence) {
    return { status: 'skipped', reason: 'canonical_quality_rejected' };
  }

  const store = input.store ?? defaultStore;
  const owned = await store.readOwnedCanonicalAnalysis(input.userId, supplied.data.analysisId);
  if (
    !owned
    || owned.userId !== input.userId
    || owned.analysisId !== supplied.data.analysisId
    || owned.schemaVersion !== SOURCE_SCHEMA_ID
  ) {
    return { status: 'skipped', reason: 'analysis_not_owned_or_missing' };
  }

  const persisted = FinalAnalysisResultSchema.safeParse(owned.engineResult);
  if (!persisted.success || persisted.data.creatorContext.memoryConsent !== true) {
    return { status: 'skipped', reason: 'not_canonical_v2' };
  }
  if (!validateAnalysisQuality(persisted.data).validForPersistence) {
    return { status: 'skipped', reason: 'canonical_quality_rejected' };
  }
  if (safeCanonicalFingerprint(supplied.data) !== safeCanonicalFingerprint(persisted.data)) {
    return { status: 'skipped', reason: 'canonical_integrity_mismatch' };
  }

  // La source persistée owner-bound est l'unique source d'apprentissage.
  const event = buildCreatorMemoryV2Event(input.userId, persisted.data);
  if (!event) return { status: 'skipped', reason: 'no_grounded_fact' };

  const insert = await store.insertOwnedEvent({
    id: event.event_id,
    userId: input.userId,
    analysisId: persisted.data.analysisId,
    payload: event,
  });
  if (insert === 'inserted') {
    console.info('[creator-memory-v2-safe] learned', {
      analysisId: persisted.data.analysisId,
      auditId: event.audit_id,
      factCount: event.facts.length,
    });
    return {
      status: 'learned',
      auditId: event.audit_id,
      eventId: event.event_id,
      factCount: event.facts.length,
    };
  }

  const existingRaw = await store.readOwnedEvent(input.userId, event.event_id);
  const existing = parseOwnedEventRow(existingRaw, input.userId);
  if (
    !existing
    || existing.audit_id !== event.audit_id
    || existing.source_analysis_id !== persisted.data.analysisId
    || !sameMemoryEvent(existing, event)
  ) {
    return { status: 'skipped', reason: 'event_conflict' };
  }
  return {
    status: 'already_learned',
    auditId: event.audit_id,
    eventId: event.event_id,
    factCount: event.facts.length,
  };
}

export const CREATOR_MEMORY_V2_EVENT_TYPE = MEMORY_EVENT_TYPE;
