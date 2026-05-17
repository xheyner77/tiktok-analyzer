export type TemplateKind = 'hook' | 'repost_plan' | 'cta' | 'storytelling' | 'tutorial' | 'ecommerce';

export interface ContentTemplate {
  id: string;
  kind: TemplateKind;
  title: string;
  structure: string[];
  bestFor: string[];
}

export const contentTemplates: ContentTemplate[] = [
  { id: 'hook_direct_error', kind: 'hook', title: 'Erreur directe', structure: ['Stop + erreur', 'Consequence', 'Promesse'], bestFor: ['repost', 'watchtime'] },
  { id: 'repost_watchtime', kind: 'repost_plan', title: 'Version watchtime', structure: ['0-2s tension', '2-5s preuve', '5-12s explication', 'fin question'], bestFor: ['retention'] },
  { id: 'cta_question', kind: 'cta', title: 'CTA question', structure: ['Question simple', 'Mot-cle optionnel', 'Reponse en commentaire'], bestFor: ['commentaires'] },
  { id: 'story_failure', kind: 'storytelling', title: 'Erreur personnelle', structure: ['Avant', 'Erreur', 'Moment de bascule', 'Lecon'], bestFor: ['emotion'] },
  { id: 'tutorial_fast', kind: 'tutorial', title: 'Tutoriel court', structure: ['Resultat', 'Etape 1', 'Etape 2', 'Erreur a eviter'], bestFor: ['sauvegardes'] },
  { id: 'ecommerce_proof', kind: 'ecommerce', title: 'Preuve produit', structure: ['Probleme client', 'Demo', 'Resultat', 'CTA achat doux'], bestFor: ['conversion'] },
];
