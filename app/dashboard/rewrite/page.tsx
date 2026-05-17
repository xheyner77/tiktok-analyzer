import { redirect } from 'next/navigation';
import HookRewritePage from '@/app/hook-rewrite/page';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardRewritePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/rewrite');
  }

  return <HookRewritePage />;
}
