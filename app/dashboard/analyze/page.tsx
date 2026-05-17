import AnalyzerV2Client from '@/components/analyzer/AnalyzerV2Client';

export const dynamic = 'force-dynamic';

export default async function DashboardAnalyzePage() {
  return <AnalyzerV2Client embedded />;
}
