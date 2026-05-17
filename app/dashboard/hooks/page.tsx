import { redirect } from 'next/navigation';
import HookGeneratorPage from '@/app/hook-generator/page';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardHooksPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/hooks');
  }

  return <HookGeneratorPage />;
}
