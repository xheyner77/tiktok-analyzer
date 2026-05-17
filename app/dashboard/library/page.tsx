import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardLibraryPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/library');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Bibliothèque contenu"
      title="Centralise tes vidéos, hooks et V2"
      description="La bibliothèque deviendra l’espace de classement des analyses, hooks sauvegardés et contenus à retravailler."
      status="Bientôt disponible"
      ctaHref="/dashboard/analyze"
      ctaLabel="Analyser une vidéo"
      details={['Analyses sauvegardées', 'Hooks favoris', 'V2 prêtes à retravailler']}
    />
  );
}
