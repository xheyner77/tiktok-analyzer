'use client';

import { motion } from 'framer-motion';

/* ── Easing ──────────────────────────────────────────────────── */
const E = [0.16, 1, 0.3, 1] as const;

/* helpers — entrance with delay baked into animate transition */
const up = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: E, delay } },
});
const from = (x = 0, y = 0, delay = 0) => ({
  initial: { opacity: 0, x, y },
  animate: { opacity: 1, x: 0, y: 0, transition: { duration: 0.65, ease: E, delay } },
});
const bar = (to: string, delay = 0) => ({
  initial: { width: 0 },
  animate: { width: to, transition: { duration: 1.1, ease: E, delay } },
});

/* ── Score SVG ───────────────────────────────────────────────── */
function ScoreGauge({ score = 68, uid }: { score?: number; uid: string }) {
  const r = 36, circ = 2 * Math.PI * r;
  const gGrad = `${uid}-grad`;
  const fGlow = `${uid}-glow`;
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" className="overflow-visible">
      <defs>
        <linearGradient id={gGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f9a8d4" />
          <stop offset="40%"  stopColor="#e879f9" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id={fGlow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Outer faint halo ring */}
      <circle cx="46" cy="46" r="44" fill="none" stroke="rgba(232,121,249,0.06)" strokeWidth="1" />
      {/* Track */}
      <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
      {/* Arc */}
      <motion.circle cx="46" cy="46" r={r} fill="none"
        stroke={`url(#${gGrad})`} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circ} transform="rotate(-90 46 46)"
        filter={`url(#${fGlow})`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - score / 100), transition: { duration: 1.5, delay: 0.6, ease: E } }}
      />
      <text x="46" y="43" textAnchor="middle" fill="white" fontSize="19" fontWeight="900" fontFamily="inherit">{score}</text>
      <text x="46" y="57" textAnchor="middle" fill="rgb(107,114,128)" fontSize="8.5" fontFamily="inherit">/100</text>
    </svg>
  );
}

/* ── Attention curve ─────────────────────────────────────────── */
function AttentionCurve({ uid }: { uid: string }) {
  const gLine = `${uid}-line`;
  const gFill = `${uid}-fill`;
  const fGlow = `${uid}-glow`;

  return (
    /* viewBox has 10px of extra height below the chart area for axis labels */
    <svg width="100%" height="56" viewBox="0 0 118 58" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gLine} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#22c55e" />
          <stop offset="40%"  stopColor="#eab308" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id={gFill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e879f9" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
        </linearGradient>
        <filter id={fGlow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Area fill */}
      <path
        d="M0,9 C12,9 22,12 38,26 C54,38 63,42 82,44 C98,46 108,47 118,48 L118,48 L0,48 Z"
        fill={`url(#${gFill})`}
      />
      {/* Curve line */}
      <motion.path
        d="M0,9 C12,9 22,12 38,26 C54,38 63,42 82,44 C98,46 108,47 118,48"
        fill="none"
        stroke={`url(#${gLine})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1, transition: { duration: 1.4, delay: 1, ease: E } }}
      />
      {/* Drop marker (retention drop) */}
      <circle cx="38" cy="26" r="3.5" fill="#ef4444" filter={`url(#${fGlow})`} opacity="0.9" />
      <line x1="38" y1="2" x2="38" y2="44" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" opacity="0.25" />
      {/* Moving dot — single pass only, no infinite loop */}
      <motion.circle r="3" fill="#e879f9" filter={`url(#${fGlow})`}
        initial={{ opacity: 0, cx: 0, cy: 9 }}
        animate={{
          cx: [0, 38, 82, 118],
          cy: [9, 26, 44, 48],
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration: 3, delay: 2.2, ease: 'easeInOut' }}
      />
      {/* Axis labels — positioned below the chart area (y=56 gives 8px breathing room) */}
      <text x="0"   y="56" fill="rgb(100,100,115)" fontSize="7" fontFamily="inherit">0s</text>
      <text x="31"  y="56" fill="rgb(239,68,68)"   fontSize="7" fontFamily="inherit">8s</text>
      <text x="106" y="56" fill="rgb(100,100,115)" fontSize="7" fontFamily="inherit">20s</text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function MobilePlanAction() {
  return (
    <div
      className="mt-4 rounded-[14px] p-3.5 sm:hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(232,121,249,0.06), rgba(99,102,241,0.04))',
        border: '1px solid rgba(232,121,249,0.14)',
      }}
    >
      <p className="text-[10px] font-bold text-white mb-2.5 flex items-center gap-1.5">
        <span aria-hidden>🎯</span> Plan d&apos;action
      </p>
      <ul className="space-y-2">
        {['Couper l\'intro à 2s', 'Pattern interrupt à 5s', 'Hook visuel dès l\'image 1'].map((a, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
              style={{ background: 'linear-gradient(135deg, #e879f9, #6366f1)' }}
            >
              {i + 1}
            </span>
            <span className="text-[11px] text-gray-400 leading-snug pt-0.5">{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HeroMockupPremium() {
  return (
    <div
      className="relative pt-3 pb-2 pl-3 pr-3 sm:pt-10 sm:pb-24 sm:pl-8 sm:pr-10 lg:pt-12 lg:pb-28 lg:pl-6 lg:pr-10 xl:pl-12 xl:pr-16 select-none pointer-events-none"
      aria-hidden
    >
      {/* ── Deep ambient layers (softer on mobile) ─────────────── */}
      <div className="absolute inset-0 -z-10 overflow-visible pointer-events-none">
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-[130%] h-[90%] opacity-70 sm:opacity-100"
          style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(232,121,249,0.14) 0%, rgba(99,102,241,0.08) 45%, transparent 70%)', filter: 'blur(50px)', animation: 'heroHaloPulse 5s ease-in-out infinite' }}
        />
        <div className="absolute top-8 left-[20%] right-[20%] h-[65%] hidden sm:block"
          style={{ background: 'radial-gradient(ellipse at 50% 25%, rgba(232,121,249,0.22) 0%, transparent 60%)', filter: 'blur(24px)', animation: 'heroHaloPulse 3.5s ease-in-out 1.2s infinite' }} />
        <div className="absolute bottom-0 left-[25%] right-[25%] h-[30%] hidden sm:block"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.14) 0%, transparent 65%)', filter: 'blur(30px)' }} />
      </div>

      {/* Mobile: status chips in flow (no overlap) */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3 sm:hidden">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold text-white/80"
          style={{ background: 'rgba(8,8,16,0.92)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-50" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          IA active
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold text-vn-fuchsia"
          style={{ background: 'rgba(8,8,16,0.92)', border: '1px solid rgba(232,121,249,0.2)' }}
        >
          <span>✨</span> Insight viral
        </div>
      </div>

      {/* ══ FLOATING: "Insight détecté" — desktop only ═══════════ */}
      <motion.div {...from(0, -16, 1.0)} className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap">
        <div className="mock-float-b">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(8,8,16,0.95)', border: '1px solid rgba(232,121,249,0.22)', backdropFilter: 'blur(14px)', boxShadow: '0 0 28px -6px rgba(232,121,249,0.35), 0 8px 32px rgba(0,0,0,0.6)' }}>
            <span className="text-[11px]">✨</span>
            <span className="text-[11px] font-semibold text-vn-fuchsia">Insight viral détecté</span>
            <span className="relative flex h-2 w-2 ml-0.5 shrink-0">
              <span className="animate-ping absolute h-2 w-2 rounded-full bg-vn-fuchsia opacity-60" />
              <span className="h-2 w-2 rounded-full bg-vn-fuchsia" />
            </span>
          </div>
        </div>
      </motion.div>

      {/* ══ MAIN CARD ═══════════════════════════════════════════ */}
      <motion.div
        {...up(0.15)}
        whileHover={{ scale: 1.012, y: -6, transition: { duration: 0.35, ease: E } }}
        className="relative rounded-[22px] overflow-hidden cursor-default w-full max-w-sm mx-auto sm:max-w-none sm:mx-0"
        style={{
          background: 'linear-gradient(155deg, #11111e 0%, #09090f 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 0 0 1px rgba(232,121,249,0.05), 0 48px 100px -24px rgba(0,0,0,0.9), 0 0 100px -40px rgba(232,121,249,0.18)',
        }}
      >
        {/* Top specular shimmer line */}
        <div className="absolute top-0 inset-x-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} aria-hidden />

        {/* ── Browser chrome ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]"
          style={{ background: 'rgba(255,255,255,0.012)' }}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-2 w-2 rounded-full bg-vn-fuchsia opacity-45" />
              <span className="h-2 w-2 rounded-full bg-vn-fuchsia" style={{ boxShadow: '0 0 8px rgba(232,121,249,0.9)' }} />
            </span>
            <span className="text-[11px] text-gray-500 font-medium tracking-tight">Analyse vidéo · Viralynz</span>
          </div>
          <div className="flex items-center gap-1 opacity-25">
            {['bg-red-500','bg-yellow-500','bg-green-500'].map(c => (
              <div key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
            ))}
          </div>
        </div>

        {/* ── Video thumbnail zone ────────────────────────────── */}
        <div className="relative overflow-hidden" style={{ height: '176px', background: 'linear-gradient(140deg, #131320 0%, #0b0b16 100%)' }}>
          {/* Fine grid */}
          <div className="absolute inset-0 opacity-[0.1]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

          {/* Dramatic scan line */}
          <motion.div
            className="absolute inset-x-0 pointer-events-none"
            style={{ height: '3px', background: 'linear-gradient(90deg, transparent 0%, rgba(232,121,249,0.0) 15%, rgba(232,121,249,0.8) 50%, rgba(232,121,249,0.0) 85%, transparent 100%)', boxShadow: '0 0 16px 4px rgba(232,121,249,0.25)' }}
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
          />

          {/* Aspect ratio label — TikTok 9:16 mini thumbnail outline */}
          <div className="absolute top-3 left-4 w-9 h-16 rounded-[5px] border border-white/10 bg-white/[0.02] flex items-center justify-center">
            <div className="w-3 h-3 border border-white/30 rounded-full opacity-50" />
          </div>

          {/* Frame strip */}
          <div className="absolute bottom-4 left-14 right-4 flex gap-1">
            {[0.04, 0.08, 0.16, 0.04, 0.22, 0.04, 0.10, 0.04, 0.07].map((op, i) => (
              <motion.div key={i}
                className="flex-1 rounded-[3px]"
                style={{
                  height: '36px',
                  background: i === 2 || i === 8 ? 'rgba(239,68,68,0.14)' : i === 4 ? 'rgba(232,121,249,0.16)' : `rgba(255,255,255,${op})`,
                  border: i === 2 || i === 8 ? '1px solid rgba(239,68,68,0.25)' : i === 4 ? '1px solid rgba(232,121,249,0.30)' : '1px solid rgba(255,255,255,0.04)',
                }}
                initial={{ opacity: 0, scaleY: 0.4 }}
                animate={{ opacity: 1, scaleY: 1, transition: { delay: 0.4 + i * 0.04, duration: 0.4 } }}
              />
            ))}
          </div>

          {/* Frame count */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-[9px] font-semibold text-white/50"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)' }}>
            14 frames
          </div>

          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0 h-14 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #09090f, transparent)' }} />
        </div>

        {/* Mobile: courbe + jauge intégrées (pas de chevauchement) */}
        <div className="sm:hidden px-3.5 pt-3.5 pb-1 border-t border-white/[0.05]">
          <div className="flex gap-3 items-stretch">
            <div
              className="flex-1 min-w-0 rounded-xl px-2 pt-2.5 pb-2"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-gray-600 mb-1.5">Courbe attention</p>
              <AttentionCurve uid="acm" />
            </div>
            <div
              className="shrink-0 w-[96px] rounded-xl flex flex-col items-center justify-center py-2 px-1"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="scale-[0.88] origin-center">
                <ScoreGauge score={68} uid="sgm" />
              </div>
              <p className="text-[8px] text-gray-600 mt-0.5 text-center leading-tight">Potentiel</p>
            </div>
          </div>
        </div>

        {/* ── Score block ─────────────────────────────────────── */}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-700 mb-1.5">Score de viralité</p>
              <div className="flex items-baseline gap-2">
                <motion.span className="text-[2.2rem] font-black text-white leading-none"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.8, duration: 0.5 } }}>
                  68
                </motion.span>
                <span className="text-base text-gray-700">/100</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(234,179,8,0.1)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.18)' }}>
                  Moyen
                </span>
              </div>
            </div>
            {/* Spark icon */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1"
              style={{ background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.14)' }}>
              <span className="text-sm">⚡</span>
            </div>
          </div>

          {/* Global bar */}
          <div className="h-[3px] rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <motion.div className="h-full rounded-full" {...bar('68%', 0.65)}
              style={{ background: 'linear-gradient(90deg, #f9a8d4, #e879f9, #a78bfa, #6366f1)' }} />
          </div>

          {/* 3 pillars */}
          <div className="grid grid-cols-3 gap-1.5 mb-3.5">
            {[
              { name: 'Hook',      score: 71, hex: '#4ade80', pct: '71%' },
              { name: 'Montage',   score: 55, hex: '#fbbf24', pct: '55%' },
              { name: 'Rétention', score: 48, hex: '#f87171', pct: '48%' },
            ].map(({ name, score, hex, pct }) => (
              <div key={name} className="p-2.5 rounded-[10px]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.045)' }}>
                <p className="text-[1.05rem] font-black leading-none mb-1" style={{ color: hex }}>{score}</p>
                <p className="text-[9px] text-gray-700 mb-1.5">{name}</p>
                <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <motion.div className="h-full rounded-full" {...bar(pct, 0.9)} style={{ background: hex }} />
                </div>
              </div>
            ))}
          </div>

          {/* Alert */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.13)' }}>
            <span className="text-sm shrink-0">🔴</span>
            <p className="text-[11px] leading-snug" style={{ color: '#fca5a5' }}>
              Rétention critique — chute à 6s, montage trop lent
            </p>
          </div>

          <MobilePlanAction />
        </div>
      </motion.div>

      {/* ══ FLOATING: Score gauge (top-right) — desktop ════════ */}
      <motion.div {...from(20, 0, 0.5)} className="hidden sm:block absolute top-8 right-1 sm:-top-4 sm:-right-6 lg:-right-10 z-20 scale-90 sm:scale-100 origin-top-right">
        <div className="mock-float-a">
          <div className="p-3 rounded-2xl"
            style={{ background: 'linear-gradient(145deg, rgba(14,14,26,0.98), rgba(9,9,15,0.99))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', boxShadow: '0 0 56px -12px rgba(232,121,249,0.35), 0 24px 64px rgba(0,0,0,0.75)' }}>
            <ScoreGauge score={68} uid="sgd" />
            <p className="text-center text-[9px] text-gray-600 mt-1 tracking-wide">Potentiel viral</p>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: AI badge (top-left) — desktop ════════════ */}
      <motion.div {...from(0, -14, 0.3)} className="hidden sm:block absolute top-8 left-3 sm:top-1 sm:left-4 lg:left-0 z-20">
        <div className="mock-float-b">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{ background: 'rgba(8,8,16,0.96)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(14px)', boxShadow: '0 8px 32px rgba(0,0,0,0.55)' }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute h-2 w-2 rounded-full bg-emerald-400 opacity-55" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold text-white/75">IA active</span>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Action plan — desktop ═══════════════════ */}
      <motion.div {...from(0, 20, 0.7)} className="hidden sm:block absolute top-[11rem] right-1 sm:top-auto sm:-bottom-12 sm:-right-4 lg:-right-10 z-20 w-[175px] scale-75 sm:scale-100 origin-top-right">
        <div className="mock-float-c">
          <div className="p-4 rounded-2xl"
            style={{ background: 'linear-gradient(145deg, rgba(14,14,26,0.98), rgba(9,9,15,0.99))', border: '1px solid rgba(232,121,249,0.16)', backdropFilter: 'blur(16px)', boxShadow: '0 0 44px -10px rgba(232,121,249,0.22), 0 24px 60px rgba(0,0,0,0.75)' }}>
            <p className="text-[11px] font-bold text-white mb-3 flex items-center gap-1.5">
              <span>🎯</span> Plan d&apos;action
            </p>
            <ul className="space-y-2">
              {['Couper l\'intro à 2s', 'Pattern interrupt à 5s', 'Hook visuel dès l\'image 1'].map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #e879f9, #6366f1)' }}>{i + 1}</span>
                  <span className="text-[10px] text-gray-400 leading-snug">{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Retention chart — desktop ═══════════════ */}
      <motion.div {...from(-20, 0, 0.6)} className="hidden sm:block absolute top-24 left-1 sm:top-auto sm:-bottom-7 sm:-left-4 lg:-left-10 z-20 scale-75 sm:scale-100 origin-top-left">
        <div className="mock-float-b">
          <div className="w-[160px] px-3 py-3 rounded-2xl"
            style={{ background: 'rgba(9,9,15,0.96)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(14px)', boxShadow: '0 10px 44px rgba(0,0,0,0.65)' }}>
            <p className="text-[9px] text-gray-600 uppercase tracking-[0.14em] mb-2">Courbe attention</p>
            <AttentionCurve uid="acd" />
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Rétention warning — desktop ═════════════ */}
      <motion.div {...from(0, 14, 0.9)} className="hidden sm:block absolute bottom-2 sm:-bottom-1 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
        <div className="mock-float-a" style={{ animationDelay: '2.4s' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(8,8,16,0.96)', border: '1px solid rgba(239,68,68,0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 0 20px -6px rgba(239,68,68,0.2)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            <span className="text-[10px] font-semibold" style={{ color: '#fca5a5' }}>Rétention · 48/100</span>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
