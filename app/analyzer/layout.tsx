import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analyser une vidéo',
  description:
    'Importe une vidéo courte, enrichis avec un lien TikTok optionnel, et reçois une analyse IA : hook, montage, rétention et conseils — Viralynz.',
};

export default function AnalyzerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
