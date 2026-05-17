import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardUpdatesPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/updates');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Produit"
      title="Nouveautés"
      description="Suis les dernières améliorations de Viralynz."
      status="Journal produit"
      ctaHref="/changelog"
      ctaLabel="Voir le changelog"
      details={[
        'Décisions produit et améliorations livrées.',
        'Évolutions du dashboard, des analyses et des plans de repost.',
        'Aucun faux signal: les nouveautés restent séparées de tes métriques.',
      ]}
    />
  );
}
