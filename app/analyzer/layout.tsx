import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analyser une vidéo TikTok',
  description:
    'Importe ta vidéo TikTok et reçois un diagnostic structuré avec hook, rétention, CTA, timeline et plan de remontage — Viralynz.',
};

export default function AnalyzerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
