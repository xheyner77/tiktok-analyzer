'use client'

import { motion } from 'framer-motion'

function RadarIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 12 18 6" />
      <path d="M12 4v2" />
      <path d="M20 12h-2" />
      <path d="M4 12h2" />
    </svg>
  )
}

function RadarVisual() {
  return (
    <div className="pointer-events-none relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-[24px] border border-white/[0.08] bg-[radial-gradient(circle_at_50%_52%,rgba(139,92,246,0.18),transparent_34%),linear-gradient(180deg,rgba(7,13,31,0.7),rgba(3,7,18,0.94))]">
      <div className="absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:34px_34px]" />

      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(34,211,238,0), rgba(34,211,238,0.22), rgba(168,85,247,0.38), rgba(34,211,238,0) 34%)',
          maskImage: 'radial-gradient(circle, transparent 0 10%, black 11% 100%)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
      />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 420" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="radarCoreSoon" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5d0fe" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#8b5cf6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#020611" stopOpacity="0" />
          </radialGradient>
          <filter id="radarGlowSoon" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="210" cy="210" r="42" fill="url(#radarCoreSoon)" />
        {[54, 88, 122, 156, 190].map((radius) => (
          <circle key={radius} cx="210" cy="210" r={radius} stroke="rgba(167,139,250,0.24)" strokeWidth="1.2" />
        ))}
        {[0, 30, 60, 90, 120, 150].map((rotation) => (
          <line
            key={rotation}
            x1="210"
            y1="20"
            x2="210"
            y2="400"
            stroke="rgba(125,154,255,0.16)"
            strokeWidth="1"
            transform={`rotate(${rotation} 210 210)`}
          />
        ))}
        <motion.circle
          cx="286"
          cy="132"
          r="13"
          fill="#d946ef"
          filter="url(#radarGlowSoon)"
          animate={{ scale: [1, 1.18, 1], opacity: [0.76, 1, 0.76] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="306"
          cy="268"
          r="11"
          fill="#67e8f9"
          filter="url(#radarGlowSoon)"
          animate={{ scale: [1, 1.14, 1], opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />
        <motion.circle
          cx="134"
          cy="252"
          r="10"
          fill="#8b5cf6"
          filter="url(#radarGlowSoon)"
          animate={{ scale: [1, 1.16, 1], opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        />
        <circle cx="210" cy="210" r="5" fill="#e9d5ff" filter="url(#radarGlowSoon)" />
      </svg>

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 rounded-[18px] border border-white/[0.1] bg-[#090f1d]/76 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        {['Signaux', 'Formats', 'Hooks'].map((item) => (
          <div key={item} className="rounded-[13px] border border-white/[0.08] bg-white/[0.045] px-2 py-2 text-center">
            <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RadarComingSoonClient() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-6xl items-center justify-center overflow-hidden px-0 py-4 text-white sm:px-2 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,0.1),transparent_30%)]"
      />

      <motion.article
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid w-full overflow-hidden rounded-[24px] border border-white/[0.095] bg-[linear-gradient(145deg,rgba(16,24,45,0.78),rgba(5,9,20,0.96)_52%,rgba(11,9,31,0.94))] p-5 shadow-[0_30px_100px_-60px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl sm:p-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.78fr)] lg:gap-8 lg:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(232,121,249,0.16),transparent_30%),radial-gradient(circle_at_96%_16%,rgba(34,211,238,0.13),transparent_30%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,0.38)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.38)_1px,transparent_1px)] [background-size:42px_42px]"
        />

        <div className="relative z-10 flex min-w-0 flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-fuchsia-200/18 bg-white/[0.06] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <span className="h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_16px_rgba(232,121,249,0.85)]" />
            Prochainement
          </motion.div>

          <p className="mt-6 text-[12px] font-black uppercase tracking-[0.26em] text-cyan-200/90">Radar tendances</p>
          <h1 className="mt-3 max-w-[720px] text-[40px] font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-[56px] lg:text-[64px]">
            Les signaux TikTok arrivent bientôt.
          </h1>
          <p className="mt-5 max-w-[620px] text-[15px] leading-7 text-slate-300 sm:text-[17px]">
            Le module Radar repèrera les hooks, formats et angles à surveiller avant saturation. Pour l’instant, Viralynz ne montre aucune tendance inventée.
          </p>

          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            {['Hooks faibles', 'Formats early', 'Angles à tester'].map((item) => (
              <div key={item} className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-3 py-3">
                <p className="text-[12px] font-black uppercase tracking-[0.13em] text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8 min-w-0 lg:mt-0">
          <div className="absolute -inset-6 rounded-full bg-violet-500/10 blur-3xl" />
          <RadarVisual />
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-[linear-gradient(90deg,transparent,rgba(232,121,249,0.5),rgba(34,211,238,0.32),transparent)]" />
      </motion.article>
    </section>
  )
}
