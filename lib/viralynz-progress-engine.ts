import type { AnalysisRow } from './analyses';
import type { StoredCreatorMemory } from './creator-memory-store';
import type { AnalysisResult } from './types';

export type ProgressTone = 'up' | 'down' | 'stable' | 'learning';

export interface ViralynzProgressMetric {
  id: 'hook' | 'retention' | 'cta' | 'repost';
  label: string;
  value: number;
  delta: number;
  deltaLabel: string;
  tone: ProgressTone;
  evidence: string;
  confidence: number;
}

export interface ViralynzRecurringPattern {
  label: string;
  detail: string;
  count: number;
  severity: 'critical' | 'important' | 'watch';
}

export interface ViralynzNicheBenchmark {
  label: string;
  insight: string;
  evidence: string;
  confidence: number;
}

export interface ViralynzProgressState {
  hasEnoughData: boolean;
  analysisCount: number;
  progressScore: number;
  level: string;
  streakLabel: string;
  momentumLabel: string;
  dopamineLine: string;
  nextMilestone: string;
  metrics: ViralynzProgressMetric[];
  recurringPatterns: ViralynzRecurringPattern[];
  nicheBenchmarks: ViralynzNicheBenchmark[];
  styleEvolution: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function average(values: number[]) {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return 0;
  return Math.round(safe.reduce((sum, value) => sum + value, 0) / safe.length);
}

function formatDelta(delta: number, unit = 'pts') {
  if (delta > 0) return `+${delta} ${unit}`;
  if (delta < 0) return `${delta} ${unit}`;
  return `0 ${unit}`;
}

function toneFor(delta: number): ProgressTone {
  if (delta >= 3) return 'up';
  if (delta <= -3) return 'down';
  return 'stable';
}

function chronological(rows: AnalysisRow[]) {
  return [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function splitOldRecent(results: AnalysisResult[]) {
  if (results.length < 4) {
    return {
      oldResults: results.slice(0, 1),
      recentResults: results.slice(-1),
    };
  }
  const midpoint = Math.floor(results.length / 2);
  return {
    oldResults: results.slice(0, midpoint),
    recentResults: results.slice(midpoint),
  };
}

function ctaScore(result: AnalysisResult) {
  return result.coachAnalysis?.subScores.cta ?? result.viralityScore;
}

function repostScore(result: AnalysisResult) {
  return result.coachAnalysis?.subScores.repostPotential ?? result.coachAnalysis?.repostEngine.improvementProbability ?? result.viralityScore;
}

function metric(
  id: ViralynzProgressMetric['id'],
  label: string,
  oldResults: AnalysisResult[],
  recentResults: AnalysisResult[],
  selector: (result: AnalysisResult) => number,
  evidence: string,
): ViralynzProgressMetric {
  const before = average(oldResults.map(selector));
  const after = average(recentResults.map(selector));
  const delta = after - before;
  return {
    id,
    label,
    value: after || before,
    delta,
    deltaLabel: formatDelta(delta),
    tone: toneFor(delta),
    evidence,
    confidence: clamp(42 + (oldResults.length + recentResults.length) * 8),
  };
}

function normalizePattern(value: string) {
  return value
    .replace(/[:.].*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function topEntries(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = normalizePattern(raw);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function recurringPatterns(results: AnalysisResult[], memory?: StoredCreatorMemory | null): ViralynzRecurringPattern[] {
  const fromAnalyses = results.flatMap((result) => [
    ...(result.structuredDiagnostics?.map((item) => item.title) ?? []),
    ...(result.coachAnalysis?.detectedProblems?.map((item) => item.title) ?? []),
    ...(result.hook.weaknesses ?? []),
    ...(result.retention.weaknesses ?? []),
  ]);
  const fromMemory = memory?.memory.recurringPatterns ?? [];
  const entries = topEntries([...fromAnalyses, ...fromMemory], 5);
  const fallback = [
    { label: 'Intro explicative frequente', count: 1 },
    { label: 'Payoff souvent tardif', count: 1 },
    { label: 'CTA a renforcer', count: 1 },
  ];

  return (entries.length ? entries : fallback).slice(0, 4).map((entry) => ({
    label: entry.label,
    detail: entry.count > 1
      ? `Observe dans ${entry.count} analyses recentes.`
      : 'Signal a confirmer sur les prochaines analyses.',
    count: entry.count,
    severity: entry.count >= 3 ? 'critical' : entry.count >= 2 ? 'important' : 'watch',
  }));
}

function buildBenchmarks(results: AnalysisResult[], memory?: StoredCreatorMemory | null): ViralynzNicheBenchmark[] {
  const latest = results.at(-1);
  const niche = latest?.analyzerMeta?.nicheLabel ?? latest?.analyzerMeta?.niche ?? 'ta niche';
  const format = latest?.coachAnalysis?.patternLabel ?? 'ton format';
  const memoryPatterns = memory?.memory.detectedPatterns ?? [];
  const coachBenchmarks = results
    .flatMap((result) => result.coachAnalysis?.benchmarks ?? [])
    .slice(-3);

  const items: ViralynzNicheBenchmark[] = [
    ...memoryPatterns.slice(0, 2).map((pattern) => ({
      label: 'Tendance interne',
      insight: pattern.insight,
      evidence: pattern.evidence,
      confidence: pattern.confidence,
    })),
    ...coachBenchmarks.map((benchmark) => ({
      label: benchmark.label,
      insight: benchmark.insight.replace(/\+\d+%[^.]*\.?/g, '').trim(),
      evidence: 'Compare aux patterns observes dans tes diagnostics Viralynz, sans statistique TikTok externe.',
      confidence: 58,
    })),
    {
      label: niche,
      insight: `Les hooks directs semblent plus utiles quand ${format.toLowerCase()} doit prouver vite la valeur.`,
      evidence: 'Observation basee sur tes scores hook, retention et recommandations de repost.',
      confidence: clamp(44 + results.length * 7),
    },
    {
      label: 'Preuve rapide',
      insight: 'Quand la preuve arrive avant le contexte, le risque de drop est formule plus tard dans le diagnostic.',
      evidence: 'Signal structurel interne, pas une metrique de retention TikTok.',
      confidence: clamp(40 + results.length * 8),
    },
  ];

  return items
    .filter((item, index, arr) => arr.findIndex((other) => other.insight === item.insight) === index)
    .slice(0, 4);
}

function styleEvolution(results: AnalysisResult[], memory?: StoredCreatorMemory | null) {
  const traits = memory?.memory.styleTraits?.map((trait) => trait.label) ?? [];
  const latest = results.at(-1);
  const lines = [
    traits[0] ? `Style dominant detecte: ${traits[0].toLowerCase()}.` : undefined,
    latest?.coachAnalysis?.dominantHookSource ? `Source hook principale: ${latest.coachAnalysis.dominantHookSource}.` : undefined,
    latest?.coachAnalysis?.detectedVideoFormat?.primary ? `Format reconnu: ${latest.coachAnalysis.patternLabel}.` : undefined,
    memory?.memory.learningSummary,
  ].filter(Boolean) as string[];
  return lines.length ? lines.slice(0, 4) : ['Viralynz calibre encore ton style createur avec chaque nouvelle analyse.'];
}

export function buildViralynzProgress(
  analyses: AnalysisRow[],
  memory?: StoredCreatorMemory | null,
): ViralynzProgressState {
  const rows = chronological(analyses);
  const results = rows.map((row) => row.result);
  const hasEnoughData = results.length >= 2;
  const { oldResults, recentResults } = splitOldRecent(results);
  const recent = recentResults.length ? recentResults : results;

  const metrics: ViralynzProgressMetric[] = hasEnoughData
    ? [
        metric('hook', 'Hook clarity', oldResults, recentResults, (result) => result.hook.score, 'Compare les hooks anciens aux analyses recentes.'),
        metric('retention', 'Retention', oldResults, recentResults, (result) => result.retention.score, 'Suit le risque de drop et la tenue apres ouverture.'),
        metric('cta', 'CTA', oldResults, recentResults, ctaScore, 'Mesure la clarte et la force des appels a l action.'),
        metric('repost', 'Repost', oldResults, recentResults, repostScore, 'Suit le potentiel de correction et de repost.'),
      ]
    : [
        { id: 'hook', label: 'Hook clarity', value: average(recent.map((result) => result.hook.score)), delta: 0, deltaLabel: 'learning', tone: 'learning', evidence: 'Ajoute une deuxieme analyse pour calculer une vraie progression.', confidence: 28 },
        { id: 'retention', label: 'Retention', value: average(recent.map((result) => result.retention.score)), delta: 0, deltaLabel: 'learning', tone: 'learning', evidence: 'Viralynz attend un avant/apres credible.', confidence: 28 },
        { id: 'cta', label: 'CTA', value: average(recent.map(ctaScore)), delta: 0, deltaLabel: 'learning', tone: 'learning', evidence: 'Le signal CTA se confirme avec plusieurs videos.', confidence: 28 },
        { id: 'repost', label: 'Repost', value: average(recent.map(repostScore)), delta: 0, deltaLabel: 'learning', tone: 'learning', evidence: 'Le potentiel repost devient plus fiable avec l historique.', confidence: 28 },
      ];

  const upCount = metrics.filter((item) => item.tone === 'up').length;
  const downCount = metrics.filter((item) => item.tone === 'down').length;
  const progressScore = hasEnoughData
    ? clamp(average(metrics.map((item) => item.value)) + upCount * 4 - downCount * 3)
    : clamp(18 + results.length * 16 + (memory?.sourceAnalysisCount ?? 0) * 4);

  return {
    hasEnoughData,
    analysisCount: results.length,
    progressScore,
    level: progressScore >= 82 ? 'Momentum avance' : progressScore >= 68 ? 'Progression active' : progressScore >= 46 ? 'Base en construction' : 'Calibration',
    streakLabel: results.length >= 7 ? '7 analyses recentes' : results.length >= 3 ? '3 analyses recentes' : results.length > 0 ? `${results.length} analyse recente` : 'Aucune analyse',
    momentumLabel: upCount >= 3 ? 'Momentum positif' : downCount >= 2 ? 'Attention aux regressions' : hasEnoughData ? 'Progression stable' : 'Memoire en apprentissage',
    dopamineLine: hasEnoughData
      ? upCount >= 2
        ? 'Tes derniers TikToks montrent deja une progression visible.'
        : 'La boucle est prete: analyse le prochain TikTok pour faire bouger tes scores.'
      : 'Analyse encore une video pour debloquer ton premier vrai avant/apres.',
    nextMilestone: results.length < 3 ? 'Atteindre 3 analyses pour confirmer les premiers patterns.' : 'Publier, analyser, puis comparer le prochain repost.',
    metrics,
    recurringPatterns: recurringPatterns(results, memory),
    nicheBenchmarks: buildBenchmarks(results, memory),
    styleEvolution: styleEvolution(results, memory),
  };
}
