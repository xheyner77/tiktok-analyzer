import { redirect } from 'next/navigation';

export default function LegacyHookRewritePage() {
  redirect('/dashboard/rewrite');
}
