export type TrendPlatform = 'tiktok';

export type TrendStage = 'early_signal' | 'growth' | 'peak' | 'saturated' | 'declining' | 'unstable';

export type TrendVerdict = 'post_now' | 'good_potential' | 'watch' | 'twist_it' | 'avoid';

export type TrendCategory =
  | 'hook_format'
  | 'storytelling'
  | 'business'
  | 'ecommerce'
  | 'education'
  | 'creator_growth'
  | 'entertainment'
  | 'visual_format'
  | 'audio_pattern'
  | 'carousel';

export type TrendSignalSentiment = 'positive' | 'neutral' | 'negative';
export type TrendUrgency = 'low' | 'medium' | 'high' | 'critical';
export type TrendDifficulty = 'easy' | 'medium' | 'hard';
export type TrendEffort = 'low' | 'medium' | 'high';
export type TrendPriority = 'low' | 'medium' | 'high';

export interface TrendSignal {
  label: string;
  value: string;
  sentiment: TrendSignalSentiment;
  explanation: string;
}

export interface RecommendedFormat {
  label: string;
  duration: string;
  difficulty: TrendDifficulty;
  why: string;
}

export interface TrendActionStep {
  title: string;
  description: string;
  effort: TrendEffort;
  priority: TrendPriority;
}

export interface TrendTimeWindow {
  label: string;
  estimatedHoursLeft: number;
  urgency: TrendUrgency;
}

export interface TrendRadarPosition {
  x: number;
  y: number;
  radius: number;
}

export interface Trend {
  id: string;
  name: string;
  category: TrendCategory;
  platform: TrendPlatform;
  detectedAt: string;
  lastUpdatedAt: string;
  volumeScore: number;
  velocityScore: number;
  accelerationScore: number;
  saturationScore: number;
  noveltyScore: number;
  creatorFitScore: number;
  difficultyScore: number;
  riskScore: number;
  opportunityScore: number;
  stage: TrendStage;
  verdict: TrendVerdict;
  recommendedNiches: string[];
  badFitNiches: string[];
  timeWindow: TrendTimeWindow;
  signals: TrendSignal[];
  explanation: string;
  whyItWorks: string;
  whyNow: string;
  saturationReason: string;
  recommendedFormats: RecommendedFormat[];
  hooks: string[];
  angles: string[];
  mistakesToAvoid: string[];
  actionPlan: TrendActionStep[];
  radar: TrendRadarPosition;
}

export type TrendSeed = Omit<Trend, 'opportunityScore' | 'stage' | 'verdict' | 'radar' | 'timeWindow'> & {
  timeWindow: Omit<TrendTimeWindow, 'urgency'>;
};

export interface TrendHealth {
  label: string;
  tone: 'strong' | 'good' | 'watch' | 'risky' | 'dead';
  explanation: string;
}

export interface NicheTrendOpportunity {
  niche: string;
  trendId: string;
  trendName: string;
  hook: string;
  format: string;
  score: number;
  action: string;
}

export interface AvoidTrendRecommendation {
  trendId: string;
  name: string;
  verdict: TrendVerdict;
  reason: string;
  twist: string;
}

export interface DailyTrendIdea {
  trendId: string;
  trendName: string;
  hook: string;
  format: string;
  structure: string[];
  duration: string;
  effort: TrendEffort;
  objective: string;
  cta: string;
}

export interface TrendRadarSummary {
  bestTrendId: string;
  earlyCount: number;
  avoidCount: number;
  postNowCount: number;
  marketMood: 'favorable' | 'selective' | 'saturated' | 'unstable';
  marketSummary: string;
  lastUpdatedLabel: string;
}

export interface TrendRadarModel {
  trends: Trend[];
  summary: TrendRadarSummary;
  nicheOpportunities: NicheTrendOpportunity[];
  avoidTrends: AvoidTrendRecommendation[];
  dailyIdeas: DailyTrendIdea[];
}
