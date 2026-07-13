import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { extractTranscriptFromVideo } from '@/lib/video-intelligence';
import { exceedsDeclaredBodyLimit, privateJson, readJsonObject } from '@/lib/api-route-security';

export const maxDuration = 30;

/**
 * POST /api/transcribe
 * Body: { audio: string (base64 WebM/MP4 audio), mimeType: string }
 * Returns: { transcript: string }
 *
 * Uses OpenAI Whisper to transcribe the audio track of the uploaded video.
 * Limited to Pro / Lifetime plans (same auth gate as vision analysis).
 * Max request size is intentionally lower than Whisper's provider limit to
 * protect the serverless function and bound cost per request.
 */
export async function POST(request: NextRequest) {
  try {
    if (exceedsDeclaredBodyLimit(request, 4 * 1024 * 1024)) {
      return privateJson(
        { error: 'Piste audio trop volumineuse.', code: 'AUDIO_TOO_LARGE', transcript: '' },
        { status: 413 },
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Connecte-toi pour transcrire une vidéo.', code: 'AUTH_REQUIRED', transcript: '' },
        { status: 401 }
      );
    }

    const dbUser = await getUserById(session.userId);
    const plan = dbUser ? getEffectivePlan(dbUser) : 'free';

    if (plan !== 'pro' && plan !== 'lifetime') {
      // Keep upload analysis usable without silently spending transcription
      // credits on plans that do not include this feature.
      return privateJson({
        transcript: '',
        limitations: ['Transcription audio réservée aux plans Pro et Lifetime.'],
      });
    }

    const body = await readJsonObject(request, 4 * 1024 * 1024);
    if (!body) {
      return NextResponse.json(
        { error: 'Payload JSON audio invalide.', code: 'INVALID_AUDIO_PAYLOAD', transcript: '' },
        { status: 400 }
      );
    }
    const audio = typeof body.audio === 'string' ? body.audio : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';

    if (!audio) {
      return NextResponse.json(
        { error: 'Aucune piste audio exploitable transmise.', code: 'AUDIO_REQUIRED', transcript: '' },
        { status: 400 }
      );
    }

    if (
      audio.length > 3_900_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)
      || !['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'].includes(mimeType)
    ) {
      return privateJson(
        { error: 'Piste audio invalide ou trop volumineuse.', code: 'INVALID_AUDIO_PAYLOAD', transcript: '' },
        { status: 400 },
      );
    }

    const result = await extractTranscriptFromVideo({ audioBase64: audio, mimeType, plan });
    const transcript = result.text ?? '';

    return NextResponse.json({ transcript, confidence: result.confidence, limitations: result.limitations });
  } catch (error) {
    console.error('[transcribe] request_failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      {
        error: 'Transcription temporairement indisponible. L’analyse peut continuer avec les frames et le texte à l’écran.',
        code: 'TRANSCRIPTION_UNAVAILABLE',
        transcript: '',
      },
      { status: 503 }
    );
  }
}
