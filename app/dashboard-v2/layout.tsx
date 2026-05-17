import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard V2',
  description: 'Dashboard Viralynz pour prioriser les vidéos à corriger, suivre la mémoire créateur et préparer les prochains plans de remontage.',
};

export default function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > nav,
            body > .stars-backdrop,
            body footer {
              display: none !important;
            }
          `,
        }}
      />
      {children}
    </>
  );
}
