import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connecte-toi à Viralynz pour retrouver tes analyses et tes plans de repost.',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
