import type { AnalysisRow } from './analyses';
import type { ViralynzProgressState } from './viralynz-progress-engine';
import type { AnalysisResult } from './types';

export type LeaderboardCategory =
  | 'main'
  | 'top_progression_week'
  | 'best_repost_transformations'
  | 'most_improved_creator'
  | 'best_hook_rewrites'
  | 'strongest_retention_structures';

export type LeaderboardNiche = 'Business' | 'Storytelling' | 'UGC' | 'E-commerce' | 'Fitness' | 'Gaming' | 'Education';

export interface CreatorBadge {
  id: string;
  label: 'Hook Precision' | 'Retention Builder' | 'Repost Specialist' | 'Pattern Expert';
  description: string;
  score: number;
  unlocked: boolean;
}

export interface LeaderboardEntry {
  id: string;
  label: string;
  category: LeaderboardCategory;
  niche?: LeaderboardNiche | string;
  qualityScore: number;
  hookQuality: number;
  structureQuality: number;
  retentionSignals: number;
  repostImprovement: number;
  creatorProgress: number;
  consistency: number;
  movement: 'up' | 'down' | 'stable' | 'new';
  evidence: string;
}

export interface CreatorLeaderboardState {
  mainEntry: LeaderboardEntry;
  categoryBoards: Record<LeaderboardCategory, LeaderboardEntry[]>;
  nicheBoards: Array<{
    niche: LeaderboardNiche;
    entries: LeaderboardEntry[];
    status: 'active' | 'learning';
  }>;
  badges: CreatorBadge[];
  teamBoard: LeaderboardEntry[];
  summary: string;
}

const niches: LeaderboardNiche[] = ['Business', 'Storytelling', 'UGC', 'E-commerce', 'Fitness', 'Gaming', 'Education'];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function average(values: number[]) {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return 0;
  return Math.round(safe.reduce((sum, value) => sum + value, 0) / safe.length);
}

function repostImprovement(result: AnalysisResult) {
  const engine = result.coachAnalysis?.repostEngine;
  return clamp((engine?.scoreAfter ?? result.viralityScore) - (engine?.scoreBefore ?? result.viralityScore) + 50);
}

function consistencyScore(results: AnalysisResult[]) {
  if (results.length < 2) return 42;
  const avg = average(results.map((result) => result.viralityScore));
  const spread = Math.max(...results.map((result) => Math.abs(result.viralityScore - avg)));
  return clamp(100 - spread * 1.6);
}

function movementFromProgress(progress: ViralynzProgressState) {
  const positive = progress.metrics.filter((metric) => metric.tone === 'up').length;
  const negative = progress.metrics.filter((metric) => metric.tone === 'down').length;
  if (!progress.hasEnoughData) return 'new' as const;
  if (positive > negative) return 'up' as const;
  if (negative > positive) return 'down' as const;
  return 'stable' as const;
}

function qualityScore(input: {
  hookQuality: number;
  structureQuality: number;
  retentionSignals: number;
  repostImprovement: number;
  creatorProgress: number;
  consistency: number;
}) {
  return clamp(
    input.hookQuality * 0.18
      + input.structureQuality * 0.16
      + input.retentionSignals * 0.18
      + input.repostImprovement * 0.16
      + input.creatorProgress * 0.18
      + input.consistency * 0.14,
  );
}

function entryForAnalysis(row: AnalysisRow, category: LeaderboardCategory, progress: ViralynzProgressState): LeaderboardEntry {
  const result = row.result;
  const hookQuality = result.hook.score;
  const structureQuality = average([result.editing.score, result.coachAnalysis?.subScores.clarity ?? result.viralityScore]);
  const retentionSignals = result.retention.score;
  const repost = repostImprovement(result);
  const creatorProgress = progress.progressScore;
  const consistency = average([result.viralityScore, structureQuality, retentionSignals]);
  return {
    id: `${category}_${row.id}`,
    label: result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'Video analysee',
    category,
    niche: result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche,
    qualityScore: qualityScore({ hookQuality, structureQuality, retentionSignals, repostImprovement: repost, creatorProgress, consistency }),
    hookQuality,
    structureQuality,
    retentionSignals,
    repostImprovement: repost,
    creatorProgress,
    consistency,
    movement: movementFromProgress(progress),
    evidence: result.coachAnalysis?.detectedProblems?.[0]?.action ?? result.actionPlan?.[0] ?? 'Score qualite base sur hook, structure, retention et potentiel repost.',
  };
}

function mainEntry(rows: AnalysisRow[], progress: ViralynzProgressState): LeaderboardEntry {
  const results = rows.map((row) => row.result);
  const hookQuality = average(results.map((result) => result.hook.score));
  const structureQuality = average(results.map((result) => average([result.editing.score, result.coachAnalysis?.subScores.clarity ?? result.viralityScore])));
  const retentionSignals = average(results.map((result) => result.retention.score));
  const repost = average(results.map(repostImprovement));
  const consistency = consistencyScore(results);
  const creatorProgress = progress.progressScore;
  return {
    id: 'current_creator',
    label: 'Ton classement qualite',
    category: 'main',
    niche: rows.at(0)?.result.analyzerMeta?.nicheLabel ?? rows.at(0)?.result.analyzerMeta?.niche,
    qualityScore: qualityScore({ hookQuality, structureQuality, retentionSignals, repostImprovement: repost, creatorProgress, consistency }),
    hookQuality,
    structureQuality,
    retentionSignals,
    repostImprovement: repost,
    creatorProgress,
    consistency,
    movement: movementFromProgress(progress),
    evidence: 'Classement base sur qualite hook, structure, retention, repost, progression et consistency.',
  };
}

function badgesFor(entry: LeaderboardEntry, rows: AnalysisRow[]): CreatorBadge[] {
  const recurrentPatterns = rows.flatMap((row) => row.result.coachAnalysis?.detectedProblems ?? []).length;
  return [
    {
      id: 'hook_precision',
      label: 'Hook Precision',
      description: 'Hooks clairs, courts et mieux structures.',
      score: entry.hookQuality,
      unlocked: entry.hookQuality >= 72,
    },
    {
      id: 'retention_builder',
      label: 'Retention Builder',
      description: 'Structures qui gardent mieux l attention.',
      score: entry.retentionSignals,
      unlocked: entry.retentionSignals >= 72,
    },
    {
      id: 'repost_specialist',
      label: 'Repost Specialist',
      description: 'Transformations avant/apres solides.',
      score: entry.repostImprovement,
      unlocked: entry.repostImprovement >= 66,
    },
    {
      id: 'pattern_expert',
      label: 'Pattern Expert',
      description: 'Patterns recurrents identifies et exploites.',
      score: clamp(42 + recurrentPatterns * 8),
      unlocked: recurrentPatterns >= 4,
    },
  ];
}

export function buildCreatorLeaderboard(rows: AnalysisRow[], progress: ViralynzProgressState, isScalePlan = false): CreatorLeaderboardState {
  const activeRows = rows.length ? rows : [];
  const main = activeRows.length
    ? mainEntry(activeRows, progress)
    : {
        id: 'current_creator',
        label: 'Ton classement qualite',
        category: 'main' as const,
        qualityScore: 0,
        hookQuality: 0,
        structureQuality: 0,
        retentionSignals: 0,
        repostImprovement: 0,
        creatorProgress: progress.progressScore,
        consistency: 0,
        movement: 'new' as const,
        evidence: 'Analyse une video pour entrer dans le classement qualite.',
      };
  const entries = activeRows.map((row) => entryForAnalysis(row, 'main', progress));
  const categoryBoards: CreatorLeaderboardState['categoryBoards'] = {
    main: [main],
    top_progression_week: [...entries].sort((a, b) => b.creatorProgress - a.creatorProgress).slice(0, 5),
    best_repost_transformations: [...entries].sort((a, b) => b.repostImprovement - a.repostImprovement).slice(0, 5),
    most_improved_creator: [main],
    best_hook_rewrites: [...entries].sort((a, b) => b.hookQuality - a.hookQuality).slice(0, 5),
    strongest_retention_structures: [...entries].sort((a, b) => b.retentionSignals - a.retentionSignals).slice(0, 5),
  };
  const nicheBoards = niches.map((niche) => {
    const nicheEntries = entries.filter((entry) => String(entry.niche ?? '').toLowerCase().includes(niche.toLowerCase()));
    return {
      niche,
      entries: nicheEntries.length ? nicheEntries.slice(0, 4) : [],
      status: nicheEntries.length ? 'active' as const : 'learning' as const,
    };
  });
  return {
    mainEntry: main,
    categoryBoards,
    nicheBoards,
    badges: badgesFor(main, activeRows),
    teamBoard: isScalePlan ? entries.slice(0, 6).map((entry, index) => ({ ...entry, id: `team_${entry.id}`, label: `Compte ${index + 1} - ${entry.label}` })) : [],
    summary: main.qualityScore
      ? `${main.qualityScore}/100 qualite createur. Le score recompense progression, structure et coherence, pas les vues.`
      : 'Le leaderboard s active apres tes premieres analyses.',
  };
}
