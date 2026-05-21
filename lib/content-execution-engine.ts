import type { Plan } from './supabase';
import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import type { ContentWorkspaceState } from './content-workspace-engine';
import type { StrategicDecisionState } from './strategic-decision-engine';
import type { TikTokPublishingState } from './tiktok-publishing-engine';

export type HookRewriteMode = 'direct' | 'tension' | 'proof' | 'storytelling' | 'short' | 'aggressive';
export type CtaRewriteMode = 'comment' | 'engagement' | 'emotion' | 'short' | 'tension';
export type EditingSuggestionType = 'zoom' | 'cut_speed' | 'on_screen_text' | 'pattern_interrupt' | 'caption_density';

export interface HookRewriteVariant {
  id: string;
  mode: HookRewriteMode;
  hook: string;
  why: string;
  basedOn: string[];
  confidence: number;
  score: number;
}

export interface CtaRewriteVariant {
  id: string;
  mode: CtaRewriteMode;
  cta: string;
  why: string;
  confidence: number;
}

export interface CaptionVariant {
  id: string;
  caption: string;
  format: 'clean' | 'curiosity' | 'proof' | 'community';
  hashtags: string[];
  why: string;
  confidence: number;
}

export interface StructureRewrite {
  id: string;
  currentOrder: string[];
  recommendedOrder: string[];
  reason: string;
  expectedImpact: string;
  confidence: number;
}

export interface AutoVariantSet {
  id: string;
  title: string;
  variants: string[];
  testSuggestion: string;
  saveReason: string;
}

export interface EditingSuggestion {
  id: string;
  type: EditingSuggestionType;
  timestamp: string;
  suggestion: string;
  reason: string;
  confidence: number;
}

export interface ContentExecutionState {
  executionScore: number;
  hookRewrites: HookRewriteVariant[];
  ctaRewrites: CtaRewriteVariant[];
  captionVariants: CaptionVariant[];
  structureRewrite: StructureRewrite;
  autoVariants: AutoVariantSet[];
  editingSuggestions: EditingSuggestion[];
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function activeItem(items: RepostPriorityInput[], decisions: StrategicDecisionState) {
  return items.find((item) => item.id === decisions.topDecision.sourceId) ?? items[0];
}

function cleanHook(value?: string) {
  return value?.replace(/^["'\s]+|["'\s]+$/g, '').trim();
}

function nicheFor(item?: RepostPriorityInput, workspace?: ContentWorkspaceState) {
  return item?.result.analyzerMeta?.nicheLabel
    ?? item?.result.analyzerMeta?.niche
    ?? workspace?.activeProject.niche
    ?? 'TikTok';
}

function makeHookBase(item: RepostPriorityInput | undefined, contentOS: ContentOperatingSystem, workspace: ContentWorkspaceState) {
  return cleanHook(item?.result.repostVersion?.hook)
    ?? cleanHook(item?.result.coachAnalysis?.hookVariants?.[0])
    ?? cleanHook(contentOS.creatorDNA.frequentHooks[0])
    ?? `${nicheFor(item, workspace)}: ce detail change tout`;
}

function buildHookRewrites(
  item: RepostPriorityInput | undefined,
  contentOS: ContentOperatingSystem,
  workspace: ContentWorkspaceState,
): HookRewriteVariant[] {
  const niche = nicheFor(item, workspace);
  const base = makeHookBase(item, contentOS, workspace);
  const proof = item?.result.hook.strengths[0] ?? contentOS.creatorDNA.strengths[0] ?? 'preuve rapide';
  const weakness = item?.result.hook.weaknesses[0] ?? contentOS.creatorDNA.weaknesses[0] ?? 'intro trop descriptive';
  const benchmark = workspace.activeProject.memory.benchmarks[0] ?? 'hooks plus directs dans ce format';
  const variants: Array<[HookRewriteMode, string, string]> = [
    ['direct', `Voici ce que ${niche} fait perdre en 3 secondes`, 'Rend le sujet immediat et actionnable.'],
    ['tension', `Tu fais peut-etre cette erreur sans la voir`, 'Cree une tension claire sans inventer de performance.'],
    ['proof', `J ai teste ca: ${proof.toLowerCase()}`, 'Met une preuve ou un resultat avant le contexte.'],
    ['storytelling', `Au debut je pensais que ${weakness.toLowerCase()} etait normal`, 'Ouvre une boucle narrative reliee a l erreur detectee.'],
    ['short', base.length > 58 ? base.slice(0, 55).replace(/\s+\S*$/, '') : `Stop: ${niche} change ici`, 'Version plus courte pour reduire la friction.'],
    ['aggressive', `Arrete de commencer tes videos comme ca`, 'Plus fort, utile si le style createur accepte plus de tension.'],
  ];
  return variants.map(([mode, hook, why], index) => ({
    id: `hook_rewrite_${mode}`,
    mode,
    hook,
    why,
    basedOn: [benchmark, weakness, contentOS.creatorDNA.dominantStyle].filter(Boolean),
    confidence: clamp(48 + (item?.result.hook.score ?? 42) * 0.35 + workspace.activeProject.videosCount * 4),
    score: clamp((item?.result.hook.score ?? 48) + 12 - index * 2),
  }));
}

function buildCtaRewrites(item: RepostPriorityInput | undefined, contentOS: ContentOperatingSystem): CtaRewriteVariant[] {
  const original = item?.result.repostVersion?.cta ?? item?.result.coachAnalysis?.optimizedCtas?.[0] ?? contentOS.creatorDNA.frequentCtas[0] ?? 'Tu veux la version complete ?';
  const variants: Array<[CtaRewriteMode, string, string]> = [
    ['comment', 'Commente "hook" et je te donne la version courte.', 'CTA commentaire simple, facile a executer.'],
    ['engagement', 'Lequel tu aurais garde: A ou B ?', 'Force une reponse comparative.'],
    ['emotion', 'Si tu t es reconnu, sauvegarde avant de poster.', 'Connecte le CTA au probleme detecte.'],
    ['short', original.length > 42 ? 'Tu testes ca ?' : original, 'Reduit la longueur du CTA.'],
    ['tension', 'La plupart corrigent le montage, pas le vrai probleme.', 'CTA plus tendu pour pousser la discussion.'],
  ];
  return variants.map(([mode, cta, why], index) => ({
    id: `cta_rewrite_${mode}`,
    mode,
    cta,
    why,
    confidence: clamp(62 - index * 3 + (item?.result.coachAnalysis?.subScores.cta ?? 50) * 0.22),
  }));
}

function buildCaptionVariants(
  item: RepostPriorityInput | undefined,
  workspace: ContentWorkspaceState,
  publishing: TikTokPublishingState,
): CaptionVariant[] {
  const draft = publishing.drafts[0];
  const niche = nicheFor(item, workspace);
  const hashtags = draft?.hashtags ?? [`#${niche.toLowerCase().replace(/[^a-z0-9]+/g, '')}`, '#viralynz'];
  const issue = item?.result.coachAnalysis?.detectedProblems?.[0]?.title ?? workspace.activeProject.memory.recurringErrors[0] ?? 'hook';
  return [
    {
      id: 'caption_clean',
      format: 'clean',
      caption: `${draft?.hook ?? `Ton ${niche} peut etre plus clair.`} ${draft?.cta ?? 'Tu testerais quelle version ?'}`,
      hashtags,
      why: 'Caption courte qui ne dilue pas le hook.',
      confidence: 64,
    },
    {
      id: 'caption_curiosity',
      format: 'curiosity',
      caption: `Le probleme n est pas toujours le montage. Parfois c est ${issue.toLowerCase()}.`,
      hashtags,
      why: 'Cree une boucle ouverte reliee au diagnostic.',
      confidence: 58,
    },
    {
      id: 'caption_proof',
      format: 'proof',
      caption: `Avant de repost, regarde les 3 premieres secondes: c est souvent la que tout se joue.`,
      hashtags,
      why: 'Positionne la video comme preuve/action, sans fausses stats.',
      confidence: 60,
    },
    {
      id: 'caption_community',
      format: 'community',
      caption: `Tu gardes quelle intro: directe, preuve ou storytelling ?`,
      hashtags,
      why: 'Invite une comparaison utile pour nourrir la feedback loop.',
      confidence: 56,
    },
  ];
}

function buildStructureRewrite(item: RepostPriorityInput | undefined, contentOS: ContentOperatingSystem): StructureRewrite {
  const current = item?.result.coachAnalysis?.videoSegments?.slice(0, 4).map((segment) => segment.mainProblem)
    ?? contentOS.repostWorkspace[0]?.oldStructure
    ?? ['contexte', 'explication', 'preuve', 'CTA'];
  const recommended = item?.result.repostVersion?.structure
    ?? contentOS.repostWorkspace[0]?.newStructure
    ?? ['preuve', 'payoff', 'explication', 'CTA'];
  return {
    id: 'structure_rewrite_primary',
    currentOrder: current.length ? current : ['contexte', 'explication', 'preuve', 'CTA'],
    recommendedOrder: recommended.length ? recommended : ['preuve', 'payoff', 'explication', 'CTA'],
    reason: item?.result.coachAnalysis?.detectedProblems?.[0]?.explanation ?? 'Le payoff doit arriver avant que le contexte prenne trop de place.',
    expectedImpact: 'Reduire le risque de scroll en donnant une raison de rester plus tot.',
    confidence: clamp(item?.result.videoIntelligence?.confidence.score ?? item?.result.retention.score ?? 54),
  };
}

function buildAutoVariants(hooks: HookRewriteVariant[], ctas: CtaRewriteVariant[], captions: CaptionVariant[]): AutoVariantSet[] {
  return [
    {
      id: 'auto_hooks',
      title: 'Hooks a comparer',
      variants: hooks.slice(0, 4).map((hook) => hook.hook),
      testSuggestion: 'Tester direct vs preuve sur le prochain repost.',
      saveReason: 'Alimente Hook Vault et mémoire créateur.',
    },
    {
      id: 'auto_ctas',
      title: 'CTA a tester',
      variants: ctas.slice(0, 4).map((cta) => cta.cta),
      testSuggestion: 'Comparer question courte vs CTA commentaire.',
      saveReason: 'Permet au moteur de prioriser les CTA vraiment utiles.',
    },
    {
      id: 'auto_captions',
      title: 'Captions prêtes',
      variants: captions.slice(0, 3).map((caption) => caption.caption),
      testSuggestion: 'Associer la caption curiosity au hook tension.',
      saveReason: 'Garde les angles reutilisables par niche/projet.',
    },
  ];
}

function buildEditingSuggestions(item: RepostPriorityInput | undefined): EditingSuggestion[] {
  const timeline = item?.result.coachAnalysis?.timeline ?? [];
  const firstTime = timeline[0]?.time ?? '0:00-0:03';
  const weakTime = item?.result.structuredDiagnostics?.[0]?.timestamp ?? timeline[1]?.time ?? '0:03-0:06';
  const patternInterruptCount = item?.result.videoIntelligence?.technicalSignals?.visual.patternInterrupts.length
    ?? item?.result.videoIntelligence?.visualSignals.cutDensityEstimate
    ?? 0;
  return [
    {
      id: 'edit_zoom',
      type: 'zoom',
      timestamp: firstTime,
      suggestion: 'Ajouter un zoom leger au moment ou la preuve arrive.',
      reason: 'Renforce le payoff sans transformer Viralynz en editeur video complet.',
      confidence: 58,
    },
    {
      id: 'edit_cut_speed',
      type: 'cut_speed',
      timestamp: weakTime,
      suggestion: 'Raccourcir le plan ou accelerer le cut avant la prochaine phrase.',
      reason: item?.result.retention.weaknesses[0] ?? 'Risque de baisse de rythme detecte.',
      confidence: clamp(item?.result.retention.score ? 100 - item.result.retention.score : 52),
    },
    {
      id: 'edit_text',
      type: 'on_screen_text',
      timestamp: firstTime,
      suggestion: 'Afficher la promesse en texte ecran sur une ligne courte.',
      reason: 'Aide le viewer a comprendre avant meme le son.',
      confidence: 62,
    },
    {
      id: 'edit_interrupt',
      type: 'pattern_interrupt',
      timestamp: weakTime,
      suggestion: patternInterruptCount === 0 ? 'Ajouter cut, zoom ou changement de cadrage.' : 'Placer le pattern interrupt plus proche du drop.',
      reason: `${patternInterruptCount} pattern interrupt detecte dans les signaux disponibles.`,
      confidence: patternInterruptCount === 0 ? 66 : 54,
    },
  ];
}

export function buildContentExecutionEngine(input: {
  items: RepostPriorityInput[];
  contentOS: ContentOperatingSystem;
  workspace: ContentWorkspaceState;
  decisions: StrategicDecisionState;
  publishing: TikTokPublishingState;
  plan: Plan;
}): ContentExecutionState {
  const item = activeItem(input.items, input.decisions);
  const hookRewrites = buildHookRewrites(item, input.contentOS, input.workspace);
  const ctaRewrites = buildCtaRewrites(item, input.contentOS);
  const captionVariants = buildCaptionVariants(item, input.workspace, input.publishing);
  const structureRewrite = buildStructureRewrite(item, input.contentOS);
  const autoVariants = buildAutoVariants(hookRewrites, ctaRewrites, captionVariants);
  const editingSuggestions = buildEditingSuggestions(item);
  const executionScore = clamp(
    hookRewrites[0].score * 0.24
      + ctaRewrites[0].confidence * 0.16
      + captionVariants[0].confidence * 0.14
      + structureRewrite.confidence * 0.18
      + editingSuggestions[0].confidence * 0.12
      + input.publishing.publishingScore * 0.16,
  );

  return {
    executionScore,
    hookRewrites,
    ctaRewrites,
    captionVariants,
    structureRewrite,
    autoVariants,
    editingSuggestions,
    summary: executionScore
      ? `${hookRewrites.length} hooks, ${ctaRewrites.length} CTA, ${captionVariants.length} captions et ${editingSuggestions.length} suggestions montage pretes.`
      : 'Le copilote execution attend une analyse pour generer des variantes utiles.',
  };
}
