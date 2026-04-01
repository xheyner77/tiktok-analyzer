import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Syne } from 'next/font/google';
import Navbar from '@/components/Navbar';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://viralynz.com'),
  title: {
    default: 'Viralynz — Copilote IA pour vidéos courtes qui performent',
    template: '%s | Viralynz',
  },
  description:
    'Viralynz : copilote IA pour vidéos courtes — décode hook, montage et rétention, génère des hooks prêts à tourner. Pour créateurs, marques et équipes growth.',
  openGraph: {
    title: 'Viralynz',
    description:
      'Copilote IA pour scaler le contenu court : analyse structurée, hooks, itérations plus rapides.',
    url: 'https://viralynz.com',
    siteName: 'Viralynz',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viralynz',
    description: 'Analyse virale & hooks pour créateurs et marques.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${syne.variable}`}>
      <body className={`${jakarta.className} font-sans`}>
        <Navbar />
        <div className="pt-16 min-h-[calc(100vh-0px)] overflow-x-hidden">{children}</div>
      </body>
    </html>
  );
}
