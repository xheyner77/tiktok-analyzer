import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';

export const maxDuration = 30;

/**
 * POST /api/transcribe
 * Body: { audio: string (base64 WebM/MP4 audio), mimeType: string }
 * Returns: { transcript: string }
 *
 * Uses OpenAI Whisper to transcribe the audio track of the uploaded video.
 * Limited to Pro / Elite plans (same auth gate as vision analysis).
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

    const hasOpenAI =
      !!process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'sk-your-key-here';

    if (!hasOpenAI) {
      return NextResponse.json({ transcript: '' });
    }

    const body = await request.json() as { audio?: string; mimeType?: string };
    const { audio, mimeType = 'audio/webm' } = body;

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json({ transcript: '' });
    }

    // Decode base64 → Buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Whisper limit = 25 MB
    if (audioBuffer.byteLength > 25 * 1024 * 1024) {
      console.warn('[transcribe] audio too large:', audioBuffer.byteLength);
      return NextResponse.json({ transcript: '' });
    }

    // Build a File-like object for the OpenAI SDK
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const audioFile = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'fr',          // French-first; Whisper auto-detects if wrong
      response_format: 'text',
    });

    const transcript = typeof response === 'string' ? response.trim() : '';
    console.log('[transcribe] OK —', transcript.slice(0, 120));

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error('[transcribe] error:', err instanceof Error ? err.message : err);
    // Non-blocking: return empty transcript rather than blocking the analysis
    return NextResponse.json({ transcript: '' });
  }
}
