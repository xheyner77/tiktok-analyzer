import Link from 'next/link';
import { redirect } from 'next/navigation';
import FloatingParticles from '@/components/FloatingParticles';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/account');

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  const tiktokConnected = !!user?.tiktok_open_id;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/10 via-vn-violet/8 to-vn-indigo/8 blur-[110px]" />
        <FloatingParticles count={18} />
      </div>
      <section className="relative mx-auto max-w-5xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-vn-violet/80">Account</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Compte créateur</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
          Ton compte centralise le plan, l’accès produit et les connexions qui alimentent la mémoire créateur.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Email</p>
            <p className="mt-3 truncate text-sm font-black text-white">{session.email}</p>
          </article>
          <article className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Plan</p>
            <p className="mt-3 text-sm font-black capitalize text-white">{plan}</p>
          </article>
          <article className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">TikTok</p>
            <p className="mt-3 text-sm font-black text-white">{tiktokConnected ? 'Connecté' : 'Optionnel'}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              {tiktokConnected ? 'La mémoire peut utiliser les signaux liés au profil.' : 'Tu peux tester Viralynz sans connecter TikTok.'}
            </p>
          </article>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/settings" className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.08]">
            Ouvrir les réglages
          </Link>
          <Link href="/dashboard/billing" className="rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-3 text-sm font-black text-white transition hover:brightness-110">
            Voir le plan
          </Link>
        </div>
      </section>
    </main>
  );
}
