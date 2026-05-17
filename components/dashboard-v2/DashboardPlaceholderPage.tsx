import Link from 'next/link';

type DashboardPlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  details?: string[];
};

export default function DashboardPlaceholderPage({
  eyebrow,
  title,
  description,
  status,
  ctaHref,
  ctaLabel,
  secondaryHref = '/dashboard',
  secondaryLabel = 'Retour au dashboard',
  details = [],
}: DashboardPlaceholderPageProps) {
  return (
    <main className="min-h-screen bg-[#020611] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_76%_48%_at_50%_-12%,rgba(124,58,237,0.22),transparent_62%),radial-gradient(ellipse_52%_38%_at_100%_12%,rgba(34,211,238,0.11),transparent_58%)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <div className="relative w-full overflow-hidden rounded-[24px] border border-white/[0.085] bg-[linear-gradient(180deg,rgba(12,18,34,0.94),rgba(3,7,18,0.985))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_34px_120px_-78px_rgba(124,58,237,0.95)] sm:p-9">
          <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(139,92,246,.11)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.11)_1px,transparent_1px)] [background-size:38px_38px]" />
          <div className="relative">
            <span className="inline-flex rounded-full border border-violet-300/22 bg-violet-400/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-violet-100">
              {status}
            </span>
            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/75">{eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>

            {details.length > 0 ? (
              <div className="mt-7 grid gap-3 md:grid-cols-3">
                {details.map((detail) => (
                  <div key={detail} className="rounded-[14px] border border-white/[0.075] bg-white/[0.04] p-4">
                    <p className="text-sm font-bold leading-6 text-slate-200">{detail}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={ctaHref} className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white transition hover:brightness-110">
                {ctaLabel}
              </Link>
              <Link href={secondaryHref} className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 text-sm font-black text-white transition hover:bg-white/[0.07]">
                {secondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
