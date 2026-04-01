import type { ReactNode } from 'react';

type Variant = 'hero' | 'showcase';

/* ── Barre de navigateur ─────────────────────────────────── */
function BrowserChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.07] bg-[#0a0a10] px-4 py-3 sm:px-5 sm:py-3.5 shrink-0">
      <div className="flex gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/90" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/90" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/90" />
      </div>
      <div className="flex-1 flex justify-center">
        <span className="text-[11px] text-gray-500 bg-white/[0.06] border border-white/[0.08] rounded-md px-4 py-1 font-medium tracking-tight">
          {url}
        </span>
      </div>
      <span className="hidden sm:block text-[10px] text-vn-violet font-bold uppercase tracking-[0.18em] shrink-0">
        Analyse IA
      </span>
    </div>
  );
}

/* ── Barre de score mini ─────────────────────────────────── */
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Badge score ─────────────────────────────────────────── */
function ScoreBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border bg-white/[0.04] px-3 py-2.5 text-center min-w-[4.5rem] ${color}`}>
      <p className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold mb-0.5">{label}</p>
      <p className="text-[1.35rem] font-black text-white tabular-nums leading-none">{value}</p>
    </div>
  );
}

/* ── Main mockup dashboard ───────────────────────────────── */
function Dashboard() {
  const bars = [38, 52, 70, 65, 48, 44, 60, 76, 71, 55, 42, 36, 50, 64, 72, 58];

  return (
    <div className="flex h-full min-h-0">

      {/* ── Sidebar ── */}
      <aside className="hidden sm:flex flex-col w-[13rem] lg:w-[15rem] shrink-0 border-r border-white/[0.06] bg-[#080810] py-4 gap-1 px-2.5 overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2.5 pb-4 mb-1 border-b border-white/[0.06]">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-vn-fuchsia to-vn-indigo flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M3 13 L6.5 4 L8 8 L9.5 4 L13 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[13px] font-bold text-white tracking-tight">Viralynz</span>
        </div>

        {/* Nav items */}
        {[
          { icon: '▦', label: 'Dashboard', active: false },
          { icon: '◈', label: 'Analyses', active: true },
          { icon: '↗', label: 'Mes vidéos', active: false },
          { icon: '⊕', label: 'Hook generator', active: false },
          { icon: '◉', label: 'Insights', active: false },
        ].map(({ icon, label, active }) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-default transition-colors ${
              active
                ? 'bg-vn-fuchsia/[0.12] text-white border border-vn-fuchsia/20'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`text-[14px] leading-none ${active ? 'text-vn-fuchsia' : ''}`}>{icon}</span>
            {label}
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-vn-fuchsia shadow-[0_0_6px_rgba(232,121,249,0.8)]" />}
          </div>
        ))}

        <div className="mt-auto pt-4 border-t border-white/[0.06] mx-1">
          <div className="flex items-center gap-2 px-2 py-2">
            <img
              src="https://i.pravatar.cc/28?img=11"
              alt=""
              width={28}
              height={28}
              className="w-7 h-7 rounded-full border border-white/10 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-300 truncate">Mathys R.</p>
              <p className="text-[10px] text-gray-600 truncate">Plan Pro</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#05050c]">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/[0.05] shrink-0">
          <div>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase mb-0.5">Analyse en cours</p>
            <p className="text-[13px] font-semibold text-white truncate max-w-[200px] lg:max-w-sm">viral_hook_test_v3.mp4</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold bg-emerald-400/[0.08] border border-emerald-400/20 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Analyse terminée
            </span>
          </div>
        </div>

        {/* Scores row */}
        <div className="flex items-stretch gap-3 px-5 py-4 border-b border-white/[0.05] shrink-0">
          {/* Score global */}
          <div className="flex flex-col justify-center min-w-[5.5rem]">
            <p className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-bold mb-1">Score global</p>
            <p
              className="text-[3.2rem] font-black tabular-nums leading-none"
              style={{
                background: 'linear-gradient(120deg, #f5c5ff 0%, #c084fc 45%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 16px rgba(232,121,249,0.4))',
              }}
            >
              84
            </p>
          </div>
          <div className="w-px bg-white/[0.06] shrink-0 mx-1" />
          {/* Sub-scores */}
          <div className="flex items-center gap-2 flex-wrap">
            <ScoreBadge label="Hook" value={88} color="border-vn-fuchsia/25 shadow-[0_0_20px_-6px_rgba(232,121,249,0.3)]" />
            <ScoreBadge label="Montage" value={76} color="border-vn-violet/25 shadow-[0_0_20px_-6px_rgba(167,139,250,0.25)]" />
            <ScoreBadge label="Rétention" value={81} color="border-vn-indigo/25 shadow-[0_0_20px_-6px_rgba(99,102,241,0.25)]" />
            <ScoreBadge label="CTA" value={69} color="border-white/10" />
          </div>
          <div className="ml-auto hidden lg:flex items-center gap-2">
            <p className="text-[11px] text-gray-600 leading-snug max-w-[180px]">
              Diagnostic vidéo : hook, montage, rétention — priorités actionnables.
            </p>
          </div>
        </div>

        {/* Chart + details */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 overflow-hidden">

          {/* Left: chart */}
          <div className="flex flex-col gap-4 p-5 border-r border-white/[0.05] overflow-auto">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-gray-300">Courbe d&apos;attention</p>
              <span className="text-[10px] text-gray-600 uppercase tracking-[0.18em] font-bold">IA + frames</span>
            </div>
            {/* Bars */}
            <div className="flex items-end gap-1 sm:gap-1.5 h-[88px] sm:h-[100px]">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[3px] min-w-[3px]"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(to top, rgba(99,102,241,0.6), rgba(167,139,250,0.75) 50%, rgba(232,121,249,0.9))`,
                    boxShadow: h > 65 ? '0 -3px 10px -2px rgba(232,121,249,0.25)' : undefined,
                  }}
                />
              ))}
            </div>
            {/* Insight */}
            <div className="rounded-xl border border-vn-violet/15 bg-vn-violet/[0.06] px-4 py-3">
              <p className="text-[12px] text-gray-300 leading-relaxed">
                <span className="text-vn-violet font-semibold">Lecture IA : </span>
                tension visuelle à renforcer dès la 2ᵉ seconde — stabiliser le sujet avant la promesse pour réduire le drop.
              </p>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {['Vision IA', 'Hook & ouverture', 'Rétention', 'Montage & rythme', 'CTA'].map((t) => (
                <span key={t} className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/[0.08] text-gray-500 bg-white/[0.03]">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: priority cards */}
          <div className="hidden lg:flex flex-col gap-3 p-4 overflow-auto">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">Priorités</p>

            {[
              {
                rank: '01',
                color: 'border-vn-fuchsia/20 bg-vn-fuchsia/[0.04]',
                dot: 'bg-vn-fuchsia',
                title: 'Hook trop lent',
                desc: 'Couper les 1,5 premières sec. Aller droit au clash visuel.',
              },
              {
                rank: '02',
                color: 'border-vn-violet/20 bg-vn-violet/[0.04]',
                dot: 'bg-vn-violet',
                title: 'CTA absent avant 80%',
                desc: 'Micro-phrase de CTA à placer entre 60-65% de la vidéo.',
              },
              {
                rank: '03',
                color: 'border-white/[0.07] bg-white/[0.02]',
                dot: 'bg-gray-500',
                title: 'Contraste plan large',
                desc: "Renforcer le contraste sujet/fond sur le plan d\u2019ouverture.",
              },
            ].map((p) => (
              <div key={p.rank} className={`rounded-xl border p-3.5 ${p.color}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}`} />
                  <p className="text-[11px] font-bold text-white">{p.title}</p>
                  <span className="ml-auto text-[10px] text-gray-600 font-mono">#{p.rank}</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}

            {/* Point fort */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5 mt-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-[11px] font-bold text-emerald-300">Point fort</p>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Rythme de coupe soutenu après 3 s — énergie bien maintenue jusqu'au milieu.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Export principal ────────────────────────────────────── */
export default function LandingProductMockup({
  variant = 'hero',
  className = '',
  footerSlot,
}: {
  variant?: Variant;
  className?: string;
  footerSlot?: ReactNode;
}) {
  const isHero = variant === 'hero';

  const frame = (
    <div className="relative">
      {/* Glow extérieur */}
      <div
        className="absolute -inset-[3px] sm:-inset-5 rounded-[inherit] bg-gradient-to-br from-vn-fuchsia/40 via-vn-violet/18 to-vn-indigo/38 blur-2xl sm:blur-[40px] opacity-90"
        aria-hidden
      />
      {/* Fenêtre */}
      <div className="relative overflow-hidden bg-[#05050c] rounded-[1.1rem] sm:rounded-[1.35rem] ring-1 ring-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_48px_120px_-30px_rgba(0,0,0,0.95)]">
        {/* Reflet supérieur */}
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-10" aria-hidden />
        <BrowserChrome url="app.viralynz.com · Analyse vidéo" />
        <div className="h-[360px] sm:h-[440px] md:h-[500px] lg:h-[540px] xl:h-[580px] overflow-hidden">
          <Dashboard />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {isHero ? (
        <>
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[18%] w-[min(100%,1200px)] h-[min(30vw,240px)] rounded-[100%] bg-gradient-to-b from-vn-fuchsia/30 via-vn-violet/15 to-transparent blur-3xl opacity-80"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-[30%] w-[min(100%,1100px)] h-[min(50vw,460px)] max-h-[500px] rounded-[100%] bg-gradient-to-t from-vn-indigo/35 via-vn-violet/18 to-transparent blur-3xl opacity-90"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-[min(100%,1340px)] [perspective:2200px]">
            <div className="transform-gpu will-change-transform origin-[50%_0%] sm:[transform:rotateX(5deg)] transition-transform duration-500">
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
