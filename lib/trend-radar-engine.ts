import type { AnalysisRow } from './analyses';
import type { TikTokDashboardState } from './tiktok-accounts';

export type TrendOpportunityType = 'hook' | 'format' | 'cta' | 'montage' | 'niche' | 'audio' | 'structure' | 'repost';
export type TrendOpportunitySource = 'creator_data' | 'viralynz_network' | 'manual_watch' | 'fallback_demo' | 'tiktok_sync';
export type TrendMomentum = 'up' | 'stable' | 'down' | 'unknown';
export type TrendConfidence = 'faible' | 'moyenne' | 'élevée';

export interface TrendOpportunity {
  id: string;
  title: string;
  type: TrendOpportunityType;
  source: TrendOpportunitySource;
  momentum: TrendMomentum;
  opportunityScore: number;
  fitScore: number;
  confidence: TrendConfidence;
  nicheFit: string[];
  whyItWorks: string;
  howToUse: string;
  hookExample: string;
  onScreenTextExample: string;
  repostAction: string;
  risk: string;
  evidence: string[];
  signalsUsed: string[];
  isRealData: boolean;
  locked?: boolean;
}

export interface TrendRadarResult {
  opportunities: TrendOpportunity[];
  hasPersonalData: boolean;
  sourceLabel: string;
  filters: TrendOpportunityType[];
}

export interface TrendRadarInput {
  analyses: AnalysisRow[];
  tiktok?: TikTokDashboardState | null;
  plan?: string | null;
}

const fallback: TrendOpportunity[] = [
  {
    id: 'demo_hook_personal_error',
    title: 'Hook erreur personnelle',
    type: 'hook',
    source: 'fallback_demo',
    momentum: 'unknown',
    opportunityScore: 82,
    fitScore: 74,
    confidence: 'faible',
    nicheFit: ['Business', 'Fitness', 'Créateur'],
    whyItWorks: 'Ce pattern crée une tension immédiate : le viewer veut éviter de faire la même erreur.',
    howToUse: 'Commence par une erreur vécue, puis révèle la correction après 2 secondes.',
    hookExample: "J'ai compris ça beaucoup trop tard.",
    onScreenTextExample: "Cette erreur m'a coûté 30 jours.",
    repostAction: 'Applique ce hook à une vidéo où le sujet est bon mais la promesse arrive trop tard.',
    risk: 'Peut sembler dramatique si la preuve n’arrive pas vite.',
    evidence: ['Exemple de pattern Viralynz, pas une tendance globale TikTok.'],
    signalsUsed: ['fallback_demo'],
    isRealData: false,
  },
  {
    id: 'demo_format_result_first',
    title: 'Résultat avant explication',
    type: 'format',
    source: 'fallback_demo',
    momentum: 'unknown',
    opportunityScore: 79,
    fitScore: 72,
    confidence: 'faible',
    nicheFit: ['E-commerce', 'Tutoriel', 'Lifestyle'],
    whyItWorks: 'Le viewer voit le payoff avant de décider s’il reste pour comprendre.',
    howToUse: 'Montre le résultat final en première frame, puis remonte vers la cause.',
    hookExample: 'Le résultat est bon, mais la méthode surprend.',
    onScreenTextExample: 'Regarde le résultat avant la méthode.',
    repostAction: 'Reposte une ancienne vidéo en avançant la preuve visuelle à 0:00.',
    risk: 'Moins fort si la première frame ne montre pas un vrai contraste.',
    evidence: ['Exemple à tester, données compte non connectées.'],
    signalsUsed: ['fallback_demo'],
    isRealData: false,
  },
  {
    id: 'demo_cta_binary_question',
    title: 'CTA question binaire',
    type: 'cta',
    source: 'fallback_demo',
    momentum: 'unknown',
    opportunityScore: 76,
    fitScore: 70,
    confidence: 'faible',
    nicheFit: ['Tous formats'],
    whyItWorks: 'Une question A/B baisse l’effort de commentaire.',
    howToUse: 'Termine par un choix simple, pas une demande large.',
    hookExample: 'Tu ferais A ou B ?',
    onScreenTextExample: 'A ou B ?',
    repostAction: 'Remplace une fin générique par une question binaire.',
    risk: 'Faible si la question n’est pas liée au sujet.',
    evidence: ['Exemple de CTA, pas une métrique TikTok réelle.'],
    signalsUsed: ['fallback_demo'],
    isRealData: false,
  },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function creatorOpportunities(analyses: AnalysisRow[], tiktok?: TikTokDashboardState | null): TrendOpportunity[] {
  if (!analyses.length) return [];
  const results = analyses.map((item) => item.result);
  const avgHook = results.reduce((sum, result) => sum + result.hook.score, 0) / results.length;
  const avgRetention = results.reduce((sum, result) => sum + result.retention.score, 0) / results.length;
  const dominantFormat = mostCommon(results.map((result) => result.coachAnalysis?.patternLabel ?? result.analyzerMeta?.nicheLabel ?? 'Short-form')) ?? 'Short-form';
  const commonWeakness = mostCommon(results.flatMap((result) => [
    ...(result.hook.weaknesses ?? []),
    ...(result.retention.weaknesses ?? []),
    ...(result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? []),
  ])) ?? 'Promesse trop tardive';
  const bestHook = results.flatMap((result) => result.coachAnalysis?.hookVariants ?? []).find(Boolean) ?? "J'ai compris ça trop tard.";
  const hasTikTokVideos = (tiktok?.totalVideos ?? 0) > 0;

  return [
    {
      id: 'creator_hook_gap',
      title: avgHook < 72 ? 'Hook plus direct à tester' : 'Hook gagnant à décliner',
      type: 'hook',
      source: 'creator_data',
      momentum: avgHook < 72 ? 'up' : 'stable',
      opportunityScore: clamp(92 - avgHook + analyses.length * 4),
      fitScore: clamp(78 + analyses.length * 3),
      confidence: analyses.length >= 3 ? 'élevée' : 'moyenne',
      nicheFit: [dominantFormat],
      whyItWorks: `Tes analyses indiquent surtout : ${commonWeakness}. Un hook plus court crée la tension avant le contexte.`,
      howToUse: 'Ouvre sur la conséquence ou le résultat, puis explique seulement après.',
      hookExample: bestHook,
      onScreenTextExample: 'Le détail qui bloque tes vues',
      repostAction: 'Utilise ce hook sur la vidéo analysée avec le score hook le plus bas.',
      risk: 'À éviter si la vidéo ne livre pas la preuve dans les 3 premières secondes.',
      evidence: [`${analyses.length} analyse${analyses.length > 1 ? 's' : ''} Viralynz`, `Score hook moyen ${Math.round(avgHook)}/100`],
      signalsUsed: ['analyses_saved', 'hook_scores', 'detected_weaknesses'],
      isRealData: true,
    },
    {
      id: 'creator_retention_repost',
      title: 'Repost avec payoff avancé',
      type: 'repost',
      source: hasTikTokVideos ? 'tiktok_sync' : 'creator_data',
      momentum: avgRetention < 70 ? 'up' : 'stable',
      opportunityScore: clamp(88 - avgRetention + analyses.length * 5 + (hasTikTokVideos ? 8 : 0)),
      fitScore: clamp(74 + analyses.length * 4),
      confidence: hasTikTokVideos ? 'élevée' : 'moyenne',
      nicheFit: [dominantFormat],
      whyItWorks: 'Quand la preuve arrive avant l’explication, le viewer comprend pourquoi rester.',
      howToUse: 'Déplace le résultat ou la tension à 0:00, puis coupe le contexte lent.',
      hookExample: 'Le résultat arrive avant la méthode.',
      onScreenTextExample: 'Attends de voir pourquoi ça marche',
      repostAction: hasTikTokVideos ? 'Choisis une vidéo synchronisée puis recrée les 5 premières secondes.' : 'Analyse ou connecte TikTok pour choisir la meilleure vidéo à retravailler.',
      risk: 'Ne pas avancer un payoff faible : il faut une vraie preuve visuelle ou textuelle.',
      evidence: [`Score rétention moyen ${Math.round(avgRetention)}/100`, hasTikTokVideos ? `${tiktok?.totalVideos ?? 0} vidéo(s) synchronisée(s)` : 'Compte TikTok non priorisé'],
      signalsUsed: hasTikTokVideos ? ['analyses_saved', 'tiktok_sync'] : ['analyses_saved'],
      isRealData: true,
    },
    {
      id: 'creator_cta_question',
      title: 'CTA question à faible friction',
      type: 'cta',
      source: 'creator_data',
      momentum: 'stable',
      opportunityScore: 74,
      fitScore: 76,
      confidence: 'moyenne',
      nicheFit: [dominantFormat],
      whyItWorks: 'Les fins trop larges demandent trop d’effort. Une question binaire donne une réponse immédiate.',
      howToUse: 'Remplace “dis-moi ce que tu en penses” par un choix A/B lié au sujet.',
      hookExample: 'Tu garderais A ou B ?',
      onScreenTextExample: 'A ou B ?',
      repostAction: 'Ajoute ce CTA sur une vidéo où le sujet appelle un avis rapide.',
      risk: 'Trop faible si la question n’a pas de tension.',
      evidence: ['Recommandation issue des patterns CTA Viralynz disponibles.'],
      signalsUsed: ['analyses_saved', 'cta_patterns'],
      isRealData: true,
    },
  ];
}

export function trendRadarEngine(input: TrendRadarInput): TrendRadarResult {
  const personal = creatorOpportunities(input.analyses, input.tiktok);
  const plan = input.plan ?? 'free';
  const maxItems = plan === 'free' ? 3 : plan === 'pro' ? 8 : 12;
  const opportunities = (personal.length ? personal : fallback)
    .map((item, index) => ({ ...item, locked: plan === 'free' && index > 2 }))
    .slice(0, maxItems);

  return {
    opportunities,
    hasPersonalData: personal.length > 0,
    sourceLabel: personal.length ? 'Basé sur tes analyses Viralynz' : 'Exemples à tester, non présentés comme tendances réelles',
    filters: ['hook', 'format', 'cta', 'montage', 'niche', 'audio', 'structure', 'repost'],
  };
}
