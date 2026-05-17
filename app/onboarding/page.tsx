import Link from 'next/link';
import { redirect } from 'next/navigation';
import FloatingParticles from '@/components/FloatingParticles';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const steps = [
  {
    title: 'Analyse une vidéo sans connecter TikTok',
    body: 'Upload une vidéo, choisis l’objectif et récupère un diagnostic avec score, hook, drop principal et mini timeline.',
  },
  {
    title: 'Lis le signal, pas un avis vague',
    body: 'Chaque diagnostic doit expliquer le signal détecté, la preuve, l’impact et la correction à tester.',
  },
  {
    title: 'Prépare une structure à remonter',
    body: 'Viralynz transforme le diagnostic en hook corrigé, ordre recommandé, CTA et actions de montage.',
  },
  {
    title: 'Construis ta mémoire créateur',
    body: 'Plus tu analyses, plus Viralynz repère tes patterns: intros trop longues, payoff tardif, CTA faible ou hooks qui reviennent.',
  },
];

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/onboarding');

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/10 via-vn-violet/8 to-vn-indigo/8 blur-[110px]" />
        <FloatingParticles count={18} />
      </div>
      <section className="relative mx-auto max-w-5xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-vn-violet/80">Onboarding</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Comprends pourquoi tes TikToks décrochent. Reconstruis leur structure.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
          Le premier test doit être immédiat: pas de connexion TikTok obligatoire, pas de dashboard vide, juste un diagnostic exploitable.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-violet/80">Étape {index + 1}</p>
              <h2 className="mt-3 text-lg font-black text-white">{step.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">{step.body}</p>
            </article>
          ))}
        </div>
        <Link href="/dashboard/analyze" className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-3 text-sm font-black text-white transition hover:brightness-110">
          Lancer la première analyse
        </Link>
      </section>
    </main>
  );
}
