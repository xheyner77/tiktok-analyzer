export type TrendProvider = 'apify' | 'tiktok_display' | 'demo';

export type TrendSourceType =
  | 'trend'
  | 'search'
  | 'hashtag'
  | 'sound'
  | 'profile'
  | 'user_video';

export type TrendClusterType =
  | 'hook_pattern'
  | 'format_pattern'
  | 'hashtag'
  | 'sound'
  | 'keyword'
  | 'creator_behavior';

export type TrendVerdict = 'post_now' | 'good_potential' | 'watch' | 'twist_it' | 'avoid';

export type TrendStage =
  | 'early_signal'
  | 'growth'
  | 'peak'
  | 'saturated'
  | 'declining'
  | 'unstable';

export type TrendUrgency = 'low' | 'medium' | 'high' | 'critical';

export type TrendPatternKey =
  | 'before_after'
  | 'seven_day_test'
  | 'mistake_hook'
  | 'mini_case_study'
  | 'expectation_vs_reality'
  | 'ranking'
  | 'three_step_framework'
  | 'generic_pov'
  | 'transformation_story'
  | 'flop_analysis'
  | 'unpopular_truth'
  | 'confession_hook'
  | 'fast_proof'
  | 'repost_v2'
  | 'audio_loop'
  | 'carousel_explainer'
  | 'unknown';

export type TrendNiche =
  | 'business'
  | 'coaching'
  | 'ecommerce'
  | 'creator_growth'
  | 'fitness'
  | 'beauty'
  | 'education'
  | 'lifestyle'
  | 'food'
  | 'gaming';

export interface TrendMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
}

export interface RawTrendItem {
  id: string;
  provider: TrendProvider;
  providerItemId: string;
  sourceUrl: string | null;
  country: string;
  language: string;
  query: string;
  sourceType: TrendSourceType;
  caption: string;
  hashtags: string[];
  soundId: string | null;
  soundName: string | null;
  authorId: string | null;
  authorUsername: string | null;
  authorFollowers: number | null;
  createdAt: string | null;
  fetchedAt: string;
  metrics: TrendMetrics;
  duration: number | null;
  coverUrl?: string | null;
  rawPayload: Record<string, unknown>;
}

export interface NormalizedTrendSignal {
  id: string;
  sourceItemId: string;
  caption: string;
  cleanCaption: string;
  hookText: string;
  detectedPattern: TrendPatternKey;
  hashtags: string[];
  soundKey: string | null;
  authorKey: string | null;
  postedAt: string | null;
  fetchedAt: string;
  ageHours: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  shareRate: number;
  commentRate: number;
  viewVelocity: number;
  country: string;
  language: string;
  nicheHints: TrendNiche[];
  sourceUrl: string | null;
  raw: RawTrendItem;
}

export interface TrendScores {
  opportunityScore: number;
  velocityScore: number;
  accelerationScore: number;
  engagementScore: number;
  shareabilityScore: number;
  noveltyScore: number;
  saturationScore: number;
  riskScore: number;
  confidenceScore: number;
  creatorFitScore: number;
  freshnessScore: number;
  sampleQualityScore: number;
  finalScore: number;
}

export interface TrendEvidenceItem {
  sourceUrl: string | null;
  caption: string;
  hookText: string;
  authorUsername: string | null;
  views: number;
  likes: number;
  shares: number;
  postedAt: string | null;
  country: string;
}

export interface TrendEvidenceSummary {
  sourceProvider: TrendProvider;
  medianViews: number;
  averageEngagementRate: number;
  averageShareRate: number;
}

export interface TrendRecommendation {
  verdict: TrendVerdict;
  stage: TrendStage;
  decisionLabel: string;
  shortReason: string;
  recommendedHook: string;
  recommendedAngle: string;
  recommendedFormat: string;
  estimatedWindowHours: number;
  actionNow: string;
  avoidReason?: string;
  twistSuggestion?: string;
}

export interface TrendCluster {
  id: string;
  title: string;
  slug: string;
  clusterType: TrendClusterType;
  patternKey: TrendPatternKey;
  niche: TrendNiche | 'general';
  country: string;
  language: string;
  sampleSize: number;
  uniqueCreators: number;
  firstSeenAt: string;
  lastSeenAt: string;
  topHashtags: string[];
  topSounds: string[];
  topExamples: TrendEvidenceItem[];
  evidenceItems: TrendEvidenceItem[];
  evidenceSummary: TrendEvidenceSummary;
  scores: TrendScores;
  recommendation: TrendRecommendation;
  createdAt: string;
  updatedAt: string;
}

export interface TrendScanPayload {
  niches: TrendNiche[];
  countries: string[];
  keywords: string[];
  force?: boolean;
}

export interface TrendScanJob {
  id: string;
  userId: string | null;
  status: 'idle' | 'running' | 'success' | 'failed';
  provider: TrendProvider | 'mixed';
  countries: string[];
  niches: string[];
  queries: string[];
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  itemsFetched: number;
  clustersCreated: number;
}

export interface TrendSourceStatus {
  status: 'connected' | 'demo' | 'not_configured' | 'empty' | 'stale' | 'error';
  label: string;
  detail: string;
  provider: TrendProvider | 'none';
  lastScanAt: string | null;
  totalRawItems: number;
  totalClusters: number;
  isDemoMode: boolean;
  canScan: boolean;
}

export interface TrendOverview {
  lastScanAt: string | null;
  sourceStatus: TrendSourceStatus;
  totalRawItems: number;
  totalClusters: number;
  totalCreators: number;
  topOpportunity: TrendCluster | null;
  twistTrend: TrendCluster | null;
  avoidTrend: TrendCluster | null;
  marketSummary: string;
  freshnessLabel: string;
  scanConfidence: number;
  clusters: TrendCluster[];
  plan24h: TrendActionIdea[];
  tiktokConnected: boolean;
}

export interface TrendActionIdea {
  clusterId: string;
  title: string;
  hook: string;
  format: string;
  duration: string;
  cta: string;
  objective: string;
  effort: 'low' | 'medium' | 'high';
}

export interface TrendClusterFilters {
  niche?: string;
  country?: string;
  stage?: TrendStage;
  verdict?: TrendVerdict;
  sort?: 'score' | 'freshness' | 'confidence' | 'low_saturation' | 'sample_size';
  limit?: number;
}
