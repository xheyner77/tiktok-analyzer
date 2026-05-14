import type { AnalysisResult, VideoPattern } from './types';
import type { RepostPriorityInput } from './repost-priority-engine';
import { rankRepostPriorities } from './repost-priority-engine';

export interface CreatorMemory {
  strengths: string[];
  weaknesses: string[];
  recurringPatterns: string[];
  bestFormats: string[];
  bestHookStyles: string[];
  styleTraits: Array<{
    label: string;
    evidence: string;
    strength: number;
  }>;
  detectedPatterns: Array<{
    insight: string;
    evidence: string;
    confidence: number;
  }>;
  evolution: Array<{
    label: string;
    before: string;
    after: string;
    delta: string;
    tone: 'up' | 'down' | 'stable';
  }>;
  bestPostingWindows: string[];
  flopSignals: string[];
  repostRecommendations: string[];
  strategyInsights: string[];
  learningSummary: string;
  signalsCount: number;
  creatorScore: number;
  consistencyScore: number;
  level: string;
  streakLabel: string;
}

const patternFallback: Record<VideoPattern, string> = {
  storytelling_lent: 'Storytelling',
  video_informative: 'Format conseil',
  facecam_tiktok: 'Facecam',
  playback_lipsync: 'Playback',
  motivation: 'Motivation',
  ecommerce: 'E-commerce',
  hook_agressif: 'Hook direct',
  video_preuve: 'Preuve',
  video_emotionnelle: 'Emotion',
  tutoriel: 'Tutoriel',
  demo_produit: 'Demo produit',
  avant_apres: 'Avant / apres',
  vlog_lifestyle: 'Lifestyle',
  gaming: 'Gaming',
  humour: 'Humour',
  sans_parole: 'Sans parole',
  montage_rapide: 'Montage rapide',
};

function clamp(value: number, min = 1, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function topCounts(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function topCountEntries(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function formatFor(result: AnalysisResult) {
  const pattern = result.coachAnalysis?.videoPattern;
  return result.coachAnalysis?.patternLabel ?? (pattern ? patternFallback[pattern] : undefined) ?? result.analyzerMeta?.nicheLabel ?? 'TikTok';
}

function weaknessFor(result: AnalysisResult) {
  return result.coachAnalysis?.detectedProblems?.[0]?.title
    ?? result.hook.weaknesses?.[0]
    ?? result.retention.weaknesses?.[0]
    ?? 'Promesse a clarifier';
}

function strengthFor(result: AnalysisResult) {
  if (result.hook.score >= result.retention.score && result.hook.score >= result.editing.score) return 'Hooks clairs';
  if (result.retention.score >= result.editing.score) return 'Retention exploitable';
  return 'Rythme visuel solide';
}

function hookStyleFor(result: AnalysisResult) {
  const text = [
    result.repostVersion?.hook,
    ...(result.coachAnalysis?.hookVariants ?? []),
    ...(result.coachAnalysis?.hookSources?.map((source) => source.type) ?? []),
  ].join(' ').toLowerCase();
  if (/preuve|resultat|test|avant/i.test(text)) return 'Preuve rapide';
  if (/erreur|stop|jamais|personne/i.test(text)) return 'Tension directe';
  if (/pourquoi|comment|\?/i.test(text)) return 'Question ouverte';
  if (/emotion|peur|honte|fier|story/i.test(text)) return 'Emotion / story';
  return result.hook.score >= 72 ? 'Hook court' : 'Hook a raccourcir';
}

function ctaStyleFor(result: AnalysisResult) {
  const text = [
    result.repostVersion?.cta,
    ...(result.coachAnalysis?.optimizedCtas ?? []),
    ...(result.improvements ?? []).map((item) => item.tip),
  ].join(' ').toLowerCase();
  if (/comment|question|\?/.test(text)) return 'CTA question';
  if (/mot|plan|hook|guide|dm/.test(text)) return 'CTA mot-cle';
  if (/clique|lien|bio|acheter/.test(text)) return 'CTA action';
  return (result.coachAnalysis?.subScores.cta ?? result.viralityScore) >= 68 ? 'CTA clair' : 'CTA a renforcer';
}

function averageDropSecond(results: AnalysisResult[], pick: 'early' | 'late') {
  const values = results
    .map((result) => result.coachAnalysis?.timeline?.find((marker) => marker.type === 'drop')?.time)
    .map((time) => {
      const match = time?.match(/(\d+)/);
      return match ? Number(match[1]) : undefined;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length) return average(values);
  const avgRetention = average(results.map((result) => result.retention.score));
  const base = avgRetention >= 72 ? 7 : avgRetention >= 58 ? 5 : 4;
  return pick === 'late' ? base : Math.max(3, base - 2);
}

function formatDelta(value: number, suffix = '%') {
  if (value > 0) return `+${value}${suffix}`;
  if (value < 0) return `${value}${suffix}`;
  return `0${suffix}`;
}

function splitOldRecent(results: AnalysisResult[]) {
  if (results.length < 4) return { oldResults: results.slice(0, 1), recentResults: results.slice(-1) };
  const midpoint = Math.floor(results.length / 2);
  return { oldResults: results.slice(0, midpoint), recentResults: results.slice(midpoint) };
}

function buildEvolution(results: AnalysisResult[]): CreatorMemory['evolution'] {
  if (!results.length) return [];
  const chronological = [...results].reverse();
  const { oldResults, recentResults } = splitOldRecent(chronological);
  const oldHook = average(oldResults.map((result) => result.hook.score));
  const newHook = average(recentResults.map((result) => result.hook.score));
  const oldRetention = average(oldResults.map((result) => result.retention.score));
  const newRetention = average(recentResults.map((result) => result.retention.score));
  const oldCta = average(oldResults.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore));
  const newCta = average(recentResults.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore));
  const oldDrop = averageDropSecond(oldResults, 'early');
  const newDrop = averageDropSecond(recentResults, 'late');
  return [
    {
      label: 'Drop moyen',
      before: `0:0${Math.min(9, oldDrop)}`,
      after: `0:0${Math.min(9, newDrop)}`,
      delta: newDrop > oldDrop ? `+${newDrop - oldDrop}s` : `${newDrop - oldDrop}s`,
      tone: newDrop > oldDrop ? 'up' : newDrop < oldDrop ? 'down' : 'stable',
    },
    {
      label: 'Hook retention',
      before: `${oldHook}/100`,
      after: `${newHook}/100`,
      delta: formatDelta(newHook - oldHook),
      tone: newHook > oldHook ? 'up' : newHook < oldHook ? 'down' : 'stable',
    },
    {
      label: 'Watch time estime',
      before: `${oldRetention}/100`,
      after: `${newRetention}/100`,
      delta: formatDelta(newRetention - oldRetention),
      tone: newRetention > oldRetention ? 'up' : newRetention < oldRetention ? 'down' : 'stable',
    },
    {
      label: 'CTA engagement',
      before: `${oldCta}/100`,
      after: `${newCta}/100`,
      delta: formatDelta(newCta - oldCta),
      tone: newCta > oldCta ? 'up' : newCta < oldCta ? 'down' : 'stable',
    },
  ];
}

function buildStyleTraits(results: AnalysisResult[], formats: string[], hookStyles: string[]): CreatorMemory['styleTraits'] {
  const ctaStyles = topCountEntries(results.map(ctaStyleFor), 2);
  const formatEntries = topCountEntries(results.map(formatFor), 3);
  const hookEntries = topCountEntries(results.map(hookStyleFor), 3);
  const avgEditing = average(results.map((result) => result.editing.score));
  const traits = [
    ...hookEntries.map((entry) => ({
      label: entry.value,
      evidence: `${entry.count} analyse${entry.count > 1 ? 's' : ''} avec ce type d'ouverture.`,
      strength: clamp(54 + entry.count * 12),
    })),
    ...formatEntries.map((entry) => ({
      label: entry.value,
      evidence: `${entry.count} video${entry.count > 1 ? 's' : ''} dans ce format dominant.`,
      strength: clamp(52 + entry.count * 11),
    })),
    ...ctaStyles.map((entry) => ({
      label: entry.value,
      evidence: entry.value.includes('question') ? 'Tes fins cherchent surtout la reponse en commentaire.' : 'Signal repere dans tes fins et recommandations.',
      strength: clamp(50 + entry.count * 12),
    })),
    {
      label: avgEditing >= 72 ? 'Montage rapide' : avgEditing >= 58 ? 'Montage cadence' : 'Montage a densifier',
      evidence: avgEditing >= 72 ? 'Tes analyses gardent un rythme visuel solide.' : 'Le rythme revient comme levier de progression.',
      strength: clamp(avgEditing),
    },
  ];
  return topCounts(traits.map((trait) => trait.label), 8)
    .map((label) => traits.find((trait) => trait.label === label))
    .filter((trait): trait is CreatorMemory['styleTraits'][number] => Boolean(trait))
    .slice(0, 6);
}

function buildDetectedPatterns(results: AnalysisResult[], weaknesses: string[], hookStyles: string[]): CreatorMemory['detectedPatterns'] {
  const avgHook = average(results.map((result) => result.hook.score));
  const avgRetention = average(results.map((result) => result.retention.score));
  const avgEditing = average(results.map((result) => result.editing.score));
  const avgCta = average(results.map((result) => result.coachAnalysis?.subScores.cta ?? result.viralityScore));
  const hasEarlyProof = results.filter((result) => {
    const text = [
      result.repostVersion?.hook,
      result.coachAnalysis?.openingAnalysis?.recommendedAction,
      result.coachAnalysis?.openingAnalysis?.recommendedFirstFrame,
      ...(result.coachAnalysis?.benchmarks?.map((item) => item.insight) ?? []),
    ].join(' ').toLowerCase();
    return /preuve|resultat|payoff|avant 0:0?3|0:03/.test(text);
  }).length;

  return [
    {
      insight: hasEarlyProof
        ? 'Les videos avec preuve avant 0:03 retiennent mieux chez toi.'
        : 'Quand la promesse arrive avant le contexte, ton score de hook monte plus vite.',
      evidence: hasEarlyProof ? `${hasEarlyProof} analyse${hasEarlyProof > 1 ? 's' : ''} mentionnent preuve ou payoff avance.` : `Score hook moyen ${avgHook}/100.`,
      confidence: clamp(48 + results.length * 8 + Math.max(0, avgHook - 55) * 0.35),
    },
    {
      insight: weaknesses[0]
        ? `${weaknesses[0]} revient assez souvent pour devenir ton premier levier.`
        : 'Les intros longues creent souvent un drop avant que la valeur soit claire.',
      evidence: weaknesses[0] ? 'Probleme recurrent extrait de tes diagnostics Viralynz.' : `Retention moyenne ${avgRetention}/100.`,
      confidence: clamp(50 + results.length * 9),
    },
    {
      insight: avgCta < 66
        ? 'Les CTA places trop tard transforment moins bien ton attention en commentaires.'
        : 'Tes CTA deviennent plus clairs quand ils posent une question simple.',
      evidence: `Signal CTA moyen ${avgCta}/100.`,
      confidence: clamp(46 + results.length * 7 + Math.max(0, 70 - avgCta) * 0.25),
    },
    {
      insight: avgEditing >= 68
        ? 'Les cuts rapides augmentent ta retention quand ils servent la preuve.'
        : 'Ton prochain gain de retention vient probablement de cuts plus rapproches.',
      evidence: `Rythme moyen ${avgEditing}/100, compare aux drops detectes.`,
      confidence: clamp(44 + results.length * 8 + Math.max(0, avgEditing - 50) * 0.25),
    },
    {
      insight: hookStyles[0]
        ? `Ton angle ${hookStyles[0].toLowerCase()} est celui que Viralynz reconnait le plus vite chez toi.`
        : 'Viralynz attend encore quelques analyses pour confirmer ton angle dominant.',
      evidence: hookStyles[0] ? 'Base sur tes hooks recommandes et variantes generees.' : 'Memoire en phase de calibration.',
      confidence: clamp(38 + results.length * 9),
    },
  ].slice(0, 5);
}

export function buildCreatorMemory(items: RepostPriorityInput[]): CreatorMemory {
  const results = items.map((item) => item.result);
  const realCount = results.length;
  const avgScore = average(results.map((result) => result.viralityScore));
  const avgHook = average(results.map((result) => result.hook.score));
  const avgRetention = average(results.map((result) => result.retention.score));
  const ranked = rankRepostPriorities(items);
  const formats = topCounts(results.map(formatFor), 4);
  const weaknesses = topCounts(results.map(weaknessFor), 4);
  const strengths = topCounts(results.map(strengthFor), 4);
  const hookStyles = topCounts(results.map(hookStyleFor), 4);
  const styleTraits = buildStyleTraits(results, formats, hookStyles);
  const detectedPatterns = buildDetectedPatterns(results, weaknesses, hookStyles);
  const evolution = buildEvolution(results);
  const creatorScore = clamp(avgScore * 0.42 + avgHook * 0.28 + avgRetention * 0.3);
  const consistencyScore = clamp(100 - Math.min(42, Math.max(...results.map((result) => Math.abs(result.viralityScore - avgScore)), 0) * 1.4));
  const level = creatorScore >= 82 ? 'Systeme avance' : creatorScore >= 68 ? 'Croissance active' : creatorScore >= 52 ? 'Base exploitable' : 'Fondations a renforcer';

  return {
    strengths: strengths.length ? strengths : ['Sujet exploitable'],
    weaknesses: weaknesses.length ? weaknesses : ['Hook a rendre plus direct'],
    recurringPatterns: topCounts([
      ...results.flatMap((result) => result.coachAnalysis?.memory?.recurrentWeaknesses ?? []),
      ...weaknesses,
      ...formats,
    ], 5),
    bestFormats: formats,
    bestHookStyles: hookStyles,
    styleTraits,
    detectedPatterns,
    evolution,
    bestPostingWindows: realCount >= 3 ? ['Tester 11h-13h', 'Retester 18h-20h'] : ['Connecter plus de donnees avant recommandation horaire'],
    flopSignals: topCounts(results.filter((result) => result.viralityScore < avgScore || result.retention.score < 58).map(weaknessFor), 3),
    repostRecommendations: ranked.slice(0, 3).map((item) => item.recommendedFix),
    strategyInsights: [
      avgHook >= avgRetention ? 'Tes ouvertures portent mieux que la retention: avance le payoff plus tot.' : 'Ta retention peut devenir ton avantage: rends le hook plus court pour capter plus vite.',
      hookStyles[0] ? `Angle a pousser cette semaine: ${hookStyles[0].toLowerCase()}.` : 'Tester trois angles de hook avant de publier.',
      weaknesses[0] ? `Pattern a corriger: ${weaknesses[0].toLowerCase()}.` : 'Priorite: rendre le CTA plus conversationnel.',
    ],
    learningSummary: realCount >= 4
      ? `Viralynz a assez de signaux pour comparer tes ouvertures, tes drops et tes CTA. Le systeme reconnait surtout ${hookStyles[0]?.toLowerCase() ?? 'tes hooks'} et ${formats[0]?.toLowerCase() ?? 'ton format dominant'}.`
      : realCount >= 2
        ? `Memoire en calibration: Viralynz commence a relier tes hooks, tes formats et tes moments de drop. Analyse encore ${4 - realCount} video${4 - realCount > 1 ? 's' : ''} pour confirmer les tendances.`
        : 'Memoire en initialisation: chaque analyse ajoute des signaux sur ton hook, ton rythme, ta retention et ton CTA.',
    signalsCount: realCount * 4
      + results.filter((result) => result.coachAnalysis?.timeline?.length).length
      + results.filter((result) => result.videoIntelligence?.confidence.signalsUsed.length).length,
    creatorScore,
    consistencyScore,
    level,
    streakLabel: realCount >= 7 ? '7 analyses recentes' : realCount >= 3 ? '3 analyses recentes' : realCount > 0 ? `${realCount} analyse recente` : 'Memoire en initialisation',
  };
}

export function creatorMemoryEngine(items: RepostPriorityInput[]): CreatorMemory {
  return buildCreatorMemory(items);
}
