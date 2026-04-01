import type { ReactNode } from 'react';

type Variant = 'hero' | 'showcase';

function BrowserChrome({ url, dense }: { url: string; dense?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.08] to-black/55 ${
        dense ? 'px-4 py-3.5 sm:px-5 sm:py-4' : 'px-4 py-3 sm:px-5 sm:py-3.5'
      }`}
    >
      <div className="flex gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/90 shadow-sm" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/90 shadow-sm" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/90 shadow-sm" />
      </div>
      <span className="text-[11px] sm:text-xs text-gray-400 font-medium truncate flex-1 text-center sm:text-left tracking-tight">
        {url}
      </span>
      <span className="hidden sm:block text-[10px] text-gray-500 font-bold uppercase tracking-[0.18em] shrink-0">
        Analyse IA
      </span>
    </div>
  );
}

function ScorePill({
  label,
  value,
  tone,
  large,
}: {
  label: string;
  value: number;
  tone: 'pink' | 'violet' | 'indigo';
  large?: boolean;
}) {
  const tones = {
    pink: 'border-vn-fuchsia/25 bg-vn-fuchsia/[0.08] shadow-[0_0_24px_-8px_rgba(232,121,249,0.35)]',
    violet: 'border-vn-violet/30 bg-vn-violet/[0.08] shadow-[0_0_24px_-8px_rgba(167,139,250,0.25)]',
    indigo: 'border-vn-indigo/30 bg-vn-indigo/[0.08] shadow-[0_0_24px_-8px_rgba(99,102,241,0.28)]',
  } as const;
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 min-w-[5.85rem] ${tones[tone]}`}>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className={`font-bold text-white tabular-nums leading-tight ${large ? 'text-xl sm:text-2xl' : 'text-lg'}`}>
        {value}
      </p>
    </div>
  );
}

export default function LandingProductMockup({
  variant = 'hero',
  className = '',
  footerSlot,
}: {
  variant?: Variant;
  className?: string;
  footerSlot?: ReactNode;
}) {
  const isShowcase = variant === 'showcase';
  const isHero = variant === 'hero';

  const frame = (
    <div className="relative">
      <div
        className={`absolute rounded-[inherit] opacity-95 ${
          isHero
            ? '-inset-[3px] sm:-inset-4 bg-gradient-to-br from-vn-fuchsia/45 via-vn-violet/20 to-vn-indigo/40 blur-2xl sm:blur-3xl'
            : '-inset-[2px] sm:-inset-3 bg-gradient-to-br from-vn-fuchsia/35 via-vn-violet/15 to-vn-indigo/35 blur-2xl'
        }`}
        aria-hidden
      />
      <div
        className={`relative overflow-hidden bg-gradient-to-b from-[#0c0c14] via-[#07070e] to-[#040408] landing-mockup-ring-deep ${
          isHero
            ? 'rounded-[1.2rem] sm:rounded-[1.45rem] ring-1 ring-white/[0.11]'
            : 'rounded-[1.15rem] sm:rounded-[1.4rem] ring-1 ring-white/[0.1]'
        }`}
      >
        <div className="absolute inset-x-8 sm:inset-x-12 top-0 landing-mockup-specular pointer-events-none" aria-hidden />
        <BrowserChrome url="app.viralynz.com · Analyse vidéo" dense={isHero} />

        <div className={isHero ? 'p-6 sm:p-10 lg:p-12 xl:p-14' : 'p-5 sm:p-8 lg:p-12'}>
          {isShowcase ? (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] gap-8 lg:gap-14 items-stretch">
              <div className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-b from-white/[0.06] via-[#0a0a10] to-black/55 overflow-hidden min-h-[240px] lg:min-h-[380px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-vn-fuchsia/[0.07]" aria-hidden />
                <div className="absolute inset-0 opacity-[0.07] landing-noise mix-blend-overlay pointer-events-none" />
                <div className="absolute top-5 left-5 right-5 flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Lecture frame</span>
                  <span className="text-[10px] font-mono text-vn-fuchsia bg-black/50 px-2.5 py-1 rounded-lg border border-white/10 shadow-lg">
                    0:00 — 0:12
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5 space-y-3">
                  <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden ring-1 ring-white/[0.05]">
                    <div className="h-full w-[34%] rounded-full bg-gradient-to-r from-vn-fuchsia via-vn-violet to-vn-indigo shadow-[0_0_20px_rgba(232,121,249,0.35)]" />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                    <span className="text-white font-semibold">Ouverture :</span> sujet lisible, mais contraste faible sur
                    le plan large — risque de drop avant la promesse.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-7">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-bold mb-2">Score global</p>
                    <p className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold gradient-text-hero tabular-nums leading-[0.95]">
                      84
                    </p>
                    <p className="mt-3 text-sm text-gray-500 max-w-md leading-relaxed">
                      Synthèse vision + contexte — priorise ce qui impacte l’accroche et la rétention.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <ScorePill label="Hook" value={88} tone="pink" large />
                    <ScorePill label="Montage" value={76} tone="violet" large />
                    <ScorePill label="Rétention" value={81} tone="indigo" large />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-black/40 p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="text-[11px] font-bold text-vn-violet uppercase tracking-[0.2em] mb-3">Priorité #1</p>
                  <p className="text-sm sm:text-[15px] text-gray-200 leading-relaxed">
                    Renforcer le contraste sujet / fond dans les 2 premières secondes et compresser l’entrée en promesse
                    — avant d’ajouter du montage.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['Vision IA', 'Structure', 'CTA', 'Cadence'].map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-white/10 text-gray-400 bg-black/40"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  {[
                    { t: 'Point fort', d: 'Rythme de coupe soutenu après 3 s — maintient l’énergie.' },
                    { t: 'Friction', d: 'CTA trop tardif : tester une micro‑phrase avant la moitié.' },
                  ].map((x) => (
                    <div
                      key={x.t}
                      className="rounded-xl border border-white/[0.07] bg-black/35 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <p className="text-xs font-semibold text-white mb-1.5">{x.t}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{x.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto lg:max-w-none">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-10">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-bold mb-2">Score global</p>
                  <p className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[5.25rem] font-bold gradient-text-hero tabular-nums leading-[0.92] landing-hero-title-glow">
                    84
                  </p>
                  <p className="mt-4 text-sm sm:text-base text-gray-500 max-w-md leading-relaxed">
                    Diagnostic vidéo : hook, montage, rétention — une lecture actionnable, pas un jugement flou.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <ScorePill label="Hook" value={88} tone="pink" large />
                  <ScorePill label="Montage" value={76} tone="violet" large />
                  <ScorePill label="Rétention" value={81} tone="indigo" large />
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] via-[#0a0a12]/90 to-transparent p-7 sm:p-9 mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <p className="text-xs sm:text-sm font-semibold text-gray-300">Courbe d’attention (indicative)</p>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">IA + frames</span>
                </div>
                <div className="h-28 sm:h-32 flex items-end gap-1 sm:gap-1.5 px-0.5">
                  {[40, 55, 72, 68, 52, 48, 62, 78, 74, 58, 44, 38, 52, 66].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-vn-indigo/45 via-vn-violet/55 to-vn-fuchsia/75 opacity-95 min-w-[3px] shadow-[0_-4px_16px_-2px_rgba(232,121,249,0.15)]"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="mt-5 text-sm sm:text-[15px] text-gray-300 leading-relaxed">
                  <span className="text-vn-violet font-semibold">Lecture :</span> tension visuelle à renforcer tout de
                  suite — puis stabiliser le sujet pour la promesse.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {['Vision IA', 'Hook & ouverture', 'Rétention', 'Montage & rythme', 'CTA'].map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-medium px-3.5 py-1.5 rounded-full border border-white/10 text-gray-400 bg-black/35 backdrop-blur-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {isHero ? (
        <>
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[18%] w-[min(98%,1080px)] h-[min(30vw,220px)] rounded-[100%] bg-gradient-to-b from-vn-fuchsia/30 via-vn-violet/12 to-transparent blur-3xl opacity-80"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-[34%] w-[min(100%,980px)] h-[min(54vw,460px)] max-h-[520px] rounded-[100%] bg-gradient-to-t from-vn-fuchsia/36 via-vn-violet/16 to-transparent blur-3xl opacity-95"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-[min(100%,1240px)] [perspective:2200px]">
            <div className="transform-gpu will-change-transform origin-[50%_0%] sm:[transform:rotateX(4.8deg)] transition-transform duration-500">
              {frame}
            </div>
          </div>
        </>
      ) : (
        <div className="relative mx-auto w-full max-w-[min(100%,1180px)] sm:[perspective:2400px]">
          <div className="transform-gpu sm:[transform:rotateX(2deg)] origin-[50%_0%]">
            {frame}
          </div>
        </div>
      )}

      {footerSlot ? <div className="relative mt-8 sm:mt-10">{footerSlot}</div> : null}
    </div>
  );
}
