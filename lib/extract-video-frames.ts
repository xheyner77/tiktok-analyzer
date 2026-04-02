/**
 * Extrait des images JPEG (base64) et l'audio d'un fichier vidéo — navigateur uniquement.
 */

import {
  VISION_JPEG_QUALITY,
  VISION_MAX_FRAMES,
  VISION_MAX_WIDTH_PX,
} from '@/lib/vision-config';

const DEFAULT_MAX_DURATION_SEC = 90;
/** Max audio duration sent to Whisper — keeps file size small */
const AUDIO_MAX_DURATION_SEC = 90;

// ── Frame extraction ──────────────────────────────────────────────────────────

export async function extractVideoFramesFromFile(
  file: File,
  options?: {
    maxFrames?: number;
    maxWidth?: number;
    maxDurationSec?: number;
    jpegQuality?: number;
  }
): Promise<{ frames: string[]; durationSec: number }> {
  const maxFrames = Math.min(
    VISION_MAX_FRAMES,
    Math.max(3, options?.maxFrames ?? VISION_MAX_FRAMES)
  );
  const maxWidth = options?.maxWidth ?? VISION_MAX_WIDTH_PX;
  const maxDurationSec = options?.maxDurationSec ?? DEFAULT_MAX_DURATION_SEC;
  const jpegQuality = options?.jpegQuality ?? VISION_JPEG_QUALITY;

  if (!file.type.startsWith('video/')) {
    throw new Error('Fichier vidéo attendu (MP4, WebM, MOV…).');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Impossible de lire cette vidéo. Essaie le format MP4.'));
      video.src = objectUrl;
    });

    const rawDur = Number.isFinite(video.duration) ? video.duration : 0;
    if (rawDur <= 0) throw new Error('Durée vidéo invalide.');

    const duration = Math.min(rawDur, maxDurationSec);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non disponible.');

    const frames: string[] = [];
    const denom = Math.max(1, maxFrames);

    for (let i = 0; i < maxFrames; i++) {
      // Distribute frames: first frame early (~1s) to capture the hook
      const t = i === 0
        ? Math.min(0.8, duration * 0.05)                    // ~0.8s → hook frame
        : ((i + 0.5) / denom) * duration;                   // even spread for rest
      video.currentTime = Math.min(t, Math.max(0, duration - 0.04));

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          reject(new Error('Timeout lecture vidéo.'));
        }, 8000);
        const onSeeked = () => {
          window.clearTimeout(timeout);
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) continue;

      const scale = Math.min(1, maxWidth / vw);
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      const base64 = dataUrl.split(',')[1];
      if (base64) frames.push(base64);
    }

    URL.revokeObjectURL(objectUrl);

    if (frames.length < 3) {
      throw new Error(
        "Pas assez d'images extraites. Essaie un MP4 H.264 ou une vidéo plus longue."
      );
    }

    return { frames, durationSec: duration };
  } catch (e) {
    URL.revokeObjectURL(objectUrl);
    throw e;
  }
}

// ── Audio extraction for Whisper transcription ────────────────────────────────

export interface AudioExtractResult {
  audioBase64: string;
  mimeType: string;
}

/**
 * Extrait l'audio d'un fichier vidéo en utilisant l'API Web Audio + MediaRecorder.
 * Retourne un base64 WebM (ou null si le navigateur ne supporte pas).
 * Non bloquant : les erreurs retournent null plutôt que de crasher l'analyse.
 */
export async function extractAudioFromVideo(
  file: File,
  maxDurationSec = AUDIO_MAX_DURATION_SEC
): Promise<AudioExtractResult | null> {
  try {
    if (typeof window === 'undefined') return null;

    // Check MediaRecorder support
    if (!window.MediaRecorder) return null;

    // Find a supported MIME type for Whisper-compatible audio
    const mimeType =
      MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
      MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
      MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
      null;

    if (!mimeType) return null;

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;    // silenced for the user — captureStream() still gets the audio track
    video.volume = 0;      // extra safety: no sound leaks to speakers
    video.playsInline = true;
    video.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('video load failed'));
      video.src = objectUrl;
    });

    const rawDur = Number.isFinite(video.duration) ? video.duration : 0;
    if (rawDur <= 0) { URL.revokeObjectURL(objectUrl); return null; }

    const captureDuration = Math.min(rawDur, maxDurationSec) * 1000; // ms

    // Capture audio stream from the video element
    const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
      .captureStream?.() ?? (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
      .mozCaptureStream?.();

    if (!stream) { URL.revokeObjectURL(objectUrl); return null; }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) { URL.revokeObjectURL(objectUrl); return null; }

    // Keep only audio
    const audioStream = new MediaStream(audioTracks);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(audioStream, { mimeType });

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const recordingDone = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(250); // collect in 250ms chunks
    video.currentTime = 0;
    await video.play().catch(() => null);

    // Wait for captureDuration or end of video
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, captureDuration + 500);
      video.onended = () => { clearTimeout(timeout); resolve(); };
    });

    video.pause();
    recorder.stop();
    await recordingDone;

    URL.revokeObjectURL(objectUrl);

    if (chunks.length === 0) return null;

    const blob = new Blob(chunks, { type: mimeType });

    // Whisper limit: 25 MB
    if (blob.size > 25 * 1024 * 1024) return null;

    // Convert Blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const audioBase64 = btoa(binary);

    return { audioBase64, mimeType: mimeType.split(';')[0] };
  } catch (err) {
    console.warn('[extractAudio] failed (non-blocking):', err instanceof Error ? err.message : err);
    return null;
  }
}
