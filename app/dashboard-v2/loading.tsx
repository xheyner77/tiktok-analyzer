export default function DashboardV2Loading() {
  return (
    <main className="fixed inset-0 z-[100] overflow-hidden bg-[#020611] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[248px] shrink-0 border-r border-white/[0.07] bg-[#050814]/96 p-5 xl:block">
          <div className="h-10 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-white/[0.045]" />
            ))}
          </div>
        </aside>
        <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="h-8 w-56 animate-pulse rounded-xl bg-white/[0.06]" />
          <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-lg bg-white/[0.045]" />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
            <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
          </div>
        </section>
      </div>
    </main>
  );
}
