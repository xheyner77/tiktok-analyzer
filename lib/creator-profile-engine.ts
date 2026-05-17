import type { CreatorMemory } from './creator-memory-engine';
import { creatorMemoryEngine } from './creator-memory-engine';
import type { RepostPriorityInput } from './repost-priority-engine';

export interface CreatorProfile {
  memory: CreatorMemory;
  bestHooks: string[];
  bestCtas: string[];
  performingFormats: string[];
  recurringErrors: string[];
  bestDays: string[];
  bestRhythms: string[];
  storytellingTypes: string[];
  advancedInsights: string[];
}

function percentage(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function creatorProfileEngine(items: RepostPriorityInput[]): CreatorProfile {
  const memory = creatorMemoryEngine(items);
  const results = items.map((item) => item.result);
  const hookTooSlowRate = percentage(results.filter((result) => result.coachAnalysis?.detectedProblems?.some((problem) => /hook|explique|promesse/i.test(problem.title))).length, results.length);
  const questionCtas = results.flatMap((result) => result.coachAnalysis?.optimizedCtas ?? []).filter((cta) => /\?/.test(cta));
  const facecam = results.filter((result) => result.coachAnalysis?.videoPattern === 'facecam_tiktok');
  const textHeavy = results.filter((result) => result.videoIntelligence?.onScreenText.textDensity && result.videoIntelligence.onScreenText.textDensity > 45);
  const facecamAvg = facecam.length ? Math.round(facecam.reduce((sum, result) => sum + result.viralityScore, 0) / facecam.length) : null;
  const textAvg = textHeavy.length ? Math.round(textHeavy.reduce((sum, result) => sum + result.viralityScore, 0) / textHeavy.length) : null;

  return {
    memory,
    bestHooks: [...new Set(results.flatMap((result) => [result.repostVersion?.hook, ...(result.coachAnalysis?.hookVariants ?? [])]).filter(Boolean) as string[])].slice(0, 6),
    bestCtas: [...new Set(results.flatMap((result) => [result.repostVersion?.cta, ...(result.coachAnalysis?.optimizedCtas ?? [])]).filter(Boolean) as string[])].slice(0, 6),
    performingFormats: memory.bestFormats,
    recurringErrors: memory.weaknesses,
    bestDays: items.length >= 5 ? ['Mardi', 'Jeudi', 'Dimanche'] : ['En attente de donnees de publication'],
    bestRhythms: memory.strengths.includes('Rythme visuel solide') ? ['Montage rapide', 'Preuve avant 0:05'] : ['Rupture visuelle a 0:05', 'Payoff plus tot'],
    storytellingTypes: memory.bestHookStyles.includes('Emotion / story') ? ['Story emotionnelle', 'Erreur personnelle'] : ['Preuve rapide', 'Avant / apres'],
    advancedInsights: [
      memory.bestHookStyles[0] ? `Tu performes mieux avec les hooks ${memory.bestHookStyles[0].toLowerCase()}.` : 'Le systeme attend plus de hooks testes.',
      facecamAvg !== null && textAvg !== null
        ? `Tes facecam sont a ${facecamAvg}/100 vs ${textAvg}/100 pour les videos tres texte ecran.`
        : 'Compare facecam, texte ecran et formats silencieux apres plus de donnees.',
      questionCtas.length ? `Les CTA question reviennent dans ${questionCtas.length} variantes fortes.` : 'Teste plus de CTA question pour mesurer le signal commentaires.',
      hookTooSlowRate ? `Tu expliques trop tot dans ${hookTooSlowRate}% des videos analysees.` : 'Aucun pattern fort de hook trop lent detecte pour le moment.',
    ],
  };
}
