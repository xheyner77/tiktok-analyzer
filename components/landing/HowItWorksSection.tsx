import Link from 'next/link';

const phases = [
  ['Upload', 'Vidéo ou lien reçu.'],
  ['Scan', 'Hook, rythme, preuve, CTA.'],
  ['Décisions', 'Couper, avancer, réécrire.'],
  ['V2', 'Structure, hooks, plan de repost.'],
];

const resultItems = [
  'Couper les secondes inutiles',
  'Avancer le payoff',
  'Réécrire le hook',
  'Reposter une V2 plus tendue',
];

export default function HowItWorksSection() {
  return (
    <section id="comment-ca-marche" className="relative mx-auto w-full max-w-6xl scroll-mt-28 px-3.5 py-7 sm:px-6 sm:py-14 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(ellipse_64%_36%_at_50%_4%,rgba(34,211,238,0.11),transparent_70%),radial-gradient(circle_at_84%_22%,rgba(232,121,249,0.1),transparent_30%)]" aria-hidden />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-vn-fuchsia/85">Comment ça marche</p>
        <h2 className="mt-3 text-[1.72rem] font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
          Comment Viralynz transforme ta vidéo en V2
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-400 sm:text-base sm:leading-7">
          Tu uploades. Viralynz repère ce qui casse l’attention. Tu repars avec une version plus directe à tester.
        </p>
      </div>

      <div className="relative mt-7 grid gap-3 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-stretch">
        <div className="relative overflow-hidden rounded-[1.45rem] bg-[#05060e] p-3 shadow-[0_34px_140px_-94px_rgba(168,85,247,0.9)] ring-1 ring-white/[0.09] sm:rounded-[2rem] sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(124,58,237,0.13),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.11),transparent_32%)]" aria-hidden />
          <div className="relative">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/65">La machine Viralynz</p>
            <h3 className="mt-1 text-lg font-black text-white sm:text-xl">Upload → Scan → Décisions → V2</h3>
          </div>

          <div className="relative mt-4">
            <div className="pointer-events-none absolute bottom-5 left-[1.05rem] top-5 w-px bg-white/[0.06] lg:left-0 lg:right-0 lg:top-[1rem] lg:h-px lg:w-auto" aria-hidden />
            <div className="pointer-events-none absolute bottom-[18%] left-[1.05rem] top-5 w-px bg-gradient-to-b from-cyan-300/72 via-vn-fuchsia/48 to-transparent shadow-[0_0_22px_rgba(34,211,238,0.26)] lg:left-0 lg:right-[14%] lg:top-[1rem] lg:h-px lg:w-auto lg:bg-gradient-to-r" aria-hidden />
            <div className="grid gap-3 lg:grid-cols-4 lg:gap-4">
              {phases.map(([title, body], index) => (
                <article key={title} className="relative grid grid-cols-[2.35rem_1fr] gap-2 lg:block">
                  <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full bg-[#07101a] text-[10px] font-black text-cyan-100 ring-1 ring-cyan-300/22 shadow-[0_0_28px_-12px_rgba(34,211,238,0.95)] lg:mb-4">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-black leading-5 text-white">{title}</h4>
                    <p className="mt-0.5 text-[12px] font-semibold leading-4 text-gray-300">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <p className="relative mt-4 rounded-[1rem] bg-vn-fuchsia/[0.045] px-3 py-3 text-sm font-black leading-5 text-white ring-1 ring-vn-fuchsia/12">
            Chaque score devient une décision de montage.
          </p>
        </div>

        <aside className="relative overflow-hidden rounded-[1.45rem] bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_0%_100%,rgba(168,85,247,0.13),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.018))] p-4 shadow-[0_38px_150px_-84px_rgba(34,211,238,0.95)] ring-1 ring-cyan-300/18 sm:rounded-[2rem] sm:p-5">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" aria-hidden />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/75">Résultat obtenu</p>
          <h3 className="mt-2 text-[1.5rem] font-black leading-tight text-white sm:text-3xl">
            À la fin, tu sais quoi changer.
          </h3>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-400">
            Tu ne repars pas avec un rapport. Tu repars avec une version à tester.
          </p>

          <div className="mt-4 grid gap-1.5">
            {resultItems.map((item) => (
              <div key={item} className="grid grid-cols-[1.35rem_1fr] items-center gap-2 rounded-xl bg-black/22 px-3 py-2 text-[13px] font-black leading-5 text-white ring-1 ring-white/[0.035]">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-cyan-300/12 text-[10px] text-cyan-100 ring-1 ring-cyan-200/18">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-2xl bg-cyan-300/[0.065] px-3 py-3 text-sm font-black leading-5 text-white ring-1 ring-cyan-300/12">
            Coupe l’intro, avance le payoff, republie une V2 plus tendue.
          </p>

          <Link href="/signup" className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#d946ef_0%,#7c3aed_48%,#22d3ee_100%)] px-5 text-sm font-black text-white shadow-[0_18px_52px_-30px_rgba(34,211,238,0.9)] transition duration-500 hover:-translate-y-0.5">
            Tester le parcours
          </Link>
        </aside>
      </div>
    </section>
  );
}
