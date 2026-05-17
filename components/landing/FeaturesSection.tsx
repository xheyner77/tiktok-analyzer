import Link from 'next/link';

const currentVideo = [
  ['0:00', 'Tu expliques avant de donner une raison de rester.'],
  ['0:05', 'La promesse arrive après la perte d’attention.'],
  ['0:15', 'Le CTA demande une action sans curiosité.'],
];

const diagnostics = [
  'Le sujet est clair, mais l’enjeu arrive trop tard.',
  'La preuve arrive après le moment où le viewer décroche.',
  'Le CTA ne crée pas de raison de répondre.',
];

const scanTimeline = [
  ['0:00', 'Hook faible'],
  ['0:05', 'Drop'],
  ['0:15', 'CTA à réécrire'],
];

const v2Plan = [
  'Ouvre avec le résultat',
  'Coupe les 2 premières secondes',
  'Avance la preuve',
  'Termine avec une question',
];

export default function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="relative mx-auto w-full max-w-6xl scroll-mt-28 px-3.5 py-7 sm:px-6 sm:py-14 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-4 h-[22rem] bg-[radial-gradient(ellipse_60%_36%_at_50%_0%,rgba(168,85,247,0.14),transparent_72%),radial-gradient(circle_at_90%_20%,rgba(34,211,238,0.09),transparent_32%)]" aria-hidden />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300/80">Fonctionnalités</p>
        <h2 className="mt-3 text-[1.72rem] font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
          Viralynz ne te donne pas des features. Il te donne quoi changer.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-400 sm:text-base sm:leading-7">
          Chaque analyse transforme ta vidéo en décisions de montage : où l’attention casse, quoi couper, quoi avancer et quelle V2 republier.
        </p>
      </div>

      <div className="relative mt-7 overflow-hidden rounded-[1.45rem] bg-[#05060e] shadow-[0_36px_140px_-96px_rgba(168,85,247,0.95)] ring-1 ring-white/[0.09] sm:mt-9 sm:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(232,121,249,0.12),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_40%)]" aria-hidden />
        <div className="pointer-events-none absolute left-[12%] right-[12%] top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" aria-hidden />

        <div className="relative px-3.5 py-3 sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Moteur de décision</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black leading-5 text-white">De vidéo faible à V2 prête à tester</h3>
            <span className="rounded-full bg-cyan-300/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
              Vidéo → Diagnostic → V2
            </span>
          </div>
        </div>

        <div className="relative grid gap-2.5 px-2.5 pb-2.5 sm:px-4 sm:pb-4 lg:grid-cols-[0.9fr_1.05fr_1fr] lg:items-stretch">
          <div className="min-w-0 rounded-[1.05rem] bg-rose-300/[0.035] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-100/58">Vidéo actuelle</p>
                <h4 className="mt-1 text-[15px] font-black leading-5 text-white">Bonne idée. Mauvais ordre.</h4>
              </div>
              <span className="rounded-full bg-rose-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-rose-100/75">
                À corriger
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {currentVideo.map(([time, line]) => (
                <div key={time} className="grid grid-cols-[3rem_1fr] gap-2">
                  <span className="text-[10px] font-black text-rose-100/72">{time}</span>
                  <span className="text-[12px] font-semibold leading-4 text-gray-200">{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-w-0 rounded-[1.05rem] bg-cyan-300/[0.05] p-3 shadow-[0_24px_90px_-66px_rgba(34,211,238,0.95)]">
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" aria-hidden />
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Diagnostic Viralynz</p>
            <div className="relative mt-3 rounded-2xl bg-black/20 px-2.5 py-3">
              <div className="absolute left-6 right-6 top-[1.05rem] h-px bg-gradient-to-r from-rose-300/35 via-cyan-300/60 to-vn-fuchsia/34" aria-hidden />
              <div className="relative grid grid-cols-3 gap-2">
                {scanTimeline.map(([time, label]) => (
                  <div key={time} className="text-center">
                    <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
                    <span className="mt-1 block text-[9px] font-black text-cyan-100/72">{time}</span>
                    <span className="block text-[10px] font-black leading-3 text-white">{label}</span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-200/28 to-transparent" aria-hidden />
            </div>
            <div className="mt-3 space-y-2">
              {diagnostics.map((item) => (
                <p key={item} className="text-[12px] font-semibold leading-4 text-gray-200">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="relative min-w-0 overflow-hidden rounded-[1.12rem] bg-[radial-gradient(circle_at_78%_0%,rgba(34,211,238,0.19),transparent_35%),rgba(16,185,129,0.082)] p-3 shadow-[0_38px_130px_-68px_rgba(34,211,238,0.95)] ring-1 ring-emerald-200/22 lg:-my-1">
            <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/65 to-transparent" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-100/76">Sortie Viralynz</p>
                <h4 className="mt-1 text-[17px] font-black leading-5 text-white">V2 prête à republier</h4>
              </div>
              <span className="rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-vn-bg shadow-[0_0_22px_-8px_rgba(34,211,238,0.9)]">
                V2
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {v2Plan.map((item, index) => (
                <div key={item} className="grid grid-cols-[2rem_1fr] items-center">
                  <span className="text-[10px] font-black text-emerald-100/82">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-[12px] font-bold leading-4 text-gray-100">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-emerald-300/[0.07] px-3 py-2 text-xs font-black leading-4 text-emerald-50 ring-1 ring-emerald-200/12">
              Une version plus courte, plus directe, prête à tester.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-3 rounded-[1rem] bg-white/[0.025] px-3 py-2.5 ring-1 ring-white/[0.06] sm:flex sm:items-center sm:gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/60">Décisions générées</p>
        <p className="mt-1 text-xs font-black leading-5 text-white sm:mt-0">
          Couper l’intro · Avancer la preuve · Réécrire le hook · Republier la V2
        </p>
      </div>

      <div className="relative mt-3 rounded-[1.1rem] bg-[radial-gradient(circle_at_0%_0%,rgba(232,121,249,0.1),transparent_38%),rgba(255,255,255,0.022)] px-3.5 py-3 ring-1 ring-vn-fuchsia/14 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-5">
        <p className="text-sm font-black leading-5 text-white sm:text-base">
          Coupe. Avance. Réécris. Republie.
        </p>
        <Link href="/#comment-ca-marche" className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#d946ef_0%,#7c3aed_48%,#22d3ee_100%)] px-4 text-sm font-black text-white shadow-[0_18px_52px_-30px_rgba(34,211,238,0.9)] transition duration-500 hover:-translate-y-0.5 sm:mt-0 sm:w-auto">
          Voir comment ça marche
        </Link>
      </div>
    </section>
  );
}
