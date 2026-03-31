/**
 * Paramètres vision — impact direct sur la taille des requêtes OpenAI (TPM / 429).
 * Coût dominant : les images (tokens d’entrée), pas le texte du prompt.
 */
export const VISION_MAX_FRAMES = 3;
export const VISION_MAX_WIDTH_PX = 360;
/** Plus bas = fichiers plus petits (moins de TPM) ; MVP ~0.5 reste lisible. */
export const VISION_JPEG_QUALITY = 0.52;
