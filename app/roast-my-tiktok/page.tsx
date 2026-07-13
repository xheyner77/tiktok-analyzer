import { redirect } from 'next/navigation';

export default function LegacyRoastPage() {
  redirect('/dashboard/analyze');
}
