import { z } from 'zod';
import { TimelineSegmentSchema } from '@/lib/analysis-engine/index';

const cleanText = z.string().trim().min(1).max(2_000);
const evidenceId = z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const timestamp = z.number().finite().min(0);

export const VisualFrameObservationSchema = z.object({
  evidenceRef: evidenceId,
  timestampSec: timestamp,
  visibleSubject: cleanText,
  framing: cleanText,
  movement: cleanText,
  changeFromPrevious: cleanText,
  onScreenText: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('observed'),
      text: z.string().trim().max(1_000),
      legibility: z.enum(['clear', 'partial', 'poor']),
      safeZoneRisk: z.enum(['none', 'possible', 'likely']),
    }).strict(),
    z.object({
      status: z.literal('not_observed'),
      reason: cleanText,
    }).strict(),
  ]),
  speechVisualAlignment: z.discriminatedUnion('status', [
    z.object({ status: z.literal('observed'), note: cleanText }).strict(),
    z.object({ status: z.literal('unavailable'), reason: cleanText }).strict(),
  ]),
  proofOrDemonstration: z.discriminatedUnion('status', [
    z.object({ status: z.literal('observed'), note: cleanText }).strict(),
    z.object({ status: z.literal('not_observed'), note: cleanText }).strict(),
  ]),
  distractions: z.array(cleanText).max(10),
  lightContrastComposition: cleanText,
  cameraPresence: z.discriminatedUnion('status', [
    z.object({ status: z.literal('observed'), note: cleanText }).strict(),
    z.object({ status: z.literal('not_applicable'), reason: cleanText }).strict(),
  ]),
  bRollOrProduct: z.discriminatedUnion('status', [
    z.object({ status: z.literal('observed'), note: cleanText }).strict(),
    z.object({ status: z.literal('not_observed'), note: cleanText }).strict(),
  ]),
  confidence: z.enum(['low', 'medium', 'high']),
}).strict();

export const VisualBatchObservationSchema = z.object({
  batchId: evidenceId,
  frames: z.array(VisualFrameObservationSchema).min(1).max(12),
  persistentTextGroups: z.array(z.object({
    text: z.string().trim().min(1).max(1_000),
    evidenceRefs: z.array(evidenceId).min(1).max(12),
  }).strict()).max(20),
  limitations: z.array(cleanText).max(20),
}).strict();

export const TimelineAnalysisChunkSchema = z.object({
  segments: z.array(TimelineSegmentSchema).min(1).max(10),
}).strict();

export type VisualFrameObservation = z.infer<typeof VisualFrameObservationSchema>;
export type VisualBatchObservation = z.infer<typeof VisualBatchObservationSchema>;
export type TimelineAnalysisChunk = z.infer<typeof TimelineAnalysisChunkSchema>;
