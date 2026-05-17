import { redirect } from 'next/navigation';
import UpdatesPageClient from '@/components/dashboard-v2/updates/UpdatesPageClient';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardUpdatesPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/updates');
  }

  return <UpdatesPageClient />;
}
