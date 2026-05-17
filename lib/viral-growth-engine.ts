export type SharePlatform = 'tiktok' | 'x' | 'linkedin' | 'discord';

export interface ShareableAnalysisCard {
  id: string;
  title: string;
  eyebrow: string;
  format: 'before_after' | 'hook_vs_hook' | 'drop_detected' | 'timeline' | 'repost_fix';
  platformFit: SharePlatform[];
  lines: string[];
  footer: string;
}

export interface HookRewriteVariant {
  type: 'direct' | 'proof' | 'curiosity' | 'tension' | 'short';
  label: string;
  hook: string;
  why: string;
  score: number;
}

export interface PublicHook {
  id: string;
  category: 'business' | 'storytelling' | 'proof' | 'facecam' | 'education';
  hook: string;
  useCase: string;
  tags: string[];
}

export interface ViralContentTemplate {
  id: string;
  title: string;
  platform: 'tiktok' | 'x';
  structure: string[];
  example: string;
}

function clamp(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function cleanHook(value: string) {
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function topicFromHook(hook: string) {
  const clean = cleanHook(hook);
  return clean.replace(/^(je vais|aujourd'hui|dans cette video|voici)/i, '').trim() || 'ce sujet';
}

export function rewriteHook(input: string): HookRewriteVariant[] {
  const hook = cleanHook(input);
  const topic = topicFromHook(hook);
  const weakIntro = /aujourd'hui|je vais|dans cette video|petite video|salut/i.test(hook);
  const base = weakIntro ? 54 : hook.length <= 75 ? 68 : 60;
  const variants: HookRewriteVariant[] = [
    {
      type: 'direct',
      label: 'Version directe',
      hook: `Tu perds des vues a cause de ca: ${topic}`,
      why: 'Commence par le probleme au lieu du contexte.',
      score: clamp(base + 12),
    },
    {
      type: 'proof',
      label: 'Version preuve',
      hook: `La preuve que ${topic} change tout en 3 secondes`,
      why: 'Promet une preuve rapide avant l explication.',
      score: clamp(base + 16),
    },
    {
      type: 'curiosity',
      label: 'Version curiosite',
      hook: `Le detail que presque personne ne regarde: ${topic}`,
      why: 'Cree une boucle ouverte simple sans surpromesse.',
      score: clamp(base + 10),
    },
    {
      type: 'tension',
      label: 'Version tension',
      hook: `Stop: ${topic} peut tuer ta retention avant 0:03`,
      why: 'Ajoute une consequence claire et un timestamp concret.',
      score: clamp(base + 14),
    },
    {
      type: 'short',
      label: 'Version courte',
      hook: `${topic}: le vrai probleme est ici`,
      why: 'Plus court, plus lisible en texte ecran.',
      score: clamp(base + 8),
    },
  ];
  return variants.sort((a, b) => b.score - a.score);
}

export const publicHooks: PublicHook[] = [
  { id: 'business-proof-1', category: 'business', hook: 'La preuve que ton offre ne manque pas de clients, mais de clarte', useCase: 'Audit offre / business', tags: ['preuve', 'business', 'facecam'] },
  { id: 'business-direct-1', category: 'business', hook: 'Tu perds des ventes avant meme que les gens comprennent ton offre', useCase: 'CTA / conversion', tags: ['direct', 'conversion'] },
  { id: 'story-1', category: 'storytelling', hook: 'J ai compris trop tard pourquoi cette video avait flop', useCase: 'Retour experience', tags: ['story', 'flop'] },
  { id: 'story-2', category: 'storytelling', hook: 'La partie que je voulais couper est celle qui a tout change', useCase: 'Narration creator', tags: ['story', 'retention'] },
  { id: 'proof-1', category: 'proof', hook: 'Regarde la difference entre ces deux intros', useCase: 'Avant / apres', tags: ['preuve', 'repost'] },
  { id: 'proof-2', category: 'proof', hook: 'Meme sujet, hook different: voila pourquoi le second retient mieux', useCase: 'Comparaison hooks', tags: ['preuve', 'analyse'] },
  { id: 'facecam-1', category: 'facecam', hook: 'Si tu fais des facecams, evite cette intro', useCase: 'Facecam conseil', tags: ['facecam', 'erreur'] },
  { id: 'facecam-2', category: 'facecam', hook: 'Ton visage ne suffit pas: il faut une tension visible', useCase: 'Opening facecam', tags: ['facecam', 'tension'] },
  { id: 'education-1', category: 'education', hook: 'La methode simple pour rendre ton conseil regardable', useCase: 'Tutoriel / education', tags: ['education', 'clarte'] },
  { id: 'education-2', category: 'education', hook: 'Explique moins au debut. Montre la preuve d abord.', useCase: 'Conseil educatif', tags: ['education', 'preuve'] },
];

export const viralContentTemplates: ViralContentTemplate[] = [
  {
    id: 'why-flop',
    title: 'Pourquoi cette video flop',
    platform: 'tiktok',
    structure: ['Montrer le hook original', 'Nommer le probleme exact', 'Afficher le timestamp du drop', 'Montrer la correction'],
    example: 'Cette video ne flop pas a cause du sujet. Elle flop parce que la preuve arrive apres le contexte.',
  },
  {
    id: 'hook-problem',
    title: 'Le vrai probleme de ce hook',
    platform: 'x',
    structure: ['Hook original', 'Ce qui bloque', 'Version corrigee', 'Pourquoi elle retient mieux'],
    example: 'Le hook explique. Le repost doit prouver.',
  },
  {
    id: 'three-seconds',
    title: '3 secondes qui detruisent la retention',
    platform: 'tiktok',
    structure: ['0:00 hook', '0:03 drop probable', 'Cause', 'Fix concret'],
    example: 'A 0:03, la video donne encore du contexte. Le viewer attend deja la preuve.',
  },
  {
    id: 'before-after',
    title: 'Avant / apres repost',
    platform: 'x',
    structure: ['Avant', 'Apres', 'Signal utilise', 'Regle appliquee'],
    example: 'Avant: sujet clair. Apres: preuve claire.',
  },
];

export function buildDemoShareCards(): ShareableAnalysisCard[] {
  return [
    {
      id: 'before-after',
      title: 'Avant / apres repost',
      eyebrow: 'Repost Lab',
      format: 'before_after',
      platformFit: ['tiktok', 'x', 'linkedin', 'discord'],
      lines: ['Avant: intro explicative', 'Apres: preuve en 2 secondes', 'Gain: moins de contexte, plus de tension'],
      footer: 'Powered by Viralynz',
    },
    {
      id: 'hook-vs-hook',
      title: 'Hook original vs optimise',
      eyebrow: 'Hook Rewrite',
      format: 'hook_vs_hook',
      platformFit: ['x', 'linkedin', 'discord'],
      lines: ['Original: Je vais vous expliquer...', 'Optimise: Tu perds des vues ici', 'Regle: probleme avant contexte'],
      footer: 'Powered by Viralynz',
    },
    {
      id: 'drop-detected',
      title: 'Drop detecte',
      eyebrow: 'Retention Risk',
      format: 'drop_detected',
      platformFit: ['tiktok', 'discord'],
      lines: ['Risque a 0:04', 'Cause: payoff pas encore visible', 'Fix: montrer la preuve avant 0:03'],
      footer: 'Powered by Viralynz',
    },
    {
      id: 'timeline',
      title: 'Timeline intelligente',
      eyebrow: 'Viralynz Brain',
      format: 'timeline',
      platformFit: ['linkedin', 'discord', 'x'],
      lines: ['0:00 hook', '0:03 risque drop', '0:06 preuve', '0:12 CTA'],
      footer: 'Powered by Viralynz',
    },
  ];
}
