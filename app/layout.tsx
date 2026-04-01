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
    default: 'Viralynz — Analyse vidéo IA pour comprendre ce qui fait performer',
    template: '%s | Viralynz',
  },
  description:
    'Viralynz : intelligence virale pour le court format — analyse vidéo IA (hook, rétention, montage, CTA), priorités actionnables. Hook generator en complément. TikTok aujourd’hui, Reels & Shorts en roadmap.',
  openGraph: {
    title: 'Viralynz — Analyse vidéo IA',
    description:
      'Comprends pourquoi ta vidéo performe ou non : diagnostic structuré, moins de publication au hasard. Pour créateurs, e‑com, UGC, agences.',
    url: 'https://viralynz.com',
    siteName: 'Viralynz',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viralynz',
    description: 'Analyse vidéo IA pour TikTok et le court format — hooks en accélérateur.',
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
        <div className="pt-[4.25rem] min-h-[calc(100vh-0px)] overflow-x-hidden">{children}</div>
      </body>
    </html>
  );
}
