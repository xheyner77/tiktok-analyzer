import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Analyse complète',
  description: 'Diagnostic complet Viralynz : moments faibles, décisions de montage, hooks alternatifs et plan de repost.',
  robots: { index: false, follow: false },
};

export default function AnalysesLayout({ children }: { children: React.ReactNode }) {
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
