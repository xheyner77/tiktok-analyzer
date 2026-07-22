import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ensureUserProfile } from '@/lib/auth';
import { privateJson, readJsonObject, rejectCrossSiteMutation } from '@/lib/api-route-security';
import { getSessionVerification } from '@/lib/session';
import { VIDEO_ANALYSIS_LIMITS, VIDEO_INPUT_MIME_TYPES } from '@/lib/video-analysis/config';
import { createOrReuseUploadJob } from '@/lib/video-analysis/jobs';
import { toPublicAnalysisJob } from '@/lib/video-analysis/types';
import { analysisProfileSnapshot, resolveServerAnalysisProfile } from '@/lib/video-analysis/analysis-profiles';

export const runtime = 'nodejs';

const creatorContextSchema = z.object({
  objective: z.enum([
    'retention',
    'views',
    'comments',
    'followers',
    'leads',
    'sales',
    'authority',
    'advertising',
    'clip',
    'other',
  ]),
  objectiveDetails: z.string().trim().min(3).max(160).optional(),
  niche: z.string().trim().min(2).max(100),
  audience: z.string().trim().min(2).max(180),
  audienceKnowledge: z.enum(['beginner', 'intermediate', 'expert', 'mixed']),
  tone: z.string().trim().min(2).max(80),
  platform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'other']),
  platformDetails: z.string().trim().min(2).max(120).optional(),
  language: z.string().trim().min(2).max(40),
  format: z.enum(['facecam', 'ugc', 'clip', 'demo', 'storytelling', 'advertising', 'other']),
  formatDetails: z.string().trim().min(2).max(120).optional(),
  memoryConsent: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  if (value.objective === 'other' && !value.objectiveDetails) {
    ctx.addIssue({
      code: 'custom',
      path: ['objectiveDetails'],
      message: 'Précise ton objectif.',
    });
  }
  if (value.platform === 'other' && !value.platformDetails) {
    ctx.addIssue({ code: 'custom', path: ['platformDetails'], message: 'Précise la plateforme.' });
  }
  if (value.format === 'other' && !value.formatDetails) {
    ctx.addIssue({ code: 'custom', path: ['formatDetails'], message: 'Précise le format.' });
  }
});

const createJobSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(160).regex(/^[A-Za-z0-9:_-]+$/),
  fileName: z.string().trim().min(1).max(220),
  contentType: z.string().trim().max(100),
  sizeBytes: z.number().int().positive().max(VIDEO_ANALYSIS_LIMITS.maxFileBytes),
  creatorContext: creatorContextSchema,
}).strict();

function sessionFailure(status: 'missing' | 'invalid' | 'unavailable') {
  if (status === 'unavailable') {
    return privateJson(
      { error: 'La vérification de session est temporairement indisponible.' },
      { status: 503 },
    );
  }
  return privateJson({ error: 'Connexion requise.' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  const sessionResult = await getSessionVerification();
  if (sessionResult.status !== 'authenticated') return sessionFailure(sessionResult.status);

  const raw = await readJsonObject(request, 32 * 1024);
  const parsed = createJobSchema.safeParse(raw);
  if (!parsed.success) {
    return privateJson(
      {
        error: 'Les informations de la vidéo ou du projet sont incomplètes.',
        fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean),
      },
      { status: 400 },
    );
  }

  if (!VIDEO_INPUT_MIME_TYPES.has(parsed.data.contentType)) {
    return privateJson(
      { error: 'Format vidéo non pris en charge. Utilise MP4, MOV, WebM, MKV ou MPEG.' },
      { status: 415 },
    );
  }

  const profile = await ensureUserProfile({
    userId: sessionResult.session.userId,
    email: sessionResult.session.email,
  });
  if (!profile) {
    return privateJson({ error: 'Ton profil est temporairement indisponible.' }, { status: 503 });
  }

  try {
    const analysisProfile = resolveServerAnalysisProfile({
      plan: profile.plan,
      userId: sessionResult.session.userId,
    });
    const created = await createOrReuseUploadJob({
      userId: sessionResult.session.userId,
      idempotencyKey: parsed.data.idempotencyKey,
      fileName: parsed.data.fileName,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      creatorContext: parsed.data.creatorContext,
      sourceMetadata: { analysisProfile: analysisProfileSnapshot(analysisProfile) },
    });

    return privateJson(
      {
        job: toPublicAnalysisJob(created.job),
        upload: created.uploadToken
          ? {
              bucket: created.job.storage_bucket,
              path: created.job.storage_path,
              token: created.uploadToken,
            }
          : null,
        reused: created.reused,
        limits: {
          maxFileBytes: VIDEO_ANALYSIS_LIMITS.maxFileBytes,
          maxDurationSeconds: analysisProfile.maxDurationSeconds,
        },
      },
      { status: created.reused ? 200 : 201 },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : 'ANALYSIS_JOB_CREATE_FAILED';
    console.error('[analysis-job] initialization_failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    if (code === 'ANALYSIS_IDEMPOTENCY_CONFLICT') {
      return privateJson(
        { error: 'Cette clé d’envoi appartient déjà à une autre vidéo. Relance l\u2019envoi.' },
        { status: 409 },
      );
    }
    if (code === 'ANALYSIS_ACTIVE_JOB_LIMIT') {
      return privateJson(
        { error: 'Trois analyses sont déjà en cours. Attends qu’une analyse se termine.' },
        { status: 429 },
      );
    }
    return privateJson(
      { error: 'Impossible de préparer l’envoi pour le moment. Réessaie sans recharger la vidéo.' },
      { status: 503 },
    );
  }
}
