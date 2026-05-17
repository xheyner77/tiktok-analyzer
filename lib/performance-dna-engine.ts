import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentBrain } from './content-brain-engine';

export interface PerformanceDNA {
  creatorDNA: string[];
  hookDNA: string[];
  contentDNA: string[];
  winningPatterns: string[];
  penaltyPatterns: string[];
  summary: string;
}

export function performanceDNAEngine(items: RepostPriorityInput[], brain: ContentBrain): PerformanceDNA {
  const top = [...items].sort((a, b) => b.result.viralityScore - a.result.viralityScore)[0];
  const longVideos = items.filter((item) => (item.result.detectedVideoMeta?.durationSec ?? item.result.videoIntelligence?.metadata.durationSec ?? 0) > 25);
  const questionCtas = items.filter((item) => /\?/.test(item.result.repostVersion?.cta ?? ''));

  return {
    creatorDNA: [
      top?.result.coachAnalysis?.patternLabel ? `Format fort: ${top.result.coachAnalysis.patternLabel}.` : 'Format fort en apprentissage.',
      questionCtas.length ? 'Les CTA questions sont un levier a pousser.' : 'CTA questions a tester davantage.',
      longVideos.length ? 'Surveiller les videos au-dessus de 25 secondes.' : 'Durees courtes compatibles avec ton profil actuel.',
    ],
    hookDNA: brain.patternLinks.filter((link) => link.to === 'hook_attention').slice(0, 4).map((link) => link.from),
    contentDNA: brain.winningStructures.length ? brain.winningStructures.slice(0, 5) : ['Preuve avant explication', 'Hook court', 'CTA question'],
    winningPatterns: brain.winningStructures.slice(0, 4),
    penaltyPatterns: brain.weakStructures.slice(0, 4),
    summary: top ? `Ton DNA actuel favorise ${top.result.coachAnalysis?.patternLabel ?? 'les formats clairs'} avec hooks courts et preuve rapide.` : 'Performance DNA pret, en attente de videos.',
  };
}
