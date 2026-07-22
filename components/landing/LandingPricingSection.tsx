import Link from 'next/link';
import { PUBLIC_PLANS, type CommercialPlanId } from '@/lib/public-plans';

const accents: Record<CommercialPlanId, string> = {
  free: 'border-white/[0.1] bg-white/[0.03]',
  starter: 'border-cyan-300/20 bg-cyan-300/[0.045]',
  pro: 'border-vn-fuchsia/45 bg-[linear-gradient(180deg,rgba(168,85,247,0.15),rgba(255,255,255,0.035))] shadow-[0_34px_110px_-72px_rgba(168,85,247,0.95)]',
  lifetime: 'border-amber-300/25 bg-amber-300/[0.045]',
};

export default function LandingPricingSection() {
  return (
    <section id="tarifs" className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-3.5 py-6 sm:px-6 sm:py-14 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_58%_34%_at_50%_0%,rgba(168,85,247,0.15),transparent_72%),radial-gradient(circle_at_86%_18%,rgba(34,211,238,0.08),transparent_30%)]" aria-hidden />

      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="text-[1.72rem] font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
          Quatre offres. Aucun quota caché.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-400 sm:text-base sm:leading-7">
          Les montants et les droits affichés ici viennent du même catalogue que la facturation et les checkouts Viralynz.
        </p>
      </div>

      <div className="relative mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`relative flex min-h-[25rem] flex-col overflow-hidden rounded-[1.35rem] border p-4 backdrop-blur-xl sm:p-5 ${accents[plan.id]}`}
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
            {plan.featured ? (
              <span className="absolute right-4 top-4 rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-fuchsia-100">
                Le plus complet
              </span>
            ) : null}

            <p className="text-sm font-black text-white">{plan.name}</p>
            <div className="mt-5">
              <p className="text-4xl font-black tracking-[-0.05em] text-white">{plan.priceLabel}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{plan.cadence}</p>
            </div>
            <p className="mt-4 min-h-[4.1rem] text-[13px] font-medium leading-6 text-slate-400">{plan.description}</p>

            <ul className="mt-5 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-[13px] font-semibold leading-5 text-slate-300">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-[10px] text-cyan-100" aria-hidden>✓</span>
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
      </div>

      <p className="relative mt-4 text-center text-xs font-semibold leading-5 text-slate-500">
        Free comprend 3 analyses au total. Starter et Pro sont mensuels. Lifetime est un paiement unique.
      </p>
    </section>
  );
}
