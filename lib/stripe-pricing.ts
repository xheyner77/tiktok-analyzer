/**
 * Tarifs affichés dans l’UI (EUR, virgule décimale).
 * À aligner avec les montants des Prices Stripe.
 */

export const DISPLAY_CATALOG_CREATOR_EUR = '10';
export const DISPLAY_CATALOG_PRO_EUR = '29';
export const DISPLAY_CATALOG_SCALE_EUR = '149';
export const DISPLAY_CATALOG_LIFETIME_EUR = DISPLAY_CATALOG_SCALE_EUR;

/** Libellés produit sur la facture / reçu Stripe (Checkout utilise les Prices du Dashboard). */
export const STRIPE_PRODUCT_NAME_CREATOR = 'Viralynz — Plan Starter';
export const STRIPE_PRODUCT_NAME_PRO = 'Viralynz — Plan Pro';
export const STRIPE_PRODUCT_NAME_SCALE = 'Viralynz — Plan Lifetime';
