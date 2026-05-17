import { redirect } from 'next/navigation';
import DashboardPlaceholderPage from '@/components/dashboard-v2/DashboardPlaceholderPage';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardInsightsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/insights');
  }

  return (
    <DashboardPlaceholderPage
      eyebrow="Insights IA"
      title="Tes insights IA se débloquent avec tes analyses"
      description="Cette vue regroupera les recommandations, signaux faibles et priorités de reconstruction issues de tes vidéos réelles."
      status="Bientôt disponible"
      ctaHref="/dashboard/analyze"
      ctaLabel="Analyser une vidéo"
      details={['Priorités de correction consolidées', 'Synthèse des hooks et drops récurrents', 'Actions recommandées sans métriques inventées']}
    />
  );
}
