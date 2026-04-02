'use client';

import { motion } from 'framer-motion';

/* ── Animation presets ───────────────────────────────────────── */
const E = [0.16, 1, 0.3, 1] as const;
const fadeUp  = (delay = 0) => ({ initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.75, ease: E, delay } });
const fadeIn  = (delay = 0, x = 0, y = 0) => ({ initial: { opacity: 0, x, y }, animate: { opacity: 1, x: 0, y: 0 }, transition: { duration: 0.65, ease: E, delay } });
const barGrow = (to: string, delay = 0) => ({ initial: { width: 0 }, animate: { width: to }, transition: { duration: 1.1, ease: E, delay } });

/* ── Score SVG gauge ─────────────────────────────────────────── */
function ScoreGauge({ score = 73 }: { score?: number }) {
  const r = 34, circ = 2 * Math.PI * r, pct = score / 100;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="overflow-visible">
      <defs>
        <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#e879f9" />
          <stop offset="50%"  stopColor="#c084fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id="sgGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
      {/* Arc */}
      <motion.circle
        cx="44" cy="44" r={r} fill="none"
        stroke="url(#sg)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circ} transform="rotate(-90 44 44)"
        filter="url(#sgGlow)"
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct) }}
        transition={{ duration: 1.4, delay: 0.5, ease: E }}
      />
      {/* Labels */}
      <text x="44" y="41" textAnchor="middle" fill="white" fontSize="18" fontWeight="900" fontFamily="inherit">{score}</text>
      <text x="44" y="55" textAnchor="middle" fill="rgb(107,114,128)" fontSize="8.5" fontFamily="inherit">/100</text>
    </svg>
  );
}

/* ── Retention curve SVG ─────────────────────────────────────── */
function RetentionCurve() {
  return (
    <svg width="116" height="46" viewBox="0 0 116 46">
      <defs>
        <linearGradient id="rl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#22c55e" />
          <stop offset="42%"  stopColor="#eab308" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="ra" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e879f9" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#e879f9" stopOpacity="0"    />
        </linearGradient>
      </defs>
      {/* Area */}
      <path d="M0,9 C12,9 22,12 38,24 C54,36 63,40 82,42 C98,44 106,45 116,46 L116,46 L0,46 Z" fill="url(#ra)" />
      {/* Curve */}
      <motion.path
        d="M0,9 C12,9 22,12 38,24 C54,36 63,40 82,42 C98,44 106,45 116,46"
        fill="none" stroke="url(#rl)" strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.9, ease: E }}
      />
      {/* Drop dot */}
      <circle cx="38" cy="24" r="3" fill="#ef4444" opacity="0.85" />
      <line x1="38" y1="0" x2="38" y2="46" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
      {/* X-axis labels */}
      <text x="0"   y="46" fill="rgb(107,114,128)" fontSize="7" fontFamily="inherit">0s</text>
      <text x="32"  y="46" fill="rgb(107,114,128)" fontSize="7" fontFamily="inherit">8s</text>
      <text x="104" y="46" fill="rgb(107,114,128)" fontSize="7" fontFamily="inherit">20s</text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────── */

export default function HeroMockupPremium() {
  return (
    <div
      className="relative pt-10 pb-28 pl-10 pr-12 lg:pl-4 lg:pr-8 xl:pl-10 xl:pr-14 select-none pointer-events-none"
      aria-hidden
    >
      {/* ── Ambient glow blob ────────────────────────────────── */}
      <div
        className="mock-glow absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-[60%] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(232,121,249,0.28) 0%, rgba(99,102,241,0.18) 45%, transparent 70%)',
          filter: 'blur(48px)',
        }}
      />

      {/* ══ MAIN CARD ═══════════════════════════════════════════ */}
      <motion.div
        {...fadeUp(0.2)}
        className="relative rounded-[20px] overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #10101c 0%, #0a0a14 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 40px 90px -20px rgba(0,0,0,0.85), 0 0 80px -30px rgba(232,121,249,0.15)',
        }}
      >
        {/* Browser chrome */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]"
          style={{ background: 'rgba(255,255,255,0.015)' }}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vn-fuchsia opacity-40" />
              <span className="relative h-2 w-2 rounded-full bg-vn-fuchsia" style={{ boxShadow: '0 0 6px rgba(232,121,249,0.7)' }} />
            </span>
            <span className="text-[11px] text-gray-500 font-medium">Analyse vidéo · Viralynz</span>
          </div>
          <div className="flex items-center gap-1.5 opacity-30">
            <div className="h-2 w-2 rounded-full bg-gray-600" />
            <div className="h-2 w-2 rounded-full bg-gray-600" />
            <div className="h-2 w-2 rounded-full bg-gray-600" />
          </div>
        </div>

        {/* ── Video thumbnail zone ────────────────────────────── */}
        <div className="relative h-44 overflow-hidden" style={{ background: 'linear-gradient(135deg, #12121e 0%, #0c0c17 100%)' }}>
          {/* Fine grid */}
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

          {/* Scan line */}
          <div className="mock-scan" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,121,249,0.7), transparent)' }} />

          {/* Simulated TikTok frames */}
          <div className="absolute bottom-4 left-4 right-4 flex gap-1">
            {[0.06, 0.04, 0.12, 0.04, 0.18, 0.04, 0.08, 0.04, 0.06].map((op, i) => (
              <div key={i} className="flex-1 h-10 rounded-[3px] transition-all"
                style={{
                  background: i === 4 ? 'rgba(232,121,249,0.15)' : i === 2 || i === 8 ? 'rgba(239,68,68,0.12)' : `rgba(255,255,255,${op})`,
                  border: i === 4 ? '1px solid rgba(232,121,249,0.35)' : i === 2 || i === 8 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.04)',
                }}
              />
            ))}
          </div>

          {/* Gradient fade bottom */}
          <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #0a0a14, transparent)' }} />

          {/* AI overlay badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-vn-fuchsia animate-pulse" />
            <span className="text-[10px] text-white/70 font-medium">IA en action</span>
          </div>
        </div>

        {/* ── Score & metrics ─────────────────────────────────── */}
        <div className="p-4 sm:p-5">
          {/* Score header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[9.5px] uppercase tracking-[0.16em] text-gray-600 mb-1">Score de viralité</p>
              <div className="flex items-baseline gap-2">
                <motion.span className="text-[2rem] font-black text-white leading-none"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.4 }}>
                  73
                </motion.span>
                <span className="text-sm text-gray-700">/100</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(234,179,8,0.12)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.2)' }}>
                  Moyen
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[3px] rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div className="h-full rounded-full" {...barGrow('73%', 0.6)}
              style={{ background: 'linear-gradient(90deg, #e879f9, #a78bfa, #6366f1)' }} />
          </div>

          {/* 3 pillars */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { name: 'Hook',      score: 81, color: '#4ade80', bar: 'from-emerald-500 to-emerald-400', pct: '81%' },
              { name: 'Montage',   score: 62, color: '#fbbf24', bar: 'from-amber-500 to-amber-400',     pct: '62%' },
              { name: 'Rétention', score: 58, color: '#f87171', bar: 'from-red-500 to-red-400',         pct: '58%' },
            ].map(({ name, score, color, bar, pct }) => (
              <div key={name} className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[1.1rem] font-black leading-none mb-1" style={{ color }}>{score}</p>
                <p className="text-[9px] text-gray-600 mb-2">{name}</p>
                <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <motion.div className={`h-full rounded-full bg-gradient-to-r ${bar}`} {...barGrow(pct, 0.85)} />
                </div>
              </div>
            ))}
          </div>

          {/* Main issue */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.14)' }}>
            <span className="text-sm shrink-0">⚡</span>
            <p className="text-[11.5px] leading-snug" style={{ color: '#fca5a5' }}>
              Rétention chute à 8s — montage trop lent
            </p>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Score gauge (top-right) ══════════════════ */}
      <motion.div {...fadeIn(0.55, 18, 0)} className="absolute -top-2 -right-4 lg:-right-8 z-20">
        <div className="mock-float-a">
          <div className="relative p-3 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, rgba(16,16,28,0.97), rgba(10,10,18,0.99))',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 48px -12px rgba(232,121,249,0.3), 0 20px 56px rgba(0,0,0,0.7)',
            }}>
            <ScoreGauge score={73} />
            <p className="text-center text-[9px] text-gray-600 mt-1 tracking-wide">Potentiel viral</p>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: AI badge (top-left) ══════════════════════ */}
      <motion.div {...fadeIn(0.35, 0, -12)} className="absolute -top-1 left-4 lg:left-0 z-20">
        <div className="mock-float-b">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{
              background: 'rgba(10,10,18,0.94)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute h-2 w-2 rounded-full bg-vn-fuchsia opacity-55" />
              <span className="h-2 w-2 rounded-full bg-vn-fuchsia" />
            </span>
            <span className="text-[11px] font-semibold text-white/80">IA en action</span>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Viral badge (mid-right) ══════════════════ */}
      <motion.div {...fadeIn(0.85, 16, 0)} className="absolute top-[8.5rem] -right-4 lg:-right-10 z-20">
        <div className="mock-float-d">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(10,10,18,0.94)',
              border: '1px solid rgba(34,197,94,0.22)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 0 20px -6px rgba(34,197,94,0.25), 0 8px 24px rgba(0,0,0,0.5)',
            }}>
            <span className="text-[11px]">🔥</span>
            <span className="text-[10.5px] font-semibold" style={{ color: '#86efac' }}>Hook puissant</span>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Action plan (bottom-right) ══════════════ */}
      <motion.div {...fadeIn(0.75, 0, 18)} className="absolute -bottom-10 -right-4 lg:-right-8 z-20 w-[168px]">
        <div className="mock-float-c">
          <div className="p-4 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, rgba(14,14,24,0.97), rgba(10,10,18,0.99))',
              border: '1px solid rgba(232,121,249,0.18)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 0 40px -10px rgba(232,121,249,0.2), 0 20px 56px rgba(0,0,0,0.7)',
            }}>
            <p className="text-[11px] font-bold text-white mb-3 flex items-center gap-1.5">
              <span>🎯</span> Plan d&apos;action
            </p>
            <ul className="space-y-2">
              {[
                'Couper l\'intro à 2s',
                'Ajouter pattern interrupt',
                'Booster le hook visuel',
              ].map((action, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #e879f9, #6366f1)' }}>
                    {i + 1}
                  </span>
                  <span className="text-[10px] text-gray-400 leading-snug">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* ══ FLOATING: Retention chart (bottom-left) ═══════════ */}
      <motion.div {...fadeIn(0.65, -18, 0)} className="absolute -bottom-6 -left-4 lg:-left-8 z-20">
        <div className="mock-float-b">
          <div className="px-4 py-3 rounded-2xl"
            style={{
              background: 'rgba(10,10,18,0.95)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}>
            <p className="text-[9px] text-gray-600 uppercase tracking-[0.14em] mb-2.5">Courbe d&apos;attention</p>
            <RetentionCurve />
          </div>
        </div>
      </motion.div>

    </div>
  );
}
