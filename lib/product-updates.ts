export type ProductUpdateCategory =
  | 'Dashboard'
  | 'Analyse'
  | 'TikTok Sync'
  | 'Hooks'
  | 'Rewrite / V2'
  | 'Publication'
  | 'Billing'
  | 'Expérience utilisateur';

export type ProductUpdateStatus = 'Livré' | 'Amélioré' | 'Nouveau';
export type RoadmapStatus = 'En préparation' | 'Recherche' | 'Bientôt';

export type ProductUpdate = {
  id: string;
  version: string;
  date: string;
  isoDate: string;
  title: string;
  summary: string;
  category: ProductUpdateCategory;
  status: ProductUpdateStatus;
  tags: ProductUpdateCategory[];
  bullets: string[];
  featured?: boolean;
};

export type RoadmapUpdate = {
  id: string;
  title: string;
  description: string;
  category: ProductUpdateCategory;
  status: RoadmapStatus;
};

export const productUpdateCategories: ProductUpdateCategory[] = [
  'Dashboard',
  'Analyse',
  'TikTok Sync',
  'Hooks',
  'Rewrite / V2',
  'Publication',
  'Billing',
  'Expérience utilisateur',
];

export const productUpdates: ProductUpdate[] = [
  {
    id: 'v2-7-support-center',
    version: 'v2.7',
    date: '18 mai 2026',
    isoDate: '2026-05-18',
    title: 'Centre support intégré au dashboard',
    summary:
      'La page Support devient un vrai centre d’assistance avec formulaire contextualisé, raccourcis et état du compte.',
    category: 'Expérience utilisateur',
    status: 'Nouveau',
    tags: ['Dashboard', 'Billing', 'TikTok Sync', 'Expérience utilisateur'],
    featured: true,
    bullets: [
      'Formulaire support protégé par session avec contexte compte ajouté automatiquement.',
      'Raccourcis pour compte, billing, bugs d’analyse, TikTok Sync et feedback produit.',
      'Fallback propre si l’envoi email n’est pas encore configuré en production.',
    ],
  },
  {
    id: 'v2-6-settings-billing',
    version: 'v2.6',
    date: '18 mai 2026',
    isoDate: '2026-05-18',
    title: 'Paramètres et abonnement repensés',
    summary:
      'Les pages internes deviennent des surfaces produit denses : réglages, plan, quotas, modules inclus et états billing.',
    category: 'Dashboard',
    status: 'Amélioré',
    tags: ['Dashboard', 'Billing', 'TikTok Sync', 'Expérience utilisateur'],
    featured: true,
    bullets: [
      'Page Paramètres structurée autour du compte, du moteur Viralynz et des connexions.',
      'Page Plan & abonnement enrichie avec quotas, modules, comparaison des plans et portail Stripe.',
      'Fallbacks lisibles si une donnée de profil, quota ou billing n’est pas disponible.',
    ],
  },
  {
    id: 'v2-5-dashboard-sections',
    version: 'v2.5',
    date: '18 mai 2026',
    isoDate: '2026-05-18',
    title: 'Les features vivent dans le dashboard',
    summary:
      'La page Analyse et les sections internes s’ouvrent dans le même shell dashboard, avec sidebar, header et état actif cohérent.',
    category: 'Dashboard',
    status: 'Livré',
    tags: ['Dashboard', 'Analyse', 'Expérience utilisateur'],
    featured: true,
    bullets: [
      'Route /dashboard/analyze intégrée dans la zone centrale du dashboard.',
      'Route legacy /analyzer redirigée proprement vers la nouvelle section.',
      'Vue d’ensemble restaurée comme section principale de /dashboard.',
    ],
  },
  {
    id: 'v2-4-tiktok-connected-state',
    version: 'v2.4',
    date: '17 mai 2026',
    isoDate: '2026-05-17',
    title: 'TikTok connecté devient clair et gérable',
    summary:
      'Le compte TikTok relié est visible dans le header, gérable depuis un modal premium, sans promettre de métriques avancées.',
    category: 'TikTok Sync',
    status: 'Amélioré',
    tags: ['TikTok Sync', 'Dashboard', 'Analyse'],
    featured: true,
    bullets: [
      'État “TikTok connecté” visible avec nom, avatar et mode Sandbox si disponible.',
      'Modal de gestion pour voir les permissions actives et déconnecter proprement.',
      'Copies corrigées pour ne pas promettre vues, engagement ou watch time sans scopes avancés.',
    ],
  },
  {
    id: 'v2-3-tiktok-oauth',
    version: 'v2.3',
    date: '17 mai 2026',
    isoDate: '2026-05-17',
    title: 'Connexion TikTok Sandbox fiabilisée',
    summary:
      'Le flow OAuth TikTok avance de l’autorisation au stockage du profil de base compatible avec user.info.basic.',
    category: 'TikTok Sync',
    status: 'Livré',
    tags: ['TikTok Sync', 'Dashboard'],
    bullets: [
      'URL OAuth et redirect_uri alignées sur l’environnement production.',
      'Récupération du profil limitée aux champs autorisés par user.info.basic.',
      'Stockage du compte TikTok sans exposer tokens, secret ou clé complète.',
    ],
  },
  {
    id: 'v2-2-Starter-workspace',
    version: 'v2.2',
    date: '16 mai 2026',
    isoDate: '2026-05-16',
    title: 'Starter Workspace consolidé',
    summary:
      'Les sections Hooks, Rewrite, Publication, Radar et Bibliothèque sont structurées dans l’app dashboard.',
    category: 'Dashboard',
    status: 'Amélioré',
    tags: ['Dashboard', 'Hooks', 'Rewrite / V2', 'Publication'],
    bullets: [
      'Navigation latérale enrichie pour contrôler les sections du dashboard.',
      'Placeholders premium pour les modules en construction, sans pages blanches.',
      'CTA “Analyser une vidéo” harmonisés vers /dashboard/analyze.',
    ],
  },
  {
    id: 'v2-1-billing-alignment',
    version: 'v2.1',
    date: '16 mai 2026',
    isoDate: '2026-05-16',
    title: 'Plans, quotas et Stripe alignés',
    summary:
      'Les plans Free, Starter, Pro et Lifetime sont mieux reliés aux quotas et aux modules accessibles.',
    category: 'Billing',
    status: 'Livré',
    tags: ['Billing', 'Dashboard', 'TikTok Sync'],
    bullets: [
      'Starter autorise un compte TikTok, Pro et Lifetime gardent une trajectoire d’upgrade claire.',
      'États d’abonnement annulé ou absent affichés sans bloquer brutalement l’accès legacy.',
      'Pages billing reliées aux routes Stripe existantes sans exposer d’identifiants sensibles.',
    ],
  },
];

export const upcomingProductUpdates: RoadmapUpdate[] = [
  {
    id: 'advanced-tiktok-metrics',
    title: 'Métriques TikTok avancées',
    description:
      'Préparer l’accès aux statistiques réelles après validation des permissions TikTok dédiées.',
    category: 'TikTok Sync',
    status: 'Recherche',
  },
  {
    id: 'publishing-workflow',
    title: 'Workflow publication enrichi',
    description:
      'Transformer les décisions de repost en étapes plus claires pour préparer une V2 à publier.',
    category: 'Publication',
    status: 'En préparation',
  },
  {
    id: 'actionable-insights',
    title: 'Insights plus actionnables',
    description:
      'Rendre chaque insight plus proche d’une décision de montage : couper, avancer, garder ou réécrire.',
    category: 'Analyse',
    status: 'En préparation',
  },
  {
    id: 'Starter-resource-center',
    title: 'Centre de ressources créateur',
    description:
      'Regrouper guides, exemples de V2 et méthodes de lecture des diagnostics Viralynz.',
    category: 'Expérience utilisateur',
    status: 'Bientôt',
  },
];

export function getProductUpdateStats(entries = productUpdates) {
  const featured = entries.filter((entry) => entry.featured);
  const categories = new Set(entries.flatMap((entry) => entry.tags));
  const dashboardImprovements = entries.filter((entry) => entry.tags.includes('Dashboard')).length;
  const latest = entries[0];

  return {
    latestRelease: latest,
    totalReleases: entries.length,
    featuredCount: featured.length,
    categoryCount: categories.size,
    dashboardImprovements,
    upcomingCount: upcomingProductUpdates.length,
  };
}
