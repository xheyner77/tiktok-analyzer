import 'server-only';

import { normalizePlan, type RawPlan } from '@/lib/plans';

export type AnalysisProfileId = 'free' | 'starter' | 'pro' | 'qa';

export type AnalysisBudgetStage =
  | 'transcription'
  | 'visual_analysis'
  | 'specialist_analysis'
  | 'timeline_analysis'
  | 'synthesis_critique'
  | 'synthesis'
  | 'synthesis_repair';

export type AnalysisSpecialist =
  | 'hook'
  | 'script'
  | 'audio'
  | 'editing'
  | 'storytelling'
  | 'visual_text'
  | 'cta';

export interface AnalysisStageBudget {
  maxCalls: number;
  maxInputTokensPerCall: number;
  maxOutputTokensPerCall: number;
  maxAudioSecondsPerCall: number;
  models: readonly string[];
}

export interface AnalysisProfile {
  version: 'analysis-economics-2026-07-22.1';
  id: AnalysisProfileId;
  maxCostUsd: number;
  maxBillableCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxDurationSeconds: number;
  maxFrames: number;
  framesPerVisionBatch: number;
  maxTimelineSegments: number;
  specialists: readonly AnalysisSpecialist[];
  includeCritique: boolean;
  maxRepairs: 0 | 1;
  maxProviderRetries: 0;
  singlePassTranscription: true;
  stages: Readonly<Record<AnalysisBudgetStage, AnalysisStageBudget>>;
}

const noCalls = (models: readonly string[]): AnalysisStageBudget => ({
  maxCalls: 0,
  maxInputTokensPerCall: 0,
  maxOutputTokensPerCall: 0,
  maxAudioSecondsPerCall: 0,
  models,
});

const FREE: AnalysisProfile = Object.freeze({
  version: 'analysis-economics-2026-07-22.1',
  id: 'free',
  maxCostUsd: 0.15,
  maxBillableCalls: 9,
  maxInputTokens: 88_000,
  maxOutputTokens: 16_000,
  maxDurationSeconds: 60,
  maxFrames: 8,
  framesPerVisionBatch: 8,
  maxTimelineSegments: 8,
  specialists: ['hook', 'script', 'editing', 'cta'] as const,
  includeCritique: false,
  maxRepairs: 1,
  maxProviderRetries: 0,
  singlePassTranscription: true,
  stages: Object.freeze({
    transcription: { maxCalls: 1, maxInputTokensPerCall: 0, maxOutputTokensPerCall: 0, maxAudioSecondsPerCall: 60, models: ['whisper-1'] },
    visual_analysis: { maxCalls: 1, maxInputTokensPerCall: 16_000, maxOutputTokensPerCall: 1_800, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    specialist_analysis: { maxCalls: 4, maxInputTokensPerCall: 8_000, maxOutputTokensPerCall: 1_600, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    timeline_analysis: { maxCalls: 1, maxInputTokensPerCall: 10_000, maxOutputTokensPerCall: 2_500, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    synthesis_critique: noCalls(['gpt-4o-mini']),
    synthesis: { maxCalls: 1, maxInputTokensPerCall: 18_000, maxOutputTokensPerCall: 3_500, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    synthesis_repair: { maxCalls: 1, maxInputTokensPerCall: 12_000, maxOutputTokensPerCall: 1_800, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
  }),
});

const STARTER: AnalysisProfile = Object.freeze({
  version: 'analysis-economics-2026-07-22.1',
  id: 'starter',
  maxCostUsd: 0.25,
  maxBillableCalls: 12,
  maxInputTokens: 154_000,
  maxOutputTokens: 26_900,
  maxDurationSeconds: 120,
  maxFrames: 16,
  framesPerVisionBatch: 8,
  maxTimelineSegments: 16,
  specialists: ['hook', 'script', 'editing', 'storytelling', 'cta'] as const,
  includeCritique: false,
  maxRepairs: 1,
  maxProviderRetries: 0,
  singlePassTranscription: true,
  stages: Object.freeze({
    transcription: { maxCalls: 1, maxInputTokensPerCall: 0, maxOutputTokensPerCall: 0, maxAudioSecondsPerCall: 120, models: ['whisper-1'] },
    visual_analysis: { maxCalls: 2, maxInputTokensPerCall: 18_000, maxOutputTokensPerCall: 2_200, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    specialist_analysis: { maxCalls: 5, maxInputTokensPerCall: 10_000, maxOutputTokensPerCall: 2_000, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    timeline_analysis: { maxCalls: 2, maxInputTokensPerCall: 14_000, maxOutputTokensPerCall: 3_000, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    synthesis_critique: noCalls(['gpt-5.4-mini']),
    synthesis: { maxCalls: 1, maxInputTokensPerCall: 24_000, maxOutputTokensPerCall: 4_500, maxAudioSecondsPerCall: 0, models: ['gpt-5.4-mini'] },
    synthesis_repair: { maxCalls: 1, maxInputTokensPerCall: 16_000, maxOutputTokensPerCall: 2_000, maxAudioSecondsPerCall: 0, models: ['gpt-5.4-mini'] },
  }),
});

const PRO: AnalysisProfile = Object.freeze({
  version: 'analysis-economics-2026-07-22.1',
  id: 'pro',
  maxCostUsd: 0.4,
  maxBillableCalls: 17,
  maxInputTokens: 266_000,
  maxOutputTokens: 48_200,
  maxDurationSeconds: 180,
  maxFrames: 28,
  framesPerVisionBatch: 10,
  maxTimelineSegments: 24,
  specialists: ['hook', 'script', 'audio', 'editing', 'storytelling', 'visual_text', 'cta'] as const,
  includeCritique: true,
  maxRepairs: 1,
  maxProviderRetries: 0,
  singlePassTranscription: true,
  stages: Object.freeze({
    transcription: { maxCalls: 1, maxInputTokensPerCall: 0, maxOutputTokensPerCall: 0, maxAudioSecondsPerCall: 180, models: ['whisper-1'] },
    visual_analysis: { maxCalls: 3, maxInputTokensPerCall: 20_000, maxOutputTokensPerCall: 3_000, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    specialist_analysis: { maxCalls: 7, maxInputTokensPerCall: 12_000, maxOutputTokensPerCall: 2_500, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    timeline_analysis: { maxCalls: 3, maxInputTokensPerCall: 18_000, maxOutputTokensPerCall: 4_000, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    synthesis_critique: { maxCalls: 1, maxInputTokensPerCall: 22_000, maxOutputTokensPerCall: 2_500, maxAudioSecondsPerCall: 0, models: ['gpt-5.4-mini'] },
    synthesis: { maxCalls: 1, maxInputTokensPerCall: 60_000, maxOutputTokensPerCall: 5_000, maxAudioSecondsPerCall: 0, models: ['gpt-5.4'] },
    synthesis_repair: { maxCalls: 1, maxInputTokensPerCall: 18_000, maxOutputTokensPerCall: 2_200, maxAudioSecondsPerCall: 0, models: ['gpt-5.4-mini'] },
  }),
});

const QA: AnalysisProfile = Object.freeze({
  version: 'analysis-economics-2026-07-22.1',
  id: 'qa',
  maxCostUsd: 0.25,
  maxBillableCalls: 9,
  maxInputTokens: 100_000,
  maxOutputTokens: 17_600,
  maxDurationSeconds: 90,
  maxFrames: 10,
  framesPerVisionBatch: 10,
  maxTimelineSegments: 8,
  specialists: ['hook', 'script', 'editing', 'cta'] as const,
  includeCritique: false,
  maxRepairs: 1,
  maxProviderRetries: 0,
  singlePassTranscription: true,
  stages: Object.freeze({
    transcription: { maxCalls: 1, maxInputTokensPerCall: 0, maxOutputTokensPerCall: 0, maxAudioSecondsPerCall: 90, models: ['whisper-1'] },
    visual_analysis: { maxCalls: 1, maxInputTokensPerCall: 16_000, maxOutputTokensPerCall: 2_000, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    specialist_analysis: { maxCalls: 4, maxInputTokensPerCall: 9_000, maxOutputTokensPerCall: 1_800, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    timeline_analysis: { maxCalls: 1, maxInputTokensPerCall: 12_000, maxOutputTokensPerCall: 2_800, maxAudioSecondsPerCall: 0, models: ['gpt-4o-mini'] },
    synthesis_critique: noCalls(['gpt-5.4-mini']),
    synthesis: { maxCalls: 1, maxInputTokensPerCall: 22_000, maxOutputTokensPerCall: 3_800, maxAudioSecondsPerCall: 0, models: ['gpt-5.4-mini'] },
    synthesis_repair: { maxCalls: 1, maxInputTokensPerCall: 14_000, maxOutputTokensPerCall: 1_800, maxAudioSecondsPerCall: 0, models: ['gpt-5.4-mini'] },
  }),
});

export const ANALYSIS_PROFILES: Readonly<Record<AnalysisProfileId, AnalysisProfile>> = Object.freeze({
  free: FREE,
  starter: STARTER,
  pro: PRO,
  qa: QA,
});

function qaUserIds(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map((value) => value.trim()).filter(Boolean));
}

function qaWindowOpen(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt) return true;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function resolveServerAnalysisProfile(input: {
  plan: RawPlan;
  userId: string;
  qaEnabled?: boolean;
  qaAllowedUserIds?: ReadonlySet<string>;
  qaExpiresAt?: string;
  now?: Date;
}): AnalysisProfile {
  const qaEnabled = input.qaEnabled ?? process.env.VIDEO_ANALYSIS_QA_ENABLED === 'true';
  const allowed = input.qaAllowedUserIds ?? qaUserIds(process.env.VIDEO_ANALYSIS_QA_USER_IDS);
  const expiresAt = input.qaExpiresAt ?? process.env.VIDEO_ANALYSIS_QA_EXPIRES_AT;
  if (qaEnabled && allowed.has(input.userId) && qaWindowOpen(expiresAt, input.now ?? new Date())) {
    return QA;
  }
  const plan = normalizePlan(input.plan);
  if (plan === 'starter') return STARTER;
  if (plan === 'pro' || plan === 'lifetime') return PRO;
  return FREE;
}

export function analysisProfileSnapshot(profile: AnalysisProfile): Record<string, unknown> {
  return {
    version: profile.version,
    id: profile.id,
    maxCostUsd: profile.maxCostUsd,
  };
}

export function getAnalysisProfileFromMetadata(metadata: Record<string, unknown>): AnalysisProfile {
  const value = metadata.analysisProfile;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return FREE;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' && id in ANALYSIS_PROFILES
    ? ANALYSIS_PROFILES[id as AnalysisProfileId]
    : FREE;
}

export function configuredProfileModels(
  profile: AnalysisProfile,
  stage: AnalysisBudgetStage,
): readonly string[] {
  const envName = stage === 'specialist_analysis'
    ? 'OPENAI_SPECIALIST_MODELS'
    : stage === 'visual_analysis' || stage === 'timeline_analysis'
      ? 'OPENAI_EXTRACTION_MODELS'
      : stage === 'transcription'
        ? 'OPENAI_TRANSCRIPTION_MODEL'
        : 'OPENAI_ANALYSIS_MODELS';
  const configured = process.env[envName]
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? [...new Set(configured)] : profile.stages[stage].models;
}
