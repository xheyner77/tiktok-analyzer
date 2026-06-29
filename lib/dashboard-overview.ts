import type { Plan } from '@/lib/supabase';

export type OverviewTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface OverviewUser {
  name: string;
  email: string;
}

export interface OverviewPlan {
  name: Plan;
  label: string;
  isPaid: boolean;
  quotaAnalyses: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  quotaHooks: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
}

export interface OverviewTikTok {
  connected: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncLabel: string;
  needsReconnect: boolean;
  missingScopes: string[];
}

export interface OverviewHeroOpportunity {
  score: number | null;
  title: string;
  description: string;
  analysisId: string | null;
  ctaLabel: string;
  href: string;
}

export interface OverviewKpi {
  id: 'views' | 'retention' | 'hooks' | 'repostScore';
  label: string;
  value: string;
  detail: string;
  trendLabel: string | null;
  available: boolean;
}

export interface OverviewAnalysisCard {
  id: string;
  title: string;
  createdAtLabel: string;
  durationLabel: string | null;
  thumbnailUrl: string | null;
  score: number | null;
  badgeLabel: string;
  badgeTone: OverviewTone;
  href: string;
}

export interface OverviewOpportunity {
  id: string;
  title: string;
  description: string;
  priority: 'Élevée' | 'Moyenne' | 'Faible';
  actionLabel: string;
  href: string;
}

export interface OverviewFormatPerformance {
  id: string;
  format: string;
  metricLabel: string;
  value: string;
  trendLabel: string | null;
  available: boolean;
}

export interface OverviewAiBlock {
  title: string;
  description: string;
  items: string[];
  available: boolean;
}

export interface OverviewActivity {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  type: 'analysis' | 'tiktok' | 'hook' | 'system';
  href: string;
}

export interface OverviewGoal {
  id: string;
  label: string;
  current: number;
  target: number;
  percent: number;
}

export interface OverviewHookSuggestion {
  id: string;
  text: string;
  category: string;
  score: number | null;
  href: string;
}

export interface OverviewTimeSlot {
  id: string;
  label: string;
  trendLabel: string;
  description: string;
  available: boolean;
}

export interface OverviewMemoryInsight {
  available: boolean;
  description: string;
  items: string[];
}

export interface DashboardOverviewData {
  user: OverviewUser;
  plan: OverviewPlan;
  tiktok: OverviewTikTok;
  heroOpportunity: OverviewHeroOpportunity;
  kpis: OverviewKpi[];
  dailyPlan: string[];
  recentAnalyses: OverviewAnalysisCard[];
  opportunities: OverviewOpportunity[];
  formatPerformance: OverviewFormatPerformance[];
  aiRecommendation: OverviewAiBlock;
  activity: OverviewActivity[];
  weeklyGoals: OverviewGoal[];
  hooksToTest: OverviewHookSuggestion[];
  bestTimeSlots: OverviewTimeSlot[];
  memoryInsight: OverviewMemoryInsight;
}

export interface OverviewSource {
  user: {
    name: string;
    email: string;
    plan: Plan;
    planLabel: string;
    quotaUsed: number;
    quotaLimit: number | null;
    hooksUsed: number;
  };
  tiktok: {
    connected: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    lastSyncAt: string | null;
    needsReconnect: boolean;
    missingScopes: string[];
  };
  states: {
    hasAnalyses: boolean;
    hasTikTokConnection: boolean;
    hasTikTokMetrics: boolean;
    hasRetentionData: boolean;
    hasRealInsights: boolean;
  };
  metrics: {
    totalViews: string;
    averageViralScore: number | null;
    viralScoreChange: string | null;
    opportunityText: string;
    recommendationsContext: string;
  };
  insights: Array<{
    title: string;
    description: string;
    score: number | null;
    type: string;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    cta: string;
    locked?: boolean;
  }>;
  analysisCta: {
    label: string;
    href: string;
  };
  recentAnalyses: OverviewAnalysisCard[];
  hooks: OverviewHookSuggestion[];
  memory: {
    available: boolean;
    description: string;
    items: string[];
  };
  formatPerformance: OverviewFormatPerformance[];
  counts: {
    analyses7d: number;
    hooks7d: number;
  };
}

function clampPercent(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function cleanShortText(value: string, fallback: string, maxLength = 72) {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function relativeSyncLabel(value: string | null) {
  if (!value) return 'Dernière sync non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Dernière sync non disponible';
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Dernière sync à l’instant';
  if (diffMinutes < 60) return `Dernière sync il y a ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `Dernière sync il y a ${hours} h`;
  return `Dernière sync il y a ${Math.round(hours / 24)} j`;
}

function planIsPaid(plan: Plan) {
  return plan !== 'free';
}

function remaining(used: number, limit: number | null) {
  if (limit === null) return null;
  return Math.max(0, limit - used);
}

function badgeForScore(score: number | null): { label: string; tone: OverviewTone } {
  if (score === null) return { label: 'Score —', tone: 'neutral' };
  if (score >= 85) return { label: 'Excellent', tone: 'success' };
  if (score >= 70) return { label: 'Bon', tone: 'info' };
  if (score >= 55) return { label: 'À améliorer', tone: 'warning' };
  return { label: 'Critique', tone: 'danger' };
}

function buildHero(source: OverviewSource): OverviewHeroOpportunity {
  const best = source.recentAnalyses
    .filter((item) => item.score !== null)
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
  const recommendation = source.recommendations.find((item) => !item.locked);
  const insight = source.insights[0];

  if (!source.states.hasAnalyses) {
    return {
      score: null,
      title: 'Lance ta première analyse',
      description: 'Analyse une vidéo pour détecter ton meilleur angle de repost.',
      analysisId: null,
      ctaLabel: 'Analyser une vidéo',
      href: '/dashboard/analyze',
    };
  }

  return {
    score: best?.score ?? source.metrics.averageViralScore,
    title: best?.title ?? 'Meilleure opportunité de repost',
    description: cleanShortText(
      recommendation?.description || insight?.description || source.metrics.opportunityText,
      'Ouvre la dernière analyse pour transformer le score en décision de montage.',
      118
    ),
    analysisId: best?.id ?? null,
    ctaLabel: source.analysisCta.label,
    href: best?.href ?? source.analysisCta.href,
  };
}

function buildKpis(source: OverviewSource): OverviewKpi[] {
  const retention = source.insights.find((item) => item.type === 'retention')?.score ?? null;

  return [
    {
      id: 'views',
      label: source.states.hasTikTokMetrics ? 'Vues TikTok' : 'Vues',
      value: source.states.hasTikTokMetrics ? source.metrics.totalViews : '—',
      detail: source.states.hasTikTokMetrics ? 'Donnée synchronisée' : source.tiktok.connected ? 'Scope requis' : 'Connecter TikTok',
      trendLabel: null,
      available: source.states.hasTikTokMetrics,
    },
    {
      id: 'retention',
      label: 'Rétention moyenne',
      value: retention === null ? '—' : `${retention}%`,
      detail: retention === null ? 'Après analyse' : 'Source analyse',
      trendLabel: null,
      available: retention !== null,
    },
    {
      id: 'hooks',
      label: 'Hooks générés',
      value: String(source.user.hooksUsed),
      detail: source.user.hooksUsed > 0 ? 'Usage réel' : 'À lancer',
      trendLabel: null,
      available: source.user.hooksUsed > 0,
    },
    {
      id: 'repostScore',
      label: 'Score repost moyen',
      value: source.metrics.averageViralScore === null ? '—' : `${source.metrics.averageViralScore}/100`,
      detail: source.metrics.averageViralScore === null ? 'Après analyse' : 'Source Viralynz',
      trendLabel: source.metrics.viralScoreChange,
      available: source.metrics.averageViralScore !== null,
    },
  ];
}

function buildDailyPlan(source: OverviewSource) {
  const real = source.recommendations
    .filter((item) => !item.locked)
    .map((item) => cleanShortText(item.title, item.cta, 38))
    .slice(0, 3);

  if (real.length >= 3) return real;
  if (!source.states.hasAnalyses) {
    return ['Analyser une vidéo', source.tiktok.connected ? 'Lancer un diagnostic' : 'Connecter TikTok', 'Préparer une V2'];
  }
  return ['Tester un hook plus direct', 'Couper l’intro trop lente', 'Ajouter un CTA commentaire'];
}

function buildOpportunities(source: OverviewSource): OverviewOpportunity[] {
  const real = source.recommendations
    .filter((item) => !item.locked)
    .slice(0, 3)
    .map((item, index) => ({
      id: `recommendation-${index}`,
      title: cleanShortText(item.title, 'Action recommandée', 42),
      description: cleanShortText(item.description, 'Ouvre l’analyse pour voir la décision complète.', 86),
      priority: index === 1 ? 'Moyenne' as const : 'Élevée' as const,
      actionLabel: item.cta || 'Appliquer',
      href: '/dashboard/rewrite',
    }));

  if (real.length > 0) return real;

  return [
    {
      id: 'empty-analysis',
      title: 'Analyser une vidéo',
      description: 'Viralynz attend une vraie analyse avant de prioriser les corrections.',
      priority: 'Moyenne',
      actionLabel: 'Lancer',
      href: '/dashboard/analyze',
    },
  ];
}

function buildAiRecommendation(source: OverviewSource): OverviewAiBlock {
  const insight = source.insights[0];
  const items = source.recommendations
    .filter((item) => !item.locked)
    .map((item) => cleanShortText(item.title, item.cta, 48))
    .slice(0, 3);

  if (!source.states.hasAnalyses) {
    return {
      title: 'Recommandation IA',
      description: 'Analyse une vidéo pour obtenir une recommandation reliée à tes propres signaux.',
      items: ['Aucun score inventé', 'Aucune courbe simulée', 'Décisions prêtes après analyse'],
      available: false,
    };
  }

  return {
    title: 'Recommandation IA',
    description: cleanShortText(insight?.description || source.metrics.recommendationsContext, 'Ouvre l’analyse pour voir la prochaine décision de montage.', 128),
    items: items.length > 0 ? items : ['Réécrire le hook', 'Tester une version plus courte', 'Ajouter un CTA commentaire'],
    available: true,
  };
}

function buildActivity(source: OverviewSource): OverviewActivity[] {
  const activity: OverviewActivity[] = [];
  const latest = source.recentAnalyses[0];
  if (latest) {
    activity.push({
      id: `analysis-${latest.id}`,
      title: 'Analyse terminée',
      description: latest.title,
      timeLabel: latest.createdAtLabel,
      type: 'analysis',
      href: latest.href,
    });
  }
  if (source.tiktok.connected) {
    activity.push({
      id: 'tiktok-sync',
      title: 'Compte TikTok synchronisé',
      description: source.tiktok.displayName || 'Compte TikTok',
      timeLabel: relativeSyncLabel(source.tiktok.lastSyncAt).replace('Dernière sync ', ''),
      type: 'tiktok',
      href: '/dashboard/settings',
    });
  }
  if (source.hooks.length > 0) {
    activity.push({
      id: `hook-${source.hooks[0].id}`,
      title: 'Nouveau hook généré',
      description: source.hooks[0].text,
      timeLabel: 'Récent',
      type: 'hook',
      href: '/dashboard/hooks',
    });
  }
  return activity.slice(0, 3);
}

function buildWeeklyGoals(source: OverviewSource): OverviewGoal[] {
  return [
    {
      id: 'analyses-week',
      label: 'Analyser 3 vidéos',
      current: Math.min(source.counts.analyses7d, 3),
      target: 3,
      percent: clampPercent(source.counts.analyses7d, 3),
    },
    {
      id: 'hooks-week',
      label: 'Générer 5 hooks',
      current: Math.min(source.counts.hooks7d, 5),
      target: 5,
      percent: clampPercent(source.counts.hooks7d, 5),
    },
    {
      id: 'tiktok-ready',
      label: source.tiktok.connected ? 'Synchroniser TikTok' : 'Connecter TikTok',
      current: source.tiktok.connected ? 1 : 0,
      target: 1,
      percent: source.tiktok.connected ? 100 : 0,
    },
  ];
}

function buildTimeSlots(source: OverviewSource): OverviewTimeSlot[] {
  const available = source.states.hasTikTokMetrics && source.recentAnalyses.length >= 3;
  return [
    { id: 'midday', label: '12h–14h', trendLabel: available ? 'À confirmer' : '—', description: available ? 'Signal à comparer' : 'Après plusieurs analyses', available },
    { id: 'evening', label: '18h–21h', trendLabel: available ? 'À confirmer' : '—', description: available ? 'Fenêtre à valider' : 'Données en cours', available },
    { id: 'night', label: '22h–23h', trendLabel: available ? 'À confirmer' : '—', description: available ? 'À tester' : 'Après synchronisation', available },
  ];
}

export function formatOverviewAnalysis(input: {
  id: string;
  title: string;
  createdAtLabel: string;
  durationLabel?: string | null;
  thumbnailUrl?: string | null;
  score: number | null;
  href?: string;
}): OverviewAnalysisCard {
  const badge = badgeForScore(input.score);
  return {
    id: input.id,
    title: cleanShortText(input.title, 'Vidéo analysée', 86),
    createdAtLabel: input.createdAtLabel,
    durationLabel: input.durationLabel ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    score: input.score,
    badgeLabel: badge.label,
    badgeTone: badge.tone,
    href: input.href ?? `/analyses/${encodeURIComponent(input.id)}`,
  };
}

export function buildDashboardOverviewData(source: OverviewSource): DashboardOverviewData {
  const heroOpportunity = buildHero(source);

  return {
    user: {
      name: source.user.name || 'Créateur',
      email: source.user.email || '',
    },
    plan: {
      name: source.user.plan,
      label: source.user.planLabel,
      isPaid: planIsPaid(source.user.plan),
      quotaAnalyses: {
        used: source.user.quotaUsed,
        limit: source.user.quotaLimit,
        remaining: remaining(source.user.quotaUsed, source.user.quotaLimit),
      },
      quotaHooks: {
        used: source.user.hooksUsed,
        limit: null,
        remaining: null,
      },
    },
    tiktok: {
      connected: source.tiktok.connected,
      displayName: source.tiktok.displayName,
      avatarUrl: source.tiktok.avatarUrl,
      lastSyncLabel: relativeSyncLabel(source.tiktok.lastSyncAt),
      needsReconnect: source.tiktok.needsReconnect,
      missingScopes: source.tiktok.missingScopes,
    },
    heroOpportunity,
    kpis: buildKpis(source),
    dailyPlan: buildDailyPlan(source),
    recentAnalyses: source.recentAnalyses,
    opportunities: buildOpportunities(source),
    formatPerformance: source.formatPerformance,
    aiRecommendation: buildAiRecommendation(source),
    activity: buildActivity(source),
    weeklyGoals: buildWeeklyGoals(source),
    hooksToTest: source.hooks,
    bestTimeSlots: buildTimeSlots(source),
    memoryInsight: source.memory,
  };
}
