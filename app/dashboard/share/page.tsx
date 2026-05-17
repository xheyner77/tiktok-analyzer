import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardSharePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/share');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Planification & publication"
      title="Programme tes reposts et compare les performances de tes V2"
      description="La publication assistée vivra ici: préparation des V2, suivi des reposts et comparaison des résultats quand tes comptes TikTok sont connectés."
      status="Disponible bientôt"
      ctaHref="/dashboard/analyze"
      ctaLabel="Analyser une vidéo"
      secondaryHref="/api/tiktok/connect"
      secondaryLabel="Connecter TikTok"
      details={['Planning des V2 à republier', 'Suivi des reposts connectés à TikTok', 'Comparaison V1 / V2 quand la donnée est disponible']}
    />
  );
}
