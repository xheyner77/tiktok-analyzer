/**
 * Extrait des images JPEG (base64 sans préfixe data:) depuis un fichier vidéo — navigateur uniquement.
 */

const DEFAULT_MAX_FRAMES = 8;
const DEFAULT_MAX_WIDTH = 640;
const DEFAULT_MAX_DURATION_SEC = 90;

export async function extractVideoFramesFromFile(
  file: File,
  options?: {
    maxFrames?: number;
    maxWidth?: number;
    maxDurationSec?: number;
    jpegQuality?: number;
  }
): Promise<{ frames: string[]; durationSec: number }> {
  const maxFrames = Math.min(12, Math.max(4, options?.maxFrames ?? DEFAULT_MAX_FRAMES));
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxDurationSec = options?.maxDurationSec ?? DEFAULT_MAX_DURATION_SEC;
  const jpegQuality = options?.jpegQuality ?? 0.72;

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
    if (rawDur <= 0) {
      throw new Error('Durée vidéo invalide.');
    }

    const duration = Math.min(rawDur, maxDurationSec);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non disponible.');

    const frames: string[] = [];
    const denom = Math.max(1, maxFrames);

    for (let i = 0; i < maxFrames; i++) {
      const t = ((i + 0.5) / denom) * duration;
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
        'Pas assez d’images extraites. Essaie un MP4 H.264 ou une vidéo plus longue.'
      );
    }

    return { frames, durationSec: duration };
  } catch (e) {
    URL.revokeObjectURL(objectUrl);
    throw e;
  }
}
