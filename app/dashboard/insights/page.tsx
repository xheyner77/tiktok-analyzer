import { redirect } from 'next/navigation';
import MemoryPageClient from '@/components/dashboard-v2/MemoryPageClient';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardInsightsPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/insights');

  return <MemoryPageClient />;
}
