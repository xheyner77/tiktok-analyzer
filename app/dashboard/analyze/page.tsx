import { redirect } from 'next/navigation';
import AnalyzerV2Client from '@/components/analyzer/AnalyzerV2Client';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardAnalyzePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/analyze');
  }

  return <AnalyzerV2Client />;
}
