import type { Metadata, Viewport } from 'next';
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
  colorScheme: 'dark',
  themeColor: '#020611',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.viralynz.com'),
  applicationName: 'Viralynz',
  title: {
    default: 'Viralynz — Comprends pourquoi tes vidéos décrochent',
    template: '%s | Viralynz',
  },
  description:
    'Viralynz transforme chaque analyse TikTok, Reels ou Shorts en décisions de montage : quoi couper, avancer, réécrire, garder et republier dans une V2.',
  category: 'technology',
  creator: 'Viralynz',
  publisher: 'Viralynz',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    title: 'Viralynz — Du diagnostic à la V2 à republier',
    description:
      'Repère ce qui fait décrocher, transforme le diagnostic en décisions de montage et prépare une V2 plus tendue.',
    url: 'https://www.viralynz.com',
    siteName: 'Viralynz',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viralynz — Du diagnostic à la V2',
    description: 'Chaque score devient une décision de montage : couper, avancer, réécrire, garder ou republier.',
  },
  appleWebApp: {
    capable: true,
    title: 'Viralynz',
    statusBarStyle: 'black-translucent',
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
          <StarsBackdrop />
          <Navbar />
          <div className="relative z-[1] pt-[4.25rem] min-h-dvh overflow-x-hidden">{children}</div>
          <FooterWrapper />
        </LanguageProvider>
      </body>
    </html>
  );
}
