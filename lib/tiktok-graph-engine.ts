import type { AnalysisResult } from './types';
import type { ProprietaryVideoSignals } from './proprietary-video-engine';

export type TikTokTagKey =
  | 'hook_type'
  | 'niche'
  | 'format_type'
  | 'cta_type'
  | 'speech_speed'
  | 'visual_density'
  | 'facecam'
  | 'storytelling'
  | 'proof_based'
  | 'emotional'
  | 'educational'
  | 'captions_present'
  | 'payoff_position'
  | 'intro_duration'
  | 'pattern_interrupt_count';

export interface TikTokGraphTag {
  key: TikTokTagKey;
  value: string;
  confidence: number;
  evidence: string;
}

export interface TikTokStructuredSignals {
  hook_type: 'proof' | 'question' | 'contrarian' | 'story' | 'problem' | 'direct' | 'unknown';
  cta_type: 'question' | 'keyword' | 'action' | 'soft' | 'missing' | 'unknown';
  payoff_position?: number;
  intro_duration?: number;
  visual_density: 'low' | 'medium' | 'high' | 'unknown';
  speech_speed: 'slow' | 'balanced' | 'fast' | 'unknown';
  risk_drop: string[];
  pattern_interrupts: number;
  captions_present: boolean;
  facecam: boolean | 'unknown';
  niche?: string;
  format_type?: string;
}

export interface TikTokBenchmarkInsight {
  label: string;
  insight: string;
  comparisonBasis: string;
  confidence: number;
  caveat: string;
}

export interface TikTokGraphNode {
  id: string;
  type: 'video' | 'hook' | 'cta' | 'structure' | 'niche' | 'format' | 'retention' | 'repost' | 'diagnostic';
  label: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface TikTokGraphEdge {
  from: string;
  to: string;
  relation: 'uses' | 'belongs_to' | 'creates_risk' | 'improves' | 'recommends' | 'has_score' | 'similar_to';
  weight: number;
  evidence: string;
}

export interface TikTokGraphRecord {
  version: 'tiktok-graph-v1';
  videoId: string;
  userId: string;
  tags: TikTokGraphTag[];
  structuredSignals: TikTokStructuredSignals;
  benchmarkInsights: TikTokBenchmarkInsight[];
  nodes: TikTokGraphNode[];
  edges: TikTokGraphEdge[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function id(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64) || 'node';
}

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function hookType(result: AnalysisResult): TikTokStructuredSignals['hook_type'] {
  const text = [
    result.repostVersion?.hook,
    result.hook.analysis,
    ...(result.coachAnalysis?.hookVariants ?? []),
  ].join(' ').toLowerCase();
  if (includesAny(text, ['preuve', 'resultat', 'test', 'avant apres', 'avant/apres'])) return 'proof';
  if (includesAny(text, ['pourquoi', 'comment', '?', 'tu veux'])) return 'question';
  if (includesAny(text, ['erreur', 'probleme', 'bloque', 'perds', 'fuir'])) return 'problem';
  if (includesAny(text, ['personne', 'faux', 'jamais', 'arrete', 'stop'])) return 'contrarian';
  if (includesAny(text, ['histoire', 'jour', 'quand', 'avant'])) return 'story';
  if (text.length) return 'direct';
  return 'unknown';
}

function ctaType(result: AnalysisResult): TikTokStructuredSignals['cta_type'] {
  const text = [
    result.repostVersion?.cta,
    ...(result.coachAnalysis?.optimizedCtas ?? []),
    ...(result.improvements ?? []).map((item) => item.tip),
  ].join(' ').toLowerCase();
  if (!text.trim()) return 'missing';
  if (includesAny(text, ['commente', 'mot', 'hook', 'plan', 'audit'])) return 'keyword';
  if (includesAny(text, ['?', 'dis-moi', 'tu veux', 'quel', 'laquelle'])) return 'question';
  if (includesAny(text, ['clique', 'lien', 'dm', 'abonne'])) return 'action';
  return 'soft';
}

function density(value?: number): TikTokStructuredSignals['visual_density'] {
  if (value === undefined) return 'unknown';
  if (value >= 68) return 'high';
  if (value >= 38) return 'medium';
  return 'low';
}

function speechSpeed(value?: number): TikTokStructuredSignals['speech_speed'] {
  if (value === undefined || value === 0) return 'unknown';
  if (value >= 3.2) return 'fast';
  if (value <= 1.25) return 'slow';
  return 'balanced';
}

function scoreConfidence(result: AnalysisResult, technical?: ProprietaryVideoSignals) {
  return clamp((result.videoIntelligence?.confidence.score ?? technical?.metadata.signalQuality ?? 50));
}

export function buildTikTokStructuredSignals(result: AnalysisResult): TikTokStructuredSignals {
  const technical = result.videoIntelligence?.technicalSignals;
  const payoffPosition = technical?.structure.timeToPayoffSec;
  const introDuration = result.coachAnalysis?.openingAnalysis?.stopScrollScore
    ? Math.max(1, Math.round((100 - result.coachAnalysis.openingAnalysis.stopScrollScore) / 18))
    : payoffPosition ? Math.min(5, payoffPosition) : undefined;

  return {
    hook_type: hookType(result),
    cta_type: ctaType(result),
    payoff_position: payoffPosition,
    intro_duration: introDuration,
    visual_density: density(technical?.visual.visualDensity ?? result.videoIntelligence?.visualSignals.textDensityEstimate),
    speech_speed: speechSpeed(technical?.speech.wordsPerSecond),
    risk_drop: technical?.structure.retentionRisks.map((risk) => risk.timestamp) ?? result.coachAnalysis?.timeline?.filter((item) => item.type === 'drop').map((item) => item.time) ?? [],
    pattern_interrupts: technical?.visual.patternInterrupts.length ?? 0,
    captions_present: Boolean(result.videoIntelligence?.onScreenText.available),
    facecam: result.videoIntelligence?.visualSignals.facePresence === 'unknown'
      ? 'unknown'
      : result.videoIntelligence?.visualSignals.facePresence === 'detected',
    niche: result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche,
    format_type: result.coachAnalysis?.patternLabel,
  };
}

export function buildTikTokGraphTags(result: AnalysisResult): TikTokGraphTag[] {
  const signals = buildTikTokStructuredSignals(result);
  const confidence = scoreConfidence(result, result.videoIntelligence?.technicalSignals);
  const tags: TikTokGraphTag[] = [
    { key: 'hook_type', value: signals.hook_type, confidence, evidence: 'Classifie depuis hook, variantes et diagnostic ouverture.' },
    { key: 'cta_type', value: signals.cta_type, confidence, evidence: 'Classifie depuis CTA recommande et suggestions.' },
    { key: 'speech_speed', value: signals.speech_speed, confidence: result.videoIntelligence?.transcript.available ? confidence : 32, evidence: 'Calcule depuis transcript et duree estimee.' },
    { key: 'visual_density', value: signals.visual_density, confidence, evidence: 'Calcule depuis frames, OCR et variations visuelles.' },
    { key: 'captions_present', value: String(signals.captions_present), confidence, evidence: 'Presence texte ecran via OCR Vision.' },
    { key: 'facecam', value: String(signals.facecam), confidence: result.videoIntelligence?.visualSignals.facePresence === 'unknown' ? 28 : confidence, evidence: 'Signal facecam issu de la detection visuelle legere.' },
    { key: 'pattern_interrupt_count', value: String(signals.pattern_interrupts), confidence, evidence: 'Nombre de changements visuels internes detectes.' },
  ];
  if (signals.niche) tags.push({ key: 'niche', value: signals.niche, confidence: 80, evidence: 'Niche selectionnee ou detectee dans le contexte analyse.' });
  if (signals.format_type) tags.push({ key: 'format_type', value: signals.format_type, confidence, evidence: 'Format detecte par Viralynz Brain.' });
  if (signals.payoff_position !== undefined) tags.push({ key: 'payoff_position', value: String(signals.payoff_position), confidence, evidence: 'Position estimee du payoff dans transcript/signaux.' });
  if (signals.intro_duration !== undefined) tags.push({ key: 'intro_duration', value: String(signals.intro_duration), confidence, evidence: 'Duree introduction estimee par signaux structurels.' });
  tags.push({ key: 'proof_based', value: String(signals.hook_type === 'proof'), confidence, evidence: 'Derive du hook type.' });
  tags.push({ key: 'storytelling', value: String(signals.hook_type === 'story' || signals.format_type?.toLowerCase().includes('story')), confidence, evidence: 'Derive du hook et format.' });
  tags.push({ key: 'educational', value: String(signals.format_type?.toLowerCase().includes('tutoriel') || signals.format_type?.toLowerCase().includes('informative')), confidence, evidence: 'Derive du format detecte.' });
  tags.push({ key: 'emotional', value: String(signals.format_type?.toLowerCase().includes('emotion')), confidence, evidence: 'Derive du format detecte.' });
  return tags;
}

export function buildTikTokBenchmarkInsights(result: AnalysisResult): TikTokBenchmarkInsight[] {
  const signals = buildTikTokStructuredSignals(result);
  const basis = [
    signals.niche ? `niche=${signals.niche}` : undefined,
    signals.format_type ? `format=${signals.format_type}` : undefined,
    `hook=${signals.hook_type}`,
  ].filter(Boolean).join(' | ');

  return [
    {
      label: 'Hook similaire',
      insight: signals.hook_type === 'proof'
        ? 'Les hooks preuve sont a pousser quand la valeur peut etre montree avant le contexte.'
        : 'Ton hook gagnerait a emprunter plus vite un signal de preuve ou de tension.',
      comparisonBasis: basis,
      confidence: clamp(42 + (result.videoIntelligence?.confidence.score ?? 45) * 0.45),
      caveat: 'Benchmark interne base sur patterns Viralynz, pas sur analytics TikTok reels.',
    },
    {
      label: 'Structure similaire',
      insight: (signals.intro_duration ?? 0) > 3
        ? 'Les intros longues creent plus de risques de drop dans les structures similaires.'
        : 'L intro est assez courte pour laisser le repost travailler surtout le payoff et le CTA.',
      comparisonBasis: basis,
      confidence: clamp(46 + (signals.risk_drop.length * 8)),
      caveat: 'Utilise uniquement risques structurels et timestamps internes.',
    },
    {
      label: 'Rythme similaire',
      insight: signals.visual_density === 'low'
        ? 'Les videos similaires gagnent souvent a ajouter une rupture visuelle avant le premier risque de drop.'
        : 'La densite visuelle donne assez de matiere; la priorite devient la clarte du payoff.',
      comparisonBasis: basis,
      confidence: clamp(44 + (signals.pattern_interrupts * 7)),
      caveat: 'Densite visuelle estimee depuis frames et OCR.',
    },
  ];
}

export function buildTikTokGraphRecord(input: {
  userId: string;
  videoId: string;
  result: AnalysisResult;
}): TikTokGraphRecord {
  const { userId, videoId, result } = input;
  const tags = buildTikTokGraphTags(result);
  const structuredSignals = buildTikTokStructuredSignals(result);
  const benchmarkInsights = buildTikTokBenchmarkInsights(result);
  const videoNode = `video_${id(videoId)}`;
  const hookNode = `hook_${structuredSignals.hook_type}`;
  const ctaNode = `cta_${structuredSignals.cta_type}`;
  const nicheNode = `niche_${id(structuredSignals.niche ?? 'unknown')}`;
  const formatNode = `format_${id(structuredSignals.format_type ?? 'unknown')}`;
  const retentionNode = `retention_${id(structuredSignals.risk_drop[0] ?? 'no_drop')}`;

  const nodes: TikTokGraphNode[] = [
    { id: videoNode, type: 'video', label: videoId, properties: { score: result.viralityScore, confidence: scoreConfidence(result, result.videoIntelligence?.technicalSignals) } },
    { id: hookNode, type: 'hook', label: structuredSignals.hook_type, properties: { score: result.hook.score } },
    { id: ctaNode, type: 'cta', label: structuredSignals.cta_type, properties: { score: result.coachAnalysis?.subScores.cta ?? null } },
    { id: nicheNode, type: 'niche', label: structuredSignals.niche ?? 'unknown', properties: {} },
    { id: formatNode, type: 'format', label: structuredSignals.format_type ?? 'unknown', properties: {} },
    { id: retentionNode, type: 'retention', label: structuredSignals.risk_drop[0] ?? 'no_drop_detected', properties: { risk_count: structuredSignals.risk_drop.length } },
  ];
  const edges: TikTokGraphEdge[] = [
    { from: videoNode, to: hookNode, relation: 'uses', weight: result.hook.score, evidence: 'Video tagged with hook_type.' },
    { from: videoNode, to: ctaNode, relation: 'uses', weight: result.coachAnalysis?.subScores.cta ?? result.viralityScore, evidence: 'Video tagged with cta_type.' },
    { from: videoNode, to: nicheNode, relation: 'belongs_to', weight: 70, evidence: 'Niche from analyzer context.' },
    { from: videoNode, to: formatNode, relation: 'belongs_to', weight: 70, evidence: 'Format detected by Viralynz Brain.' },
    { from: hookNode, to: retentionNode, relation: 'creates_risk', weight: structuredSignals.risk_drop.length * 20, evidence: 'Risk drops linked to hook/structure.' },
  ];
  if (result.repostVersion) {
    const repostNode = `repost_${id(result.repostVersion.hook)}`;
    nodes.push({ id: repostNode, type: 'repost', label: result.repostVersion.hook, properties: { score: result.coachAnalysis?.subScores.repostPotential ?? null } });
    edges.push({ from: repostNode, to: hookNode, relation: 'improves', weight: result.coachAnalysis?.subScores.repostPotential ?? 50, evidence: 'Repost strategist generated alternate hook.' });
  }

  return {
    version: 'tiktok-graph-v1',
    videoId,
    userId,
    tags,
    structuredSignals,
    benchmarkInsights,
    nodes,
    edges,
  };
}
