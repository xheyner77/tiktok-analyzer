import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardCollectionsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/collections');
  }

  redirect('/dashboard/library?tab=collections');
}
