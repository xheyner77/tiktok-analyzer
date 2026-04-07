import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, Plus_Jakarta_Sans, Syne } from 'next/font/google';
import Navbar from '@/components/Navbar';
import FooterWrapper from '@/components/FooterWrapper';
import StarsBackdrop from '@/components/StarsBackdrop';
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

/** Hero landing : même ressenti typographique que les landings type Vinteer (Inter Black / tight tracking) */
const interHero = Inter({
  subsets: ['latin'],
  variable: '--font-inter-hero',
  weight: ['800', '900'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.viralynz.com'),
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
    url: 'https://www.viralynz.com',
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
    <html lang="fr" className={`${jakarta.variable} ${syne.variable} ${interHero.variable}`}>
      <body className={`${jakarta.className} font-sans bg-vn-bg text-white antialiased`}>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "w84s4jmhgx");`}
        </Script>
        <StarsBackdrop />
        <Navbar />
        <div className="relative z-[1] pt-[4.25rem] min-h-dvh overflow-x-hidden">{children}</div>
        <FooterWrapper />
      </body>
    </html>
  );
}
