import type {
  AnalysisResult,
  AnalysisConfidence,
  CoachAnalysis,
  DetectedVideoFormat,
  DiagnosticItem,
  DiagnosticSeverity,
  DetailedScoreItem,
  HookSourceAnalysis,
  HookSourceType,
  OpeningAnalysis,
  RepostVersion,
  ScoreBreakdownItem,
  TikTokBenchmark,
  TimelineMarker,
  TranscriptAnalysis,
  VideoSegmentAnalysis,
  VideoPattern,
  ViralSubScores,
  ViralynzMemory,
  VideoIntelligenceResult,
} from './types';
import { runViralynzBrain } from './viralynz-brain';
import { mergeTechnicalDiagnostics } from './proprietary-video-engine';
import { buildAnalysisExplainability } from './explainability-engine';

export interface AnalysisEngineContext {
  objective?: string;
  objectiveLabel?: string;
  niche?: string;
  nicheLabel?: string;
  fileName?: string;
  durationSec?: number;
  caption?: string;
  transcript?: string;
  videoIntelligence?: VideoIntelligenceResult;
  previousAnalyses?: AnalysisResult[];
  creatorMemoryContext?: string;
}

interface TranscriptSignals {
  available: boolean;
  firstWords: string;
  wordCount: number;
  hookWordCount: number;
  avgWordsPerSentence: number;
  hasQuestion: boolean;
  hasCta: boolean;
  hasPromise: boolean;
  hasPayoff: boolean;
  hasPatternInterrupt: boolean;
  repetitionRate: number;
  energyScore: number;
  overloadRisk: boolean;
  confusionRisk: boolean;
  mentalFriction: number;
  weakWords: string[];
  strongWords: string[];
}

const weights: Record<keyof ViralSubScores, number> = {
  hook: 0.22,
  retention: 0.18,
  clarity: 0.14,
  tension: 0.14,
  cta: 0.1,
  repostPotential: 0.1,
  engagementPotential: 0.07,
  rewatchPotential: 0.05,
};

const patternLabels: Record<VideoPattern, string> = {
  storytelling_lent: 'Storytelling lent',
  video_informative: 'Vidéo informative',
  facecam_tiktok: 'Facecam TikTok',
  playback_lipsync: 'Playback / lip sync',
  motivation: 'Motivation',
  ecommerce: 'E-commerce / produit',
  hook_agressif: 'Hook agressif',
  video_preuve: 'Vidéo preuve',
  video_emotionnelle: 'Vidéo émotionnelle',
  tutoriel: 'Tutoriel',
  demo_produit: 'Démo produit',
  avant_apres: 'Avant / après',
  vlog_lifestyle: 'Vlog lifestyle',
  gaming: 'Gaming',
  humour: 'Humour',
  sans_parole: 'Vidéo sans parole',
  montage_rapide: 'Montage rapide',
};

function clamp(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function hasText(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export function cleanOcrForUserDisplay(rawText?: string): { text?: string; quality: 'faible' | 'moyenne' | 'bonne' } {
  if (!rawText) return { quality: 'faible' };
  const normalized = rawText
    .replace(/[|_[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalized.match(/[\p{L}\p{N}'’]+/gu) ?? [];
  const cleanedWords: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    const previous = cleanedWords[cleanedWords.length - 1]?.toLowerCase();
    if (lower.length <= 1) continue;
    if (lower === previous) continue;
    if (lower.length <= 4 && cleanedWords.some((item) => item.toLowerCase() === lower)) continue;
    if (cleanedWords.filter((item) => item.toLowerCase() === lower).length >= 2) continue;
    cleanedWords.push(word);
    if (cleanedWords.length >= 9) break;
  }
  const shortRate = cleanedWords.length ? cleanedWords.filter((word) => word.length <= 2).length / cleanedWords.length : 1;
  const quality = cleanedWords.length >= 4 && shortRate < 0.35 ? 'bonne' : cleanedWords.length >= 3 && shortRate < 0.55 ? 'moyenne' : 'faible';
  if (quality === 'faible') return { text: cleanedWords.length >= 2 ? 'Texte écran partiellement détecté' : undefined, quality };
  return { text: cleanedWords.join(' '), quality };
}

function firstWeakness(result: AnalysisResult, key: 'hook' | 'editing' | 'retention') {
  return result[key]?.weaknesses?.[0] ?? '';
}

function transcriptSignals(context: AnalysisEngineContext, result: AnalysisResult): TranscriptSignals {
  const source = [
    context.videoIntelligence?.transcript.text,
    context.transcript,
    context.caption,
    result.detectedVideoMeta?.caption,
  ].filter(Boolean).join(' ');
  const clean = source.replace(/\s+/g, ' ').trim();
  const words = clean.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) ?? [];
  const sentences = clean.split(/[.!?。！？\n]+/).map((item) => item.trim()).filter(Boolean);
  const firstWords = words.slice(0, 14).join(' ');
  const unique = new Set(words);
  const repetitionRate = words.length ? 1 - unique.size / words.length : 0;
  const energyTerms = ['stop', 'erreur', 'jamais', 'personne', 'attention', 'grave', 'choquant', 'preuve', 'résultat', 'regarde', 'arrête', 'détruit', 'trop tard'];
  const frictionTerms = ['en fait', 'aujourd’hui', 'je vais', 'on va parler', 'petit', 'rapidement', 'du coup', 'voilà'];
  const ctaTerms = ['commente', 'écris', 'clique', 'enregistre', 'partage', 'abonne', 'réponds', 'dis-moi'];
  const promiseTerms = ['tu vas', 'voici', 'voilà', 'résultat', 'gagner', 'éviter', 'apprendre', 'comprendre', 'solution', 'preuve'];
  const payoffTerms = ['résultat', 'preuve', 'solution', 'avant après', 'avant/après', 'la raison', 'le problème', 'la réponse'];

  const avgWordsPerSentence = sentences.length ? words.length / sentences.length : words.length;
  const lower = clean.toLowerCase();
  const strongWords = energyTerms.filter((term) => lower.includes(term));
  const weakWords = frictionTerms.filter((term) => lower.includes(term));
  const energyHits = strongWords.length;
  const frictionHits = weakWords.length;

  return {
    available: clean.length > 0,
    firstWords,
    wordCount: words.length,
    hookWordCount: Math.min(words.length, firstWords ? firstWords.split(/\s+/).length : 0),
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    hasQuestion: /\?|\b(pourquoi|comment|qui|quoi|tu penses|vous pensez|t'as déjà|vous avez déjà)\b/i.test(clean),
    hasCta: ctaTerms.some((term) => clean.toLowerCase().includes(term)),
    hasPromise: promiseTerms.some((term) => lower.includes(term)),
    hasPayoff: payoffTerms.some((term) => lower.includes(term)),
    hasPatternInterrupt: /\b(stop|attends|regarde|non|erreur|personne|voilà pourquoi|preuve|alerte)\b/i.test(clean),
    repetitionRate: Math.round(repetitionRate * 100) / 100,
    energyScore: clamp(45 + energyHits * 10 - frictionHits * 5),
    overloadRisk: avgWordsPerSentence > 18 || words.length > 95,
    confusionRisk: frictionHits >= 2 || (words.length > 45 && energyHits === 0),
    mentalFriction: clamp(35 + frictionHits * 12 + (avgWordsPerSentence > 18 ? 14 : 0) + (repetitionRate > 0.38 ? 10 : 0) - energyHits * 4),
    weakWords,
    strongWords,
  };
}

type FormatCandidateScore = { format: VideoPattern; score: number; reasons: string[]; signals: string[]; contradictions: string[] };
type FormatDetectionSignals = {
  text: string;
  hasTranscript: boolean;
  wordCount: number;
  faceDetected: boolean;
  facecamLikely: boolean;
  cutRhythm: 'faible' | 'moyen' | 'élevé' | 'unknown';
  visualEnergy: number;
  ocrAvailable: boolean;
  objective?: string;
  niche?: string;
  hookScore: number;
  retentionScore: number;
  editingScore: number;
  avgWordsPerSentence: number;
};

const formatDetectionMatrix: Record<VideoPattern, {
  strong: string[];
  weak: string[];
  threshold: number;
  secondary: VideoPattern[];
  contradictions?: Array<(signals: FormatDetectionSignals) => string | null>;
}> = {
  facecam_tiktok: { strong: ['facecam', 'visage', 'coach', 'conseil'], weak: ['parle', 'astuce', 'créateur'], threshold: 48, secondary: ['video_informative', 'motivation', 'sans_parole'], contradictions: [(s) => !s.faceDetected && !s.facecamLikely ? 'Aucun signal visage pour confirmer la facecam.' : null] },
  playback_lipsync: { strong: ['lip sync', 'lipsync', 'playback', 'son tendance', 'audio tendance', 'pov'], weak: ['quand', 'moi quand', 'situation'], threshold: 44, secondary: ['humour', 'sans_parole'], contradictions: [(s) => s.wordCount > 45 ? 'Transcript trop dense pour un playback classique.' : null] },
  ecommerce: { strong: ['e-commerce', 'ecommerce', 'produit', 'shop', 'commande', 'prix', 'client', 'acheter'], weak: ['vente', 'clic', 'panier', 'boutique'], threshold: 46, secondary: ['demo_produit', 'video_preuve'] },
  demo_produit: { strong: ['démo', 'demo', 'j’ai testé', 'testé', 'test produit'], weak: ['produit', 'fonctionne', 'montre', 'preuve'], threshold: 46, secondary: ['ecommerce', 'video_preuve'] },
  humour: { strong: ['humour', 'drôle', 'sketch', 'meme', 'blague', 'punchline'], weak: ['pov', 'quand', 'setup', 'chute'], threshold: 44, secondary: ['playback_lipsync', 'montage_rapide'] },
  vlog_lifestyle: { strong: ['vlog', 'routine', 'journée', 'lifestyle', 'ma vie'], weak: ['matin', 'soir', 'coulisses', 'storytime'], threshold: 42, secondary: ['storytelling_lent', 'video_emotionnelle'] },
  gaming: { strong: ['gaming', 'gameplay', 'rank', 'partie', 'build', 'boss', 'fps', 'fortnite', 'minecraft', 'roblox'], weak: ['level', 'kill', 'game', 'joueur'], threshold: 46, secondary: ['humour', 'montage_rapide'] },
  motivation: { strong: ['motivation', 'discipline', 'mental', 'mindset', 'sport', 'réussite'], weak: ['arrête', 'tu dois', 'chaque jour'], threshold: 42, secondary: ['video_emotionnelle', 'facecam_tiktok'] },
  storytelling_lent: { strong: ['histoire', 'story', 'storytime', 'j’ai perdu', 'un jour', 'j’ai compris'], weak: ['erreur', 'avant', 'après', 'finalement'], threshold: 42, secondary: ['video_emotionnelle', 'vlog_lifestyle'] },
  tutoriel: { strong: ['tuto', 'tutoriel', 'comment faire', 'étape', 'guide', 'recette'], weak: ['voici', 'méthode', 'checklist', 'solution'], threshold: 46, secondary: ['video_informative', 'demo_produit'] },
  avant_apres: { strong: ['avant/après', 'avant apres', 'transformation', 'avant après'], weak: ['résultat', 'changement', 'progression'], threshold: 46, secondary: ['video_preuve', 'motivation'] },
  video_preuve: { strong: ['preuve', 'résultat', 'cas client', 'j’ai testé', 'testé', 'screenshot'], weak: ['montre', 'voici', 'ça marche'], threshold: 43, secondary: ['demo_produit', 'avant_apres'] },
  sans_parole: { strong: ['sans parole', 'no talking', 'asmr'], weak: ['texte écran', 'regarde', 'vu'], threshold: 40, secondary: ['playback_lipsync', 'montage_rapide'], contradictions: [(s) => s.wordCount > 12 ? 'Transcript trop présent pour confirmer une vidéo sans parole.' : null, (s) => s.faceDetected || s.facecamLikely ? 'Présence facecam détectée : format sans parole possible mais secondaire.' : null] },
  montage_rapide: { strong: ['montage rapide', 'transition', 'edit', 'cuts'], weak: ['rapide', 'compilation', 'best of'], threshold: 40, secondary: ['gaming', 'humour'] },
  hook_agressif: { strong: ['stop', 'arrête', 'erreur', 'personne', 'attention'], weak: ['jamais', 'grave', 'détruit'], threshold: 38, secondary: ['facecam_tiktok', 'video_informative'] },
  video_emotionnelle: { strong: ['émotion', 'triste', 'peur', 'honte', 'fier', 'j’ai pleuré'], weak: ['touché', 'vécu', 'mal'], threshold: 38, secondary: ['storytelling_lent', 'motivation'] },
  video_informative: { strong: ['astuce', 'conseil', 'apprendre', 'comprendre', 'voici pourquoi'], weak: ['info', 'méthode', 'erreur', 'solution'], threshold: 34, secondary: ['tutoriel', 'facecam_tiktok'] },
};

function keywordHits(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term));
}

export function scoreFormatCandidate(format: VideoPattern, signals: FormatDetectionSignals): FormatCandidateScore {
  const matrix = formatDetectionMatrix[format];
  const strongHits = keywordHits(signals.text, matrix.strong);
  const weakHits = keywordHits(signals.text, matrix.weak);
  const contradictions = matrix.contradictions?.map((fn) => fn(signals)).filter(Boolean) as string[] | undefined;
  let score = strongHits.length * 22 + weakHits.length * 8 - (contradictions?.length ?? 0) * 12;
  const reasons: string[] = [];
  const used: string[] = [];
  if (strongHits.length) { reasons.push(`Signaux forts : ${strongHits.slice(0, 3).join(', ')}.`); used.push('keywords_forts'); }
  if (weakHits.length) { reasons.push(`Signaux faibles : ${weakHits.slice(0, 3).join(', ')}.`); used.push('keywords_faibles'); }
  if (format === 'facecam_tiktok' && (signals.faceDetected || signals.facecamLikely)) { score += signals.hasTranscript ? 30 : 50; reasons.push('Facecam/personne probable détectée.'); used.push('face_detection'); }
  if (format === 'sans_parole' && !signals.hasTranscript && signals.visualEnergy > 0) { score += 42; reasons.push('Frames disponibles avec transcript absent ou très court.'); used.push('frames_without_transcript'); }
  if (format === 'montage_rapide' && signals.cutRhythm === 'élevé') { score += 24; reasons.push('Rythme visuel élevé détecté.'); used.push('cut_rhythm'); }
  if ((format === 'gaming' || format === 'humour') && signals.cutRhythm === 'élevé') { score += 8; reasons.push('Rythme rapide compatible avec le format.'); used.push('cut_rhythm'); }
  if ((format === 'ecommerce' || format === 'demo_produit') && (signals.objective === 'clicks' || signals.niche?.includes('commerce'))) { score += 10; reasons.push('Objectif/niche compatible vente ou produit.'); used.push('objective_niche'); }
  if (format === 'hook_agressif' && signals.hookScore >= 78 && signals.retentionScore < 68) { score += 18; reasons.push('Hook fort mais rétention plus faible.'); used.push('scores'); }
  if (format === 'video_emotionnelle' && signals.retentionScore >= 72 && signals.hookScore < 62) { score += 18; reasons.push('Rétention correcte malgré hook plus faible.'); used.push('scores'); }
  return { format, score: Math.max(0, score), reasons, signals: Array.from(new Set(used)), contradictions: contradictions ?? [] };
}

export function detectVideoFormatFromSignals(signals: FormatDetectionSignals): DetectedVideoFormat {
  const ranked = (Object.keys(formatDetectionMatrix) as VideoPattern[])
    .map((format) => scoreFormatCandidate(format, signals))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) ranked.push({ format: 'video_informative', score: 24, reasons: ['Format informatif probable par défaut.'], signals: ['fallback'], contradictions: [] });
  const primary = ranked[0];
  const second = ranked[1];
  const threshold = formatDetectionMatrix[primary.format].threshold;
  const ambiguous = primary.score < threshold || !!(second && primary.score - second.score <= 9);
  const rawConfidence = clamp(primary.score + (ambiguous ? -10 : 14) + (signals.hasTranscript ? 8 : 0) + (signals.ocrAvailable ? 7 : 0) + (signals.visualEnergy > 0 ? 5 : 0));
  const confidence = !signals.hasTranscript && (primary.format === 'facecam_tiktok' || signals.faceDetected || signals.facecamLikely)
    ? Math.min(69, rawConfidence)
    : rawConfidence;

  return {
    primary: ambiguous ? 'autre_ambigu' : primary.format,
    secondary: ranked.slice(ambiguous ? 0 : 1, ambiguous ? 3 : 4).map((item) => item.format),
    confidence,
    level: confidence >= 74 && !ambiguous ? 'élevée' : confidence >= 52 ? 'moyenne' : 'faible',
    reasons: primary.reasons.length ? primary.reasons : ['Format probable estimé depuis signaux faibles.'],
    signalsUsed: Array.from(new Set(ranked.flatMap((item) => item.signals))).slice(0, 5),
    limitations: [
      ...(ambiguous ? ['Format probable ambigu : analyse hybride et recommandations prudentes.'] : []),
      ...ranked.slice(0, 2).flatMap((item) => item.contradictions),
    ],
  };
}

function detectVideoFormat(context: AnalysisEngineContext, result: AnalysisResult, signals: TranscriptSignals): DetectedVideoFormat {
  const vi = context.videoIntelligence;
  const text = `${context.nicheLabel ?? ''} ${context.caption ?? ''} ${context.transcript ?? ''} ${vi?.transcript.text ?? ''} ${vi?.onScreenText.text.join(' ') ?? ''} ${result.hook?.analysis ?? ''}`.toLowerCase();
  return detectVideoFormatFromSignals({
    text,
    hasTranscript: signals.available && signals.wordCount >= 8,
    wordCount: signals.wordCount,
    faceDetected: vi?.visualSignals.facePresence === 'detected',
    facecamLikely: !!vi?.visualSignals.facecamLikely,
    cutRhythm: vi?.visualSignals.cutRhythm ?? 'unknown',
    visualEnergy: vi?.visualSignals.visualEnergy ?? 0,
    ocrAvailable: !!vi?.onScreenText.available,
    objective: context.objective,
    niche: `${context.niche ?? ''} ${context.nicheLabel ?? ''}`.toLowerCase(),
    hookScore: result.hook.score,
    retentionScore: result.retention.score,
    editingScore: result.editing.score,
    avgWordsPerSentence: signals.avgWordsPerSentence,
  });
}

export function buildFormatSpecificRecommendations(format: VideoPattern | 'autre_ambigu') {
  const formatKey = format === 'autre_ambigu' ? 'video_informative' : format;
  return {
    secondaryFormats: formatDetectionMatrix[formatKey].secondary,
    threshold: formatDetectionMatrix[formatKey].threshold,
    note: format === 'autre_ambigu'
      ? 'Analyse hybride : Viralynz évite de surpondérer un format incertain.'
      : `Analyse adaptée au format ${patternLabels[formatKey]}.`,
  };
}

function detectPattern(context: AnalysisEngineContext, result: AnalysisResult, signals: TranscriptSignals): VideoPattern {
  const detected = detectVideoFormat(context, result, signals);
  return detected.primary === 'autre_ambigu' ? (detected.secondary[0] ?? 'video_informative') : detected.primary;
}

function scoreFromSignals(result: AnalysisResult, signals: TranscriptSignals): ViralSubScores {
  const hook = clamp(result.hook?.score ?? result.viralityScore);
  const retention = clamp(result.retention?.score ?? result.viralityScore);
  const rhythm = clamp(result.editing?.score ?? result.viralityScore);
  const allWeaknesses = [
    ...(result.hook?.weaknesses ?? []),
    ...(result.editing?.weaknesses ?? []),
    ...(result.retention?.weaknesses ?? []),
    ...(result.improvements ?? []).map((item) => item.tip),
  ].join(' ');

  const hookLengthPenalty = signals.available && signals.hookWordCount > 11 ? 10 : 0;
  const clarityPenalty = (hasText(allWeaknesses, ['promesse', 'clair', 'contexte', 'comprend', 'bénéfice']) ? 14 : 4) + (signals.overloadRisk ? 8 : 0) + (signals.confusionRisk ? 7 : 0);
  const tensionPenalty = (hasText(allWeaknesses, ['tension', 'curiosité', 'open loop', 'boucle', 'choc']) ? 16 : 5) + (!signals.hasPatternInterrupt ? 5 : 0);
  const ctaPenalty = (hasText(allWeaknesses, ['cta', 'comment', 'question', 'fin']) ? 22 : 8) + (!signals.hasCta && !signals.hasQuestion ? 8 : 0);
  const interruptPenalty = hasText(allWeaknesses, ['pattern interrupt', 'rupture', 'zoom', 'cut', 'statique']) || !signals.hasPatternInterrupt ? 12 : 3;

  const clarity = clamp((hook * 0.42 + retention * 0.28 + rhythm * 0.3) - clarityPenalty);
  const tension = clamp((hook * 0.52 + retention * 0.28 + rhythm * 0.2 + signals.energyScore * 0.08) - tensionPenalty - hookLengthPenalty);
  const cta = clamp((result.viralityScore * 0.55 + retention * 0.25 + hook * 0.2) - ctaPenalty);
  const repostPotential = clamp(58 + (100 - hook) * 0.23 + (100 - rhythm) * 0.14 + (interruptPenalty > 8 ? 8 : 0));
  const engagementPotential = clamp(cta + (hasText(allWeaknesses, ['commentaire', 'question']) ? 10 : 2));
  const rewatchPotential = clamp(retention + (hasText(allWeaknesses, ['preuve', 'payoff', 'révélation']) ? 8 : 0) - interruptPenalty / 2 - (signals.overloadRisk ? 4 : 0));

  return { hook: clamp(hook - hookLengthPenalty), retention: clamp(retention - (signals.overloadRisk ? 5 : 0)), clarity, tension, cta, repostPotential, engagementPotential, rewatchPotential };
}

function weightedScore(subScores: ViralSubScores) {
  return clamp((Object.keys(weights) as Array<keyof ViralSubScores>).reduce((sum, key) => sum + subScores[key] * weights[key], 0));
}

function weightsForPattern(pattern: VideoPattern): Record<keyof ViralSubScores, number> {
  const custom: Partial<Record<VideoPattern, Partial<Record<keyof ViralSubScores, number>>>> = {
    facecam_tiktok: { hook: 0.24, clarity: 0.16, tension: 0.16, retention: 0.15, cta: 0.1, repostPotential: 0.08, engagementPotential: 0.07, rewatchPotential: 0.04 },
    playback_lipsync: { hook: 0.18, retention: 0.2, clarity: 0.14, tension: 0.14, cta: 0.07, repostPotential: 0.1, engagementPotential: 0.07, rewatchPotential: 0.1 },
    sans_parole: { hook: 0.16, retention: 0.18, clarity: 0.18, tension: 0.13, cta: 0.08, repostPotential: 0.12, engagementPotential: 0.05, rewatchPotential: 0.1 },
    ecommerce: { hook: 0.17, retention: 0.13, clarity: 0.17, tension: 0.08, cta: 0.15, repostPotential: 0.14, engagementPotential: 0.08, rewatchPotential: 0.08 },
    demo_produit: { hook: 0.16, retention: 0.13, clarity: 0.18, tension: 0.08, cta: 0.14, repostPotential: 0.15, engagementPotential: 0.08, rewatchPotential: 0.08 },
    tutoriel: { hook: 0.18, retention: 0.16, clarity: 0.22, tension: 0.08, cta: 0.08, repostPotential: 0.12, engagementPotential: 0.05, rewatchPotential: 0.11 },
    storytelling_lent: { hook: 0.2, retention: 0.16, clarity: 0.1, tension: 0.22, cta: 0.07, repostPotential: 0.1, engagementPotential: 0.05, rewatchPotential: 0.1 },
    gaming: { hook: 0.18, retention: 0.2, clarity: 0.09, tension: 0.13, cta: 0.07, repostPotential: 0.09, engagementPotential: 0.08, rewatchPotential: 0.16 },
    humour: { hook: 0.18, retention: 0.19, clarity: 0.08, tension: 0.16, cta: 0.07, repostPotential: 0.08, engagementPotential: 0.08, rewatchPotential: 0.16 },
  };
  return { ...weights, ...(custom[pattern] ?? {}) };
}

function weightedScoreForPattern(subScores: ViralSubScores, pattern: VideoPattern) {
  const patternWeights = weightsForPattern(pattern);
  return clamp((Object.keys(patternWeights) as Array<keyof ViralSubScores>).reduce((sum, key) => sum + subScores[key] * patternWeights[key], 0));
}

function verdictFor(score: number, subScores: ViralSubScores, repostRecommended: boolean) {
  if (score >= 82 && repostRecommended) return 'Fort potentiel de rétention estimé, reconstruction recommandée avec un hook plus direct';
  if (score >= 78) return 'Fort potentiel de rétention estimé';
  if (subScores.hook < 55 && subScores.retention >= 68) return 'Hook faible mais bonne structure';
  if (subScores.repostPotential >= 74) return 'Vidéo récupérable avec un meilleur packaging';
  if (score >= 60) return 'Très bon sujet mais exécution à resserrer';
  if (score >= 42) return 'Potentiel limité tant que le hook ne crée pas de tension';
  return 'Repost déconseillé sans refonte des 5 premières secondes';
}

function diagnostic(
  severity: DiagnosticSeverity,
  id: string,
  title: string,
  explanation: string,
  action: string,
  timecode?: string
): DiagnosticItem {
  return {
    id,
    severity,
    title,
    explanation,
    impact: severity === 'critique' ? 'Impact direct sur la distribution initiale' : severity === 'important' ? 'Impact visible sur la rétention' : 'Gain marginal mais utile',
    action,
    timecode,
  };
}

function buildDiagnostics(result: AnalysisResult, subScores: ViralSubScores, signals: TranscriptSignals): DiagnosticItem[] {
  const items: DiagnosticItem[] = [];
  const hookWeakness = firstWeakness(result, 'hook');
  const retentionWeakness = firstWeakness(result, 'retention');
  const editingWeakness = firstWeakness(result, 'editing');
  const joined = `${hookWeakness} ${retentionWeakness} ${editingWeakness} ${(result.improvements ?? []).map((item) => item.tip).join(' ')}`;

  if (!signals.available || signals.wordCount < 8) {
    items.push(diagnostic(
      'important',
      'visual_hook_required',
      'Hook porté par le visuel',
      "Sans transcript fiable, Viralynz évalue surtout le texte écran, la première frame et le rythme visuel. La première seconde doit donc être comprise sans son.",
      "Ajoute un texte écran ultra court et montre le résultat, le problème ou une rupture visuelle immédiatement.",
      '0:00'
    ));
  }

  if (subScores.hook < 68) {
    items.push(diagnostic(
      'critique',
      'hook_too_slow',
      'Hook trop lent',
      !signals.available
        ? "L’ouverture visible ne crée pas encore assez de tension : le viewer doit comprendre l’enjeu avant de lire ou écouter la suite."
        : signals.hookWordCount > 11
        ? "Le hook met trop de mots avant la récompense : le cerveau comprend le sujet, mais pas pourquoi rester."
        : "Le hook explique avant de créer la curiosité : les viewers quittent avant de comprendre pourquoi regarder.",
      "Ouvre avec une phrase brute de 3 à 6 mots : erreur, regret, preuve ou contradiction.",
      '0:00'
    ));
  }
  if (subScores.clarity < 64 || hasText(joined, ['promesse', 'bénéfice', 'clair'])) {
    items.push(diagnostic(
      'critique',
      'promise_unclear',
      'Promesse pas assez claire',
      signals.confusionRisk
        ? "Le wording crée de la friction mentale : trop de préparation avant la promesse émotionnelle."
        : "La valeur arrive trop tard : l’audience comprend le sujet, mais pas le gain immédiat.",
      "Ajoute un texte écran qui annonce le bénéfice concret avant le contexte.",
      '0:01'
    ));
  }
  if (signals.overloadRisk) {
    items.push(diagnostic(
      'important',
      'information_overload',
      'Surcharge d’information',
      "Les phrases demandent trop d’effort : le viewer doit traiter l’idée au lieu de ressentir l’enjeu.",
      "Coupe les phrases longues en punchlines courtes et garde une seule idée par plan.",
      '0:04'
    ));
  }
  if (subScores.tension < 65 || hasText(joined, ['curiosité', 'open loop', 'boucle'])) {
    items.push(diagnostic(
      'important',
      'missing_open_loop',
      'Manque de boucle ouverte',
      "La vidéo ne donne pas assez de raison émotionnelle de rester jusqu’au payoff.",
      "Pose une tension claire : “le problème, c’est que…” puis retarde la solution de quelques secondes.",
      '0:03'
    ));
  }
  if (signals.available && !signals.hasPatternInterrupt) {
    items.push(diagnostic(
      'important',
      'weak_pattern_interrupt_wording',
      'Aucun stop d’ouverture',
      "Le signal d’ouverture ne contient pas de rupture forte : rien ne force le cerveau à sortir du scroll automatique.",
      'Ajoute un signal brutal au début : “stop”, “erreur”, “personne te dit ça” ou “voilà pourquoi”.',
      '0:00'
    ));
  }
  if (hasText(joined, ['statique', 'rupture', 'zoom', 'cut', 'pattern interrupt']) || result.editing.score < 64) {
    items.push(diagnostic(
      'important',
      'missing_pattern_interrupt',
      'Pattern interrupt absent',
      "Le rythme visuel reste trop stable : le cerveau du viewer anticipe la suite et swipe.",
      'Ajoute un zoom, un cut brutal, un changement de cadrage ou une stat choc vers 0:05.',
      '0:05'
    ));
  }
  if (subScores.cta < 62) {
    items.push(diagnostic(
      'important',
      'weak_cta',
      'CTA trop faible',
      signals.hasQuestion
        ? "La question existe, mais elle n’est pas assez simple ou polarisante pour déclencher une réponse rapide."
        : "La fin ne donne pas une action simple à faire : elle ne déclenche ni commentaire ni clic.",
      'Termine par une question binaire ou un mot-clé à commenter.',
      'fin'
    ));
  }
  if (subScores.rewatchPotential < 62) {
    items.push(diagnostic(
      'optimisation',
      'weak_payoff',
      'Payoff pas assez mémorable',
      "La vidéo donne l’information, mais pas de moment que l’on veut revoir ou partager.",
      'Place la preuve, le résultat ou le twist plus tôt et rends-le visuel.',
      '0:08'
    ));
  }

  if (!items.length) {
    items.push(diagnostic(
      'optimisation',
      'tighten_repost',
      'Optimisation de packaging',
      'La base est solide : le gain vient surtout d’un hook plus court et d’un CTA plus spécifique.',
      'Teste trois hooks avec la même vidéo et garde celui qui crée le plus de tension.'
    ));
  }

  return items.slice(0, 6);
}

function buildBenchmarks(context: AnalysisEngineContext, pattern: VideoPattern): TikTokBenchmark[] {
  const niche = context.nicheLabel || 'ta niche';
  const byPattern: Record<VideoPattern, TikTokBenchmark> = {
    storytelling_lent: { label: 'Storytelling', insight: 'Les récits courts semblent plus lisibles quand la tension arrive avant le contexte.', delta: 'signal rétention' },
    video_informative: { label: 'Éducation', insight: `Les vidéos ${niche} gagnent en clarté avec une promesse visible sous 2 secondes.`, delta: 'signal clarté' },
    facecam_tiktok: { label: 'Facecam', insight: 'Les facecams avec changement de cadrage à 0:05 peuvent limiter le drop du milieu.', delta: 'signal rythme' },
    motivation: { label: 'Motivation', insight: 'Les vidéos motivationnelles gagnent en tension avec une phrase choc en première frame.', delta: 'signal engagement' },
    ecommerce: { label: 'Produit', insight: 'Les vidéos produit gagnent en clarté quand le problème client précède la feature.', delta: 'signal clic' },
    hook_agressif: { label: 'Hook fort', insight: 'Un hook agressif doit livrer une preuve rapide pour éviter la déception.', delta: 'signal rewatch' },
    video_preuve: { label: 'Preuve', insight: 'Les vidéos avec preuve avant 0:05 donnent plus vite une raison de rester.', delta: 'signal sauvegarde' },
    video_emotionnelle: { label: 'Émotion', insight: 'Les vidéos émotionnelles semblent plus lisibles avec une montée en tension progressive.', delta: 'signal rétention' },
    tutoriel: { label: 'Tutoriel', insight: 'Les tutoriels gagnent en clarté quand le résultat final est montré avant les étapes.', delta: 'signal complétion' },
    playback_lipsync: { label: 'Playback', insight: 'Les lip syncs gagnent en contexte quand le texte écran prépare la chute ou l’émotion.', delta: 'signal hook' },
    demo_produit: { label: 'Démo produit', insight: 'Les démos gagnent en clarté quand le problème client précède la fonctionnalité.', delta: 'signal clic' },
    avant_apres: { label: 'Avant / après', insight: 'Les transformations donnent plus vite une raison de rester quand l’après apparaît dès la première seconde.', delta: 'signal rewatch' },
    vlog_lifestyle: { label: 'Lifestyle', insight: 'Les vlogs courts retiennent mieux avec une tension claire plutôt qu’une simple chronologie.', delta: 'signal rétention' },
    gaming: { label: 'Gaming', insight: 'Les gameplays doivent annoncer le moment fort ou le fail avant la séquence.', delta: 'signal watch time' },
    humour: { label: 'Humour', insight: 'Les formats humour gagnent en rythme quand le setup est compressé et le payoff arrive vite.', delta: 'signal complétion' },
    sans_parole: { label: 'Sans parole', insight: 'Sans transcript clair, le texte écran doit porter la curiosité dès la première seconde.', delta: 'signal clarté' },
    montage_rapide: { label: 'Montage rapide', insight: 'Les montages rapides gagnent quand chaque cut ajoute une information nouvelle.', delta: 'signal rétention' },
  };

  return [
    byPattern[pattern],
    { label: 'Hook court', insight: 'Les hooks qui posent une tension en moins de 2 secondes clarifient la distribution initiale.', delta: 'signal reach' },
    { label: 'CTA question', insight: 'Les CTA sous forme de question directe donnent une action plus simple que les fins génériques.', delta: 'signal commentaires' },
  ];
}

function hookBase(context: AnalysisEngineContext) {
  const niche = context.nicheLabel || 'TikTok';
  if (context.objective === 'comments') return `PERSONNE NE RÉPOND À ÇA`;
  if (context.objective === 'retention') return `TU PERDS LES GENS ICI`;
  if (context.objective === 'clicks') return `TON CTA BLOQUE TOUT`;
  if (context.objective === 'repost') return `REPOSTE AVEC CET ANGLE`;
  if (context.objective === 'hook') return `TES 3 SECONDES TUENT TOUT`;
  if (niche.toLowerCase().includes('business')) return `TON BUSINESS RATE ÇA`;
  return `PERSONNE TE DIT ÇA`;
}

function buildHookSources(result: AnalysisResult, signals: TranscriptSignals, pattern: VideoPattern): HookSourceAnalysis[] {
  const sources: HookSourceAnalysis[] = [];
  if (signals.available) {
    sources.push({
      type: 'vocal',
      strength: clamp(result.hook.score - (signals.hookWordCount > 11 ? 12 : 0)),
      evidence: `Premiers mots détectés : “${signals.firstWords || 'non isolés'}”.`,
      recommendation: 'Raccourcir la première phrase et avancer la récompense.',
    });
  }
  sources.push(
    {
      type: 'visuel',
      strength: clamp(result.editing.score + (pattern === 'sans_parole' || pattern === 'montage_rapide' ? 10 : 0)),
      evidence: pattern === 'sans_parole' ? 'Analyse orientée signaux visuels faute de transcript exploitable.' : 'Score montage utilisé comme proxy visuel.',
      recommendation: 'Montrer le résultat, le problème ou une rupture de cadrage avant l’explication.',
    },
    {
      type: 'texte_ecran',
      strength: result.videoIntelligence?.onScreenText.available
        ? clamp((result.videoIntelligence.onScreenText.confidence * 0.55) + (100 - result.videoIntelligence.onScreenText.textDensity) * 0.18 + signals.energyScore * 0.25)
        : signals.available ? clamp(signals.energyScore + (signals.hasPatternInterrupt ? 8 : -5)) : 38,
      evidence: result.videoIntelligence?.onScreenText.dominantText
        ? `Texte écran détecté : “${cleanOcrForUserDisplay(result.videoIntelligence.onScreenText.dominantText).text ?? 'lecture partielle'}”.`
        : signals.strongWords.length ? `Mots forts détectés : ${signals.strongWords.slice(0, 3).join(', ')}.` : 'OCR texte écran indisponible ou illisible.',
      recommendation: result.videoIntelligence?.onScreenText.available
        ? 'Rendre le texte écran plus tendu, plus court et visible dès la première frame.'
        : 'Utiliser une phrase écran de 3 à 6 mots qui porte la curiosité seule.',
    },
    {
      type: 'curiosite',
      strength: clamp(result.hook.score + (signals.hasQuestion || signals.hasPromise ? 8 : -8)),
      evidence: signals.hasQuestion ? 'Question détectée dans le wording.' : 'Curiosité surtout déduite du score hook.',
      recommendation: 'Ouvrir une boucle claire et retarder la réponse de quelques secondes.',
    },
    {
      type: 'preuve',
      strength: clamp(result.retention.score + (signals.hasPayoff ? 10 : -10)),
      evidence: signals.hasPayoff ? 'Signal de preuve/payoff détecté.' : 'Payoff explicite non détecté dans les signaux disponibles.',
      recommendation: 'Afficher une preuve ou le résultat final avant 0:05.',
    },
  );

  return sources.sort((a, b) => b.strength - a.strength);
}

function dominantHookSource(sources: HookSourceAnalysis[]): HookSourceType {
  return sources[0]?.type ?? 'visuel';
}

function buildConfidence(context: AnalysisEngineContext, signals: TranscriptSignals, pattern: VideoPattern, sources: HookSourceAnalysis[]): AnalysisConfidence {
  if (context.videoIntelligence) {
    const vi = context.videoIntelligence;
    const hasTranscript = vi.transcript.available && !!vi.transcript.text;
    const hasOcr = vi.onScreenText.available;
    const facecamWithoutTranscript = vi.visualSignals.facecamLikely || vi.visualSignals.facePresence === 'detected' || pattern === 'facecam_tiktok';
    const visualOnlyCap = facecamWithoutTranscript ? 69 : pattern === 'sans_parole' || pattern === 'playback_lipsync' ? 74 : 69;
    const cappedScore = !hasTranscript && hasOcr
      ? Math.min(vi.confidence.score, visualOnlyCap)
      : !hasTranscript
        ? Math.min(vi.confidence.score, 58)
        : vi.confidence.score;
    const cappedLevel: AnalysisConfidence['level'] = cappedScore >= 74 ? 'élevée' : cappedScore >= 52 ? 'moyenne' : 'faible';
    return {
      score: cappedScore,
      level: cappedLevel,
      reasons: vi.confidence.signalsUsed.length
        ? vi.confidence.signalsUsed.map((signal) => `Signal utilisé : ${signal}.`)
        : ['Analyse basée sur les signaux structurels disponibles.'],
      limitations: [
        ...vi.limitations,
        ...(!hasTranscript && pattern === 'facecam_tiktok'
          ? ['Facecam probable sans transcript exploitable : confiance limitée, diagnostics sur le contenu audio désactivés.']
          : []),
        ...(cappedLevel === 'faible'
          ? ['Confiance faible : recommandations formulées prudemment, sans supposer de transcript ou OCR réel.']
          : []),
      ],
    };
  }

  const reasons: string[] = [];
  const limitations: string[] = [];
  let score = 42;

  if (signals.available && signals.wordCount >= 18) {
    score += 22;
    reasons.push('Transcript exploitable pour analyser hook vocal, CTA et rythme verbal.');
  } else {
    limitations.push('Transcript absent ou trop court : analyse plus prudente, orientée signaux visuels et structurels.');
  }
  if (typeof context.durationSec === 'number' && context.durationSec > 0) {
    score += 10;
    reasons.push(`Durée vidéo disponible (${Math.round(context.durationSec)}s).`);
  } else {
    limitations.push('Durée vidéo non fiable : segmentation temporelle estimée.');
  }
  if (context.caption || context.nicheLabel) {
    score += 8;
    reasons.push('Contexte niche/caption utilisé pour adapter les benchmarks.');
  }
  if (pattern !== 'video_informative') {
    score += 8;
    reasons.push(`Format détecté : ${patternLabels[pattern]}.`);
  } else {
    limitations.push('Format vidéo potentiellement ambigu.');
  }
  if (sources[0] && sources[1] && Math.abs(sources[0].strength - sources[1].strength) <= 8) {
    score -= 6;
    limitations.push('Plusieurs sources de hook proches : dominant estimé avec prudence.');
  }

  const finalScore = clamp(Math.min(92, score));
  return {
    score: finalScore,
    level: finalScore >= 76 ? 'élevée' : finalScore >= 55 ? 'moyenne' : 'faible',
    reasons: reasons.length ? reasons : ['Analyse basée sur les signaux structurels disponibles.'],
    limitations,
  };
}

function buildVideoSegments(pattern: VideoPattern, diagnostics: DiagnosticItem[], subScores: ViralSubScores, signals: TranscriptSignals): VideoSegmentAnalysis[] {
  const problemById = (ids: string[], fallback: string) =>
    diagnostics.find((item) => ids.some((id) => item.id.includes(id)))?.title ?? fallback;

  return [
    {
      range: '0-2s',
      role: !signals.available || pattern === 'sans_parole' ? 'Hook visuel / texte écran' : 'Hook vocal + promesse',
      tension: subScores.tension,
      clarity: subScores.clarity,
      dropRisk: clamp(100 - subScores.hook + (signals.hasPatternInterrupt ? -8 : 8)),
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['hook', 'promise'], signals.available ? 'Promesse à rendre plus immédiate' : 'Texte écran pas assez porteur'),
      recommendation: pattern === 'tutoriel' ? 'Montrer le résultat final avant de dire comment faire.' : 'Créer une tension lisible en une seule phrase ou image.',
    },
    {
      range: '2-5s',
      role: 'Preuve rapide ou clarification',
      tension: clamp(subScores.tension - 4),
      clarity: subScores.clarity,
      dropRisk: clamp(100 - subScores.clarity + (signals.overloadRisk ? 10 : 0)),
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['overload', 'open_loop'], 'Récompense viewer encore trop floue'),
      recommendation: 'Donner une preuve, un exemple ou un contraste avant d’ajouter du contexte.',
    },
    {
      range: '5-10s',
      role: 'Maintien du momentum',
      tension: clamp(subScores.tension - 8),
      clarity: clamp(subScores.clarity - (signals.overloadRisk ? 8 : 0)),
      dropRisk: clamp(100 - subScores.retention + 6),
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['pattern', 'tension'], 'Rythme à relancer'),
      recommendation: 'Ajouter un cut, une stat choc ou une rupture visuelle pour relancer l’attention.',
    },
    {
      range: '10-20s',
      role: pattern === 'storytelling_lent' ? 'Payoff narratif' : 'Explication utile',
      tension: clamp(subScores.tension - 10),
      clarity: subScores.clarity,
      dropRisk: clamp(100 - subScores.retention + (signals.avgWordsPerSentence > 18 ? 12 : 0)),
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['payoff'], 'Payoff à rendre plus visible'),
      recommendation: 'Faire arriver la récompense plus tôt ou transformer l’explication en exemple concret.',
    },
    {
      range: 'fin',
      role: 'CTA / boucle de commentaire',
      tension: subScores.engagementPotential,
      clarity: subScores.cta,
      dropRisk: clamp(100 - subScores.cta),
      rewatchPotential: clamp(subScores.rewatchPotential - 4),
      mainProblem: problemById(['cta'], 'Action finale à préciser'),
      recommendation: 'Finir sur une question simple ou un mot-clé à commenter, pas sur une conclusion molle.',
    },
  ];
}

function segmentText(value?: string, max = 82) {
  if (!value) return undefined;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}...` : cleaned;
}

function normalizedVisualRhythm(result?: AnalysisResult): VideoSegmentAnalysis['visualRhythm'] {
  const raw = String(result?.videoIntelligence?.visualSignals.cutRhythm ?? 'unknown').toLowerCase();
  if (raw.includes('lev') || raw === 'high') return 'eleve';
  if (raw.includes('moy') || raw === 'medium') return 'moyen';
  if (raw.includes('faib') || raw === 'low') return 'faible';
  return 'unknown';
}

function availableSegmentSignals(result: AnalysisResult | undefined, signals: TranscriptSignals) {
  return [
    signals.available ? 'transcript' : undefined,
    result?.videoIntelligence?.onScreenText.available ? 'ocr_texte_ecran' : undefined,
    result?.videoIntelligence?.frames.sampled ? 'frames' : undefined,
    result?.videoIntelligence?.visualSignals.available ? 'rythme_visuel' : undefined,
  ].filter(Boolean) as string[];
}

function buildSegmentedTimeline(pattern: VideoPattern, diagnostics: DiagnosticItem[], subScores: ViralSubScores, signals: TranscriptSignals, result?: AnalysisResult): VideoSegmentAnalysis[] {
  const problemById = (ids: string[], fallback: string) =>
    diagnostics.find((item) => ids.some((id) => item.id.includes(id)))?.title ?? fallback;
  const ocr = result?.videoIntelligence?.onScreenText;
  const firstScreenText = ocr?.available ? cleanOcrForUserDisplay(ocr.firstFrameText ?? ocr.dominantText).text : undefined;
  const dominantScreenText = ocr?.available ? cleanOcrForUserDisplay(ocr.dominantText ?? ocr.text[0]).text : undefined;
  const transcriptExcerpt = signals.available ? segmentText(signals.firstWords, 72) : undefined;
  const segmentSignals = availableSegmentSignals(result, signals);
  const visualRhythm = normalizedVisualRhythm(result);
  const visualEnergy = result?.videoIntelligence?.visualSignals.visualEnergy ?? subScores.retention;

  return [
    {
      range: '0-1s',
      role: !signals.available || pattern === 'sans_parole' ? 'Premiere frame / stop-scroll visuel' : 'Premiere phrase + promesse',
      signalsUsed: segmentSignals,
      onScreenText: segmentText(firstScreenText),
      transcriptExcerpt,
      tension: subScores.tension,
      clarity: subScores.clarity,
      dropRisk: clamp(100 - subScores.hook + (signals.hasPatternInterrupt ? -8 : 10)),
      visualRhythm,
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['hook', 'promise'], signals.available ? 'Promesse a rendre plus immediate' : 'Texte ecran pas assez porteur'),
      concreteCorrection: pattern === 'tutoriel' ? 'Ouvre par le resultat final en plein cadre.' : 'Remplace le contexte par une phrase courte orientee tension.',
      recommendation: pattern === 'tutoriel' ? 'Montrer le resultat final avant de dire comment faire.' : 'Creer une tension lisible en une seule phrase ou image.',
    },
    {
      range: '1-3s',
      role: 'Clarification de la promesse',
      signalsUsed: segmentSignals,
      onScreenText: segmentText(firstScreenText ?? dominantScreenText),
      transcriptExcerpt,
      tension: clamp(subScores.tension - 4),
      clarity: subScores.clarity,
      dropRisk: clamp(100 - subScores.clarity + (signals.overloadRisk ? 10 : 0)),
      visualRhythm,
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['overload', 'open_loop'], 'Recompense viewer encore trop floue'),
      concreteCorrection: 'Donne la preuve ou le benefice avant toute explication.',
      recommendation: 'Donner une preuve, un exemple ou un contraste avant d ajouter du contexte.',
    },
    {
      range: '3-5s',
      role: 'Preuve rapide / payoff initial',
      signalsUsed: segmentSignals,
      onScreenText: segmentText(dominantScreenText),
      transcriptExcerpt: signals.available ? segmentText(signals.firstWords, 54) : undefined,
      tension: clamp(subScores.tension - 6),
      clarity: clamp(subScores.clarity - (signals.overloadRisk ? 6 : 0)),
      dropRisk: clamp(100 - subScores.retention + (signals.hasPayoff ? -6 : 10)),
      visualRhythm,
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['payoff', 'pattern'], 'Preuve pas assez visible'),
      concreteCorrection: visualEnergy >= 70 ? 'Garde le mouvement mais rends le message plus simple.' : 'Ajoute un cut preuve ou une image resultat avant 0:05.',
      recommendation: 'Faire arriver une preuve, un exemple ou une rupture visuelle avant que le viewer anticipe la suite.',
    },
    {
      range: '5-10s',
      role: 'Maintien du momentum',
      signalsUsed: segmentSignals,
      onScreenText: segmentText(dominantScreenText),
      tension: clamp(subScores.tension - 8),
      clarity: clamp(subScores.clarity - (signals.overloadRisk ? 8 : 0)),
      dropRisk: clamp(100 - subScores.retention + 6),
      visualRhythm,
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['pattern', 'tension'], 'Rythme a relancer'),
      concreteCorrection: 'Insere un micro-reset : zoom, objection, stat ou changement de cadre.',
      recommendation: 'Ajouter un cut, une stat choc ou une rupture visuelle pour relancer l attention.',
    },
    {
      range: '10-20s',
      role: pattern === 'storytelling_lent' ? 'Payoff narratif' : 'Explication utile',
      signalsUsed: segmentSignals,
      onScreenText: segmentText(dominantScreenText),
      tension: clamp(subScores.tension - 10),
      clarity: subScores.clarity,
      dropRisk: clamp(100 - subScores.retention + (signals.avgWordsPerSentence > 18 ? 12 : 0)),
      visualRhythm,
      rewatchPotential: subScores.rewatchPotential,
      mainProblem: problemById(['payoff'], 'Payoff a rendre plus visible'),
      concreteCorrection: 'Transforme une explication en exemple concret ou avance la recompense.',
      recommendation: 'Faire arriver la recompense plus tot ou transformer l explication en exemple concret.',
    },
    {
      range: 'fin',
      role: 'CTA / boucle de commentaire',
      signalsUsed: segmentSignals,
      tension: subScores.engagementPotential,
      clarity: subScores.cta,
      dropRisk: clamp(100 - subScores.cta),
      visualRhythm,
      rewatchPotential: clamp(subScores.rewatchPotential - 4),
      mainProblem: problemById(['cta'], 'Action finale a preciser'),
      concreteCorrection: 'Termine par une question simple ou un mot-cle facile a commenter.',
      recommendation: 'Finir sur une question simple ou un mot-cle a commenter, pas sur une conclusion molle.',
    },
  ];
}

function screenTextDiagnostics(result: AnalysisResult): DiagnosticItem[] {
  const ocr = result.videoIntelligence?.onScreenText;
  if (!ocr?.available) return [];
  const text = `${cleanOcrForUserDisplay(ocr.dominantText).text ?? ''} ${cleanOcrForUserDisplay(ocr.firstFrameText).text ?? ''}`.toLowerCase();
  const items: DiagnosticItem[] = [];
  if (ocr.textDensity > 72) {
    items.push(diagnostic(
      'important',
      'screen_text_overload',
      'Texte écran trop dense',
      'Le texte écran contient trop d’information pour être compris en plein scroll.',
      'Réduis le texte à une phrase de 3 à 6 mots et garde le reste pour les cuts ou la suite.',
      '0:00'
    ));
  }
  if (text && !hasText(text, ['stop', 'erreur', 'pourquoi', 'personne', 'preuve', 'avant', 'après', 'regarde', 'secret', 'attention'])) {
    items.push(diagnostic(
      'optimisation',
      'screen_text_low_tension',
      'Texte écran peu tendu',
      'La promesse est visible, mais elle explique plus qu’elle ne crée de curiosité.',
      'Réécris le texte écran comme une tension : erreur, preuve, contradiction ou résultat.',
      '0:00'
    ));
  }
  if (ocr.firstFrameText && ocr.dominantText && ocr.firstFrameText !== ocr.dominantText) {
    items.push(diagnostic(
      'optimisation',
      'screen_hook_changes_early',
      'Hook écran instable',
      'Le texte écran change rapidement : le viewer peut perdre la promesse avant de l’avoir comprise.',
      'Garde le hook écran principal assez longtemps pour être lu sans pause.',
      '0:01'
    ));
  }
  return items;
}

function buildMultimodalFusion(result: AnalysisResult, signals: TranscriptSignals, pattern: VideoPattern, hookSources: HookSourceAnalysis[]) {
  const vi = result.videoIntelligence;
  const contradictions: string[] = [];
  const fusionSignals: string[] = [];
  const vocal = hookSources.find((item) => item.type === 'vocal')?.strength ?? 0;
  const screen = hookSources.find((item) => item.type === 'texte_ecran')?.strength ?? 0;
  const visual = hookSources.find((item) => item.type === 'visuel')?.strength ?? 0;

  if (signals.available) fusionSignals.push('hook vocal/transcript exploitable');
  if (vi?.onScreenText.available) fusionSignals.push(`texte écran détecté : "${cleanOcrForUserDisplay(vi.onScreenText.dominantText ?? vi.onScreenText.text[0]).text ?? 'lecture partielle'}"`);
  if (vi?.visualSignals.available) fusionSignals.push(`rythme visuel ${vi.visualSignals.cutRhythm}`);
  if (vi?.visualSignals.facecamLikely || vi?.visualSignals.facePresence === 'detected') fusionSignals.push('présence facecam/personne détectée');

  if (vi?.onScreenText.available && signals.available && Math.abs(screen - vocal) >= 22) {
    contradictions.push(screen > vocal
      ? 'Le texte écran porte mieux la curiosité que la voix : la voix risque de ralentir le hook.'
      : 'La voix porte le hook, mais le texte écran ne renforce pas assez la promesse.');
  }
  if (signals.available && (vi?.visualSignals.motionEstimate ?? 0) >= 72 && signals.energyScore < 58) {
    contradictions.push('Le rythme visuel est élevé, mais le wording manque de tension : la vidéo bouge sans créer assez de curiosité.');
  }
  if ((vi?.visualSignals.facecamLikely || pattern === 'facecam_tiktok') && signals.available && signals.energyScore < 60) {
    contradictions.push('Le format ressemble à une facecam, mais le hook parlé manque d’enjeu émotionnel.');
  }
  if ((vi?.visualSignals.facecamLikely || pattern === 'facecam_tiktok') && !signals.available) {
    contradictions.push('Facecam probable, mais transcript absent : l’analyse doit s’appuyer sur la première frame, le texte écran et le rythme visuel.');
  }
  if (vi?.onScreenText.available && vi.onScreenText.textDensity > 72) {
    contradictions.push('Le texte écran est détecté, mais sa densité peut ralentir la compréhension.');
  }

  if (vi?.onScreenText.available && (vi.visualSignals.visualEnergy ?? 0) < 45 && screen >= 66) {
    contradictions.push('Le texte ecran porte une promesse forte, mais le visuel reste trop faible pour soutenir le stop-scroll.');
  }
  if (vi?.visualSignals.available && (vi.visualSignals.motionEstimate ?? 0) >= 70 && signals.available && signals.mentalFriction >= 62) {
    contradictions.push('Le visuel est dynamique, mais le message demande trop d effort mental pour suivre le rythme.');
  }
  if (pattern === 'sans_parole' && !signals.available && !vi?.onScreenText.available) {
    contradictions.push('Format sans parole probable, mais texte ecran indisponible : le repost doit clarifier la promesse visuellement.');
  }
  if (vi?.visualSignals.available && String(vi.visualSignals.cutRhythm).toLowerCase().includes('lev') && !signals.hasPayoff) {
    contradictions.push('Le rythme est rapide, mais le payoff detecte reste faible : la video bouge plus vite que la recompense.');
  }

  const spread = Math.max(vocal, screen, visual) - Math.min(vocal || 100, screen || 100, visual || 100);
  const coherenceScore = clamp(82 - contradictions.length * 16 - Math.min(18, spread * 0.22) + (fusionSignals.length >= 3 ? 6 : 0));
  const level: 'forte' | 'moyenne' | 'faible' | 'contradictoire' =
    contradictions.length >= 2 ? 'contradictoire' : coherenceScore >= 76 ? 'forte' : coherenceScore >= 58 ? 'moyenne' : 'faible';
  return {
    coherenceScore,
    level,
    summary: contradictions[0] ?? 'Les signaux principaux vont dans le même sens : le repost doit surtout renforcer le hook et accélérer le payoff.',
    signals: fusionSignals,
    contradictions,
  };
}

function crossSignalDiagnostics(fusion: ReturnType<typeof buildMultimodalFusion>): DiagnosticItem[] {
  return fusion.contradictions.slice(0, 3).map((item, index) => diagnostic(
    index === 0 ? 'critique' : 'important',
    `cross_signal_${index + 1}`,
    index === 0 ? 'Signaux contradictoires' : 'Cohérence multimodale à renforcer',
    item,
    index === 0
      ? 'Aligne la première phrase, le texte écran et la première image autour de la même promesse.'
      : 'Supprime le signal le plus faible ou transforme-le pour soutenir le hook dominant.',
    index === 0 ? '0:00' : '0:03'
  ));
}

function buildDominantFailure(diagnostics: DiagnosticItem[], fusion: ReturnType<typeof buildMultimodalFusion>, result: AnalysisResult) {
  const primary = diagnostics[0];
  const evidence = [
    primary?.timecode ? `Moment : ${primary.timecode}` : undefined,
    fusion.contradictions[0],
    result.videoIntelligence?.onScreenText.dominantText ? `Texte écran : "${cleanOcrForUserDisplay(result.videoIntelligence.onScreenText.dominantText).text ?? 'lecture partielle'}"` : undefined,
    result.videoIntelligence?.visualSignals.cutRhythm ? `Rythme visuel : ${result.videoIntelligence.visualSignals.cutRhythm}` : undefined,
  ].filter(Boolean) as string[];
  return {
    title: primary?.title ?? 'Packaging trop prudent',
    cause: primary?.explanation ?? fusion.summary,
    evidence: evidence.length ? evidence : fusion.signals.slice(0, 3),
    estimatedImpact: primary?.severity === 'critique' ? 'Fort impact sur les 3 premières secondes' : 'Impact moyen sur la rétention',
    priorityFix: primary?.action ?? 'Réduire le hook, avancer la preuve et rendre le texte écran plus direct.',
  };
}

function buildBestOpportunity(pattern: VideoPattern, dominantSource: HookSourceType, result: AnalysisResult, diagnostics: DiagnosticItem[]) {
  const ocrText = result.videoIntelligence?.onScreenText.dominantText;
  if (pattern === 'tutoriel') {
    return { title: 'Montrer le résultat à 0:00', why: 'Le format tutoriel gagne en clarté quand le viewer voit la récompense avant les étapes.', action: 'Ouvre avec le résultat final, puis explique seulement après.', expectedLift: 'potentiel de complétion estimé' };
  }
  if (pattern === 'playback_lipsync') {
    return { title: 'Renforcer le contexte texte écran', why: 'En playback/lip sync, le viewer doit comprendre la situation avant que l’expression ou le son fasse effet.', action: 'Ouvre avec un texte écran court, puis fais arriver le payoff visuel sans explication.', expectedLift: 'potentiel de hook estimé' };
  }
  if (pattern === 'sans_parole' || dominantSource === 'texte_ecran') {
    return { title: 'Faire porter le repost par le texte écran', why: ocrText ? `Le texte détecté (“${cleanOcrForUserDisplay(ocrText).text ?? 'lecture partielle'}”) peut devenir le vrai hook.` : 'Sans transcript exploitable, le texte écran doit créer toute la curiosité.', action: 'Affiche une phrase de 3 à 6 mots dès la première frame et garde-la lisible.', expectedLift: 'potentiel de hook estimé' };
  }
  if (pattern === 'ecommerce' || pattern === 'demo_produit') {
    return { title: 'Transformer l’intro en preuve produit', why: 'Le viewer doit voir le problème ou le résultat avant les fonctionnalités.', action: 'Commence par le problème client visible, puis montre la démo.', expectedLift: 'potentiel de clic estimé' };
  }
  return { title: 'Avancer la preuve avant 0:05', why: diagnostics[0]?.title ?? 'Le payoff arrive trop tard pour justifier le watchtime.', action: 'Remplace l’explication par une preuve, un contraste ou une question directe.', expectedLift: 'potentiel de rétention estimé' };
}

function buildTranscriptAnalysis(signals: TranscriptSignals): TranscriptAnalysis {
  return {
    available: signals.available,
    firstPhrase: signals.firstWords || undefined,
    hookWordCount: signals.hookWordCount,
    avgWordsPerSentence: signals.avgWordsPerSentence,
    hasQuestion: signals.hasQuestion,
    hasCta: signals.hasCta,
    hasPromise: signals.hasPromise,
    hasPayoff: signals.hasPayoff,
    hasPatternInterrupt: signals.hasPatternInterrupt,
    repetitionRate: signals.repetitionRate,
    energyScore: signals.energyScore,
    mentalFriction: signals.mentalFriction,
    weakWords: signals.weakWords,
    strongWords: signals.strongWords,
  };
}

function repostStructureFor(pattern: VideoPattern) {
  if (pattern === 'sans_parole') {
    return [
      '0-1 sec : texte écran brutal + résultat visuel',
      '1-3 sec : zoom/cut sur le détail qui crée la curiosité',
      '3-7 sec : montrer le problème sans l’expliquer',
      '7-14 sec : preuve visuelle ou transformation',
      'fin : CTA visuel simple + mot-clé commentaire',
    ];
  }
  if (pattern === 'playback_lipsync') {
    return [
      '0-1 sec : contexte texte écran ultra clair',
      '1-3 sec : expression ou mouvement synchronisé avec le son',
      '3-7 sec : montée vers la chute, sans expliquer',
      '7-12 sec : payoff visuel ou émotionnel',
      'fin : CTA commentaire lié à la situation',
    ];
  }
  if (pattern === 'tutoriel') {
    return [
      '0-2 sec : résultat final en premier',
      '2-5 sec : erreur fréquente à éviter',
      '5-12 sec : étapes compressées',
      '12-18 sec : preuve que ça marche',
      'fin : “tu veux la checklist ?”',
    ];
  }
  if (pattern === 'demo_produit' || pattern === 'ecommerce') {
    return [
      '0-2 sec : problème client visible',
      '2-5 sec : preuve ou contraste avant/après',
      '5-12 sec : démo en action, pas de feature list',
      '12-18 sec : bénéfice concret',
      'fin : CTA clic ou commentaire sur le cas d’usage',
    ];
  }
  return [
    '0-2 sec : erreur ou conséquence directe',
    '2-5 sec : preuve visuelle ou phrase de tension',
    '5-12 sec : explication courte, sans contexte inutile',
    '12-20 sec : solution claire avec exemple',
    '20-25 sec : CTA question ou mot-clé commentaire',
  ];
}

function contentSeed(context: AnalysisEngineContext, result?: AnalysisResult) {
  const raw = [
    result?.videoIntelligence?.onScreenText.dominantText,
    result?.videoIntelligence?.onScreenText.firstFrameText,
    result?.videoIntelligence?.transcript.text,
    context.transcript,
    context.caption,
  ].filter(Boolean).join(' ');
  const clean = cleanOcrForUserDisplay(raw).text ?? '';
  const lower = clean.toLowerCase();

  if (/\bsdf|sans abri|sans-abri|gratuit|bio|paris|manger/i.test(lower)) {
    return {
      topic: 'aide SDF',
      hook: 'IL PENSAIT BIEN FAIRE',
      variants: [
        'IL PENSAIT BIEN FAIRE',
        'CE DÉTAIL CHANGE TOUT',
        'PERSONNE N’A VU ÇA',
        'IL VOULAIT AIDER UN SDF',
        'LE VRAI PROBLÈME EST AILLEURS',
      ],
      cta: 'Tu aurais fait quoi à sa place ?',
      screenText: 'Il pensait bien faire…',
      structure: [
        '0-2 sec : montre immédiatement le moment où il veut aider le SDF + texte écran “Il pensait bien faire…”',
        '2-5 sec : ajoute la contradiction : “mais tout le monde a raté ce détail”',
        '5-12 sec : explique le contexte en une seule phrase, sans intro longue',
        '12-20 sec : montre la conséquence ou la réaction la plus forte',
        'fin : demande “tu aurais fait quoi à sa place ?”',
      ],
    };
  }
  if (/\bhater|haineux|critique|humili/i.test(lower)) {
    return {
      topic: 'hater',
      hook: 'IL PENSAIT M’AVOIR HUMILIÉ',
      variants: [
        'IL PENSAIT M’AVOIR HUMILIÉ',
        'CE HATER A RATÉ UN DÉTAIL',
        'J’AI RÉPONDU SANS M’ÉNERVER',
        'IL M’A CRITIQUÉ TROP VITE',
        'REGARDE COMMENT JE L’AI RECADRÉ',
      ],
      cta: 'Tu aurais répondu quoi à ma place ?',
      screenText: 'Il a raté un détail',
      structure: [
        '0-2 sec : montre la critique ou la phrase du hater + texte écran “Il pensait m’avoir humilié”',
        '2-5 sec : montre le détail qu’il a raté',
        '5-12 sec : réponds en une phrase calme, sans justification longue',
        '12-20 sec : montre la preuve ou la contradiction',
        'fin : demande “tu aurais répondu quoi ?”',
      ],
    };
  }
  if (/\bproduit|client|commande|acheter|prix|boutique/i.test(lower)) {
    return {
      topic: 'produit',
      hook: 'CE PRODUIT RÈGLE ÇA',
      variants: ['CE PRODUIT RÈGLE ÇA', 'LE PROBLÈME QUE PERSONNE NE MONTRE', 'J’AI TESTÉ POUR VOIR', 'AVANT D’ACHETER, REGARDE ÇA', 'ÇA CHANGE TOUT SUR CE CAS'],
      cta: 'Tu veux voir le test complet ?',
      screenText: 'Le problème avant le produit',
      structure: undefined,
    };
  }
  if (/\berreur|rate|flop|détruit|trop tard/i.test(lower)) {
    return {
      topic: 'erreur',
      hook: 'J’AI COMPRIS ÇA TROP TARD',
      variants: ['J’AI COMPRIS ÇA TROP TARD', 'STOP DE FAIRE CETTE ERREUR', 'PERSONNE NE TE DIT ÇA', 'VOILÀ POURQUOI ÇA BLOQUE', 'CETTE ERREUR COÛTE CHER'],
      cta: 'Tu fais encore cette erreur ?',
      screenText: clean.length >= 8 ? clean.slice(0, 58) : 'L’erreur à voir tout de suite',
      structure: undefined,
    };
  }
  if (clean.length >= 12) {
    const words = clean.match(/[\p{L}\p{N}'’]+/gu)?.slice(0, 7).join(' ') ?? '';
    return {
      topic: words,
      hook: words.toUpperCase().slice(0, 42),
      variants: [
        words.toUpperCase().slice(0, 42),
        'REGARDE CE DÉTAIL',
        'PERSONNE NE VOIT ÇA',
        'LA PARTIE IMPORTANTE EST LÀ',
        'ATTENDS LA SUITE',
      ],
      cta: 'Tu avais remarqué ce détail ?',
      screenText: words.slice(0, 48),
    };
  }
  return undefined;
}

function buildRepost(context: AnalysisEngineContext, diagnostics: DiagnosticItem[], scoreBefore: number, scoreAfter: number, pattern: VideoPattern, dominantSource: HookSourceType, result?: AnalysisResult): RepostVersion {
  const screenHook = cleanOcrForUserDisplay(result?.videoIntelligence?.onScreenText.dominantText).text;
  const seed = contentSeed(context, result);
  const hook = seed?.hook ?? (pattern === 'sans_parole'
    ? screenHook ? `${screenHook.toUpperCase().slice(0, 42)}` : 'REGARDE CE DÉTAIL'
    : pattern === 'playback_lipsync'
      ? screenHook ? `${screenHook.toUpperCase().slice(0, 42)}` : 'PERSONNE S’Y ATTENDAIT'
    : dominantSource === 'texte_ecran' && screenHook
      ? `${screenHook.toUpperCase().slice(0, 42)}`
    : dominantSource === 'preuve'
      ? 'LA PREUVE EST LÀ'
      : hookBase(context));
  const niche = context.nicheLabel || 'ta niche';
  const mainProblem = diagnostics[0]?.title.toLowerCase() ?? 'hook trop lent';
  const hookVariants = seed?.variants ?? [
    hook,
    'REGARDE CE DÉTAIL',
    'PERSONNE NE VOIT ÇA',
    'J’AI COMPRIS ÇA TROP TARD',
    'ATTENDS LA SUITE',
  ];
  return {
    hook,
    hookVariants,
    structure: seed?.structure ?? repostStructureFor(pattern),
    onScreenText: [
      seed?.screenText ?? (screenHook ? `Reformule : ${screenHook}` : mainProblem),
      pattern === 'sans_parole' ? 'le détail que tu dois voir' : `Ce que l’audience ${niche} doit comprendre tout de suite`,
      `Avant ${scoreBefore}/100 → après ${scoreAfter}/100`,
    ],
    cta: seed?.cta ?? (pattern === 'sans_parole' ? 'Commente "VU" si tu l’as repéré.' : pattern === 'playback_lipsync' ? 'Commente “moi” si tu connais cette situation.' : 'Commente ton cas et je te donne l’angle à tester.'),
    angle: pattern === 'sans_parole'
      ? `Reposter en faisant porter la curiosité par le visuel : texte écran immédiat, preuve visuelle avant 0:05, CTA lisible sans son.`
      : pattern === 'playback_lipsync'
        ? `Reposter comme un format playback : le texte écran donne le contexte, l’expression porte l’émotion, le payoff arrive vite.`
      : `Transformer la vidéo en correction directe : partir du blocage principal (${mainProblem}), montrer la preuve, puis donner une action simple.`,
    shortVersion: `${hook} ${screenHook ? 'Garde le texte écran visible.' : 'Montre le problème en une phrase.'} Preuve avant 0:05. Termine par une question liée au sujet.`,
    beforeAfter: {
      before: 'Intro explicative, promesse tardive, CTA trop générique.',
      after: `Tension immédiate, preuve avant 0:05, CTA spécifique${seed?.topic ? ` autour de ${seed.topic}` : ''}.`,
    },
  };
}

function buildTimeline(diagnostics: DiagnosticItem[], subScores: ViralSubScores, signals: TranscriptSignals, result?: AnalysisResult): TimelineMarker[] {
  const hasHookIssue = diagnostics.some((item) => item.id === 'hook_too_slow');
  const hasPromiseIssue = diagnostics.some((item) => item.id === 'promise_unclear');
  const hasPatternIssue = diagnostics.some((item) => item.id === 'missing_pattern_interrupt');
  const hasPayoffIssue = diagnostics.some((item) => item.id === 'weak_payoff');
  const hasCtaIssue = diagnostics.some((item) => item.id === 'weak_cta');
  const screenText = result?.videoIntelligence?.onScreenText.available
    ? cleanOcrForUserDisplay(result.videoIntelligence.onScreenText.dominantText).text
    : undefined;
  const openingEvidence = signals.firstWords
    ? `Ouverture détectée : “${signals.firstWords}”. Trop de friction avant la récompense.`
    : screenText
      ? `Texte écran détecté : “${screenText}”. La promesse doit être plus courte et plus tendue.`
      : result?.videoIntelligence?.onScreenText.confidence && result.videoIntelligence.onScreenText.confidence < 45
        ? 'Ouverture texte détectée, lecture partielle : garde uniquement une phrase lisible et plus tendue.'
      : 'D’après les frames analysées, l’ouverture visible doit créer une tension plus immédiate.';

  return [
    {
      time: '0:00',
      type: 'hook',
      label: hasHookIssue ? 'Hook trop explicatif' : 'Hook détecté',
      insight: hasHookIssue
        ? openingEvidence
        : 'Le sujet est compréhensible, mais le packaging peut être plus tendu.',
      severity: hasHookIssue ? 'critique' : 'optimisation',
    },
    {
      time: '0:03',
      type: 'drop',
      label: hasPromiseIssue ? 'Drop probable' : 'Promesse comprise',
      insight: hasPromiseIssue
        ? 'Le viewer comprend le thème, pas encore la récompense émotionnelle.'
        : 'La promesse est assez claire pour maintenir l’attention initiale.',
      severity: hasPromiseIssue ? 'critique' : 'optimisation',
    },
    {
      time: '0:05',
      type: 'tension',
      label: hasPatternIssue ? 'Tension en baisse' : 'Rythme stable',
      insight: hasPatternIssue
        ? 'Un changement visuel ou une stat choc ici peut éviter le swipe.'
        : 'Le rythme tient, mais une rupture visuelle renforcerait la rétention.',
      severity: hasPatternIssue ? 'important' : 'optimisation',
    },
    {
      time: '0:08',
      type: 'rewatch',
      label: subScores.rewatchPotential >= 70 ? 'Rewatch potentiel' : 'Payoff à renforcer',
      insight: hasPayoffIssue
        ? 'Le payoff ne paraît pas encore assez mémorable pour provoquer un rewatch.'
        : 'La vidéo peut créer du rewatch si la preuve arrive plus tôt.',
      severity: hasPayoffIssue ? 'optimisation' : 'important',
    },
    {
      time: 'fin',
      type: 'cta',
      label: hasCtaIssue ? 'CTA faible' : 'CTA à préciser',
      insight: hasCtaIssue
        ? 'La fin doit demander une action simple, idéalement une question ou un mot-clé.'
        : 'Le CTA peut transformer plus de viewers passifs en commentaires.',
      severity: hasCtaIssue ? 'important' : 'optimisation',
    },
  ];
}

function buildScoreBreakdown(subScores: ViralSubScores, diagnostics: DiagnosticItem[]): ScoreBreakdownItem[] {
  const reasons: Record<keyof ViralSubScores, string> = {
    hook: diagnostics.some((item) => item.id === 'hook_too_slow')
      ? 'Les premières secondes donnent trop de contexte avant la curiosité.'
      : 'Le hook pose une intention claire, mais peut être plus court.',
    retention: 'Mesure la capacité de la vidéo à garder l’attention après l’ouverture.',
    clarity: diagnostics.some((item) => item.id === 'promise_unclear')
      ? 'La promesse arrive après le sujet, ce qui retarde la compréhension de la valeur.'
      : 'Le message reste lisible, avec une marge sur le bénéfice écran.',
    tension: diagnostics.some((item) => item.id === 'missing_open_loop')
      ? 'La boucle ouverte n’est pas assez forte pour pousser à attendre la réponse.'
      : 'La tension existe, mais peut être renforcée par un enjeu plus visible.',
    cta: diagnostics.some((item) => item.id === 'weak_cta')
      ? 'La fin n’incite pas assez clairement à commenter ou cliquer.'
      : 'Le CTA peut devenir plus spécifique et conversationnel.',
    repostPotential: 'Estime le gain possible en gardant le sujet mais en changeant le packaging.',
    engagementPotential: 'Combine CTA, tension et probabilité de réaction en commentaires.',
    rewatchPotential: 'Mesure la présence d’un payoff, d’une preuve ou d’un twist à revoir.',
  };

  const labels: Record<keyof ViralSubScores, string> = {
    hook: 'Hook',
    retention: 'Rétention',
    clarity: 'Clarté',
    tension: 'Tension',
    cta: 'CTA',
    repostPotential: 'Potentiel repost',
    engagementPotential: 'Engagement',
    rewatchPotential: 'Rewatch',
  };

  return (Object.keys(weights) as Array<keyof ViralSubScores>).map((key) => ({
    label: labels[key],
    score: subScores[key],
    weight: Math.round(weights[key] * 100),
    reason: reasons[key],
  }));
}

function buildOpeningAnalysis(
  pattern: VideoPattern,
  diagnostics: DiagnosticItem[],
  subScores: ViralSubScores,
  signals: TranscriptSignals,
  result: AnalysisResult,
  repostHook: string
): OpeningAnalysis {
  const ocr = result.videoIntelligence?.onScreenText;
  const visual = result.videoIntelligence?.visualSignals;
  const initialOnScreenText = ocr?.available ? cleanOcrForUserDisplay(ocr.firstFrameText ?? ocr.dominantText).text : undefined;
  const vocalHook = signals.available ? segmentText(signals.firstWords, 92) : undefined;
  const signalsUsed = [
    vocalHook ? 'transcript' : undefined,
    initialOnScreenText ? 'ocr_texte_ecran' : undefined,
    result.videoIntelligence?.frames.sampled ? 'frames' : undefined,
    visual?.available ? 'rythme_visuel' : undefined,
  ].filter(Boolean) as string[];
  const primary = diagnostics.find((item) => item.timecode === '0:00') ?? diagnostics[0];
  const visualEnergy = visual?.visualEnergy ?? subScores.retention;
  const proof = clamp((signals.hasPayoff ? 72 : 46) + (initialOnScreenText && hasText(initialOnScreenText.toLowerCase(), ['preuve', 'avant', 'apres', 'resultat']) ? 12 : 0));
  const friction = clamp(100 - subScores.clarity + (signals.overloadRisk ? 14 : 0) + ((ocr?.textDensity ?? 0) > 72 ? 10 : 0));
  const stopScrollScore = clamp(Math.round(subScores.hook * 0.45 + subScores.tension * 0.28 + visualEnergy * 0.17 + proof * 0.1 - friction * 0.08));
  const promise = signals.hasPromise
    ? 'Promesse detectee dans le wording.'
    : initialOnScreenText
      ? 'Promesse portee surtout par le texte ecran.'
      : 'Promesse a rendre plus explicite dans la premiere frame.';

  return {
    firstFrame: initialOnScreenText ? `Premiere frame avec texte: "${initialOnScreenText}"` : visual?.available ? `Premiere frame analysee via rythme ${visual.cutRhythm}` : 'Premiere frame analysee avec signaux limites',
    initialOnScreenText,
    vocalHook,
    promise,
    curiosity: subScores.tension,
    emotion: clamp(signals.energyScore || subScores.tension),
    proof,
    friction,
    clarity: subScores.clarity,
    stopScrollScore,
    recommendedAction: pattern === 'tutoriel' ? 'Montrer le resultat final a 0:00, puis expliquer apres.' : 'Aligner premiere image, texte ecran et premiere phrase sur une seule tension.',
    mainProblem: primary?.title ?? 'Ouverture trop prudente',
    whyItBlocks: primary?.explanation ?? 'Le viewer comprend le sujet avant de sentir pourquoi il doit rester.',
    exactCorrection: primary?.action ?? 'Raccourcis le contexte, avance la preuve et garde une phrase ecran lisible.',
    newHook: repostHook,
    newOnScreenText: initialOnScreenText && initialOnScreenText.length <= 34 ? initialOnScreenText : 'Le detail qui change tout',
    recommendedFirstFrame: pattern === 'tutoriel' ? 'Resultat final visible, plein cadre, sans intro.' : 'Image la plus tendue ou la preuve la plus concrete des la premiere frame.',
    signalsUsed,
    confidence: signalsUsed.length >= 3 ? 78 : signalsUsed.length === 2 ? 64 : 48,
  };
}

function buildDetailedScores(
  subScores: ViralSubScores,
  result: AnalysisResult,
  signals: TranscriptSignals,
  fusion: ReturnType<typeof buildMultimodalFusion>,
  opening: OpeningAnalysis
): DetailedScoreItem[] {
  const visual = result.videoIntelligence?.visualSignals;
  const ocr = result.videoIntelligence?.onScreenText;
  const baseSignals = [
    signals.available ? 'transcript' : undefined,
    ocr?.available ? 'ocr_texte_ecran' : undefined,
    result.videoIntelligence?.frames.sampled ? 'frames' : undefined,
    visual?.available ? 'rythme_visuel' : undefined,
  ].filter(Boolean) as string[];
  const confidence = Math.max(42, Math.min(88, result.videoIntelligence?.confidence.score ?? opening.confidence));
  const visualEnergy = visual?.available ? visual.visualEnergy : Math.max(38, Math.round((subScores.retention + subScores.tension) / 2));
  const pacing = visual?.available ? clamp(Math.round((visual.motionEstimate + visual.cutDensityEstimate + subScores.retention) / 3)) : subScores.retention;
  const payoff = clamp(Math.round((subScores.rewatchPotential * 0.55) + (signals.hasPayoff ? 28 : 12) + (fusion.coherenceScore * 0.15)));

  return [
    { key: 'openingScore', label: 'Ouverture 0-3s', value: opening.stopScrollScore, reason: opening.mainProblem, signalsUsed: opening.signalsUsed, confidence: opening.confidence },
    { key: 'hookScore', label: 'Hook', value: subScores.hook, reason: signals.available ? 'Score calcule depuis le transcript et les premiers signaux.' : 'Score prudent base sur frames, OCR et structure.', signalsUsed: baseSignals, confidence },
    { key: 'clarityScore', label: 'Clarte', value: subScores.clarity, reason: 'Mesure si la promesse est lisible avant que le viewer swipe.', signalsUsed: baseSignals, confidence },
    { key: 'retentionScore', label: 'Retention', value: subScores.retention, reason: 'Estime la capacite a relancer l attention apres l ouverture.', signalsUsed: baseSignals, confidence },
    { key: 'visualEnergyScore', label: 'Energie visuelle', value: visualEnergy, reason: visual?.available ? 'Base sur mouvement, densite de cuts et signaux visuels.' : 'Estimation prudente: mouvement reel indisponible.', signalsUsed: visual?.available ? ['rythme_visuel', 'frames'] : baseSignals, confidence: visual?.available ? confidence : 46 },
    { key: 'pacingScore', label: 'Rythme', value: pacing, reason: 'Compare le rythme de lecture a un format short-form natif.', signalsUsed: visual?.available ? ['rythme_visuel', 'frames'] : baseSignals, confidence: visual?.available ? confidence : 48 },
    { key: 'payoffScore', label: 'Payoff', value: payoff, reason: signals.hasPayoff ? 'Une recompense est detectee, mais elle peut arriver plus tot.' : 'Payoff ou preuve insuffisamment explicite dans les signaux disponibles.', signalsUsed: baseSignals, confidence },
    { key: 'ctaScore', label: 'CTA', value: subScores.cta, reason: signals.hasCta ? 'CTA detecte, a rendre plus specifique.' : 'CTA faible ou absent dans les signaux disponibles.', signalsUsed: baseSignals, confidence },
    { key: 'repostPotentialScore', label: 'Potentiel repost', value: subScores.repostPotential, reason: 'Gain estime si le sujet reste identique mais le packaging change.', signalsUsed: baseSignals, confidence },
  ];
}

function buildMemory(context: AnalysisEngineContext, pattern: VideoPattern, diagnostics: DiagnosticItem[], subScores: ViralSubScores, signals: TranscriptSignals): ViralynzMemory {
  const previousProblems = (context.previousAnalyses ?? [])
    .flatMap((analysis) => analysis.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? [])
    .slice(0, 12);
  const recurrentWeaknesses = [...diagnostics.map((item) => item.title), ...previousProblems]
    .filter((title, index, arr) => arr.indexOf(title) === index)
    .filter((title) => title && title !== 'Optimisation de packaging')
    .slice(0, 3);
  const currentWeaknesses = diagnostics
    .filter((item) => item.severity !== 'optimisation')
    .map((item) => item.title)
    .slice(0, 3);

  return {
    recurrentWeaknesses: recurrentWeaknesses.length ? recurrentWeaknesses : currentWeaknesses.length ? currentWeaknesses : ['CTA à rendre plus spécifique'],
    favoritePatterns: [patternLabels[pattern], context.nicheLabel || 'Ta niche'].filter(Boolean),
    creatorEvolution: context.previousAnalyses?.length
      ? `Sur tes dernières analyses, Viralynz retrouve un pattern : ${recurrentWeaknesses[0] ?? 'hook à raccourcir'}. Ton prochain gain vient d’une ouverture plus courte et plus émotionnelle.`
      : subScores.hook < 65
        ? 'Tes prochaines analyses doivent surtout raccourcir les hooks et rendre la promesse visible plus tôt.'
        : 'Tu as déjà une base exploitable : Viralynz peut maintenant optimiser le rythme, le CTA et les variantes de repost.',
    nextRecommendation: subScores.cta < 62
      ? 'Teste un CTA question sur les 3 prochains posts pour créer plus de commentaires.'
      : signals.overloadRisk
        ? 'Réécris le script en phrases plus courtes : une idée, une frame, un payoff.'
        : 'Garde le même sujet, mais teste trois angles de hook avant de republier.',
  };
}

export function enrichAnalysisResult(result: AnalysisResult, context: AnalysisEngineContext = {}): AnalysisResult {
  const resultWithVideo: AnalysisResult = { ...result, videoIntelligence: context.videoIntelligence ?? result.videoIntelligence };
  const sourceResult: AnalysisResult = mergeTechnicalDiagnostics(resultWithVideo, resultWithVideo.videoIntelligence?.technicalSignals);
  const signals = transcriptSignals(context, sourceResult);
  const brain = runViralynzBrain(sourceResult, context);
  const subScores = brain.scoring.subScores;
  const detectedFormat = detectVideoFormat(context, sourceResult, signals);
  const pattern = detectedFormat.primary === 'autre_ambigu' ? (detectedFormat.secondary[0] ?? 'video_informative') : detectedFormat.primary;
  const weighted = brain.scoring.globalScore;
  const diagnostics = buildDiagnostics(sourceResult, subScores, signals);
  diagnostics.push(
    ...brain.diagnostics.map((item) => ({
      id: item.id,
      severity: item.severity,
      title: item.title,
      explanation: item.explanation,
      impact: item.impact,
      action: item.fix,
      timecode: item.timestamp,
    })),
  );
  diagnostics.push(...screenTextDiagnostics(sourceResult));
  const hookSources = buildHookSources(sourceResult, signals, pattern);
  const dominantHook = dominantHookSource(hookSources);
  const confidence = buildConfidence(context, signals, pattern, hookSources);
  if (detectedFormat.primary === 'autre_ambigu') {
    confidence.limitations = [...confidence.limitations, ...detectedFormat.limitations];
  }
  const fusion = buildMultimodalFusion(sourceResult, signals, pattern, hookSources);
  diagnostics.push(...crossSignalDiagnostics(fusion));
  const dedupedDiagnostics = diagnostics.filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index).slice(0, 6);
  const criticalErrors = dedupedDiagnostics.filter((item) => item.severity === 'critique');
  const rawEstimatedGain = clamp(Math.min(26, 6 + (100 - subScores.hook) * 0.14 + (100 - subScores.cta) * 0.07 + criticalErrors.length * 3 + (fusion.level === 'contradictoire' ? 4 : 0)));
  const repostPotentialCeiling = Math.max(subScores.repostPotential, weighted);
  const scoreAfter = clamp(Math.min(repostPotentialCeiling, weighted + rawEstimatedGain));
  const estimatedGain = Math.max(0, scoreAfter - weighted);
  const repostRecommended = brain.scoring.repostPotential >= 13 || criticalErrors.length > 0 || fusion.level === 'contradictoire';
  const verdict = brain.scoring.verdict || verdictFor(weighted, subScores, repostRecommended);
  const transcriptAnalysis = buildTranscriptAnalysis(signals);
  const fallbackRepostVersion = buildRepost(context, dedupedDiagnostics, weighted, scoreAfter, pattern, dominantHook, sourceResult);
  const repostVersion = {
    ...fallbackRepostVersion,
    ...brain.repost.version,
    hookVariants: brain.repost.version.hookVariants ?? fallbackRepostVersion.hookVariants,
  };
  const openingAnalysis = buildOpeningAnalysis(pattern, dedupedDiagnostics, subScores, signals, sourceResult, repostVersion.hook);
  const videoSegments = buildSegmentedTimeline(pattern, dedupedDiagnostics, subScores, signals, sourceResult);
  const timeline = buildTimeline(dedupedDiagnostics, subScores, signals, sourceResult);
  const scoreBreakdown = brain.scoring.uiBreakdown;
  const detailedScores = buildDetailedScores(subScores, sourceResult, signals, fusion, openingAnalysis);
  const memory = buildMemory(context, pattern, dedupedDiagnostics, subScores, signals);
  const dominantFailure = buildDominantFailure(dedupedDiagnostics, fusion, sourceResult);
  const bestOpportunity = buildBestOpportunity(pattern, dominantHook, sourceResult, dedupedDiagnostics);
  const priorityActions = {
    critical: dedupedDiagnostics.filter((item) => item.severity === 'critique').map((item) => item.action),
    important: dedupedDiagnostics.filter((item) => item.severity === 'important').map((item) => item.action),
    optimization: dedupedDiagnostics.filter((item) => item.severity === 'optimisation').map((item) => item.action),
  };

  const coachAnalysis: CoachAnalysis = {
    videoPattern: pattern,
    patternLabel: patternLabels[pattern],
    subScores,
    weightedScore: weighted,
    verdict,
    coachSummary: signals.overloadRisk
      ? `${verdict}. Le sujet peut fonctionner, mais le script demande trop d’effort trop tôt : raccourcis les phrases, avance la récompense et garde une seule idée par plan.`
      : confidence.level === 'faible'
        ? `${verdict}. Analyse prudente : les signaux disponibles sont limités, donc Viralynz se concentre sur le packaging visible, la structure et les actions qui ne dépendent pas d’un transcript certain.`
      : signals.hasPatternInterrupt
        ? `${verdict}. L’ouverture a déjà un signal de tension ; le vrai gain vient maintenant du payoff et du CTA, pas d’un script plus long.`
        : signals.available
          ? `${verdict}. Le principal levier n’est pas de changer le sujet, mais d’ajouter un vrai stop verbal dans les premières secondes.`
          : `${verdict}. Sans transcript fiable, le principal levier est de rendre la première frame et le texte écran plus tendus, pas de changer le sujet.`,
    detectedProblems: dedupedDiagnostics,
    criticalErrors,
    benchmarks: buildBenchmarks(context, pattern),
    hookVariants: repostVersion.hookVariants ?? [repostVersion.hook],
    optimizedCtas: [
      repostVersion.cta,
      'Tu veux que je te donne la version courte ?',
      'Commente ton mot-clé et je te donne l’angle à tester.',
    ],
    priorityActions,
    repostEngine: {
      recommended: repostRecommended,
      estimatedGain,
      improvementProbability: clamp(Math.min(88, 46 + subScores.repostPotential * 0.34 + criticalErrors.length * 4 - (signals.overloadRisk ? 5 : 0))),
      priorityChanges: [...priorityActions.critical, ...priorityActions.important].slice(0, 4),
      scoreBefore: weighted,
      scoreAfter,
      repostPotentialCeiling,
      dominantFailure,
      bestOpportunity,
    },
    shareables: {
      hookRoast: `${dedupedDiagnostics[0]?.title ?? 'Hook à resserrer'} : ta vidéo explique avant de créer l’envie de rester.`,
      beforeAfterSnippet: `Avant ${weighted}/100 → après ${scoreAfter}/100 avec un hook plus direct et un payoff avant 0:05.`,
      tiktokCaption: `J’ai analysé mon repost avec Viralynz : ${verdict.toLowerCase()}.`,
      screenshotTitle: `Pourquoi cette vidéo peut mieux performer`,
      viralAnalysisScript: `Cette vidéo peut mieux performer parce que ${dedupedDiagnostics[0]?.explanation.toLowerCase() ?? 'le packaging n’expose pas assez vite la valeur'}. Repost conseillé : hook plus court, preuve avant 0:05, CTA question.`,
      correctedHookSnippet: `Hook transformé : "${repostVersion.hook}"`,
    },
    userProgress: {
      estimatedImprovement: `+${estimatedGain}%`,
      nextMilestone: scoreAfter >= 80 ? 'Stabiliser ce format sur 3 vidéos' : 'Atteindre 75/100 sur le prochain repost',
      progressSignal: criticalErrors.length ? 'Priorité : corriger les 3 premières secondes' : 'Progression : optimiser le CTA',
    },
    timeline,
    scoreBreakdown,
    detailedScores,
    openingAnalysis,
    memory,
    formatConfidence: confidence,
    transcriptAnalysis,
    hookSources,
    dominantHookSource: dominantHook,
    videoSegments,
    detectedVideoFormat: detectedFormat,
    multimodalFusion: fusion,
    engineMeta: {
      version: brain.engineMeta.version,
      preparedSignals: [
        'hook_analyzer',
        'retention_analyzer',
        'cta_analyzer',
        'repost_strategist',
        'creator_memory_engine',
        'transcription',
        'ocr_text_ecran',
        'frame_sampling',
        'vision_api',
        'cut_detection',
        'face_presence',
        'visual_energy',
        'tiktok_analytics',
      ],
      fallbackMode: !signals.available ? 'visual_prudent' : confidence.level === 'faible' ? 'mixed' : 'transcript_first',
    },
  };
  const explainability = buildAnalysisExplainability({ ...sourceResult, coachAnalysis }, brain);

  return {
    ...sourceResult,
    viralityScore: weighted,
    structureScore: result.structureScore ?? weighted,
    finalVerdict: verdict,
    comparativeInsight: result.comparativeInsight || coachAnalysis.benchmarks[0]?.insight,
    comparativePriority: result.comparativePriority || dedupedDiagnostics[0]?.action,
    improvements: dedupedDiagnostics.map((item) => ({
      priority: item.severity === 'critique' ? 'haute' : item.severity === 'important' ? 'moyenne' : 'basse',
      tip: `${item.title} : ${item.action}`,
    })),
    repostVersion,
    structuredDiagnostics: brain.diagnostics.map((item) => ({
      title: item.title,
      explanation: item.explanation,
      timestamp: item.timestamp,
      evidence: item.evidence,
      impact: item.impact,
      fix: item.fix,
      confidence: item.confidence,
    })),
    actionPlan: [...priorityActions.critical, ...priorityActions.important, ...priorityActions.optimization].slice(0, 5),
    analyzerMeta: {
      ...result.analyzerMeta,
      objective: context.objective ?? result.analyzerMeta?.objective,
      objectiveLabel: context.objectiveLabel ?? result.analyzerMeta?.objectiveLabel,
      niche: context.niche ?? result.analyzerMeta?.niche,
      nicheLabel: context.nicheLabel ?? result.analyzerMeta?.nicheLabel,
      fileName: context.fileName ?? result.analyzerMeta?.fileName,
      status: 'completed',
      verdictShort: verdict,
      recommendations: dedupedDiagnostics.slice(0, 4).map((item) => item.action),
    },
    coachAnalysis,
    explainability,
  };
}
