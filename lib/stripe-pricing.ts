/**
 * Tarifs Pro / Elite affichés dans l’UI (EUR, virgule décimale).
 * À aligner avec les montants des Prices Stripe (`STRIPE_PRICE_PRO` / `STRIPE_PRICE_ELITE`).
 */

export const DISPLAY_CATALOG_PRO_EUR = '9,99';
export const DISPLAY_CATALOG_ELITE_EUR = '24,99';

/** Libellés produit sur la facture / reçu Stripe (Checkout utilise les Prices du Dashboard). */
export const STRIPE_PRODUCT_NAME_PRO = 'TikTok Analyzer — Plan Pro';
export const STRIPE_PRODUCT_NAME_ELITE = 'TikTok Analyzer — Plan Elite';
