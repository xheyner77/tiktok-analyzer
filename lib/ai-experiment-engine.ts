import type { PerformanceDNA } from './performance-dna-engine';
import type { ContentCluster } from './content-cluster-system';

export interface AIExperiment {
  id: string;
  type: 'hook' | 'format' | 'duration' | 'cta' | 'rhythm' | 'structure';
  hypothesis: string;
  test: string;
  successSignal: string;
}

export function aiExperimentEngine(dna: PerformanceDNA, clusters: ContentCluster[]): AIExperiment[] {
  const topCluster = clusters[0]?.label ?? 'format principal';
  return [
    { id: 'exp_hook_short', type: 'hook', hypothesis: 'Un hook plus court augmente la retention initiale.', test: `Tester 3 hooks courts sur ${topCluster}.`, successSignal: 'Hook score et drop risk ameliores.' },
    { id: 'exp_format_series', type: 'format', hypothesis: 'Le meilleur cluster peut devenir une serie.', test: `Produire 3 variations ${topCluster}.`, successSignal: 'Score moyen cluster en hausse.' },
    { id: 'exp_duration_22s', type: 'duration', hypothesis: 'Une duree sous 25s reduit le drop.', test: 'Version courte 18-24 secondes.', successSignal: 'Watchtime potential en hausse.' },
    { id: 'exp_cta_question', type: 'cta', hypothesis: 'CTA question augmente les commentaires.', test: dna.creatorDNA.includes('Les CTA questions sont un levier a pousser.') ? 'Doubler les CTA questions.' : 'Tester 2 CTA questions.', successSignal: 'Comment potential en hausse.' },
    { id: 'exp_rhythm_interrupt', type: 'rhythm', hypothesis: 'Rupture visuelle a 0:05 relance attention.', test: 'Ajouter zoom/cut/stat choc a 0:05.', successSignal: 'Drop risk baisse.' },
    { id: 'exp_structure_proof', type: 'structure', hypothesis: 'Preuve avant explication performe mieux.', test: 'Inverser contexte et preuve.', successSignal: 'Prediction score en hausse.' },
  ];
}
