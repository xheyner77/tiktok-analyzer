'use client';

import ResultsPanel from '@/components/ResultsPanel';
import type { AnalysisResult } from '@/lib/types';

const DEMO: AnalysisResult = {
  analysisSource: 'vision_upload',
  viralityScore: 68,
  structureScore: 75,
  observedPerformanceScore: 54,
  observedPerformanceLabel: 'Performance correcte',
  observedPerformanceEstimated: false,
  overperformanceDetected: false,
  finalVerdict: 'Retravailler packaging/timing pour maximiser la rétention.',
  observedStatsSource: 'live_page',
  analyzerMeta: {
    analysisMode: 'demo',
    analysisModeLabel: 'Preview demo',
    isFallback: true,
    analysisConfidence: {
      score: 45,
      level: 'faible',
      reasons: ['Donnees de demonstration, non issues de votre compte.'],
    },
    signalDisclosure: {
      observedData: ['Exemple de metrics affichees'],
      aiHypotheses: ['Diagnostic hook', 'Risque de retention'],
      simulations: ['Score de diagnostic'],
      previews: ['Sortie demo non personnalisee'],
    },
    validationWarnings: ['Preview demo : donnees fictives et hypotheses non personnalisees.'],
  },
  observedMetrics: { views: 213900, likes: 2200, comments: 180, shares: 154 },
  comparativeInsight:
    'Exemple de sortie : cette vidéo montre des signaux de hook favorables, à confirmer avec des données TikTok réelles.',
  comparativePriority:
    'Priorité estimée : améliorer le montage pour renforcer le potentiel de rétention.',
  hook: {
    score: 80,
    rating: 'Bon',
    analysis:
      'Hook visuel efficace — phrase percutante dès la première seconde, bonne pertinence du sujet.',
    strengths: ['Phrase percutante', 'Pertinence du sujet', 'Ton direct et engageant'],
    weaknesses: ['Peut manquer d\u2019originalité', 'Peu de différenciation visuelle'],
  },
  editing: {
    score: 70,
    rating: 'Moyen',
    analysis:
      'Montage cohérent mais manque de dynamisme dans les transitions et le rythme global.',
    strengths: ['Cohérence visuelle', 'Sous-titres efficaces', 'Rythme globalement correct'],
    weaknesses: ['Transitions peu marquées', 'Rythme parfois lent', 'Coupes trop longues'],
  },
  retention: {
    score: 70,
    rating: 'Moyen',
    analysis:
      'La rétention se maintient en première moitié mais chute faute de pattern interrupt central.',
    strengths: ['Bon départ', 'CTA en fin de vidéo', 'Accroche initiale solide'],
    weaknesses: ['Baisse à 50\u00a0% de la vidéo', 'Pas de rebondissement central'],
  },
  improvements: [
    { priority: 'haute',   tip: 'Ajouter des effets visuels dynamiques pour relancer l\u2019attention.' },
    { priority: 'haute',   tip: 'Incorporer des punchlines inattendues pour capter l\u2019attention.' },
    { priority: 'moyenne', tip: 'Utiliser des transitions plus marquées entre chaque plan.' },
    { priority: 'moyenne', tip: 'Raccourcir la durée globale pour un rythme plus soutenu.' },
    { priority: 'basse',   tip: 'Ajouter un call-to-action explicite en fin de vidéo.' },
  ],
};

export default function LandingResultsDemo() {
  return <ResultsPanel data={DEMO} plan="pro" />;
}
