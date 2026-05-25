import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, Plus_Jakarta_Sans, Syne } from 'next/font/google';
import Navbar from '@/components/Navbar';
import FooterWrapper from '@/components/FooterWrapper';
import StarsBackdrop from '@/components/StarsBackdrop';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';
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
    default: 'Viralynz — Comprends pourquoi tes TikToks décrochent',
    template: '%s | Viralynz',
  },
  description:
    'Viralynz analyse tes vidéos, repère les moments faibles et prépare une structure optimisée à remonter avec hook, rétention, CTA, mémoire créateur et priorités actionnables.',
  openGraph: {
    title: 'Viralynz — Analyse, mémoire créateur et reconstruction TikTok',
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
    description: 'Comprends pourquoi tes TikToks décrochent, corrige le hook et prépare une structure optimisée avec une mémoire créateur persistante.',
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
        <LanguageProvider>
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
        </LanguageProvider>
      </body>
    </html>
  );
}
