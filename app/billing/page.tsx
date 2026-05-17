import Link from 'next/link';
import { redirect } from 'next/navigation';
import FloatingParticles from '@/components/FloatingParticles';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const planCopy = {
  free: '3 analyses par mois, sans connexion TikTok obligatoire. Résultat partiel, utile, avec les blocs premium floutés.',
  creator: 'Corrections essentielles, mémoire courte et diagnostics rapides pour comprendre pourquoi une vidéo décroche.',
  pro: 'Mémoire étendue, Reconstruction Workspace, hooks, CTA, experiments et boucle d’amélioration contenu.',
  scale: 'Workspace équipe, mémoire multi-comptes, publishing, collaboration et benchmarks avancés.',
};

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/billing');

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/10 via-vn-violet/8 to-vn-indigo/8 blur-[110px]" />
        <FloatingParticles count={18} />
      </div>
      <section className="relative mx-auto max-w-5xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-vn-violet/80">Billing</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Plan et accès produit</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
          Ton plan détermine la profondeur de mémoire, les modules de reconstruction et les workflows disponibles dans Viralynz.
        </p>

        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Plan actuel</p>
          <h2 className="mt-3 text-3xl font-black capitalize text-white">{plan}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">{planCopy[plan]}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/#pricing" className="rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-3 text-sm font-black text-white transition hover:brightness-110">
              Comparer les plans
            </Link>
            <Link href="/dashboard#repost-workspace" className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.08]">
              Voir le Reconstruction Workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
