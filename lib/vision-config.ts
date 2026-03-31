/**
 * Paramètres vision — impact direct sur la taille des requêtes OpenAI (TPM / 429).
 * Coût dominant : les images (tokens d’entrée), pas le texte du prompt.
 */
export const VISION_MAX_FRAMES = 4;
export const VISION_MAX_WIDTH_PX = 480;
export const VISION_JPEG_QUALITY = 0.6;
