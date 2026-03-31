/**
 * Modèle de chat OpenAI partagé.
 *
 * - Analyse vidéo (vision) : même modèle + entrées `image_url` (base64) par frame → coût
 *   dominé par les tokens d’image, pas par le nom du modèle.
 * - Hooks / analyse par URL : texte uniquement → coût nettement plus faible (pas d’images).
 *
 * Il n’existe pas aujourd’hui de modèle « moins cher » que gpt-4o-mini pour une qualité correcte
 * (gpt-3.5-turbo est en général plus cher au token). L’économie hooks vs vision vient surtout du
 * multimodal et du plafond de sortie.
 */
export const OPENAI_CHAT_MODEL = 'gpt-4o-mini';

/**
 * Max output tokens for hook generation.
 *
 * Budget breakdown (worst case — 10 hooks × 70 chars):
 *   • Content   : 10 × ~20 tokens = 200 tokens
 *   • JSON overhead (brackets, quotes, commas) : ~40 tokens
 *   • Safety buffer : ~60 tokens
 *   → 300 tokens minimum; 400 gives comfortable headroom.
 *
 * Truncation at 240 caused JSON.parse to throw a 500 for batches of 10 hooks.
 */
export const HOOK_GENERATION_MAX_TOKENS = 400;
