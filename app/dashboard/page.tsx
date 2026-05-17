import { redirect } from 'next/navigation';
import DashboardV2Client from '@/components/dashboard-v2/DashboardV2Client';
import { getDashboardData } from '@/lib/dashboard-data';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard');
  }

  const dashboard = await getDashboardData();

  return <DashboardV2Client dashboard={dashboard} />;
}
