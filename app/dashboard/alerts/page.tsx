import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardAlertsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/alerts');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Alertes"
      title="Recevras les signaux importants au bon moment"
      description="Les alertes préviendront quand une analyse mérite une V2, quand TikTok doit être reconnecté ou quand une tendance demande ton attention."
      status="Bientôt disponible"
      ctaHref="/api/tiktok/connect"
      ctaLabel="Connecter TikTok"
      details={['Rappels de repost', 'Alertes de connexion', 'Signaux de tendance à vérifier']}
    />
  );
}
