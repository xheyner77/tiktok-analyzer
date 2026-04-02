/**
 * Paramètres vision — impact direct sur la taille des requêtes OpenAI (TPM / 429).
 * Coût dominant : les images (tokens d’entrée), pas le texte du prompt.
 */
/** 6 frames = couverture hook (2s) / début / milieu×2 / fin / toute fin — 2× plus de contexte vs 3 frames */
export const VISION_MAX_FRAMES = 6;
export const VISION_MAX_WIDTH_PX = 360;
/** Légèrement réduit pour compenser les 2× frames (même budget TPM qu'avant) */
export const VISION_JPEG_QUALITY = 0.48;
