import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardExportsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/exports');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Exports"
      title="Exporte tes diagnostics quand ton espace contient assez de matière"
      description="Les exports regrouperont les analyses, hooks et plans de V2 dans des formats faciles à partager avec une équipe ou un client."
      status="Bientôt disponible"
      ctaHref="/dashboard/analyze"
      ctaLabel="Analyser une vidéo"
      details={['Résumés d’analyse', 'Plans de V2', 'Exports équipe pour les plans avancés']}
    />
  );
}
