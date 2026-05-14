import OpenAI from 'openai';
import type { Plan } from './supabase';
import type { VideoIntelligenceResult } from './types';
import { OPENAI_CHAT_MODEL } from './openai-models';
import { buildProprietaryVideoSignals } from './proprietary-video-engine';

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const SUPPORTED_AUDIO_MIME = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/webm']);

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function estimateFrameBytes(base64: string) {
  return Math.round((base64.length * 3) / 4);
}

function isLikelyBase64(value: string) {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function buildFrameTimestamps(count: number, durationSec?: number) {
  if (!count) return [];
  if (!durationSec || durationSec <= 0) return Array.from({ length: count }, (_, i) => i);
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) => Math.round((durationSec * i) / (count - 1)));
}

function estimateVisualSignals(frames: string[]) {
  if (!frames.length) {
    return {
      visualEnergy: 0,
      motionEstimate: 0,
      cutDensityEstimate: 0,
      cutRhythm: 'unknown' as const,
      textDensityEstimate: 0,
      quality: 'faible' as const,
      limitations: ['Aucune frame exploitable reçue côté serveur.'],
    };
  }

  const sizes = frames.map(estimateFrameBytes);
  const avg = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  const deltas = sizes.slice(1).map((size, index) => Math.abs(size - sizes[index]) / Math.max(avg, 1));
  const avgDelta = deltas.length ? deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length : 0;
  const highDeltaCount = deltas.filter((delta) => delta > 0.18).length;
  const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avg, 2), 0) / sizes.length;
  const normalizedVariance = Math.sqrt(variance) / Math.max(avg, 1);

  return {
    visualEnergy: clamp(45 + normalizedVariance * 140 + avgDelta * 80),
    motionEstimate: clamp(35 + avgDelta * 170),
    cutDensityEstimate: clamp(25 + highDeltaCount * 16 + avgDelta * 80),
    cutRhythm: highDeltaCount >= 4 || avgDelta > 0.24 ? 'élevé' as const : highDeltaCount >= 2 || avgDelta > 0.12 ? 'moyen' as const : 'faible' as const,
    textDensityEstimate: clamp(30 + Math.min(35, avg / 2400)),
    quality: frames.length >= 8 ? 'bonne' as const : frames.length >= 4 ? 'moyenne' as const : 'faible' as const,
    limitations: [
      'Mouvement/cuts estimés par variation de frames compressées, pas encore par optical flow.',
    ],
  };
}

function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function sanitizeTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const text = normalizeOcrText(String(item ?? '')).slice(0, 120);
    if (text && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      out.push(text);
    }
    if (out.length >= 8) break;
  }
  return out;
}

function normalizeOcrText(value: string) {
  return value
    .replace(/[|_[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(\w{1,2})\b(?=\s+\b\w{1,2}\b)/gi, '')
    .trim();
}

function ocrQualityScore(texts: string[], reportedConfidence: number) {
  if (!texts.length) return 0;
  const joined = texts.join(' ');
  const words = joined.match(/[\p{L}\p{N}'’]+/gu) ?? [];
  const shortWordRate = words.length ? words.filter((word) => word.length <= 2).length / words.length : 1;
  const weirdCharRate = joined.length ? (joined.match(/[^\p{L}\p{N}\s'’.,!?-]/gu)?.length ?? 0) / joined.length : 1;
  const enoughWords = words.length >= 3 ? 12 : -14;
  return clamp(reportedConfidence - shortWordRate * 24 - weirdCharRate * 40 + enoughWords);
}

export async function extractOnScreenTextFromFrames(
  frames: string[],
  options?: { timeoutMs?: number }
): Promise<{
  available: boolean;
  texts: string[];
  dominantText?: string;
  firstFrameText?: string;
  textDensity: number;
  confidence: number;
  facePresence: 'detected' | 'not_detected' | 'unknown';
  faceConfidence?: number;
  facecamLikely?: boolean;
  limitations: string[];
}> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here';
  if (!hasOpenAI) {
    return {
      available: false,
      texts: [],
      textDensity: 0,
      confidence: 0,
      facePresence: 'unknown',
      limitations: ['OCR texte écran indisponible : clé OpenAI non configurée.'],
    };
  }

  const selected = frames
    .filter((frame) => typeof frame === 'string' && frame.length > 500 && frame.length < 350_000)
    .slice(0, 5);
  if (!selected.length) {
    return {
      available: false,
      texts: [],
      textDensity: 0,
      confidence: 0,
      facePresence: 'unknown',
      limitations: ['OCR impossible : aucune frame exploitable.'],
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: options?.timeoutMs ?? 20_000 });
    const response = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.1,
      max_tokens: 550,
      messages: [
        {
          role: 'system',
          content: [
            'Tu extrais uniquement les textes visibles à l’écran depuis des frames TikTok.',
            'Réponds en JSON strict. N’invente aucun texte si illisible.',
            'Détecte aussi présence visage/personne visible de façon prudente.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Analyse ces frames chronologiques.',
                'Retourne uniquement ce JSON :',
                '{"texts":["texte visible"],"dominantText":"texte principal ou null","firstFrameText":"texte frame 1 ou null","textDensity":0-100,"confidence":0-100,"facePresence":"detected|not_detected|unknown","faceConfidence":0-100,"facecamLikely":true|false}',
                'Si aucun texte lisible, texts=[] et confidence faible.',
              ].join('\n'),
            },
            ...selected.map((frame) => ({
              type: 'image_url' as const,
              image_url: { url: `data:image/jpeg;base64,${frame}`, detail: 'low' as const },
            })),
          ],
        },
      ],
    });

    const parsed = safeJsonObject(response.choices[0]?.message?.content ?? '');
    if (!parsed) {
      return {
        available: false,
        texts: [],
        textDensity: 0,
        confidence: 0,
        facePresence: 'unknown',
        limitations: ['OCR Vision a retourné un JSON inexploitable.'],
      };
    }

    const texts = sanitizeTextList(parsed.texts);
    const reportedConfidence = clamp(Number(parsed.confidence) || (texts.length ? 55 : 0));
    const confidence = ocrQualityScore(texts, reportedConfidence);
    const facePresence = parsed.facePresence === 'detected' || parsed.facePresence === 'not_detected'
      ? parsed.facePresence
      : 'unknown';
    const dominantText = typeof parsed.dominantText === 'string' && normalizeOcrText(parsed.dominantText)
      ? normalizeOcrText(parsed.dominantText).slice(0, 140)
      : texts[0];
    const firstFrameText = typeof parsed.firstFrameText === 'string' && normalizeOcrText(parsed.firstFrameText)
      ? normalizeOcrText(parsed.firstFrameText).slice(0, 140)
      : undefined;
    const reliableText = texts.length > 0 && confidence >= 45;

    return {
      available: reliableText,
      texts: reliableText ? texts : [],
      dominantText: reliableText ? dominantText : undefined,
      firstFrameText: reliableText ? firstFrameText : undefined,
      textDensity: clamp(Number(parsed.textDensity) || (texts.length ? 35 + texts.length * 6 : 0)),
      confidence,
      facePresence,
      faceConfidence: parsed.faceConfidence === undefined ? undefined : clamp(Number(parsed.faceConfidence) || 0),
      facecamLikely: typeof parsed.facecamLikely === 'boolean' ? parsed.facecamLikely : undefined,
      limitations: reliableText
        ? []
        : [texts.length ? 'Texte écran détecté, mais lecture partielle ou trop bruitée.' : 'Aucun texte écran lisible détecté par Vision OCR.'],
    };
  } catch (err) {
    console.warn('[video-intelligence] OCR failed:', err instanceof Error ? err.message : err);
    return {
      available: false,
      texts: [],
      textDensity: 0,
      confidence: 0,
      facePresence: 'unknown',
      limitations: ['OCR Vision échoué, analyse poursuivie sans texte écran réel.'],
    };
  }
}

export async function extractTranscriptFromVideo(input: {
  audioBase64?: string;
  mimeType?: string;
  plan: Plan;
  timeoutMs?: number;
}): Promise<VideoIntelligenceResult['transcript']> {
  const { audioBase64, mimeType = 'audio/webm', plan, timeoutMs = 25_000 } = input;

  if (plan === 'free') {
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: ['Transcription audio réservée aux plans Pro et Scale.'],
    };
  }

  const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here';
  if (!hasOpenAI) {
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: ['Transcription indisponible : clé OpenAI non configurée.'],
    };
  }

  if (!audioBase64) {
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: ['Aucune piste audio exploitable transmise.'],
    };
  }

  const normalizedMime = mimeType.split(';')[0]?.toLowerCase() || 'audio/webm';
  if (!SUPPORTED_AUDIO_MIME.has(normalizedMime)) {
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: [`Type audio non supporté pour transcription : ${normalizedMime}.`],
    };
  }

  if (!isLikelyBase64(audioBase64)) {
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: ['Payload audio invalide : base64 non exploitable.'],
    };
  }

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  if (audioBuffer.byteLength > WHISPER_MAX_BYTES) {
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: ['Audio trop lourd pour la transcription Whisper 25 Mo.'],
    };
  }

  const ext = normalizedMime.includes('mp4') ? 'mp4' : normalizedMime.includes('ogg') ? 'ogg' : normalizedMime.includes('mpeg') ? 'mp3' : normalizedMime.includes('wav') ? 'wav' : 'webm';
  const audioFile = new File([audioBuffer], `audio.${ext}`, { type: normalizedMime });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: timeoutMs });

  try {
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'fr',
      response_format: 'text',
    });

    const text = typeof response === 'string' ? response.trim() : '';
    return {
      available: text.length > 0,
      text: text || undefined,
      confidence: text.length > 80 ? 86 : text.length > 20 ? 68 : text.length > 0 ? 45 : 0,
      source: text ? 'whisper' : 'none',
      limitations: text ? [] : ['Whisper n’a pas retourné de transcript exploitable.'],
    };
  } catch (err) {
    console.warn('[video-intelligence] transcription failed:', err instanceof Error ? err.message : err);
    return {
      available: false,
      confidence: 0,
      source: 'none',
      limitations: ['Transcription audio échouée, analyse poursuivie sans transcript.'],
    };
  }
}

export function buildVideoIntelligenceResult(input: {
  frames?: string[];
  durationSec?: number;
  transcript?: string;
  transcriptSource?: 'whisper' | 'provided' | 'none';
  onScreenText?: Awaited<ReturnType<typeof extractOnScreenTextFromFrames>>;
  fileName?: string;
  fileSizeMb?: number;
  mimeType?: string;
}): VideoIntelligenceResult {
  const frames = (input.frames ?? []).filter((frame) => typeof frame === 'string' && frame.trim().length > 0);
  const visual = estimateVisualSignals(frames);
  const transcriptText = input.transcript?.trim() ?? '';
  const ocr = input.onScreenText;
  const transcriptAvailable = transcriptText.length > 0;
  const timestamps = buildFrameTimestamps(frames.length, input.durationSec);
  const signalsUsed: string[] = [];
  const missingSignals: string[] = [];
  const limitations: string[] = [];

  if (frames.length) signalsUsed.push('frame_sampling');
  else missingSignals.push('frames');

  if (transcriptAvailable) signalsUsed.push('transcript');
  else missingSignals.push('transcript');

  if (ocr?.available) signalsUsed.push('ocr_texte_ecran');
  else missingSignals.push('ocr_texte_ecran');
  if (ocr?.facePresence === 'detected' || ocr?.facePresence === 'not_detected') signalsUsed.push('face_detection_light');
  else missingSignals.push('face_detection_reelle');
  missingSignals.push('optical_flow');
  limitations.push(...visual.limitations);
  if (!transcriptAvailable) limitations.push('Transcript absent : recommandations vocales formulées avec prudence.');
  if (input.durationSec && input.durationSec < 3) limitations.push('Vidéo très courte : timeline compressée, interprétation prudente.');
  if (input.durationSec && input.durationSec > 180) limitations.push('Vidéo longue : sampling partiel, les moments intermédiaires peuvent être sous-représentés.');
  if (input.fileSizeMb && input.fileSizeMb > 200) limitations.push('Fichier lourd : certaines extractions secondaires peuvent être ignorées pour stabilité.');

  const confidenceBase =
    30 +
    (frames.length >= 8 ? 22 : frames.length >= 4 ? 14 : frames.length > 0 ? 6 : 0) +
    (transcriptAvailable ? 24 : 0) +
    (ocr?.available ? 14 : 0) +
    (ocr?.facePresence === 'detected' || ocr?.facePresence === 'not_detected' ? 5 : 0) +
    (input.durationSec ? 8 : 0) +
    (visual.visualEnergy > 0 ? 6 : 0);
  const uncappedConfidence = clamp(Math.min(90, confidenceBase));
  const confidenceScore = !transcriptAvailable && ocr?.available
    ? Math.min(69, uncappedConfidence)
    : !transcriptAvailable
      ? Math.min(58, uncappedConfidence)
      : uncappedConfidence;
  const technicalSignals = buildProprietaryVideoSignals({
    frames,
    durationSec: input.durationSec,
    transcript: transcriptText || undefined,
    onScreenTexts: ocr?.texts ?? [],
    source: 'browser_sampling',
  });

  return {
    metadata: {
      durationSec: input.durationSec,
      fileName: input.fileName,
      fileSizeMb: input.fileSizeMb,
      mimeType: input.mimeType,
      frameCount: frames.length,
      estimatedAspectRatio: 'unknown',
      source: frames.length ? 'upload_frames' : 'fallback',
    },
    transcript: {
      available: transcriptAvailable,
      text: transcriptAvailable ? transcriptText : undefined,
      confidence: transcriptAvailable ? (transcriptText.length > 80 ? 82 : 62) : 0,
      source: transcriptAvailable ? input.transcriptSource ?? 'provided' : 'none',
      limitations: transcriptAvailable ? [] : ['Aucun transcript exploitable disponible.'],
    },
    frames: {
      sampled: frames.length > 0,
      count: frames.length,
      timestamps,
      quality: visual.quality,
      limitations: frames.length ? [] : ['Aucun sampling de frames disponible.'],
    },
    onScreenText: {
      available: !!ocr?.available,
      text: ocr?.texts ?? [],
      dominantText: ocr?.dominantText,
      firstFrameText: ocr?.firstFrameText,
      textDensity: ocr?.textDensity ?? 0,
      confidence: ocr?.confidence ?? 0,
      source: ocr?.available ? 'vision_ocr' : 'not_available',
      limitations: ocr?.limitations ?? ['OCR texte écran indisponible.'],
    },
    visualSignals: {
      available: frames.length > 0,
      visualEnergy: visual.visualEnergy,
      motionEstimate: visual.motionEstimate,
      cutDensityEstimate: visual.cutDensityEstimate,
      cutRhythm: visual.cutRhythm,
      facePresence: ocr?.facePresence ?? 'unknown',
      faceConfidence: ocr?.faceConfidence,
      facecamLikely: ocr?.facecamLikely,
      textDensityEstimate: ocr?.textDensity ?? visual.textDensityEstimate,
      limitations: [...visual.limitations, ...(ocr?.limitations ?? [])],
    },
    audioSignals: {
      available: transcriptAvailable,
      speechDetected: transcriptAvailable,
      speechDensity: transcriptAvailable ? clamp(transcriptText.split(/\s+/).length / Math.max(input.durationSec ?? 30, 1) * 20) : 0,
      limitations: transcriptAvailable ? [] : ['Parole non détectée ou transcription indisponible.'],
    },
    technicalSignals,
    confidence: {
      score: confidenceScore,
      level: confidenceScore >= 74 ? 'élevée' : confidenceScore >= 52 ? 'moyenne' : 'faible',
      signalsUsed,
      missingSignals,
    },
    limitations,
  };
}
