import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Générateur de hooks',
  description:
    'Génère des hooks textuels courts et percutants pour tes vidéos courtes — contexte, ton, scène. Viralynz.',
};

export default function HookGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
