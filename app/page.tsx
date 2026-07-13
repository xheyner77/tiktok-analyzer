import type { Metadata } from 'next';
import HomeLanding from '@/components/landing/HomeLanding';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return <HomeLanding />;
}
