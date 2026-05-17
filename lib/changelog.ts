export type ChangelogItemType = 'Nouveauté' | 'Amélioration' | 'Correction' | 'Produit';
export type ChangelogStatus = 'live' | 'en cours' | 'vision';

export interface ChangelogItem {
  type: ChangelogItemType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  isoDate: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  status: ChangelogStatus;
  items: ChangelogItem[];
}

export const changelogEntries: ChangelogEntry[] = [
  {
    version: 'v1.6.0',
    date: '11 mai 2026',
    isoDate: '2026-05-11',
    title: 'Plans Creator, Pro et Scale alignés avec Stripe',
    summary:
      'La monétisation est maintenant cohérente entre la landing, le checkout Stripe, les quotas produit et les plans annuels Pro / Scale.',
    category: 'Billing & Plans',
    tags: ['Pricing', 'Stripe', 'Creator', 'Pro', 'Scale'],
    status: 'live',
    items: [
      { type: 'Produit', text: 'Nouveaux plans : Creator à 7,99€, Pro à 29,99€ et Scale à 79,99€.' },
      { type: 'Nouveauté', text: 'Ajout des versions annuelles Pro et Scale avec prix mensuel équivalent affiché clairement.' },
      { type: 'Amélioration', text: 'Checkout Stripe aligné sur les plans creator, pro et scale avec intervalle mensuel ou annuel.' },
      { type: 'Correction', text: 'Nettoyage des anciens libellés de plans pour ne garder que Creator, Pro et Scale.' },
      { type: 'Amélioration', text: 'Quotas harmonisés : Creator pour démarrer, Pro pour scaler, Scale pour équipes et volume.' },
    ],
  },
  {
    version: 'v1.5.0',
    date: '11 mai 2026',
    isoDate: '2026-05-11',
    title: 'Dashboard V2 devient un vrai Command Center',
    summary:
      'Le dashboard met en avant la prochaine action utile : connecter TikTok, lancer une première analyse, préparer un repost ou suivre une opportunité.',
    category: 'Dashboard V2',
    tags: ['Command Center', 'TikTok', 'Growth Loop', 'No fake data'],
    status: 'live',
    items: [
      { type: 'Produit', text: 'Blocage premium du dashboard quand aucun compte TikTok n’est connecté.' },
      { type: 'Produit', text: 'État nouveau compte sans fausses données : Viralynz demande de lancer la première analyse.' },
      { type: 'Amélioration', text: 'Plan Scale correctement reconnu depuis Supabase et affiché dans Dashboard V2.' },
      { type: 'Nouveauté', text: 'Next Best Action : le dashboard guide l’utilisateur vers l’action la plus importante.' },
      { type: 'Correction', text: 'Suppression des exemples qui pouvaient donner l’impression de vraies analytics.' },
    ],
  },
  {
    version: 'v1.4.0',
    date: '10 mai 2026',
    isoDate: '2026-05-10',
    title: 'Radar Tendances et boucle Growth Loop',
    summary:
      'Viralynz relie Dashboard, Analyzer, Hook Studio et Radar pour créer une boucle produit cohérente : opportunité, hook, repost, résultat.',
    category: 'Growth OS',
    tags: ['Radar Tendances', 'Growth Loop', 'Hook Studio', 'Repost'],
    status: 'live',
    items: [
      { type: 'Nouveauté', text: 'Page Radar Tendances avec opportunités typées : hook, format, CTA, niche et repost.' },
      { type: 'Produit', text: 'Moteur Growth Loop pour produire des actions prioritaires depuis les analyses, tendances et comptes TikTok.' },
      { type: 'Amélioration', text: 'Intégration Radar → Hook Studio via payload de pré-remplissage.' },
      { type: 'Amélioration', text: 'Radar réservé aux plans Pro et Scale pour garder une hiérarchie d’offre claire.' },
      { type: 'Correction', text: 'Sources de tendance explicites : exemple, analyse utilisateur ou compte TikTok.' },
    ],
  },
  {
    version: 'v1.3.0',
    date: '9 mai 2026',
    isoDate: '2026-05-09',
    title: 'Analyse IA plus stricte et quality gate',
    summary:
      'Le moteur d’analyse devient plus professionnel : contexte compact, validation qualité, hooks plus liés au contenu réel et repost plan plus actionnable.',
    category: 'AI Quality',
    tags: ['Quality Gate', 'Analyzer V2', 'Hooks', 'Repost Plan'],
    status: 'live',
    items: [
      { type: 'Nouveauté', text: 'AI Quality Gate pour scorer la spécificité, l’actionnabilité et la cohérence des réponses.' },
      { type: 'Nouveauté', text: 'Critic IA pour détecter les hooks génériques, les plans template et les signaux non supportés.' },
      { type: 'Amélioration', text: 'Régénération ciblée des sections faibles au lieu de refaire toute l’analyse.' },
      { type: 'Amélioration', text: 'Contexte multimodal compressé avant reasoning pour améliorer la qualité sans exploser les coûts.' },
      { type: 'Correction', text: 'Validation des outputs pour éviter les recommandations basées sur des signaux absents.' },
    ],
  },
  {
    version: 'v1.2.0',
    date: '8 mai 2026',
    isoDate: '2026-05-08',
    title: 'Analyzer V2 lit la vidéo étape par étape',
    summary:
      'L’analyse affiche une progression crédible et segmente la vidéo pour expliquer ce qui bloque dans l’ouverture, le rythme et le payoff.',
    category: 'Analyzer V2',
    tags: ['Pipeline', 'Opening', 'Timeline', 'Scoring'],
    status: 'live',
    items: [
      { type: 'Nouveauté', text: 'Pipeline visible : préparation, frames, OCR, transcript, format, timeline, repost et hooks.' },
      { type: 'Nouveauté', text: 'Opening Analysis dédiée aux 3 premières secondes avec stop-scroll score.' },
      { type: 'Amélioration', text: 'Timeline segmentée : 0-1s, 1-3s, 3-5s, 5-10s, 10-20s et fin.' },
      { type: 'Amélioration', text: 'Scores détaillés : opening, hook, clarté, rétention, pacing, payoff, CTA et repost potential.' },
      { type: 'Correction', text: 'Fallbacks propres si OCR, transcription ou vision ne sont pas disponibles.' },
    ],
  },
  {
    version: 'v1.1.0',
    date: '5 mai 2026',
    isoDate: '2026-05-05',
    title: 'Dashboard V2 premium et architecture TikTok multi-comptes',
    summary:
      'La première version du cockpit Viralynz pose les bases du pilotage quotidien : opportunités, hooks, reposts, mémoire créateur et comptes TikTok.',
    category: 'Creator OS',
    tags: ['Dashboard V2', 'TikTok Accounts', 'Creator Memory', 'Repost'],
    status: 'live',
    items: [
      { type: 'Produit', text: 'Dashboard V2 premium avec command center, right rail et modules actionnables.' },
      { type: 'Nouveauté', text: 'Architecture TikTok OAuth, comptes connectés et synchronisation vidéo préparée.' },
      { type: 'Produit', text: 'Creator Memory pour commencer à identifier forces, faiblesses et patterns récurrents.' },
      { type: 'Amélioration', text: 'Repost workflow : analyse, problème, hook, plan, publication et résultat en attente.' },
      { type: 'Correction', text: 'Le dashboard premium devient la route principale /dashboard.' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '3 avril 2026',
    isoDate: '2026-04-03',
    title: 'Lancement public de Viralynz',
    summary:
      'La première version publique pose le cœur du produit : comprendre pourquoi une vidéo décroche et repartir avec une meilleure version à tester.',
    category: 'Lancement',
    tags: ['Analyse IA', 'TikTok', 'Hook', 'Repost'],
    status: 'live',
    items: [
      { type: 'Produit', text: 'Analyse vidéo IA pour TikTok avec diagnostic hook, rythme, rétention et CTA.' },
      { type: 'Produit', text: 'Score de structure de 0 à 100 pour comprendre les signaux d’une vidéo.' },
      { type: 'Produit', text: 'Plan d’action priorisé pour savoir quoi couper, avancer ou reformuler.' },
      { type: 'Amélioration', text: '3 analyses gratuites sans carte bancaire pour tester la valeur du produit.' },
      { type: 'Produit', text: 'Roadmap Reels et YouTube Shorts préparée pour l’évolution multi-plateforme.' },
    ],
  },
];

export function getChangelogStats(entries = changelogEntries) {
  const latest = entries[0];
  return {
    updateCount: entries.length,
    improvements: entries.flatMap((entry) => entry.items).filter((item) => item.type === 'Amélioration').length,
    corrections: entries.flatMap((entry) => entry.items).filter((item) => item.type === 'Correction').length,
    latestVersion: latest.version,
    latestDate: latest.date,
  };
}
