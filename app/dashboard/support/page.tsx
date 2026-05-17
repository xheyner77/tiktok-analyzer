import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardSupportPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/support');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Assistance"
      title="Support"
      description="Besoin d’aide ? Contacte l’équipe Viralynz."
      status="Support"
      ctaHref="mailto:contact@viralynz.com"
      ctaLabel="Nous contacter"
      details={[
        'Question compte, billing ou accès.',
        'Bug sur une analyse, un hook ou une V2.',
        'Retour produit pour rendre le coach de repost plus utile.',
      ]}
    />
  );
}
