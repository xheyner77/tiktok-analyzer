import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { extractTranscriptFromVideo } from '@/lib/video-intelligence';

export const maxDuration = 30;

/**
 * POST /api/transcribe
 * Body: { audio: string (base64 WebM/MP4 audio), mimeType: string }
 * Returns: { transcript: string }
 *
 * Uses OpenAI Whisper to transcribe the audio track of the uploaded video.
 * Limited to Pro / Lifetime plans (same auth gate as vision analysis).
 * Max audio size: 25 MB (Whisper API limit).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Auth required', transcript: '' }, { status: 401 });
    }

    const dbUser = await getUserById(session.userId);
    const plan = dbUser ? getEffectivePlan(dbUser) : 'free';

    if (plan === 'free') {
      // Free plan: skip transcription silently (not a hard error, just omit)
      return NextResponse.json({ transcript: '' });
    }

    let body: { audio?: string; mimeType?: string };
    try {
      body = await request.json() as { audio?: string; mimeType?: string };
    } catch {
      return NextResponse.json({ transcript: '', limitations: ['Payload JSON audio invalide.'] });
    }
    const { audio, mimeType = 'audio/webm' } = body;

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ transcript: '' });
    }

    const result = await extractTranscriptFromVideo({ audioBase64: audio, mimeType, plan });
    const transcript = result.text ?? '';
    if (transcript) console.log('[transcribe] OK —', transcript.slice(0, 120));

    return NextResponse.json({ transcript, confidence: result.confidence, limitations: result.limitations });
  } catch (err) {
    console.error('[transcribe] error:', err instanceof Error ? err.message : err);
    // Non-blocking: return empty transcript rather than blocking the analysis
    return NextResponse.json({ transcript: '' });
  }
}
