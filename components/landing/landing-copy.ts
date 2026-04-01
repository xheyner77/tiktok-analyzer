/** Contenu FR de la landing — séparé pour lisibilité de HomeLanding */

export const faqItems = [
  {
    q: 'En quoi Viralynz diffère d’un simple outil de hooks ?',
    a: 'Le cœur du produit, c’est l’analyse vidéo : vision IA sur ton fichier, scores structurés (hook, montage, rétention, CTA) et priorités actionnables. Le générateur de hooks est un accélérateur pour tester des angles — pas un substitut à la lecture de la vidéo.',
  },
  {
    q: 'Viralynz remplace‑il un stratège ou un monteur ?',
    a: 'Non. C’est un copilote : il cadre le diagnostic et accélère les itérations. La direction créative, le tournage et le craft restent les tiens.',
  },
  {
    q: 'Faut‑il être expert TikTok ?',
    a: 'Non. Les analyses sont rédigées pour être comprises sans jargon. Tu peux les partager telles quelles avec un monteur, un créateur UGC ou un client.',
  },
  {
    q: 'Pourquoi TikTok en premier ?',
    a: 'C’est l’un des formats les plus exigeants sur l’attention : si la grille tient là, elle se transpose naturellement aux autres courts formats. La roadmap couvre Reels, Shorts et au‑delà.',
  },
  {
    q: 'Dois‑je uploader un fichier vidéo ?',
    a: 'Oui, l’analyse visuelle repose sur ta vidéo (environ 90 s max recommandé). Ajouter un lien TikTok enrichit le contexte quand les métriques publiques sont accessibles.',
  },
  {
    q: 'Comment l’analyse est‑elle produite ?',
    a: 'Des images clés sont extraites et interprétées par un modèle de vision, combiné aux métadonnées et aux stats publiques si disponibles. Tu reçois scores, forces, limites et recommandations ordonnées.',
  },
  {
    q: 'Les hooks générés : à quoi m’attendre ?',
    a: 'Des phrases courtes, adaptées au contexte que tu décris — pour challenger ton angle d’ouverture rapidement, sans figer ta voix de marque.',
  },
];

export const roadmapColumns = [
  {
    phase: 'Aujourd’hui',
    accent: 'from-emerald-400/80 to-cyan-500/60',
    items: ['Analyse upload + vision IA', 'Scores hook · montage · rétention', 'Lien TikTok & contexte stats', 'Dashboard, historique & quotas'],
  },
  {
    phase: 'Ensuite',
    accent: 'from-vn-fuchsia/80 to-vn-violet/70',
    items: ['Instagram Reels & YouTube Shorts (même cadre)', 'Exports & partage équipe', 'Onboarding guidé dans le produit'],
  },
  {
    phase: 'Vision',
    accent: 'from-vn-violet/80 to-vn-indigo/70',
    items: ['Autres surfaces vidéo', 'Workflows marque ↔ créateur', 'Intégrations stack marketing'],
  },
];

export const platformRoadmap = [
  { name: 'TikTok', status: 'live' as const, desc: 'Disponible — notre référence format court.' },
  { name: 'Instagram Reels', status: 'next' as const, desc: 'Même logique d’analyse, adaptée au feed Reels.' },
  { name: 'YouTube Shorts', status: 'next' as const, desc: 'Shorts, même exigence sur l’accroche et la rétention.' },
  { name: 'Autres formats', status: 'later' as const, desc: 'Vertical, social, paid : une discipline unique à étendre.' },
];

export const credibilityBlocks = [
  {
    title: 'Pour ceux qui veulent comprendre',
    body: 'Pensé pour les créateurs, marques et agences qui refusent le mystère algorithmique et veulent une lecture honnête de leurs vidéos.',
  },
  {
    title: 'Intuition → système',
    body: 'Tu gardes ta sensibilité ; Viralynz ajoute une couche reproductible : critères, priorités, pistes — pas un jugement flou.',
  },
  {
    title: 'Workflows réels',
    body: 'E‑commerce, UGC, social ads, personal brand : un même cadre quand le volume de contenu augmente.',
  },
];
