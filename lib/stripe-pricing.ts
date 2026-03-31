/**
 * Tarification Pro / Elite — offre lancement -50 %.
 *
 * Montants Stripe en centimes EUR (unit_amount) : alignés sur la moitié des prix catalogue
 * (9,99 € → 499 ct ; 24,99 € → 1249 ct).
 *
 * Modifier ici + redeploy pour changer le prix facturé ; l’UI importe les mêmes constantes d’affichage.
 */

export const STRIPE_LAUNCH_PRICE_PRO_CENTS = 499;
export const STRIPE_LAUNCH_PRICE_ELITE_CENTS = 1249;

/** Prix catalogue (hors promo) — affichage barré */
export const DISPLAY_CATALOG_PRO_EUR = '9,99';
export const DISPLAY_CATALOG_ELITE_EUR = '24,99';

/** Prix offre lancement (-50 %) — affichage principal */
export const DISPLAY_LAUNCH_PRO_EUR = '4,99';
export const DISPLAY_LAUNCH_ELITE_EUR = '12,49';

export const LAUNCH_OFFER_BADGE = 'Lancement −50%';

/** Libellés produit sur la facture / reçu Stripe */
export const STRIPE_PRODUCT_NAME_PRO = 'TikTok Analyzer — Plan Pro (offre lancement −50%)';
export const STRIPE_PRODUCT_NAME_ELITE = 'TikTok Analyzer — Plan Elite (offre lancement −50%)';
