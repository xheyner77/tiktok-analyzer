import type { HookAnalyzerResult, BrainInput } from './types';
import { confidenceLevel, diagnostic, evidence, from100To20, hasAny, normalizeText, scoreFromIssues, strictJsonContract } from './utils';

export const HOOK_ANALYZER_PROMPT = strictJsonContract('hook_analyzer', [
  'score',
  'detectedHook',
  'scrollRisk',
  'payoffTiming',
  'diagnostics',
  'corrections',
  'confidence',
]);

const promiseTerms = ['comment', 'pourquoi', 'voici', 'erreur', 'secret', 'avant', 'apres', 'apres', 'resultat', 'preuve'];
const tensionTerms = ['personne', 'jamais', 'stop', 'attends', 'grave', 'probleme', 'attention', 'faux', 'vrai'];
const payoffTerms = ['resultat', 'preuve', 'exemple', 'voila', 'regarde', 'avant/apres', 'avant apres'];

export function analyzeHook(input: BrainInput): HookAnalyzerResult {
  const firstWords = normalizeText(input.firstWords);
  const screenHook = normalizeText(input.onScreenText[0]);
  const hookSource = firstWords || screenHook || input.result.hook?.analysis || '';
  const hookWordCount = hookSource ? hookSource.split(/\s+/).length : 0;
  const fullText = `${firstWords} ${input.onScreenText.join(' ')}`.toLowerCase();
  const hasPromise = hasAny(fullText, promiseTerms);
  const hasTension = hasAny(fullText, tensionTerms);
  const hasQuestion = fullText.includes('?') || hasAny(fullText, ['pourquoi', 'comment', 'tu veux', 'est-ce']);
  const hasPayoff = hasAny(fullText, payoffTerms);
  const visualEnergy = input.videoIntelligence?.visualSignals.visualEnergy ?? 50;

  const penalties = [
    hookSource ? 0 : 6,
    hookWordCount > 18 ? 4 : 0,
    !hasPromise ? 3 : 0,
    !hasTension && !hasQuestion ? 3 : 0,
    !hasPayoff ? 2 : 0,
    visualEnergy < 38 ? 2 : 0,
  ];
  const bonuses = [hasQuestion ? 1 : 0, hasTension ? 1 : 0, screenHook ? 1 : 0];
  const score = scoreFromIssues(from100To20(input.result.hook?.score ?? input.result.viralityScore), penalties, bonuses);
  const confidence = Math.min(0.92, 0.38 + (firstWords ? 0.22 : 0) + (screenHook ? 0.18 : 0) + (input.videoIntelligence?.frames.sampled ? 0.14 : 0));

  const diagnostics = [];
  if (!hookSource) {
    diagnostics.push(diagnostic('hook_analyzer', 'hook_missing_signal', {
      severity: 'important',
      title: 'Hook difficile a identifier',
      explanation: 'Le transcript et le texte ecran ne donnent pas assez de signal pour isoler un hook clair.',
      timestamp: '0:00-0:03',
      evidence: 'Transcript ou texte ecran indisponible sur les premieres secondes.',
      impact: 'Le viewer risque de ne pas comprendre immediatement pourquoi rester.',
      fix: 'Ajouter une promesse visible ou verbale dans la premiere seconde.',
      confidence,
    }));
  }
  if (hookWordCount > 18) {
    diagnostics.push(diagnostic('hook_analyzer', 'hook_too_explanatory', {
      severity: 'critique',
      title: 'Hook trop explicatif',
      explanation: 'L ouverture donne du contexte avant de creer une tension claire.',
      timestamp: '0:00-0:03',
      evidence: `Le hook detecte contient environ ${hookWordCount} mots.`,
      impact: 'Le scroll risk augmente parce que la recompense arrive apres l explication.',
      fix: 'Commencer par le resultat, puis expliquer le contexte en deuxieme plan.',
      confidence,
    }));
  }
  if (!hasPayoff) {
    diagnostics.push(diagnostic('hook_analyzer', 'payoff_not_visible_early', {
      severity: 'important',
      title: 'Payoff pas assez visible',
      explanation: 'Les premiers signaux posent le sujet, mais ne montrent pas encore la recompense.',
      timestamp: '0:00-0:04',
      evidence: 'Aucun signal fort de preuve, resultat ou exemple dans l ouverture.',
      impact: 'Le viewer peut comprendre le theme sans avoir une raison forte de rester.',
      fix: 'Avancer la preuve, le resultat ou le contraste avant 0:03.',
      confidence: Math.max(0.35, confidence - 0.08),
    }));
  }

  return {
    module: 'hook_analyzer',
    score,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    diagnostics,
    evidence: [
      evidence('first_words', firstWords),
      evidence('first_frame_text', screenHook),
      evidence('hook_word_count', hookWordCount),
      evidence('visual_energy', visualEnergy),
    ],
    fallbackUsed: false,
    scrollRisk: score <= 9 ? 'high' : score <= 14 ? 'medium' : 'low',
    detectedHook: hookSource || 'Hook non detecte avec confiance',
    payoffTiming: hasPayoff ? 'early' : hookWordCount > 18 ? 'late' : 'unknown',
    corrections: [
      'Ouvrir sur le resultat ou la preuve avant le contexte.',
      'Raccourcir le hook a une phrase simple et concrete.',
      'Ajouter une tension visible dans le texte ecran.',
    ].slice(0, score <= 12 ? 3 : 2),
  };
}
