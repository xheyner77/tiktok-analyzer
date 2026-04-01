import type { ReactNode } from 'react';

type Variant = 'hero' | 'showcase';

/* ── Browser chrome ──────────────────────────────────────── */
function BrowserChrome() {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#0a0a0f] px-4 py-3 sm:px-5 sm:py-3.5 shrink-0">
      <div className="flex gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/90" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/90" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/90" />
      </div>
      <div className="flex-1 flex justify-center">
        <span className="text-[11px] text-gray-500 bg-white/[0.05] border border-white/[0.07] rounded-md px-4 py-1 font-medium tracking-tight">
          app.viralynz.com · Analyse vidéo
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-vn-fuchsia animate-pulse" />
        <span className="hidden sm:block text-[10px] text-vn-fuchsia font-bold uppercase tracking-[0.18em]">Live</span>
      </div>
    </div>
  );
}

/* ── Circular gauge SVG ──────────────────────────────────── */
function CircularGauge({ value, size = 110 }: { value: number; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value / 100;
  const dash = circ * pct;
  const gap  = circ - dash;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="url(#gaugeGrad)" strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' }}
      />
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Progress bar ────────────────────────────────────────── */
function ProgressBar({ pct, color = 'bg-emerald-400' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Badge qualité ───────────────────────────────────────── */
function QualityBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

/* ── Dashboard complet ───────────────────────────────────── */
function AnalyzerDashboard() {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#0d0d12] text-white">
      <div className="flex flex-col lg:flex-row gap-0 min-h-full">

        {/* ── Colonne gauche ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 p-4 sm:p-5 border-r border-white/[0.05]">

          {/* Score de viralité */}
          <div className="rounded-xl border border-white/[0.1] bg-[#111118] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Score de viralité</p>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/25 uppercase tracking-wide">Vision</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Gauge */}
              <div className="relative shrink-0">
                <CircularGauge value={68} size={96} />
                <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
                  <span className="text-[1.6rem] font-black text-amber-400 leading-none tabular-nums" style={{ textShadow: '0 0 20px rgba(251,191,36,0.5)' }}>68</span>
                  <span className="text-[9px] text-gray-500 font-medium">/100</span>
                </div>
              </div>
              {/* Détails */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-[0.18em] text-gray-600 font-bold mb-2">Détail structurel</p>
                <div className="flex gap-2">
                  {[
                    { label: 'Hook',      val: 80 },
                    { label: 'Montage',   val: 70 },
                    { label: 'Rétention', val: 70 },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.07] px-2 py-2 text-center">
                      <p className="text-[9px] text-gray-500 mb-0.5">{label}</p>
                      <p className="text-base font-black text-emerald-400 leading-none tabular-nums">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <QualityBadge label="Potentiel" color="bg-amber-400/15 text-amber-300 border border-amber-400/25" />
                </div>
              </div>
            </div>
          </div>

          {/* Stats publiques */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111118] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Stats publiques détectées</p>
              <span className="text-[9px] text-gray-600 font-medium">Source : page TikTok</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2">
              {[
                { label: 'Vues',         val: '213,9k' },
                { label: 'Likes',        val: '2,2k' },
                { label: 'Commentaires', val: '180' },
                { label: 'Partages',     val: '154' },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-2">
                  <p className="text-[8px] text-gray-500 mb-0.5">{label}</p>
                  <p className="text-[13px] font-black text-white leading-none">{val}</p>
                </div>
              ))}
            </div>
            {/* Analyse comparative */}
            <div className="mt-3 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-600 font-bold mb-1.5">Analyse comparative</p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-emerald-400 leading-none shrink-0">Top 10%</span>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                    <div className="h-full w-[90%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-gray-600">Moyenne</span>
                    <span className="text-[8px] text-gray-600">Top créateurs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Synthèse */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Score de structure', val: '75',            sub: 'Qualité perçue hook, montage, rétention' },
              { label: 'Performance observée', val: '54',          sub: 'Performance correcte' },
              { label: 'Verdict final',        val: null,          sub: 'Retravailler packaging/timing' },
            ].map(({ label, val, sub }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
                <p className="text-[8px] uppercase tracking-wide text-gray-600 font-bold mb-1">{label}</p>
                {val && <p className="text-[1.4rem] font-black text-white leading-none mb-1">{val}</p>}
                <p className="text-[9px] text-gray-500 leading-snug">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Colonne droite ── */}
        <div className="w-full lg:w-[260px] xl:w-[280px] shrink-0 flex flex-col gap-3 p-4 sm:p-5">

          {/* Analyses détaillées */}
          {[
            { title: 'Analyse du Hook',      score: 80, quality: 'Bon',   qcolor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25', bar: 80, barColor: 'bg-emerald-400',
              forts: ['Phrase percutante', 'Pertinence du sujet'], faibles: ['Peut manquer d\'originalité'] },
            { title: 'Analyse du Montage',   score: 70, quality: 'Moyen', qcolor: 'bg-amber-400/20 text-amber-300 border border-amber-400/25', bar: 70, barColor: 'bg-amber-400',
              forts: ['Cohérence visuelle', 'Sous-titres efficaces'], faibles: ['Transitions peu marquées', 'Rythme parfois lent'] },
          ].map(({ title, score, quality, qcolor, bar, barColor, forts, faibles }) => (
            <div key={title} className="rounded-xl border border-white/[0.08] bg-[#111118] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] font-bold text-white">{title}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] font-black text-white tabular-nums">{score}</span>
                  <QualityBadge label={quality} color={qcolor} />
                </div>
              </div>
              <ProgressBar pct={bar} color={barColor} />
              <div className="mt-2.5 space-y-1.5">
                <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold">Points forts</p>
                {forts.map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <span className="text-emerald-400 text-[10px] font-bold shrink-0">✓</span>
                    <span className="text-[10px] text-gray-400">{f}</span>
                  </div>
                ))}
                <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold pt-1">Points faibles</p>
                {faibles.map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <span className="text-red-400 text-[10px] font-bold shrink-0">×</span>
                    <span className="text-[10px] text-gray-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Recommandations */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111118] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-vn-fuchsia/20 border border-vn-fuchsia/30 flex items-center justify-center shrink-0">
                <span className="text-[9px] text-vn-fuchsia">✦</span>
              </span>
              <div>
                <p className="text-[11px] font-bold text-white leading-tight">Recommandations</p>
                <p className="text-[9px] text-gray-600">10 conseils personnalisés</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {[
                { n: 1, text: 'Ajouter des effets visuels pour dynamiser le montage.', priority: 'haute',   pc: 'bg-red-500/20 text-red-300 border border-red-500/25' },
                { n: 2, text: 'Incorporer des punchlines inattendues.', priority: 'haute',                  pc: 'bg-red-500/20 text-red-300 border border-red-500/25' },
                { n: 3, text: 'Utiliser des transitions plus marquées.', priority: 'moyenne',               pc: 'bg-amber-400/20 text-amber-300 border border-amber-400/25' },
                { n: 4, text: 'Raccourcir pour un rythme plus soutenu.', priority: 'moyenne',               pc: 'bg-amber-400/20 text-amber-300 border border-amber-400/25' },
                { n: 5, text: 'Ajouter un call-to-action en fin de vidéo.', priority: 'basse',             pc: 'bg-blue-500/20 text-blue-300 border border-blue-500/25' },
              ].map(({ n, text, priority, pc }) => (
                <div key={n} className="flex gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[10px] font-bold text-gray-600 shrink-0 w-3 pt-px">{n}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-300 leading-snug mb-1">{text}</p>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${pc}`}>
                      Priorité {priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
        className="absolute -inset-[3px] sm:-inset-5 rounded-[inherit] bg-gradient-to-br from-vn-fuchsia/38 via-vn-violet/16 to-vn-indigo/35 blur-2xl sm:blur-[40px] opacity-90"
        aria-hidden
      />
      {/* Fenêtre */}
      <div className="relative overflow-hidden bg-[#0d0d12] rounded-[1.1rem] sm:rounded-[1.3rem] ring-1 ring-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_48px_120px_-30px_rgba(0,0,0,0.95)]">
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-10" aria-hidden />
        <BrowserChrome />
        <div className="h-[400px] sm:h-[480px] md:h-[540px] lg:h-[580px] xl:h-[620px] overflow-hidden">
          <AnalyzerDashboard />
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
