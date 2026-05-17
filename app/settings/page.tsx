import Link from 'next/link';
import { redirect } from 'next/navigation';
import FloatingParticles from '@/components/FloatingParticles';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const settings = [
  {
    title: 'Mémoire créateur',
    body: 'Viralynz retient tes hooks, tes drops, tes CTA et les erreurs qui reviennent pour éviter les conseils génériques.',
    action: 'Gérer depuis le dashboard',
    href: '/dashboard#creator-memory',
  },
  {
    title: 'Expert Mode',
    body: 'Ajuste le poids du hook, de la rétention, du CTA et du payoff quand tu veux contrôler le moteur plus finement.',
    action: 'Ouvrir Expert Mode',
    href: '/dashboard#expert-mode',
  },
  {
    title: 'TikTok connecté',
    body: 'La connexion TikTok reste optionnelle pour tester. Elle devient utile pour enrichir la mémoire, suivre plusieurs comptes et préparer le publishing.',
    action: 'Voir les connexions',
    href: '/account',
  },
];

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/settings');

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/10 via-vn-violet/8 to-vn-indigo/8 blur-[110px]" />
        <FloatingParticles count={18} />
      </div>
      <section className="relative mx-auto max-w-5xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-vn-violet/80">Settings</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Réglages du moteur Viralynz</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
          Contrôle ce que Viralynz apprend, comment les analyses sont pondérées et quelles connexions alimentent la mémoire créateur.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {settings.map((item) => (
            <article key={item.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
              <h2 className="text-lg font-black text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{item.body}</p>
              <Link href={item.href} className="mt-5 inline-flex text-sm font-black text-vn-violet transition hover:text-white">
                {item.action}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
