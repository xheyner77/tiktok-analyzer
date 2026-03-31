export type Rating = 'Excellent' | 'Bon' | 'Moyen' | 'Faible';
export type Priority = 'haute' | 'moyenne' | 'basse';

export interface AnalysisSection {
  score: number;
  rating: Rating;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Improvement {
  priority: Priority;
  tip: string;
}

export interface AnalysisResult {
  viralityScore: number;
  structureScore?: number;
  observedPerformanceScore?: number;
  observedPerformanceLabel?: string;
  observedPerformanceEstimated?: boolean;
  overperformanceDetected?: boolean;
  finalVerdict?: string;
  observedMetrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  hook: AnalysisSection;
  editing: AnalysisSection;
  retention: AnalysisSection;
  improvements: Improvement[];
  strategy?: string;   // Elite only — personalized content strategy
  viralTips?: string[]; // Elite only — what top viral videos do in this niche
}
