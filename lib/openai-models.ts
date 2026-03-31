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

/** Sortie JSON courte (liste de hooks) — limite le coût output. */
export const HOOK_GENERATION_MAX_TOKENS = 240;
