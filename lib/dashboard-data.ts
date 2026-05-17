import 'server-only';

import type { AnalysisRow } from '@/lib/analyses';
import { getEffectivePlan, getUserById, PLAN_LIMITS } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { supabase, type Plan } from '@/lib/supabase';
import type { AnalysisResult } from '@/lib/types';
import { HISTORY_LIMITS } from '@/lib/plan-limits';
import { getConnectedTikTokAccountCount } from '@/lib/tiktok-account-limits';
import { hasVideoListScope, listTikTokAccountsForUser } from '@/lib/tiktok-accounts';
import type { RetentionPoint } from '@/types/reconstruction';

export type DashboardInsightType = 'hook' | 'retention' | 'rewatch' | 'engagement';

export interface DashboardUser {
  name: string;
  email: string;
  plan: Plan;
  planLabel: string;
  quotaUsed: number;
  quotaLimit: number | null;
}

export interface DashboardTikTokConnection {
  connected: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  connectedAt: string | null;
  scopes: string[];
  modeLabel: string;
  hasAdvancedMetrics: boolean;
}

export interface DashboardMetrics {
  totalViews: string;
  engagementRate: string;
  averageWatchTime: string;
  averageViralScore: number | null;
  viralScoreChange: string | null;
  opportunityCount: number;
  opportunityLabel: string;
  opportunityText: string;
  recommendationsContext: string;
}

export interface DashboardRetention {
  points: RetentionPoint[];
  keyMoments: Array<{
    label: string;
    time: string;
    tone: string;
  }>;
}

export interface DashboardLatestVideo {
  title: string;
  date: string;
  duration: string;
  tiktokUrl: string | null;
  likes: string;
  comments: string;
  shares: string;
  thumbnailUrl: string | null;
}

export interface DashboardInsight {
  title: string;
  description: string;
  score: number | null;
  type: DashboardInsightType;
}

export interface DashboardTopVideo {
  id: string;
  title: string;
  date: string;
  score: number;
  views: string;
  thumbnailUrl: string | null;
}

export interface DashboardRecommendation {
  title: string;
  description: string;
  cta: string;
  locked?: boolean;
}

export interface DashboardStates {
  hasAnalyses: boolean;
  hasTikTokConnection: boolean;
  hasTikTokMetrics: boolean;
  hasRetentionData: boolean;
  hasLatestAnalysis: boolean;
  hasRealTopVideos: boolean;
  hasRealInsights: boolean;
}

export interface DashboardData {
  user: DashboardUser;
  tiktokConnection: DashboardTikTokConnection;
  states: DashboardStates;
  metrics: DashboardMetrics;
  retention: DashboardRetention;
  latestVideo: DashboardLatestVideo;
  analysisCta: {
    label: string;
    href: string;
  };
  insights: DashboardInsight[];
  topVideos: DashboardTopVideo[];
  recommendations: DashboardRecommendation[];
  hasRealUser: boolean;
  hasRealAnalyses: boolean;
}

const FALLBACK_RECOMMENDATIONS: DashboardRecommendation[] = [
  {
    title: 'Améliorer les hooks',
    description: 'Analyse une vidéo pour savoir quoi réécrire dans les 2 premières secondes.',
    cta: 'Générer des hooks',
  },
  {
    title: 'Heure idéale de publication',
    description: 'Les performances par période seront disponibles après activation des permissions TikTok dédiées.',
    cta: 'Voir les horaires',
  },
  {
    title: 'Opportunité contenu',
    description: 'Tes opportunités apparaîtront après tes premières analyses.',
    cta: 'Explorer la tendance',
  },
  {
    title: "Booster l'engagement",
    description: 'Viralynz attend une vraie vidéo avant de te recommander un CTA.',
    cta: 'Voir des exemples',
  },
];

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  creator: 'Creator',
  pro: 'Pro',
  scale: 'Scale',
};

type DashboardAnalysisRow = Pick<AnalysisRow, 'id' | 'user_id' | 'video_url' | 'result' | 'created_at'>;

function clampScore(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstText(values: unknown[] | null | undefined): string | null {
  return values?.find(isNonEmptyString)?.trim() ?? null;
}

function formatCompact(value: number | null | undefined, fallback: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback = 'Date non disponible'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatDuration(seconds: number | null | undefined, fallback = 'Durée non disponible'): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return fallback;
  return `${seconds.toFixed(seconds >= 20 ? 0 : 1)}s`;
}

function firstNameFromEmail(email: string): string {
  const prefix = email.split('@')[0]?.trim();
  if (!prefix) return 'Créateur';
  const firstChunk = prefix.split(/[._-]/)[0] ?? prefix;
  return firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1);
}

function getVideoTitle(row: AnalysisRow | null): string {
  const result = row?.result;
  return (
    (isNonEmptyString(result?.detectedVideoMeta?.caption) ? result.detectedVideoMeta.caption.trim() : null)
    || (isNonEmptyString(result?.analyzerMeta?.fileName) ? result.analyzerMeta.fileName.trim() : null)
    || (isNonEmptyString(result?.coachAnalysis?.shareables?.screenshotTitle) ? result.coachAnalysis.shareables.screenshotTitle.trim() : null)
    || (isNonEmptyString(result?.finalVerdict) ? result.finalVerdict.split('.')[0]?.trim() : null)
    || 'Vidéo analysée'
  );
}

function getScores(result: AnalysisResult | null | undefined) {
  const subScores = result?.coachAnalysis?.subScores;
  return {
    hook: clampScore(subScores?.hook ?? result?.hook?.score),
    retention: clampScore(subScores?.retention ?? result?.retention?.score),
    rewatch: clampScore(subScores?.rewatchPotential ?? result?.reconstructionIA?.predictedImprovements?.watchTimePotential),
    engagement: clampScore(subScores?.engagementPotential ?? result?.reconstructionIA?.predictedImprovements?.engagementPotential),
    cta: clampScore(subScores?.cta),
  };
}

function buildInsights(latest: AnalysisRow | null): DashboardInsight[] {
  if (!latest?.result) return [];

  const result = latest?.result;
  const scores = getScores(result);

  return [
    {
      title: 'Force du hook',
      description: firstText(result?.hook?.strengths) || (isNonEmptyString(result?.hook?.analysis) ? result.hook.analysis : null) || 'Donnée non disponible dans cette analyse.',
      score: scores.hook,
      type: 'hook',
    },
    {
      title: 'Rétention',
      description: firstText(result?.retention?.weaknesses) || (isNonEmptyString(result?.retention?.analysis) ? result.retention.analysis : null) || 'Donnée non disponible dans cette analyse.',
      score: scores.retention,
      type: 'retention',
    },
    {
      title: 'Valeur de rewatch',
      description: (isNonEmptyString(result?.coachAnalysis?.repostEngine?.bestOpportunity?.why) ? result.coachAnalysis.repostEngine.bestOpportunity.why : null) || 'Donnée non disponible dans cette analyse.',
      score: scores.rewatch,
      type: 'rewatch',
    },
    {
      title: "Facteurs d'engagement",
      description: result?.improvements?.find((item) => isNonEmptyString(item.tip) && item.tip.toLowerCase().includes('cta'))?.tip || 'Donnée non disponible dans cette analyse.',
      score: scores.engagement,
      type: 'engagement',
    },
  ];
}

function buildRecommendations(latest: AnalysisRow | null): DashboardRecommendation[] {
  if (!latest?.result) {
    return FALLBACK_RECOMMENDATIONS.map((item) => ({
      ...item,
      locked: true,
    }));
  }

  const tips = latest?.result?.improvements?.map((item) => item.tip).filter(isNonEmptyString) ?? [];
  if (tips.length === 0) {
    return FALLBACK_RECOMMENDATIONS.map((item) => ({
      ...item,
      description: 'Donnée non disponible dans cette analyse.',
    }));
  }

  return FALLBACK_RECOMMENDATIONS.map((item, index) => ({
    ...item,
    description: tips[index] ?? item.description,
  }));
}

async function getDashboardAnalyses(userId: string, plan: Plan): Promise<AnalysisRow[]> {
  const historyLimit = HISTORY_LIMITS[plan] ?? 0;
  const dashboardLimit = plan === 'free' ? 1 : historyLimit === Infinity ? 200 : Math.max(1, Math.min(historyLimit, 200));

  const { data, error } = await supabase
    .from('analyses')
    .select('id, user_id, video_url, result, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(dashboardLimit);

  if (error) {
    console.error('[getDashboardAnalyses] Error:', error.message);
    return [];
  }

  return ((data ?? []) as DashboardAnalysisRow[]).map((row) => ({
    ...row,
    reconstruction: null,
    reconstruction_created_at: null,
    reconstruction_plan_used: null,
  }));
}

function buildRetention(latest: AnalysisRow | null): DashboardRetention {
  const points = latest?.result?.structuredReconstructionIA?.retentionSimulation ?? [];
  const fix = latest?.result?.structuredReconstructionIA?.retentionFixes?.[0] ?? latest?.result?.reconstructionIA?.retentionFixes?.[0];
  const cta = latest?.result?.structuredReconstructionIA?.optimizedCTAs?.[0];
  const keyMoments: DashboardRetention['keyMoments'] = [];

  const payoffTime = points.find((point) => point.type === 'payoff')?.time;
  if (payoffTime) keyMoments.push({ label: 'Hook', time: payoffTime, tone: 'text-emerald-300 bg-emerald-400/10' });

  const dropTime = fix?.timeRange?.split('-')[0] ?? points.find((point) => point.type === 'drop')?.time;
  if (dropTime) keyMoments.push({ label: 'Décrochage', time: dropTime, tone: 'text-orange-300 bg-orange-500/10' });

  const relaunchTime = points.find((point) => point.type === 'relaunch')?.time;
  if (relaunchTime) keyMoments.push({ label: 'Rewatch', time: relaunchTime, tone: 'text-violet-300 bg-violet-500/13' });

  const ctaTime = cta?.optimalMoment ?? points.find((point) => point.type === 'cta')?.time;
  if (ctaTime) keyMoments.push({ label: 'CTA', time: ctaTime, tone: 'text-violet-300 bg-violet-500/13' });

  return {
    points,
    keyMoments,
  };
}

function buildLatestVideo(latest: AnalysisRow | null): DashboardLatestVideo {
  const metrics = latest?.result?.observedMetrics;
  return {
    title: getVideoTitle(latest),
    date: formatDate(latest?.result?.detectedVideoMeta?.publishedAt ?? latest?.created_at),
    duration: formatDuration(latest?.result?.detectedVideoMeta?.durationSec),
    tiktokUrl: latest?.video_url ?? null,
    likes: formatCompact(metrics?.likes, '—'),
    comments: formatCompact(metrics?.comments, '—'),
    shares: formatCompact(metrics?.shares, '—'),
    thumbnailUrl: null,
  };
}

function buildTopVideos(analyses: AnalysisRow[]): DashboardTopVideo[] {
  return analyses
    .filter((row) => typeof row.result?.observedMetrics?.views === 'number' && row.result.observedMetrics.views > 0)
    .slice()
    .sort((a, b) => (b.result?.viralityScore ?? 0) - (a.result?.viralityScore ?? 0))
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      title: getVideoTitle(row),
      date: formatDate(row.result?.detectedVideoMeta?.publishedAt ?? row.created_at),
      score: clampScore(row.result?.viralityScore) ?? 0,
      views: formatCompact(row.result?.observedMetrics?.views, '—'),
      thumbnailUrl: null,
    }));
}

function hasObservedMetrics(row: AnalysisRow): boolean {
  const metrics = row.result?.observedMetrics;
  return Boolean(
    metrics
    && (
      (typeof metrics.views === 'number' && metrics.views > 0)
      || (typeof metrics.likes === 'number' && metrics.likes > 0)
      || (typeof metrics.comments === 'number' && metrics.comments > 0)
      || (typeof metrics.shares === 'number' && metrics.shares > 0)
    )
  );
}

function hasInsightSignal(latest: AnalysisRow | null): boolean {
  if (!latest?.result) return false;
  const scores = getScores(latest.result);
  return Boolean(
    Object.values(scores).some((score) => score !== null)
    || isNonEmptyString(latest.result.hook?.analysis)
    || isNonEmptyString(latest.result.retention?.analysis)
    || (latest.result.improvements?.some((item) => isNonEmptyString(item.tip)) ?? false)
  );
}

function buildMetrics(analyses: AnalysisRow[], totalAnalyses: number, hasAdvancedTikTokMetrics: boolean): DashboardMetrics {
  const scores = analyses.map((row) => row.result?.viralityScore).filter((score): score is number => typeof score === 'number');
  const totalViews = analyses.reduce((sum, row) => sum + (row.result?.observedMetrics?.views ?? 0), 0);
  const totalEngagements = analyses.reduce(
    (sum, row) => sum + (row.result?.observedMetrics?.likes ?? 0) + (row.result?.observedMetrics?.comments ?? 0) + (row.result?.observedMetrics?.shares ?? 0),
    0
  );
  const watchTimes = analyses
    .map((row) => {
      const duration = row.result?.detectedVideoMeta?.durationSec;
      const retention = row.result?.retention?.score;
      if (typeof duration !== 'number' || typeof retention !== 'number') return null;
      return duration * (retention / 100);
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const averageScore = average(scores);
  const opportunityCount = analyses.filter((row) => (row.result?.viralityScore ?? 0) >= 75).length;
  const canShowTikTokMetrics = hasAdvancedTikTokMetrics && totalViews > 0;

  return {
    totalViews: canShowTikTokMetrics ? formatCompact(totalViews, '—') : '—',
    engagementRate: canShowTikTokMetrics && totalEngagements > 0 ? `${((totalEngagements / totalViews) * 100).toFixed(2)}%` : '—',
    averageWatchTime: hasAdvancedTikTokMetrics && totalViews > 0 && watchTimes.length > 0 ? `${(watchTimes.reduce((sum, value) => sum + value, 0) / watchTimes.length).toFixed(1)}s` : '—',
    averageViralScore: averageScore,
    viralScoreChange: scores.length >= 2 && averageScore !== null ? `${Math.max(0, averageScore - scores[scores.length - 1]).toFixed(1)}%` : null,
    opportunityCount,
    opportunityLabel: totalAnalyses > 0 ? (opportunityCount > 0 ? 'Élevée' : 'À surveiller') : 'À débloquer',
    opportunityText: totalAnalyses > 0
      ? (opportunityCount > 0 ? `${opportunityCount} vidéo${opportunityCount > 1 ? 's' : ''} montre${opportunityCount > 1 ? 'nt' : ''} un fort potentiel dans tes analyses.` : 'Tes premières analyses sont prêtes. Cherche maintenant le meilleur angle à republier.')
      : 'Analyse ta première vidéo pour voir tes opportunités ici.',
    recommendationsContext: totalAnalyses > 0 ? `Basé sur ${totalAnalyses} analyses, applique ces actions au prochain repost.` : 'Analyse ta première vidéo pour débloquer tes décisions IA.',
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const session = await getSession();
  const profile = session ? await getUserById(session.userId) : null;
  const plan = profile ? getEffectivePlan(profile) : 'free';
  const rawQuotaLimit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const quotaLimit = Number.isFinite(rawQuotaLimit) ? rawQuotaLimit : null;
  const visibleAnalyses = session ? await getDashboardAnalyses(session.userId, plan) : [];
  const latest = visibleAnalyses[0] ?? null;
  const email = profile?.email ?? session?.email ?? '';
  const quotaUsed = profile?.analyses_count ?? visibleAnalyses.length;
  const tiktokAccounts = session ? await listTikTokAccountsForUser(session.userId) : [];
  const activeTikTokAccounts = tiktokAccounts.filter((account) => account.status === 'active');
  const primaryTikTokAccount = activeTikTokAccounts[0] ?? null;
  const activeTikTokAccountCount = activeTikTokAccounts.length || (session ? await getConnectedTikTokAccountCount(session.userId) : 0);
  const hasTikTokConnection = Boolean(activeTikTokAccountCount > 0 || profile?.tiktok_open_id || profile?.tiktok_connected_at);
  const tikTokScopes = primaryTikTokAccount?.scopes ?? [];
  const tiktokConnection: DashboardTikTokConnection = {
    connected: hasTikTokConnection,
    displayName: primaryTikTokAccount?.displayName ?? profile?.tiktok_display_name ?? null,
    avatarUrl: primaryTikTokAccount?.avatarUrl ?? profile?.tiktok_avatar_url ?? null,
    connectedAt: primaryTikTokAccount?.connectedAt ?? profile?.tiktok_connected_at ?? null,
    scopes: tikTokScopes,
    modeLabel: process.env.TIKTOK_APP_MODE?.trim() || 'Sandbox',
    hasAdvancedMetrics: hasVideoListScope(tikTokScopes),
  };
  const name = email ? firstNameFromEmail(email) : 'Créateur';
  const retention = buildRetention(latest);
  const topVideos = tiktokConnection.hasAdvancedMetrics ? buildTopVideos(visibleAnalyses) : [];
  const insights = buildInsights(latest);
  const states: DashboardStates = {
    hasAnalyses: visibleAnalyses.length > 0,
    hasTikTokConnection,
    hasTikTokMetrics: tiktokConnection.hasAdvancedMetrics && visibleAnalyses.some(hasObservedMetrics),
    hasRetentionData: retention.points.length >= 2,
    hasLatestAnalysis: Boolean(latest),
    hasRealTopVideos: tiktokConnection.hasAdvancedMetrics && topVideos.length > 0,
    hasRealInsights: hasInsightSignal(latest),
  };

  return {
    user: {
      name,
      email: email || 'Connecte-toi pour afficher ton email',
      plan,
      planLabel: PLAN_LABELS[plan],
      quotaUsed,
      quotaLimit,
    },
    tiktokConnection,
    states,
    metrics: buildMetrics(visibleAnalyses, quotaUsed, tiktokConnection.hasAdvancedMetrics),
    retention,
    latestVideo: buildLatestVideo(latest),
    analysisCta: latest
      ? {
          label: "Voir l'analyse complète",
          href: `/analyses/${encodeURIComponent(latest.id)}`,
        }
      : {
          label: 'Analyser une vidéo',
          href: '/dashboard/analyze',
        },
    insights,
    topVideos,
    recommendations: buildRecommendations(latest),
    hasRealUser: Boolean(profile || session),
    hasRealAnalyses: visibleAnalyses.length > 0,
  };
}
