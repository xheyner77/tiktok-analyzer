import type { BrainInput, CtaAnalyzerResult } from './types';
import { confidenceLevel, diagnostic, evidence, from100To20, hasAny, scoreFromIssues, strictJsonContract } from './utils';

export const CTA_ANALYZER_PROMPT = strictJsonContract('cta_analyzer', [
  'score',
  'timing',
  'clarity',
  'engagementForce',
  'optimizedCta',
  'diagnostics',
  'confidence',
]);

const ctaTerms = ['commente', 'comment', 'abonne', 'partage', 'sauvegarde', 'clique', 'dm', 'lien', 'dis-moi', 'ecris'];
const strongCtaTerms = ['commente', 'dis-moi', 'ecris', 'tu veux', 'quel', 'laquelle', 'ton mot'];

export function analyzeCta(input: BrainInput): CtaAnalyzerResult {
  const text = `${input.transcript} ${input.onScreenText.join(' ')}`.toLowerCase();
  const hasCta = hasAny(text, ctaTerms) || Boolean(input.result.repostVersion?.cta);
  const hasStrongCta = hasAny(text, strongCtaTerms);
  const words = input.transcript.split(/\s+/).filter(Boolean);
  const ctaIndex = ctaTerms.map((term) => text.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
  const timing: CtaAnalyzerResult['timing'] = !hasCta
    ? 'missing'
    : ctaIndex < text.length * 0.35
      ? 'early'
      : ctaIndex < text.length * 0.72
        ? 'mid'
        : 'late';
  const clarity: CtaAnalyzerResult['clarity'] = !hasCta ? 'missing' : hasStrongCta ? 'clear' : 'generic';
  const penalties = [
    !hasCta ? 7 : 0,
    timing === 'early' ? 2 : 0,
    clarity === 'generic' ? 3 : 0,
    words.length < 18 && !input.onScreenText.length ? 2 : 0,
  ];
  const bonuses = [hasStrongCta ? 1 : 0, timing === 'late' ? 1 : 0];
  const score = scoreFromIssues(from100To20(55), penalties, bonuses);
  const confidence = Math.min(0.88, 0.34 + (input.transcript ? 0.28 : 0) + (input.onScreenText.length ? 0.14 : 0) + (input.result.repostVersion?.cta ? 0.12 : 0));
  const optimizedCta = input.context.objective === 'conversion'
    ? 'Commente "audit" et je te donne la version a tester.'
    : 'Tu veux la version courte ? Commente ton mot-cle.';

  const diagnostics = [];
  if (!hasCta || clarity === 'generic') {
    diagnostics.push(diagnostic('cta_analyzer', hasCta ? 'cta_too_generic' : 'cta_missing', {
      severity: hasCta ? 'optimisation' : 'important',
      title: hasCta ? 'CTA trop generique' : 'CTA absent ou trop discret',
      explanation: hasCta
        ? 'Le CTA demande une action, mais ne donne pas une raison precise de repondre.'
        : 'Aucun appel a l action clair n est detecte dans les signaux disponibles.',
      timestamp: timing === 'missing' ? 'fin' : timing,
      evidence: hasCta ? 'CTA detecte sans mecanique de reponse forte.' : 'Transcript et texte ecran sans verbe d action clair.',
      impact: 'La video peut retenir sans transformer cette attention en commentaire, clic ou abonnement.',
      fix: optimizedCta,
      confidence,
    }));
  }

  return {
    module: 'cta_analyzer',
    score,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    diagnostics,
    evidence: [
      evidence('cta_detected', hasCta),
      evidence('cta_timing', timing),
      evidence('cta_clarity', clarity),
    ],
    fallbackUsed: !input.transcript,
    timing,
    clarity,
    engagementForce: score >= 15 ? 'high' : score >= 10 ? 'medium' : 'low',
    optimizedCta,
  };
}
