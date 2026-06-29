import 'server-only';

import type { AnalysisRow } from '@/lib/analyses';
import { getEffectivePlan, getUserById, PLAN_LIMITS } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { supabase, type Plan } from '@/lib/supabase';
import { classifyAnalysisTransparency, type AnalysisResult, type AnalysisTransparencyLevel } from '@/lib/types';
import { HISTORY_LIMITS } from '@/lib/plan-limits';
import { getConnectedTikTokAccountCount } from '@/lib/tiktok-account-limits';
import { listTikTokAccountsForUser } from '@/lib/tiktok-accounts';
import { syncTikTokAccountProfile, syncTikTokAccountVideos } from '@/lib/tiktok-sync';
import {
  calculateTikTokDashboardMetrics,
  type TikTokDashboardMetrics,
} from '@/lib/tiktok/dashboard-metrics';
import {
  buildDashboardOverviewData,
  formatOverviewAnalysis,
  type DashboardOverviewData,
  type OverviewFormatPerformance,
  type OverviewHookSuggestion,
  type OverviewMemoryInsight,
  type OverviewTone,
} from '@/lib/dashboard-overview';
import type { TikTokCapabilities } from '@/lib/tiktok/capabilities';
import type { RetentionPoint } from '@/types/reconstruction';

export type DashboardInsightType = 'hook' | 'retention' | 'rewatch' | 'engagement';

export interface DashboardUser {
  name: string;
  email: string;
  plan: Plan;
  planLabel: string;
  quotaUsed: number;
  quotaLimit: number | null;
  hooksUsed: number;
}

export interface DashboardTikTokConnection {
  connected: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  scopes: string[];
  modeLabel: string;
  hasAdvancedMetrics: boolean;
  capabilities: TikTokCapabilities;
  needsReconnect: boolean;
  syncStatus: string | null;
  syncError: string | null;
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
  durationLabel: string | null;
  score: number | null;
  views: string;
  thumbnailUrl: string | null;
  transparencyLabel?: string;
  transparencyLevel?: AnalysisTransparencyLevel;
}

export interface DashboardHookHistoryItem {
  id: string;
  text: string;
  category: string;
  score: number | null;
  createdAt: string;
}

export interface DashboardRecommendation {
  title: string;
  description: string;
  cta: string;
  locked?: boolean;
}

export interface DashboardStates {
  hasAnalyses: boolean;
  hasInternalAnalyses: boolean;
  hasTikTokConnection: boolean;
  hasTikTokMetrics: boolean;
  hasTikTokStats: boolean;
  hasTikTokVideoScope: boolean;
  hasTikTokVideoPermissions: boolean;
  hasSyncedTikTokVideos: boolean;
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
  recentAnalyses: DashboardTopVideo[];
  hooksToTest: DashboardHookHistoryItem[];
  overview: DashboardOverviewData;
  recommendations: DashboardRecommendation[];
  hasRealUser: boolean;
  hasRealAnalyses: boolean;
}

type DashboardTikTokVideoRow = {
  id: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  create_time: string | null;
  view_count: number | string | null;
  like_count: number | string | null;
  comment_count: number | string | null;
  share_count: number | string | null;
  engagement_rate: number | string | null;
  cover_image_url: string | null;
  cover_url: string | null;
};

type DashboardTikTokProfileStatsRow = {
  follower_count: number | string | null;
  likes_count: number | string | null;
  video_count: number | string | null;
};

type DashboardHookHistoryRow = {
  id: string;
  hook_text: string | null;
  tone: string | null;
  created_at: string | null;
};

type DashboardMemoryProfileRow = {
  summary?: string | null;
  prompt_context?: string | null;
  memory_json?: unknown;
  creator_style_summary?: string | null;
  hook_style_summary?: string | null;
  common_mistakes_summary?: string | null;
  strongest_formats_summary?: string | null;
  weak_patterns_summary?: string | null;
  v2_opportunities_summary?: string | null;
  source_analysis_count?: number | null;
  analyses_learned?: number | null;
  active_facts_count?: number | null;
};

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
  starter: 'Starter',
  creator: 'Starter',
  pro: 'Pro',
  lifetime: 'Lifetime',
  scale: 'Lifetime',
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

function toMetricNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function shouldRefreshTikTok(lastSyncAt: string | null | undefined): boolean {
  if (!lastSyncAt) return true;
  const lastSyncMs = new Date(lastSyncAt).getTime();
  return !Number.isFinite(lastSyncMs) || Date.now() - lastSyncMs > 6 * 60 * 60 * 1000;
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

function formatDurationStamp(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
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
    .filter((row) => isRealAggregateAnalysis(row) && typeof row.result?.observedMetrics?.views === 'number' && row.result.observedMetrics.views > 0)
    .slice()
    .sort((a, b) => (b.result?.viralityScore ?? 0) - (a.result?.viralityScore ?? 0))
    .slice(0, 4)
    .map((row) => ({
      ...(() => {
        const transparency = classifyAnalysisTransparency(row.result);
        return {
          transparencyLabel: transparency.label,
          transparencyLevel: transparency.level,
        };
      })(),
      id: row.id,
      title: getVideoTitle(row),
      date: formatDate(row.result?.detectedVideoMeta?.publishedAt ?? row.created_at),
      durationLabel: formatDurationStamp(row.result?.detectedVideoMeta?.durationSec),
      score: clampScore(row.result?.viralityScore),
      views: formatCompact(row.result?.observedMetrics?.views, '—'),
      thumbnailUrl: null,
    }));
}

function buildRecentAnalyses(analyses: AnalysisRow[]): DashboardTopVideo[] {
  return analyses
    .slice(0, 8)
    .map((row) => {
      const transparency = classifyAnalysisTransparency(row.result);
      return {
        id: row.id,
        title: getVideoTitle(row),
        date: formatDate(row.result?.detectedVideoMeta?.publishedAt ?? row.created_at),
        durationLabel: formatDurationStamp(row.result?.detectedVideoMeta?.durationSec),
        score: transparency.includeInRealAggregates ? clampScore(row.result?.viralityScore) : null,
        views: formatCompact(row.result?.observedMetrics?.views, '—'),
        thumbnailUrl: null,
        transparencyLabel: transparency.label,
        transparencyLevel: transparency.level,
      };
    });
}

async function getTikTokVideosForDashboard(userId: string): Promise<DashboardTikTokVideoRow[]> {
  const { data, error } = await supabase
    .from('tiktok_videos')
    .select('id,title,description,caption,create_time,view_count,like_count,comment_count,share_count,engagement_rate,cover_image_url,cover_url')
    .eq('user_id', userId)
    .order('create_time', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.warn('[dashboard-data] TikTok videos read failed:', error.message);
    return [];
  }

  return (data ?? []) as DashboardTikTokVideoRow[];
}

async function getTikTokProfileStatsForDashboard(userId: string, accountId: string): Promise<DashboardTikTokProfileStatsRow | null> {
  const { data, error } = await supabase
    .from('tiktok_profile_stats')
    .select('follower_count,likes_count,video_count')
    .eq('user_id', userId)
    .eq('tiktok_account_id', accountId)
    .maybeSingle();

  if (error) {
    console.warn('[dashboard-data] TikTok profile stats read failed:', error.message);
    return null;
  }

  return data as DashboardTikTokProfileStatsRow | null;
}

function buildTikTokTopVideos(metrics: TikTokDashboardMetrics): DashboardTopVideo[] {
  return metrics.topVideos
    .filter((video) => toMetricNumber(video.view_count) > 0)
    .map((video) => ({
      id: video.id,
      title: firstText([video.title, video.description]) ?? 'Vidéo TikTok synchronisée',
      date: formatDate(video.create_time),
      durationLabel: null,
      score: clampScore(
        toMetricNumber(video.view_count) > 0
          ? ((toMetricNumber(video.like_count) + toMetricNumber(video.comment_count) + toMetricNumber(video.share_count)) / toMetricNumber(video.view_count)) * 100
          : 0
      ) ?? 0,
      views: formatCompact(toMetricNumber(video.view_count), '—'),
      thumbnailUrl: video.cover_image_url ?? video.cover_url,
    }));
}

async function getDashboardHooks(userId: string): Promise<DashboardHookHistoryItem[]> {
  const { data, error } = await supabase
    .from('hooks_history')
    .select('id, hook_text, tone, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    console.warn('[dashboard-data] Hooks history read failed:', error.message);
    return [];
  }

  return ((data ?? []) as DashboardHookHistoryRow[])
    .filter((row) => isNonEmptyString(row.hook_text))
    .map((row) => ({
      id: row.id,
      text: row.hook_text?.trim() ?? 'Hook généré',
      category: row.tone?.trim() || 'Hook',
      score: null,
      createdAt: row.created_at ?? new Date(0).toISOString(),
    }));
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectMemoryStrings(value: unknown, output: string[] = []): string[] {
  if (output.length >= 3) return output;
  if (typeof value === 'string' && value.trim().length > 0) {
    output.push(value.trim());
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectMemoryStrings(item, output);
      if (output.length >= 3) break;
    }
    return output;
  }
  const record = readRecord(value);
  if (record) {
    for (const item of Object.values(record)) {
      collectMemoryStrings(item, output);
      if (output.length >= 3) break;
    }
  }
  return output;
}

async function getDashboardMemory(userId: string): Promise<OverviewMemoryInsight> {
  const { data, error } = await supabase
    .from('creator_memory_profiles')
    .select('summary,prompt_context,memory_json,source_analysis_count')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[dashboard-data] Creator memory read failed:', error.message);
    return {
      available: false,
      description: 'La mémoire IA se construit après tes premières analyses.',
      items: ['Aucune mémoire inventée', 'Patterns à confirmer', 'Décisions à consolider'],
    };
  }

  const row = data as DashboardMemoryProfileRow | null;
  const sourceCount = row?.source_analysis_count ?? 0;
  const description = firstText([row?.summary, row?.prompt_context]);
  const memoryItems = collectMemoryStrings(row?.memory_json)
    .filter((item, index, list) => list.findIndex((candidate) => candidate === item) === index)
    .slice(0, 3);

  if (!description && memoryItems.length === 0 && sourceCount <= 0) {
    return {
      available: false,
      description: 'Viralynz n’affiche pas de mémoire inventée. Analyse une vidéo pour conserver les décisions qui reviennent.',
      items: ['Premiers hooks à mesurer', 'Formats à comparer', 'CTA à confirmer'],
    };
  }

  return {
    available: true,
    description: description ?? `Mémoire construite à partir de ${sourceCount} analyse${sourceCount > 1 ? 's' : ''}.`,
    items: memoryItems.length > 0 ? memoryItems : ['Signaux créateur consolidés', 'Hooks à comparer', 'Décisions V2 à confirmer'],
  };
}

function buildFormatPerformance(analyses: AnalysisRow[]): OverviewFormatPerformance[] {
  const groups = new Map<string, number[]>();

  for (const row of analyses) {
    const format = firstText([
      row.result?.coachAnalysis?.patternLabel,
      row.result?.analyzerMeta?.objectiveLabel,
      row.result?.analyzerMeta?.nicheLabel,
    ]);
    const score = clampScore(row.result?.viralityScore ?? row.result?.coachAnalysis?.weightedScore);
    if (!format || score === null) continue;
    const current = groups.get(format) ?? [];
    current.push(score);
    groups.set(format, current);
  }

  const realItems = Array.from(groups.entries())
    .map(([format, scores]) => ({
      id: format.toLowerCase().replace(/[^a-z0-9]+/gi, '-'),
      format,
      metricLabel: scores.length > 1 ? 'Score moyen' : 'Score analyse',
      value: `${average(scores) ?? '—'}/100`,
      trendLabel: `${scores.length} analyse${scores.length > 1 ? 's' : ''}`,
      available: true,
    }))
    .sort((a, b) => Number.parseInt(b.value, 10) - Number.parseInt(a.value, 10))
    .slice(0, 3);

  if (realItems.length > 0) return realItems;

  return [
    { id: 'format-1', format: 'Format principal', metricLabel: 'Score moyen', value: '—', trendLabel: 'Après analyse', available: false },
    { id: 'format-2', format: 'Structure', metricLabel: 'Rétention moy.', value: '—', trendLabel: 'À mesurer', available: false },
    { id: 'format-3', format: 'V2 à tester', metricLabel: 'Score moyen', value: '—', trendLabel: 'Après plusieurs analyses', available: false },
  ];
}

function countSince<T>(items: T[], getDate: (item: T) => string | null | undefined, sinceMs: number): number {
  return items.filter((item) => {
    const raw = getDate(item);
    if (!raw) return false;
    const time = new Date(raw).getTime();
    return Number.isFinite(time) && time >= sinceMs;
  }).length;
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

function isRealAggregateAnalysis(row: AnalysisRow): boolean {
  return classifyAnalysisTransparency(row.result).includeInRealAggregates;
}

function overviewToneForTransparency(level: AnalysisTransparencyLevel): OverviewTone {
  if (level === 'real') return 'success';
  if (level === 'partial' || level === 'estimated') return 'warning';
  return 'danger';
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

function buildMetrics(
  analyses: AnalysisRow[],
  totalAnalyses: number,
  tiktokMetrics: TikTokDashboardMetrics,
  hasTikTokConnection: boolean
): DashboardMetrics {
  const scores = analyses.map((row) => row.result?.viralityScore).filter((score): score is number => typeof score === 'number');

  const averageScore = average(scores);
  const opportunityCount = analyses.filter((row) => (row.result?.viralityScore ?? 0) >= 75).length;

  return {
    totalViews: tiktokMetrics.totalViews === null ? '—' : formatCompact(tiktokMetrics.totalViews, '—'),
    engagementRate: tiktokMetrics.engagementRate === null ? '—' : `${tiktokMetrics.engagementRate.toFixed(2)}%`,
    averageWatchTime: hasTikTokConnection ? 'Non disponible via TikTok' : '—',
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
  const realAggregateAnalyses = visibleAnalyses.filter(isRealAggregateAnalysis);
  const latestRealAnalysis = realAggregateAnalyses[0] ?? null;
  const email = profile?.email ?? session?.email ?? '';
  const quotaUsed = profile?.analyses_count ?? visibleAnalyses.length;
  let tiktokAccounts = session ? await listTikTokAccountsForUser(session.userId) : [];
  let activeTikTokAccounts = tiktokAccounts.filter((account) => account.status === 'active');
  let primaryTikTokAccount = activeTikTokAccounts[0] ?? null;
  if (session && primaryTikTokAccount && shouldRefreshTikTok(primaryTikTokAccount.lastSyncAt)) {
    const profileSync = await syncTikTokAccountProfile(session.userId, primaryTikTokAccount.id);
    if (!profileSync.ok) {
      console.info('[dashboard-data] TikTok profile sync skipped/failed', {
        status: profileSync.status,
      });
    }
    if (primaryTikTokAccount.capabilities.hasVideoList) {
      const videoSync = await syncTikTokAccountVideos(session.userId, primaryTikTokAccount.id);
      if (!videoSync.ok) {
        console.info('[dashboard-data] TikTok video sync skipped/failed', {
          status: videoSync.status,
          reason: 'reason' in videoSync ? videoSync.reason : null,
        });
      }
    }
    tiktokAccounts = await listTikTokAccountsForUser(session.userId);
    activeTikTokAccounts = tiktokAccounts.filter((account) => account.status === 'active');
    primaryTikTokAccount = activeTikTokAccounts[0] ?? null;
  }
  const tiktokVideos = session ? await getTikTokVideosForDashboard(session.userId) : [];
  const tiktokProfileStats = session && primaryTikTokAccount
    ? await getTikTokProfileStatsForDashboard(session.userId, primaryTikTokAccount.id)
    : null;
  const tiktokMetrics = calculateTikTokDashboardMetrics({
    videos: tiktokVideos,
    profileStats: tiktokProfileStats,
  });
  const activeTikTokAccountCount = activeTikTokAccounts.length || (session ? await getConnectedTikTokAccountCount(session.userId) : 0);
  const hasTikTokConnection = Boolean(activeTikTokAccountCount > 0 || profile?.tiktok_open_id || profile?.tiktok_connected_at);
  const tikTokScopes = primaryTikTokAccount?.scopes ?? [];
  const fallbackCapabilities = primaryTikTokAccount?.capabilities ?? {
    grantedScopes: [],
    hasBasicProfile: false,
    hasProfile: false,
    hasUserStats: false,
    hasVideoList: false,
    canFetchProfileStats: false,
    canFetchVideos: false,
    canFetchVideoMetrics: false,
    canFetchWatchTime: false,
    missingScopes: [],
    environment: 'unknown' as const,
    needsReconnect: false,
  };
  const tiktokConnection: DashboardTikTokConnection = {
    connected: hasTikTokConnection,
    displayName: primaryTikTokAccount?.displayName ?? profile?.tiktok_display_name ?? null,
    avatarUrl: primaryTikTokAccount?.avatarUrl ?? profile?.tiktok_avatar_url ?? null,
    connectedAt: primaryTikTokAccount?.connectedAt ?? profile?.tiktok_connected_at ?? null,
    lastSyncAt: primaryTikTokAccount?.lastSyncAt ?? null,
    scopes: tikTokScopes,
    modeLabel: primaryTikTokAccount?.environment === 'production' ? 'Production' : primaryTikTokAccount?.environment === 'sandbox' ? 'Sandbox' : 'Environnement inconnu',
    hasAdvancedMetrics: fallbackCapabilities.canFetchVideoMetrics || fallbackCapabilities.canFetchProfileStats,
    capabilities: fallbackCapabilities,
    needsReconnect: fallbackCapabilities.needsReconnect,
    syncStatus: primaryTikTokAccount?.syncStatus ?? null,
    syncError: primaryTikTokAccount?.syncError ?? null,
  };
  const name = email ? firstNameFromEmail(email) : 'Créateur';
  const retention = buildRetention(latestRealAnalysis);
  const tiktokTopVideos = tiktokConnection.capabilities.canFetchVideos ? buildTikTokTopVideos(tiktokMetrics) : [];
  const topVideos = tiktokTopVideos.length > 0
    ? tiktokTopVideos
    : buildTopVideos(realAggregateAnalyses);
  const recentAnalyses = buildRecentAnalyses(visibleAnalyses);
  const hooksToTest = session ? await getDashboardHooks(session.userId) : [];
  const memoryInsight = session ? await getDashboardMemory(session.userId) : {
    available: false,
    description: 'Viralynz n’affiche pas de mémoire inventée. Analyse une vidéo pour conserver les décisions qui reviennent.',
    items: ['Premiers hooks à mesurer', 'Formats à comparer', 'CTA à confirmer'],
  };
  const insights = buildInsights(latestRealAnalysis);
  const states: DashboardStates = {
    hasAnalyses: visibleAnalyses.length > 0,
    hasInternalAnalyses: visibleAnalyses.length > 0,
    hasTikTokConnection,
    hasTikTokMetrics: tiktokMetrics.totalViews !== null,
    hasTikTokStats: tiktokMetrics.totalViews !== null || tiktokMetrics.videoCount > 0,
    hasTikTokVideoScope: tiktokConnection.capabilities.hasVideoList,
    hasTikTokVideoPermissions: tiktokConnection.capabilities.hasVideoList || tiktokConnection.capabilities.canFetchVideos,
    hasSyncedTikTokVideos: tiktokMetrics.videoCount > 0,
    hasRetentionData: retention.points.length >= 2,
    hasLatestAnalysis: Boolean(latest),
    hasRealTopVideos: topVideos.length > 0,
    hasRealInsights: hasInsightSignal(latestRealAnalysis),
  };
  const metrics = buildMetrics(realAggregateAnalyses, realAggregateAnalyses.length, tiktokMetrics, hasTikTokConnection);
  const latestVideo = buildLatestVideo(latest);
  const analysisCta = latest
    ? {
        label: "Voir l'analyse complète",
        href: `/analyses/${encodeURIComponent(latest.id)}`,
      }
    : {
        label: 'Analyser une vidéo',
        href: '/dashboard/analyze',
      };
  const recommendations = buildRecommendations(latestRealAnalysis);
  const dashboardUser: DashboardUser = {
    name,
    email: email || 'Connecte-toi pour afficher ton email',
    plan,
    planLabel: PLAN_LABELS[plan],
    quotaUsed,
    quotaLimit,
    hooksUsed: profile?.hooks_count ?? 0,
  };
  const formatPerformance = buildFormatPerformance(realAggregateAnalyses);
  const weekStartMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const overview = buildDashboardOverviewData({
    user: dashboardUser,
    tiktok: {
      connected: tiktokConnection.connected,
      displayName: tiktokConnection.displayName,
      avatarUrl: tiktokConnection.avatarUrl,
      lastSyncAt: tiktokConnection.lastSyncAt,
      needsReconnect: tiktokConnection.needsReconnect,
      missingScopes: tiktokConnection.capabilities.missingScopes,
    },
    states,
    metrics,
    insights,
    recommendations,
    analysisCta,
    recentAnalyses: visibleAnalyses.slice(0, 8).map((analysis) => {
      const transparency = classifyAnalysisTransparency(analysis.result);
      const card = formatOverviewAnalysis({
        id: analysis.id,
        title: getVideoTitle(analysis),
        createdAtLabel: formatDate(analysis.result?.detectedVideoMeta?.publishedAt ?? analysis.created_at),
        durationLabel: formatDurationStamp(analysis.result?.detectedVideoMeta?.durationSec),
        thumbnailUrl: null,
        score: transparency.includeInRealAggregates ? clampScore(analysis.result?.viralityScore) : null,
      });
      return transparency.includeInRealAggregates
        ? card
        : {
            ...card,
            badgeLabel: transparency.label,
            badgeTone: overviewToneForTransparency(transparency.level),
          };
    }),
    hooks: hooksToTest.map((hook) => ({
      id: hook.id,
      text: hook.text,
      category: hook.category,
      score: hook.score,
      href: '/dashboard/hooks',
    })),
    memory: memoryInsight,
    formatPerformance,
    counts: {
      analyses7d: countSince(visibleAnalyses, (row) => row.created_at, weekStartMs),
      hooks7d: countSince(hooksToTest, (hook) => hook.createdAt, weekStartMs),
    },
  });

  return {
    user: dashboardUser,
    tiktokConnection,
    states,
    metrics,
    retention,
    latestVideo,
    analysisCta,
    insights,
    topVideos,
    recentAnalyses,
    hooksToTest,
    overview,
    recommendations,
    hasRealUser: Boolean(profile || session),
    hasRealAnalyses: realAggregateAnalyses.length > 0,
  };
}
