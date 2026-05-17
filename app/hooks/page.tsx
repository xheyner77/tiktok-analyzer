import Link from 'next/link';
import { publicHooks } from '@/lib/viral-growth-engine';

const categories = ['business', 'storytelling', 'proof', 'facecam', 'education'] as const;

export default function PublicHooksPage() {
  return (
    <main className="min-h-screen bg-[#020611] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_72%_44%_at_50%_-10%,rgba(217,70,239,0.22),transparent_64%),radial-gradient(ellipse_45%_35%_at_100%_20%,rgba(59,130,246,0.14),transparent_58%)]" />
      <section className="relative mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-vn-violet/80">Public Hook Library</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Hooks TikTok par format</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
              Une bibliothèque publique de hooks concrets pour tester plus vite tes ouvertures, classée par niche et intention.
            </p>
          </div>
          <Link href="/dashboard/rewrite" className="rounded-xl bg-white/[0.07] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.1]">
            Réécrire mon hook
          </Link>
        </div>

        <div className="mt-8 grid gap-5">
          {categories.map((category) => (
            <section key={category} className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black capitalize text-white">{category}</h2>
                <span className="rounded-lg bg-white/[0.055] px-2.5 py-1 text-[10px] font-bold text-gray-400">Hook vault public</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {publicHooks.filter((hook) => hook.category === category).map((hook) => (
                  <article key={hook.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                    <p className="text-lg font-black leading-tight text-white">"{hook.hook}"</p>
                    <p className="mt-3 text-sm text-gray-500">{hook.useCase}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {hook.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-vn-violet/12 px-2 py-0.5 text-[10px] font-bold text-vn-violet">{tag}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
