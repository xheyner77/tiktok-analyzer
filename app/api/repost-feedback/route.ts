import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { saveRepostFeedback, type FeedbackLevel } from '@/lib/repost-feedback-engine';
import { supabase } from '@/lib/supabase';
import {
  exceedsDeclaredBodyLimit,
  privateJson,
  readJsonObject,
  rejectCrossSiteMutation,
} from '@/lib/api-route-security';

function bool(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function feedbackLevel(value: unknown): FeedbackLevel | undefined {
  return value === 'worse' || value === 'same' || value === 'better' || value === 'unknown' ? value : undefined;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').replace(/[<>]/g, '').trim()).filter(Boolean).slice(0, 12);
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  if (exceedsDeclaredBodyLimit(request, 32 * 1024)) {
    return privateJson({ error: 'Requête trop volumineuse.' }, { status: 413 });
  }

  const session = await getSession();
  if (!session) {
    return privateJson({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const body = await readJsonObject(request, 32 * 1024);
    if (!body) {
      return privateJson({ error: 'Corps de requête invalide.' }, { status: 400 });
    }
    const reposted = bool(body.reposted);
    if (reposted === undefined) {
      return privateJson({ error: 'Champ reposted requis.' }, { status: 400 });
    }

    const analysisId = typeof body.analysisId === 'string' && body.analysisId.trim()
      ? body.analysisId.trim()
      : null;
    if (analysisId) {
      const { data: ownedAnalysis, error: ownershipError } = await supabase
        .from('analyses')
        .select('id')
        .eq('id', analysisId)
        .eq('user_id', session.userId)
        .maybeSingle();
      if (ownershipError) {
        console.error('[repost-feedback] ownership_check_failed', {
          code: ownershipError.code,
        });
        return privateJson({ error: 'Vérification impossible pour le moment.' }, { status: 503 });
      }
      if (!ownedAnalysis) {
        return privateJson({ error: 'Analyse introuvable.' }, { status: 404 });
      }
    }

    const satisfaction = typeof body.satisfaction === 'number' && Number.isFinite(body.satisfaction)
      ? Math.max(0, Math.min(100, Math.round(body.satisfaction)))
      : undefined;

    const saved = await saveRepostFeedback({
      userId: session.userId,
      analysisId,
      videoId: typeof body.videoId === 'string' ? body.videoId : undefined,
      reposted,
      hookBetter: bool(body.hookBetter),
      retentionBetter: feedbackLevel(body.retentionBetter),
      engagementBetter: feedbackLevel(body.engagementBetter),
      performedBetter: feedbackLevel(body.performedBetter),
      useful: bool(body.useful),
      satisfaction,
      appliedRecommendations: stringList(body.appliedRecommendations),
      ignoredRecommendations: stringList(body.ignoredRecommendations),
      patternKeys: stringList(body.patternKeys),
    });

    return privateJson({ ok: true, ...saved });
  } catch (error) {
    console.error('[repost-feedback] request_failed', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
