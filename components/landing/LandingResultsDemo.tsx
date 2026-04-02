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
  observedMetrics: { views: 213900, likes: 2200, comments: 180, shares: 154 },
  comparativeInsight:
    'Cette vidéo performe dans le top 10\u00a0% de sa catégorie sur TikTok. Le hook est au-dessus de la moyenne créateurs.',
  comparativePriority:
    'Améliore le montage pour franchir le seuil top 5\u00a0%.',
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
