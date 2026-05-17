import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import DashboardV2Client from '@/components/dashboard-v2/DashboardV2Client';
import { getDashboardData } from '@/lib/dashboard-data';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Dashboard | Viralynz',
  description: 'Dashboard Viralynz pour prioriser les vidéos à corriger, suivre la mémoire créateur et préparer les prochains plans de remontage.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard');
  }

  const dashboard = await getDashboardData();

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
      <DashboardV2Client dashboard={dashboard}>{children}</DashboardV2Client>
    </>
  );
}
