import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardCollectionsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/collections');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Collections"
      title="Range tes contenus par angle, format ou série"
      description="Les collections serviront à organiser les analyses et idées de repost en dossiers exploitables pour ton workflow créateur."
      status="Bientôt disponible"
      ctaHref="/dashboard/analyze"
      ctaLabel="Créer une première analyse"
      details={['Séries de contenus', 'Angles à retester', 'Formats à comparer']}
    />
  );
}
