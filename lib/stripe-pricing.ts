export const STRIPE_CATALOG = {
  starter: {
    currency: 'eur',
    unitAmount: 1_000,
    recurringInterval: 'month',
  },
  pro: {
    currency: 'eur',
    unitAmount: 2_900,
    recurringInterval: 'month',
  },
  lifetime: {
    currency: 'eur',
    unitAmount: 14_900,
    recurringInterval: null,
  },
} as const;

function formatCatalogEuro(unitAmount: number): string {
  return Number.isInteger(unitAmount / 100)
    ? String(unitAmount / 100)
    : (unitAmount / 100).toFixed(2).replace('.', ',');
}

/**
 * Compatibilité UI : ces libellés sont désormais dérivés du catalogue Stripe,
 * afin qu'un changement de montant ne puisse plus créer un tarif parallèle.
 */
export const DISPLAY_CATALOG_CREATOR_EUR = formatCatalogEuro(STRIPE_CATALOG.starter.unitAmount);
export const DISPLAY_CATALOG_PRO_EUR = formatCatalogEuro(STRIPE_CATALOG.pro.unitAmount);
export const DISPLAY_CATALOG_LIFETIME_EUR = formatCatalogEuro(STRIPE_CATALOG.lifetime.unitAmount);
export const DISPLAY_CATALOG_SCALE_EUR = DISPLAY_CATALOG_LIFETIME_EUR;

/** Libellés produit sur la facture / reçu Stripe (Checkout utilise les Prices du Dashboard). */
export const STRIPE_PRODUCT_NAME_CREATOR = 'Viralynz — Plan Starter';
export const STRIPE_PRODUCT_NAME_PRO = 'Viralynz — Plan Pro';
export const STRIPE_PRODUCT_NAME_SCALE = 'Viralynz — Plan Lifetime';
