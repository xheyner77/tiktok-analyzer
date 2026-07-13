import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC_PLANS, type CommercialPlanId } from '@/lib/public-plans';

export const metadata: Metadata = {
  title: 'Tarifs Viralynz',
  description: 'Compare les plans Viralynz et choisis le volume adapté à tes analyses, hooks et versions à reposter.',
};

const accents: Record<CommercialPlanId, string> = {
  free: 'border-white/[0.1] bg-white/[0.035]',
  starter: 'border-cyan-300/20 bg-cyan-300/[0.045]',
  pro: 'border-vn-fuchsia/45 bg-[linear-gradient(180deg,rgba(168,85,247,0.15),rgba(255,255,255,0.035))] shadow-[0_34px_110px_-72px_rgba(168,85,247,0.95)]',
  lifetime: 'border-amber-300/25 bg-amber-300/[0.045]',
};

export default function PricingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-vn-bg px-4 pb-20 pt-16 text-white sm:px-6 sm:pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[650px] bg-[radial-gradient(ellipse_58%_42%_at_50%_0%,rgba(168,85,247,0.2),transparent_68%),radial-gradient(circle_at_82%_14%,rgba(34,211,238,0.1),transparent_30%)]" aria-hidden />

      <div className="relative mx-auto max-w-6xl">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/75">Tarifs transparents</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">Un plan selon ton volume de repost</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-400 sm:text-base">
            Les quotas ci-dessous viennent des limites réellement appliquées par Viralynz. Les 3 analyses Free sont un quota total, pas un quota mensuel.
          </p>
        </header>

        <section aria-label="Plans Viralynz" className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PUBLIC_PLANS.map((plan) => (
            <article key={plan.id} className={`relative flex min-h-[450px] flex-col rounded-[22px] border p-5 backdrop-blur-xl ${accents[plan.id]}`}>
              {plan.featured && (
                <span className="absolute right-4 top-4 rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-100">
                  Le plus complet
                </span>
              )}
              <p className="text-sm font-black text-white">{plan.name}</p>
              <div className="mt-5">
                <p className="text-4xl font-black tracking-[-0.05em] text-white">{plan.priceLabel}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{plan.cadence}</p>
              </div>
              <p className="mt-4 min-h-[66px] text-[13px] font-medium leading-6 text-slate-400">{plan.description}</p>
              <ul className="mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[13px] font-semibold leading-5 text-slate-300">
                    <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-[10px] text-cyan-100" aria-hidden>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-auto inline-flex min-h-[46px] items-center justify-center rounded-xl px-4 text-sm font-black transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-fuchsia/70 ${
                  plan.featured
                    ? 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-[0_18px_55px_-30px_rgba(168,85,247,0.95)]'
                    : 'border border-white/[0.1] bg-white/[0.055] text-slate-100 hover:bg-white/[0.08]'
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </section>

        <p className="mt-4 text-center text-xs font-semibold text-slate-600">
          Après inscription, tu peux activer Starter, Pro ou Lifetime depuis la page Facturation.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
          <p className="text-sm font-semibold text-slate-500">Tu as déjà un compte ?</p>
          <Link href="/login?redirect=/dashboard/billing" className="text-sm font-black text-cyan-100 underline decoration-cyan-300/30 underline-offset-4 hover:text-white">
            Ouvrir la facturation
          </Link>
        </div>
      </div>
    </main>
  );
}
