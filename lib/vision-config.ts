/**
 * Paramètres vision — impact direct sur la taille des requêtes OpenAI (TPM / 429).
 * Coût dominant : les images (tokens d’entrée), pas le texte du prompt.
 */
/**
 * 14 frames = ~1 frame toutes les 2s sur une vidéo de 30s.
 * Couverture : hook (1s) → post-hook → milieu ×4 → pre-fin → fin.
 * À 360px et qualité 0.42, chaque frame ≈ 85 tokens OpenAI vision (low-detail).
 * Budget total : 14 × 85 ≈ 1 190 tokens image — acceptable pour gpt-4o-mini.
 */
export const VISION_MAX_FRAMES = 14;
export const VISION_MAX_WIDTH_PX = 360;
/** Réduit pour maintenir un budget TPM raisonnable avec 14 frames */
export const VISION_JPEG_QUALITY = 0.42;
