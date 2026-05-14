import type { CtaAnalyzerResult, HookAnalyzerResult, RetentionAnalyzerResult, RepostStrategistResult, BrainInput } from './types';
import { confidenceLevel, diagnostic, evidence, score20, strictJsonContract } from './utils';

export const REPOST_STRATEGIST_PROMPT = strictJsonContract('repost_strategist', [
  'version',
  'orderedMoves',
  'repostPotential',
  'diagnostics',
  'confidence',
]);

export function buildRepostStrategy(
  input: BrainInput,
  hook: HookAnalyzerResult,
  retention: RetentionAnalyzerResult,
  cta: CtaAnalyzerResult,
): RepostStrategistResult {
  const niche = input.context.nicheLabel || input.context.niche || 'ce sujet';
  const hookVariant = hook.score <= 12
    ? `La preuve que ${niche} bloque avant meme que tu t'en rendes compte`
    : hook.detectedHook;
  const structure = [
    '0:00-0:02 - Montrer le resultat ou la preuve avant le contexte.',
    '0:02-0:05 - Nommer le probleme avec une phrase courte.',
    '0:05-0:10 - Donner un exemple concret ou un contraste visuel.',
    'Fin - Poser une question simple qui appelle une reponse.',
  ];
  const orderedMoves = [
    ...(hook.score <= 14 ? ['Remonter le payoff dans les deux premieres secondes'] : []),
    ...(retention.rhythm === 'slow' ? ['Ajouter un changement de plan avant 0:06'] : []),
    ...(cta.score <= 12 ? ['Remplacer le CTA generique par une question precise'] : []),
    'Garder une seule promesse principale dans le repost',
  ];
  const repostPotential = score20((20 - hook.score) * 0.35 + (20 - retention.score) * 0.25 + (20 - cta.score) * 0.2 + 8);
  const confidence = Math.min(0.9, (hook.confidence + retention.confidence + cta.confidence) / 3);
  const diagnostics = [];

  if (repostPotential >= 13) {
    diagnostics.push(diagnostic('repost_strategist', 'repost_high_leverage', {
      severity: 'important',
      title: 'Repost a fort levier',
      explanation: 'Le sujet semble recuperable avec un ordre plus direct et un CTA plus specifique.',
      timestamp: '0:00-fin',
      evidence: orderedMoves.slice(0, 2).join(' ; '),
      impact: 'Le gain vient surtout du packaging, pas d un changement de sujet.',
      fix: 'Tester la version repost structuree avant de produire un nouveau concept.',
      confidence,
    }));
  }

  return {
    module: 'repost_strategist',
    score: repostPotential,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    diagnostics,
    evidence: [
      evidence('hook_score_20', hook.score),
      evidence('retention_score_20', retention.score),
      evidence('cta_score_20', cta.score),
    ],
    fallbackUsed: false,
    version: {
      hook: hookVariant,
      structure,
      onScreenText: [
        hook.score <= 12 ? 'Le vrai probleme est ici' : 'Regarde ce detail',
        'Preuve avant explication',
        'Ton choix ?',
      ],
      cta: cta.optimizedCta,
      angle: retention.rhythm === 'slow'
        ? 'Repost plus tendu, preuve plus tot, moins de contexte au depart.'
        : 'Repost plus clair, avec un hook resserre et un CTA plus conversationnel.',
      hookVariants: [
        hookVariant,
        `Si tu fais ${niche}, verifie ce detail avant ton prochain post`,
        `Ton TikTok perd peut-etre les gens ici`,
      ],
      shortVersion: `${hookVariant}. Preuve en premier, explication ensuite, question claire a la fin.`,
      beforeAfter: {
        before: hook.detectedHook,
        after: hookVariant,
      },
    },
    orderedMoves,
    repostPotential,
  };
}
