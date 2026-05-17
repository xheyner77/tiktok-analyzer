import { redirect } from 'next/navigation';

export default async function AnalyzerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (typeof value === 'string') {
      query.set(key, value);
    }
  }

  redirect(`/dashboard/analyze${query.size ? `?${query.toString()}` : ''}`);
}
