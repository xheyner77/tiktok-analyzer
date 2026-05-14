import type { AnalysisResult, VideoIntelligenceResult } from './types';

const GPT_4O_MINI_INPUT_PER_1M = 0.15;
const GPT_4O_MINI_OUTPUT_PER_1M = 0.60;
const VISION_LOW_DETAIL_TOKENS_PER_FRAME = 85;
const WHISPER_USD_PER_MINUTE = 0.006;

export interface CompactAnalysisContext {
  version: 'analysis-context-v1';
  objective?: string;
  objectiveLabel?: string;
  durationSec?: number;
  fileName?: string;
  observedMetrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  signals: {
    transcriptAvailable: boolean;
    transcriptSummary?: string;
    transcriptWordCount: number;
    ocrAvailable: boolean;
    ocrSummary?: string;
    framesCount: number;
    frameTimestamps: number[];
    visualEnergy: number;
    cutRhythm: string;
    textDensity: number;
    facePresence: string;
  };
  localFindings: string[];
  contradictions: string[];
  limitations: string[];
  promptContext: string;
}

export interface AnalysisCostEstimate {
  model: string;
  framesForOcr: number;
  framesForReasoning: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedWhisperMinutes: number;
  estimatedUsd: number;
  breakdown: {
    visionInputUsd: number;
    textInputUsd: number;
    outputUsd: number;
    whisperUsd: number;
  };
}

export type QualitySection =
  | 'diagnostic'
  | 'hooks'
  | 'repostPlan'
  | 'cta'
  | 'openingAnalysis'
  | 'timeline'
  | 'reasoning';

export interface AnalysisQualityIssue {
  section: QualitySection;
  severity: 'low' | 'medium' | 'high';
  message: string;
  evidence?: string;
}

export interface AnalysisQualityReport {
  qualityScore: number;
  issues: AnalysisQualityIssue[];
  needsRegeneration: boolean;
  sectionsToRegenerate: QualitySection[];
  escalationRecommended: boolean;
}

export interface RegenerationResult {
  result: AnalysisResult;
  regeneratedSections: QualitySection[];
  modelUsed: string;
  escalationTriggered: boolean;
  estimatedAdditionalCostUsd: number;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cleanText(value?: string, max = 420) {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[<>_[\]{}|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}...` : cleaned;
}

function summarizeTranscript(transcript?: string) {
  const clean = cleanText(transcript, 900);
  if (!clean) return { summary: undefined, wordCount: 0 };
  const words = clean.split(/\s+/).filter(Boolean);
  const first = words.slice(0, 34).join(' ');
  const last = words.slice(-26).join(' ');
  const hasQuestion = /\?|\b(pourquoi|comment|tu veux|vous voulez|est-ce que)\b/i.test(clean);
  const hasCta = /\b(commente|abonne|partage|clique|envoie|sauvegarde|follow)\b/i.test(clean);
  const summary = [
    `Ouverture verbale: "${first}"`,
    last && last !== first ? `Fin/CTA probable: "${last}"` : undefined,
    hasQuestion ? 'Question detectee.' : undefined,
    hasCta ? 'CTA verbal detecte.' : 'CTA verbal non confirme.',
  ].filter(Boolean).join(' ');
  return { summary, wordCount: words.length };
}

function summarizeOcr(vi: VideoIntelligenceResult) {
  if (!vi.onScreenText.available) return undefined;
  const snippets = [
    vi.onScreenText.firstFrameText,
    vi.onScreenText.dominantText,
    ...vi.onScreenText.text,
  ]
    .map((item) => cleanText(item, 90))
    .filter(Boolean) as string[];
  const unique = Array.from(new Set(snippets.map((item) => item.toLowerCase())))
    .map((lower) => snippets.find((item) => item.toLowerCase() === lower))
    .filter(Boolean)
    .slice(0, 5) as string[];
  return unique.length ? unique.map((item, index) => `${index + 1}. ${item}`).join(' | ') : undefined;
}

function detectLocalFindings(vi: VideoIntelligenceResult, transcriptSummary?: string, ocrSummary?: string) {
  const findings: string[] = [];
  const contradictions: string[] = [];
  const visual = vi.visualSignals;

  if (vi.metadata.durationSec && vi.metadata.durationSec > 45) {
    findings.push('Duree longue pour TikTok: chaque segment doit justifier le watchtime.');
  }
  if (vi.metadata.durationSec && vi.metadata.durationSec <= 20) {
    findings.push('Format court: potentiel completion plus fort si le payoff arrive vite.');
  }
  if (vi.onScreenText.available && vi.onScreenText.textDensity > 70) {
    findings.push('Texte ecran dense: risque de friction cognitive en scroll.');
  }
  if (visual.available && visual.visualEnergy < 42) {
    findings.push('Energie visuelle faible: premiere frame et cuts doivent porter plus de tension.');
  }
  if (visual.available && visual.visualEnergy >= 70) {
    findings.push('Energie visuelle forte: le message doit rester simple pour ne pas devenir confus.');
  }
  if (!vi.transcript.available && vi.onScreenText.available) {
    findings.push('Transcript absent: analyse vocale interdite, priorite au texte ecran et aux frames.');
  }
  if (vi.transcript.available && !vi.onScreenText.available) {
    findings.push('Transcript disponible mais OCR absent: renforcer la version sans son au repost.');
  }
  if (ocrSummary && transcriptSummary && !transcriptSummary.toLowerCase().includes(ocrSummary.split(' ')[0]?.toLowerCase() ?? '')) {
    contradictions.push('Le texte ecran et le verbal semblent porter des idees differentes: alignement a verifier.');
  }
  if (visual.available && visual.motionEstimate >= 70 && !vi.transcript.available && !vi.onScreenText.available) {
    contradictions.push('Visuel dynamique mais message non lisible sans transcript/OCR: risque de mouvement sans comprehension.');
  }

  return { findings: findings.slice(0, 6), contradictions: contradictions.slice(0, 4) };
}

export function buildAnalysisContext(input: {
  videoIntelligence: VideoIntelligenceResult;
  objective?: string;
  objectiveLabel?: string;
  fileName?: string;
  observedMetrics?: CompactAnalysisContext['observedMetrics'];
}): CompactAnalysisContext {
  const vi = input.videoIntelligence;
  const transcript = summarizeTranscript(vi.transcript.text);
  const ocrSummary = summarizeOcr(vi);
  const local = detectLocalFindings(vi, transcript.summary, ocrSummary);
  const limitations = Array.from(new Set([...vi.limitations, ...vi.confidence.missingSignals.map((signal) => `Signal manquant: ${signal}`)])).slice(0, 8);
  const promptContext = [
    'CONTEXTE MULTIMODAL COMPRESSE',
    `Objectif: ${input.objectiveLabel ?? input.objective ?? 'non precise'}`,
    `Fichier: ${input.fileName ?? vi.metadata.fileName ?? 'upload'} | duree=${vi.metadata.durationSec ?? '?'}s | frames=${vi.frames.count}`,
    `Signaux: transcript=${vi.transcript.available ? 'oui' : 'non'} OCR=${vi.onScreenText.available ? 'oui' : 'non'} rythme=${vi.visualSignals.cutRhythm} energie=${vi.visualSignals.visualEnergy}/100 face=${vi.visualSignals.facePresence}`,
    transcript.summary ? `Transcript resume: ${transcript.summary}` : 'Transcript: indisponible. Ne pas analyser la voix.',
    ocrSummary ? `OCR nettoye: ${ocrSummary}` : 'OCR: texte ecran indisponible ou non fiable.',
    local.findings.length ? `Findings locaux: ${local.findings.join(' | ')}` : undefined,
    local.contradictions.length ? `Contradictions locales: ${local.contradictions.join(' | ')}` : undefined,
    limitations.length ? `Limites: ${limitations.join(' | ')}` : undefined,
  ].filter(Boolean).join('\n');

  return {
    version: 'analysis-context-v1',
    objective: input.objective,
    objectiveLabel: input.objectiveLabel,
    durationSec: vi.metadata.durationSec,
    fileName: input.fileName ?? vi.metadata.fileName,
    observedMetrics: input.observedMetrics,
    signals: {
      transcriptAvailable: vi.transcript.available,
      transcriptSummary: transcript.summary,
      transcriptWordCount: transcript.wordCount,
      ocrAvailable: vi.onScreenText.available,
      ocrSummary,
      framesCount: vi.frames.count,
      frameTimestamps: vi.frames.timestamps,
      visualEnergy: vi.visualSignals.visualEnergy,
      cutRhythm: vi.visualSignals.cutRhythm,
      textDensity: vi.onScreenText.textDensity,
      facePresence: vi.visualSignals.facePresence,
    },
    localFindings: local.findings,
    contradictions: local.contradictions,
    limitations,
    promptContext,
  };
}

export function estimateAnalysisCost(input: {
  model: string;
  framesForOcr: number;
  framesForReasoning: number;
  transcriptChars?: number;
  ocrChars?: number;
  promptChars?: number;
  outputTokens?: number;
  whisperMinutes?: number;
}): AnalysisCostEstimate {
  const textTokens = Math.ceil(((input.transcriptChars ?? 0) + (input.ocrChars ?? 0) + (input.promptChars ?? 0)) / 4);
  const visionTokens = (input.framesForOcr + input.framesForReasoning) * VISION_LOW_DETAIL_TOKENS_PER_FRAME;
  const estimatedInputTokens = textTokens + visionTokens;
  const estimatedOutputTokens = input.outputTokens ?? 1700;
  const visionInputUsd = (visionTokens / 1_000_000) * GPT_4O_MINI_INPUT_PER_1M;
  const textInputUsd = (textTokens / 1_000_000) * GPT_4O_MINI_INPUT_PER_1M;
  const outputUsd = (estimatedOutputTokens / 1_000_000) * GPT_4O_MINI_OUTPUT_PER_1M;
  const whisperUsd = (input.whisperMinutes ?? 0) * WHISPER_USD_PER_MINUTE;
  const estimatedUsd = visionInputUsd + textInputUsd + outputUsd + whisperUsd;
  return {
    model: input.model,
    framesForOcr: input.framesForOcr,
    framesForReasoning: input.framesForReasoning,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedWhisperMinutes: input.whisperMinutes ?? 0,
    estimatedUsd: Number(estimatedUsd.toFixed(5)),
    breakdown: {
      visionInputUsd: Number(visionInputUsd.toFixed(5)),
      textInputUsd: Number(textInputUsd.toFixed(5)),
      outputUsd: Number(outputUsd.toFixed(5)),
      whisperUsd: Number(whisperUsd.toFixed(5)),
    },
  };
}

function ratingFor(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Moyen';
  return 'Faible';
}

function stripForbiddenAudioClaims(text: string, transcriptAvailable: boolean) {
  if (transcriptAvailable) return text;
  return text
    .replace(/\b(voix|vocal|parle|parlee|verbal|audio|sonore)\b/gi, 'signal non confirme')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHookList(hooks: string[]) {
  const seen = new Set<string>();
  return hooks
    .map((hook) => cleanText(hook, 96))
    .filter(Boolean)
    .filter((hook) => {
      const key = hook!.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }) as string[];
}

const GENERIC_PHRASES = [
  'le hook est faible',
  'ameliore le hook',
  'ajoute de la valeur',
  'sois plus engageant',
  'rends la video plus dynamique',
  'optimise ton contenu',
  'poste plus souvent',
  'analyse tiktok',
  'contenu viral',
  'bonne opportunite',
];

function normalized(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function signalKeywords(context: CompactAnalysisContext) {
  const source = [
    context.signals.ocrSummary,
    context.signals.transcriptSummary,
    context.localFindings.join(' '),
    context.objectiveLabel,
  ].filter(Boolean).join(' ');
  return Array.from(new Set(normalized(source).split(/\s+/).filter((word) => word.length >= 4))).slice(0, 24);
}

function hasSpecificSignal(text: string, context: CompactAnalysisContext) {
  const low = normalized(text);
  const keywords = signalKeywords(context);
  return keywords.some((keyword) => low.includes(keyword))
    || /\b(0-1s|1-3s|3-5s|5-10s|10-20s|0:0|frame|ocr|texte ecran|transcript|cut|rythme|duree|score)\b/i.test(text);
}

function critiqueHookText(hook: string, context: CompactAnalysisContext): AnalysisQualityIssue[] {
  const issues: AnalysisQualityIssue[] = [];
  const words = hook.split(/\s+/).filter(Boolean);
  const low = normalized(hook);
  if (words.length > 13) issues.push({ section: 'hooks', severity: 'medium', message: 'Hook trop long pour une ouverture TikTok.', evidence: hook });
  if (GENERIC_PHRASES.some((phrase) => low.includes(phrase))) issues.push({ section: 'hooks', severity: 'high', message: 'Hook trop generique.', evidence: hook });
  if (/\b(decouvrez|bienvenue|aujourd hui nous allons|dans cette video)\b/i.test(hook)) issues.push({ section: 'hooks', severity: 'high', message: 'Hook corporate ou intro longue.', evidence: hook });
  if (!hasSpecificSignal(hook, context)) issues.push({ section: 'hooks', severity: 'medium', message: 'Hook pas assez lie aux signaux reels.', evidence: hook });
  if (context.signals.ocrSummary && normalized(hook) === normalized(context.signals.ocrSummary)) issues.push({ section: 'hooks', severity: 'medium', message: 'Hook reprend trop brutalement l OCR brut.', evidence: hook });
  return issues;
}

export function critiqueAnalysisOutput(result: AnalysisResult, context: CompactAnalysisContext): AnalysisQualityIssue[] {
  const issues: AnalysisQualityIssue[] = [];
  const allText = JSON.stringify(result).toLowerCase();
  const sections = [result.hook.analysis, result.editing.analysis, result.retention.analysis, result.comparativeInsight, result.comparativePriority].filter(Boolean) as string[];

  for (const text of sections) {
    const low = normalized(text);
    if (GENERIC_PHRASES.some((phrase) => low.includes(phrase))) {
      issues.push({ section: 'diagnostic', severity: 'medium', message: 'Diagnostic contient une phrase generique.', evidence: text.slice(0, 140) });
    }
    if (!hasSpecificSignal(text, context)) {
      issues.push({ section: 'diagnostic', severity: 'medium', message: 'Diagnostic pas assez ancre dans les signaux.', evidence: text.slice(0, 140) });
    }
  }

  const hooks = [result.repostVersion?.hook, ...(result.repostVersion?.hookVariants ?? []), ...(result.coachAnalysis?.hookVariants ?? [])].filter(Boolean) as string[];
  const hookKeys = hooks.map((hook) => normalized(hook).replace(/\s+/g, ''));
  if (new Set(hookKeys).size < hookKeys.length) {
    issues.push({ section: 'hooks', severity: 'medium', message: 'Hooks repetitifs ou doublons.' });
  }
  hooks.forEach((hook) => issues.push(...critiqueHookText(hook, context)));

  const structure = result.repostVersion?.structure ?? [];
  if (structure.length < 3) {
    issues.push({ section: 'repostPlan', severity: 'high', message: 'Plan repost trop court.' });
  }
  if (!structure.some((item) => /\b0-1|0-3|1-3|3-5|5-10|10-20|fin\b/i.test(item))) {
    issues.push({ section: 'repostPlan', severity: 'high', message: 'Plan repost pas assez timecodé.' });
  }
  if (structure.filter((item) => hasSpecificSignal(item, context)).length === 0) {
    issues.push({ section: 'repostPlan', severity: 'medium', message: 'Plan repost trop template, pas assez lie au contenu.' });
  }

  if (!context.signals.transcriptAvailable && /\b(voix|vocal|parle|audio|sonore)\b/i.test(allText)) {
    issues.push({ section: 'reasoning', severity: 'high', message: 'Usage de signaux audio absents.' });
  }
  if (!context.signals.ocrAvailable && /texte ecran detecte|ocr detecte/i.test(allText)) {
    issues.push({ section: 'reasoning', severity: 'high', message: 'Usage de signaux OCR absents.' });
  }
  if (Math.abs(result.viralityScore - Math.round(result.hook.score * 0.4 + result.editing.score * 0.3 + result.retention.score * 0.3)) > 18) {
    issues.push({ section: 'reasoning', severity: 'medium', message: 'Score global incoherent avec les sous-scores.' });
  }
  if (!result.coachAnalysis?.openingAnalysis) {
    issues.push({ section: 'openingAnalysis', severity: 'medium', message: 'Opening analysis absente.' });
  }
  if (!result.coachAnalysis?.videoSegments?.length) {
    issues.push({ section: 'timeline', severity: 'medium', message: 'Timeline segmentee absente.' });
  }

  return issues;
}

export function scoreAnalysisQuality(result: AnalysisResult, context: CompactAnalysisContext): AnalysisQualityReport {
  const issues = critiqueAnalysisOutput(result, context);
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === 'high' ? 16 : issue.severity === 'medium' ? 9 : 4), 0);
  const hooks = [result.repostVersion?.hook, ...(result.repostVersion?.hookVariants ?? [])].filter(Boolean) as string[];
  const usefulSignals = [
    context.signals.transcriptAvailable,
    context.signals.ocrAvailable,
    context.signals.framesCount > 0,
    context.localFindings.length > 0,
  ].filter(Boolean).length;
  const hookBonus = hooks.length >= 3 ? 5 : hooks.length ? 2 : -8;
  const signalBonus = usefulSignals * 2;
  const qualityScore = clamp(90 + hookBonus + signalBonus - penalty);
  const sectionsToRegenerate = Array.from(new Set(issues
    .filter((issue) => issue.severity !== 'low')
    .map((issue) => issue.section)));

  return {
    qualityScore,
    issues,
    needsRegeneration: qualityScore < 70,
    sectionsToRegenerate: qualityScore < 55 ? Array.from(new Set([...sectionsToRegenerate, 'reasoning' as const])) : sectionsToRegenerate,
    escalationRecommended: qualityScore < 55,
  };
}

function buildSpecificHookSeeds(context: CompactAnalysisContext) {
  const ocr = context.signals.ocrSummary?.split('|')[0]?.replace(/^\d+\.\s*/, '').trim();
  const finding = context.localFindings[0]?.split(':')[0];
  const objective = context.objectiveLabel ?? 'cette video';
  const anchor = ocr ?? finding ?? objective;
  return [
    ocr ? `${ocr}: le detail arrive trop tot` : undefined,
    finding ? `${finding}: le probleme est la` : undefined,
    `${anchor}: change les 3 premieres secondes`,
    `${anchor}: commence par la preuve`,
    context.signals.transcriptAvailable ? `${anchor}: cache le payoff` : `${anchor}: cree une tension`,
  ].filter(Boolean) as string[];
}

function buildSpecificRepostStructure(context: CompactAnalysisContext) {
  const ocr = context.signals.ocrSummary?.split('|')[0]?.replace(/^\d+\.\s*/, '').trim();
  const firstSignal = context.localFindings[0] ?? context.contradictions[0] ?? 'Promesse a clarifier';
  return [
    `0-1s : ouvrir sur la preuve ou l image la plus tendue. Signal: ${ocr ?? firstSignal}.`,
    `1-3s : ne pas expliquer; poser le probleme en une phrase courte liee a ${context.objectiveLabel ?? 'l objectif'}.`,
    `3-5s : montrer le contraste ou le resultat avant le contexte.`,
    `5-10s : couper toute phrase de justification et ajouter un micro-reset visuel.`,
    `10-20s : livrer la correction concrete, une idee par plan.`,
    `fin : CTA question simple, lie au probleme observe, pas un "abonne-toi" generique.`,
  ];
}

export function regenerateWeakSections(
  result: AnalysisResult,
  context: CompactAnalysisContext,
  report: AnalysisQualityReport,
  options: { enableEscalation?: boolean; escalationModel?: string; baseModel?: string } = {}
): RegenerationResult {
  const next: AnalysisResult = {
    ...result,
    hook: { ...result.hook },
    editing: { ...result.editing },
    retention: { ...result.retention },
    repostVersion: result.repostVersion ? { ...result.repostVersion } : undefined,
    coachAnalysis: result.coachAnalysis ? { ...result.coachAnalysis } : undefined,
  };
  const regenerated = new Set<QualitySection>();
  const sections = new Set(report.sectionsToRegenerate);

  if (sections.has('hooks') || sections.has('reasoning')) {
    const hooks = buildSpecificHookSeeds(context);
    next.repostVersion = {
      ...(next.repostVersion ?? {
        hook: hooks[0],
        structure: [],
        onScreenText: [],
        cta: '',
        angle: '',
      }),
      hook: hooks[0],
      hookVariants: normalizeHookList(hooks).slice(0, 5),
      onScreenText: normalizeHookList([context.signals.ocrSummary?.split('|')[0] ?? '', 'Cache le payoff 2 secondes', 'Montre la preuve avant le contexte']).slice(0, 4),
    };
    if (next.coachAnalysis) next.coachAnalysis.hookVariants = next.repostVersion.hookVariants ?? [];
    regenerated.add('hooks');
  }

  if (sections.has('repostPlan') || sections.has('reasoning')) {
    const structure = buildSpecificRepostStructure(context);
    next.repostVersion = {
      ...(next.repostVersion ?? { hook: buildSpecificHookSeeds(context)[0], structure, onScreenText: [], cta: '', angle: '' }),
      structure,
      cta: context.signals.transcriptAvailable ? 'Commente "VERSION" si tu veux le script court.' : 'Commente "VU" si le probleme est clair sans le son.',
      angle: `Repost centre sur le signal principal: ${context.localFindings[0] ?? context.contradictions[0] ?? context.objectiveLabel ?? 'ouverture plus tendue'}.`,
    };
    regenerated.add('repostPlan');
    regenerated.add('cta');
  }

  if (sections.has('diagnostic') || sections.has('reasoning')) {
    const evidence = context.localFindings[0] ?? context.contradictions[0] ?? context.signals.ocrSummary ?? 'Les signaux disponibles restent limites.';
    next.hook.analysis = `Signal observe: ${evidence}. Probleme: l ouverture doit creer une tension plus nette avant l explication. Impact: le viewer peut comprendre le sujet sans raison de rester. Correction: avance la preuve et cache le payoff jusqu a 2 secondes.`;
    next.editing.analysis = `Signal observe: rythme ${context.signals.cutRhythm}, energie ${context.signals.visualEnergy}/100. Probleme: le montage doit soutenir le signal principal au lieu de tout expliquer. Impact: sans reset visuel, la retention baisse apres l ouverture. Correction: ajoute un cut preuve entre 3-5s puis un micro-reset a 5-10s.`;
    next.retention.analysis = `Signal observe: ${evidence}. Probleme: la recompense doit rester partiellement ouverte apres la premiere frame. Impact: si le viewer comprend tout trop vite, il n a plus de raison de regarder. Correction: montre la preuve avant le contexte et garde une question ouverte jusqu a la fin.`;
    next.comparativePriority = `Priorite: refaire uniquement les 3 premieres secondes autour de ce signal: ${evidence}`;
    regenerated.add('diagnostic');
  }

  const escalationTriggered = !!options.enableEscalation && report.escalationRecommended;
  const modelUsed = escalationTriggered ? (options.escalationModel ?? 'quality-escalation-model') : (options.baseModel ?? 'local-quality-regenerator');
  const estimatedAdditionalCostUsd = escalationTriggered ? 0.003 : 0;

  return {
    result: next,
    regeneratedSections: Array.from(regenerated),
    modelUsed,
    escalationTriggered,
    estimatedAdditionalCostUsd,
  };
}

export function validateAnalysisOutput(result: AnalysisResult, context: CompactAnalysisContext): AnalysisResult {
  const next: AnalysisResult = {
    ...result,
    hook: { ...result.hook },
    editing: { ...result.editing },
    retention: { ...result.retention },
    coachAnalysis: result.coachAnalysis ? { ...result.coachAnalysis } : undefined,
    repostVersion: result.repostVersion ? { ...result.repostVersion } : undefined,
  };
  const transcriptAvailable = context.signals.transcriptAvailable;
  const validationWarnings: string[] = [];

  for (const key of ['hook', 'editing', 'retention'] as const) {
    const section = next[key];
    section.score = clamp(section.score);
    section.rating = ratingFor(section.score);
    section.analysis = stripForbiddenAudioClaims(cleanText(section.analysis, 520) ?? '', transcriptAvailable);
    section.strengths = (section.strengths ?? []).map((item) => stripForbiddenAudioClaims(cleanText(item, 180) ?? '', transcriptAvailable)).filter(Boolean).slice(0, 4);
    section.weaknesses = (section.weaknesses ?? []).map((item) => stripForbiddenAudioClaims(cleanText(item, 180) ?? '', transcriptAvailable)).filter(Boolean).slice(0, 4);
  }

  next.viralityScore = clamp(next.viralityScore);
  next.structureScore = next.structureScore === undefined ? undefined : clamp(next.structureScore);
  next.improvements = (next.improvements ?? []).map((item) => ({
    priority: item.priority,
    tip: stripForbiddenAudioClaims(cleanText(item.tip, 260) ?? '', transcriptAvailable),
  })).filter((item) => item.tip.length > 12).slice(0, 10);

  if (next.repostVersion) {
    next.repostVersion.hook = normalizeHookList([next.repostVersion.hook])[0] ?? 'Commence par le resultat, pas par le contexte.';
    next.repostVersion.hookVariants = normalizeHookList(next.repostVersion.hookVariants ?? [next.repostVersion.hook]).slice(0, 6);
    next.repostVersion.onScreenText = normalizeHookList(next.repostVersion.onScreenText ?? []).slice(0, 5);
    next.repostVersion.structure = (next.repostVersion.structure ?? []).map((item) => cleanText(item, 140)).filter(Boolean).slice(0, 6) as string[];
  }

  if (!transcriptAvailable && JSON.stringify(next).match(/\b(voix|vocal|parle|audio)\b/i)) {
    validationWarnings.push('Claims audio/verbal neutralises car aucun transcript fiable.');
  }
  if (!context.signals.ocrAvailable && JSON.stringify(next).match(/texte ecran detecte/i)) {
    validationWarnings.push('Claims OCR prudents car texte ecran non disponible.');
  }

  if (next.coachAnalysis) {
    next.coachAnalysis.hookVariants = normalizeHookList(next.coachAnalysis.hookVariants ?? []).slice(0, 6);
    next.coachAnalysis.optimizedCtas = normalizeHookList(next.coachAnalysis.optimizedCtas ?? []).slice(0, 4);
    next.coachAnalysis.engineMeta = {
      ...next.coachAnalysis.engineMeta,
      preparedSignals: next.coachAnalysis.engineMeta?.preparedSignals ?? [],
      version: `${next.coachAnalysis.engineMeta?.version ?? 'video-engine'}+validated`,
    };
  }

  next.analyzerMeta = {
    ...next.analyzerMeta,
    validationWarnings,
  };
  return next;
}
