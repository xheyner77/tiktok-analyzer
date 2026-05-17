import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardCompetitorsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/competitors');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Concurrents"
      title="Surveille les créateurs à analyser"
      description="Cette vue préparera les benchmarks et inspirations à suivre, sans afficher de données concurrentes non connectées ou inventées."
      status="Bientôt disponible"
      ctaHref="/dashboard/radar"
      ctaLabel="Ouvrir le radar"
      details={['Créateurs à suivre', 'Formats repérés', 'Opportunités à confirmer par analyse']}
    />
  );
}
