import Link from 'next/link';
import { buildDemoShareCards, viralContentTemplates } from '@/lib/viral-growth-engine';

export default function ShareCardsPage() {
  const cards = buildDemoShareCards();
  return (
    <main className="min-h-screen bg-[#020611] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(124,58,237,0.25),transparent_64%),radial-gradient(ellipse_45%_34%_at_100%_18%,rgba(34,211,238,0.12),transparent_58%)]" />
      <section className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/80">Shareable Analysis Cards</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Cartes de diagnostic partageables.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
              Avant/après structure, hook original vs corrigé, drop détecté et timeline propre pour TikTok, X, LinkedIn et Discord.
            </p>
          </div>
          <Link href="/roast-my-tiktok" className="rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-3 text-sm font-black text-white transition hover:brightness-110">
            Roast my TikTok
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.id} className="aspect-[4/5] rounded-[1.75rem] border border-white/[0.1] bg-[radial-gradient(circle_at_20%_0%,rgba(217,70,239,0.25),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-5 shadow-[0_34px_110px_-78px_rgba(124,58,237,0.95)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-violet/80">{card.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-black leading-tight text-white">{card.title}</h2>
              <div className="mt-6 grid gap-3">
                {card.lines.map((line) => (
                  <p key={line} className="rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm font-bold text-gray-200">{line}</p>
                ))}
              </div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{card.footer}</p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-5">
          <h2 className="text-xl font-black text-white">Templates de diagnostic</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {viralContentTemplates.map((template) => (
              <article key={template.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-black text-white">{template.title}</h3>
                  <span className="rounded-md bg-white/[0.055] px-2 py-0.5 text-[10px] font-bold uppercase text-gray-400">{template.platform}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">{template.example}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.structure.map((step) => <span key={step} className="rounded-md bg-vn-violet/12 px-2 py-0.5 text-[10px] font-bold text-vn-violet">{step}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
