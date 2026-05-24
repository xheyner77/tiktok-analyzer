'use client'

import Link from 'next/link'
import { useState } from 'react'

type FeatureIcon = 'trend' | 'layers' | 'hook' | 'target' | 'bell' | 'arrow'

const featureItems: Array<{
  icon: FeatureIcon
  title: string
  description: string
  tone: string
}> = [
  {
    icon: 'trend',
    title: 'Tendances qui montent',
    description: 'Avant que tout le monde copie.',
    tone: 'from-fuchsia-500/25 to-violet-500/20 text-fuchsia-200 ring-fuchsia-300/20',
  },
  {
    icon: 'layers',
    title: 'Formats encore early',
    description: 'Repérer les structures encore fraîches.',
    tone: 'from-cyan-500/20 to-sky-500/15 text-cyan-200 ring-cyan-300/20',
  },
  {
    icon: 'hook',
    title: 'Hooks à surveiller',
    description: 'Voir les tensions qui émergent.',
    tone: 'from-pink-500/25 to-rose-500/15 text-pink-200 ring-pink-300/20',
  },
  {
    icon: 'target',
    title: 'Angles à tester',
    description: 'Choisir le prochain angle à tester.',
    tone: 'from-violet-500/25 to-indigo-500/15 text-violet-200 ring-violet-300/20',
  },
]

const radarChips = [
  { label: 'Early', caption: 'Opportunités', color: 'bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.55)]' },
  { label: 'À surveiller', caption: 'Signal faible', color: 'bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.5)]' },
  { label: 'À éviter', caption: 'Saturation', color: 'bg-pink-300 shadow-[0_0_18px_rgba(249,168,212,0.5)]' },
]

export default function RadarComingSoonClient() {
  const [notified, setNotified] = useState(false)

  const notifyLaunch = () => {
    setNotified(true)
    window.setTimeout(() => setNotified(false), 2600)
  }

  return (
    <main className="relative isolate min-h-[calc(100dvh-4.25rem)] overflow-x-hidden bg-[#020611] px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 text-white sm:px-4 lg:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(151,71,255,0.22),transparent_32%),radial-gradient(circle_at_82%_14%,rgba(236,72,153,0.16),transparent_30%),radial-gradient(circle_at_75%_82%,rgba(34,211,238,0.13),transparent_34%),linear-gradient(180deg,#030714_0%,#02040b_58%,#030511_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]"
      />

      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-2.5 sm:gap-3">
        <section className="relative min-h-[258px] overflow-hidden rounded-[22px] border border-violet-200/[0.16] bg-[linear-gradient(145deg,rgba(24,18,52,0.84),rgba(5,10,24,0.88)_42%,rgba(4,9,21,0.9))] p-4 shadow-[0_18px_58px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:min-h-[274px] sm:p-5">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(236,72,153,0.16),transparent_30%),radial-gradient(circle_at_82%_52%,rgba(34,211,238,0.12),transparent_34%)]"
          />
          <HeroRadarVisual />

          <div className="relative z-10 flex max-w-[24rem] flex-col items-start">
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-fuchsia-200/20 bg-white/[0.06] px-3 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-pink-300 shadow-[0_0_16px_rgba(249,168,212,0.8)]" />
              Accès anticipé
            </span>
            <p className="mt-4 max-w-[56%] min-w-[12.5rem] text-[0.68rem] font-bold uppercase tracking-[0.27em] text-violet-300">
              Radar tendances
            </p>
            <h1 className="mt-2 max-w-[58%] min-w-[12.5rem] text-[1.92rem] font-black leading-[0.98] tracking-[-0.045em] text-zinc-50 min-[430px]:text-[2.12rem] sm:text-[2.45rem]">
              Repère les signaux
              <br />
              avant saturation.
            </h1>
            <p className="mt-3 max-w-[57%] min-w-[12.5rem] text-[0.82rem] leading-[1.42] text-zinc-300 sm:text-[0.92rem]">
              Le futur module Viralynz analysera les hooks, formats et signaux TikTok pour t’aider à décider quoi tester avant les autres.
            </p>

            <div className="mt-4 flex w-full max-w-[24rem] flex-col gap-2">
              <WaitlistButton onClick={notifyLaunch} label="Me prévenir au lancement" />
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/[0.12] bg-white/[0.035] px-4 text-[0.82rem] font-semibold text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/20 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
              >
                Retour au dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-white/[0.1] bg-white/[0.035] p-3.5 shadow-[0_18px_54px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-blue-300 sm:text-[0.78rem]">
              Radar des tendances
            </h2>
            <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-emerald-200/10 bg-emerald-300/[0.08] px-3 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.72)]" />
              En veille
            </span>
          </div>
          <RadarVisualization />
        </section>

        <FeatureList />

        <section className="relative overflow-hidden rounded-[22px] border border-fuchsia-200/20 bg-[linear-gradient(135deg,rgba(82,49,231,0.92),rgba(185,42,162,0.88)_48%,rgba(232,74,154,0.82))] p-3.5 shadow-[0_18px_54px_rgba(147,51,234,0.25)] sm:p-4">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.14),transparent_24%)]" />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/20 bg-[#1d1447]/40 text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-14 sm:w-14">
                <RadarIcon name="bell" className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[0.95rem] font-black leading-tight tracking-[-0.02em] text-white sm:text-lg">
                  Sois prévenu dès l’ouverture du Radar.
                </h2>
                <p className="mt-1 max-w-[24rem] text-xs leading-5 text-violet-100/80 sm:text-sm">
                  Les premiers accès seront réservés aux comptes actifs Viralynz.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={notifyLaunch}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-white/10 bg-[#160d27]/85 px-3.5 text-[0.82rem] font-bold text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition hover:bg-[#1d1234]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-w-[10rem] sm:px-5"
            >
              Me prévenir
              <RadarIcon name="arrow" className="h-3.5 w-3.5 text-zinc-300" />
            </button>
          </div>
        </section>
      </div>

      {notified ? (
        <div
          role="status"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-cyan-200/20 bg-[#07111d]/95 px-4 py-3 text-center text-sm font-semibold text-cyan-100 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
        >
          Tu seras prévenu au lancement du Radar.
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes radarPulse {
          0%,
          100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-radar-animated='true'] {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  )
}

function WaitlistButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-11 items-center justify-center gap-2.5 rounded-[13px] bg-[linear-gradient(135deg,#5b4bff_0%,#c13ee5_48%,#f04f9d_100%)] px-4 text-[0.84rem] font-bold text-white shadow-[0_16px_38px_rgba(192,62,229,0.26)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200/80 active:scale-[0.99]"
    >
      <RadarIcon name="bell" className="h-4 w-4 text-violet-100" />
      <span>{label}</span>
      <RadarIcon name="arrow" className="h-3.5 w-3.5 text-white/75 transition group-hover:translate-x-0.5" />
    </button>
  )
}

function HeroRadarVisual() {
  return (
    <div className="pointer-events-none absolute -right-[4.6rem] top-5 z-0 h-[15.5rem] w-[15.5rem] opacity-[0.85] min-[420px]:-right-8 min-[420px]:top-4 min-[420px]:h-[16.5rem] min-[420px]:w-[16.5rem] sm:right-2 sm:h-[17.5rem] sm:w-[17.5rem]">
      <svg aria-hidden="true" viewBox="0 0 320 320" className="h-full w-full">
        <defs>
          <radialGradient id="heroRadarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.78" />
            <stop offset="34%" stopColor="#7c3aed" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#020611" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroRadarLine" x1="30" x2="290" y1="160" y2="160">
            <stop stopColor="#8b5cf6" stopOpacity="0.06" />
            <stop offset="0.55" stopColor="#a78bfa" stopOpacity="0.45" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.28" />
          </linearGradient>
          <filter id="heroPointGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="160" cy="160" r="42" fill="url(#heroRadarGlow)" />
        {[42, 64, 86, 110, 134, 158].map((radius) => (
          <circle key={radius} cx="160" cy="160" r={radius} fill="none" stroke="rgba(167,139,250,0.25)" strokeWidth="1.2" />
        ))}
        {[0, 24, 72, 104].map((rotation) => (
          <line
            key={rotation}
            x1="160"
            y1="20"
            x2="160"
            y2="300"
            stroke="rgba(129,140,248,0.18)"
            strokeWidth="1"
            transform={`rotate(${rotation} 160 160)`}
          />
        ))}
        <line x1="28" y1="160" x2="296" y2="160" stroke="url(#heroRadarLine)" strokeWidth="1.5" />
        <circle cx="160" cy="160" r="5" fill="#d8b4fe" filter="url(#heroPointGlow)" />
        <circle data-radar-animated="true" cx="238" cy="83" r="8" fill="#f472d0" filter="url(#heroPointGlow)" style={{ animation: 'radarPulse 3.8s ease-in-out infinite' }} />
        <circle data-radar-animated="true" cx="286" cy="176" r="9" fill="#67e8f9" filter="url(#heroPointGlow)" style={{ animation: 'radarPulse 4.3s ease-in-out infinite' }} />
        <circle data-radar-animated="true" cx="94" cy="229" r="7" fill="#8b5cf6" filter="url(#heroPointGlow)" style={{ animation: 'radarPulse 4.8s ease-in-out infinite' }} />
        <g opacity="0.55">
          <circle cx="94" cy="52" r="1.1" fill="#d8b4fe" />
          <circle cx="246" cy="34" r="1" fill="#93c5fd" />
          <circle cx="284" cy="94" r="1.2" fill="#f5d0fe" />
          <circle cx="253" cy="258" r="1.1" fill="#67e8f9" />
        </g>
      </svg>
    </div>
  )
}

function RadarVisualization() {
  return (
    <div className="relative mt-3 h-[205px] overflow-hidden rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(7,13,32,0.88),rgba(5,8,18,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-[255px]">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(94,92,255,0.18),transparent_30%),radial-gradient(circle_at_78%_30%,rgba(236,72,153,0.12),transparent_28%),radial-gradient(circle_at_22%_46%,rgba(34,211,238,0.08),transparent_25%)]" />
      <svg aria-hidden="true" viewBox="0 0 720 330" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -top-2 h-[88%] w-full sm:h-full">
        <defs>
          <radialGradient id="radarCore" cx="50%" cy="70%" r="32%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
            <stop offset="38%" stopColor="#6d28d9" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#020611" stopOpacity="0" />
          </radialGradient>
          <filter id="radarNodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse cx="360" cy="250" rx="60" ry="30" fill="url(#radarCore)" />
        {[70, 115, 160, 205, 250, 295].map((radius, index) => (
          <ellipse
            key={radius}
            cx="360"
            cy="250"
            rx={radius}
            ry={radius * 0.58}
            fill="none"
            stroke={index % 2 === 0 ? 'rgba(148,163,255,0.33)' : 'rgba(34,211,238,0.18)'}
            strokeWidth={index % 2 === 0 ? '1.35' : '1'}
            strokeDasharray={index % 2 === 0 ? undefined : '3 5'}
          />
        ))}
        {[0, 28, 58, 90, 122, 152].map((rotation) => (
          <line
            key={rotation}
            x1="360"
            y1="250"
            x2="360"
            y2="-40"
            stroke="rgba(125,154,255,0.19)"
            strokeWidth="1"
            transform={`rotate(${rotation} 360 250)`}
          />
        ))}
        <line x1="360" y1="-20" x2="360" y2="330" stroke="rgba(147,197,253,0.22)" />
        <line x1="40" y1="250" x2="680" y2="250" stroke="rgba(147,197,253,0.18)" />
        <circle data-radar-animated="true" cx="247" cy="206" r="12" fill="#8b5cf6" filter="url(#radarNodeGlow)" style={{ animation: 'radarPulse 4.6s ease-in-out infinite' }} />
        <circle data-radar-animated="true" cx="472" cy="96" r="17" fill="#d946ef" filter="url(#radarNodeGlow)" style={{ animation: 'radarPulse 4.2s ease-in-out infinite' }} />
        <circle data-radar-animated="true" cx="514" cy="226" r="12" fill="#67e8f9" filter="url(#radarNodeGlow)" style={{ animation: 'radarPulse 5s ease-in-out infinite' }} />
        <circle cx="360" cy="250" r="3" fill="#f5d0fe" filter="url(#radarNodeGlow)" />
      </svg>

      <div className="absolute bottom-2.5 left-4 right-4 rounded-[18px] border border-white/[0.12] bg-[#11172a]/76 p-2.5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:left-10 sm:right-10 sm:p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.3em] text-zinc-200 sm:text-[0.72rem]">
          Bientôt dans Viralynz
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
          {radarChips.map((chip) => (
            <div key={chip.label} className="min-w-0 rounded-[15px] border border-white/[0.1] bg-white/[0.055] px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-2.5 sm:py-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${chip.color}`} />
                <span className="whitespace-nowrap text-[0.76rem] font-bold leading-4 text-zinc-100 sm:text-sm">{chip.label}</span>
              </div>
              <p className="mt-0.5 whitespace-nowrap pl-3.5 text-[0.66rem] leading-4 text-zinc-400 sm:text-xs">{chip.caption}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeatureList() {
  return (
    <section className="rounded-[22px] border border-white/[0.1] bg-white/[0.035] p-2.5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-3">
      {featureItems.map((item, index) => (
        <div
          key={item.title}
          className={`group flex items-center gap-3 rounded-[16px] px-2 py-2.5 transition hover:bg-white/[0.035] sm:px-3 sm:py-3 ${
            index < featureItems.length - 1 ? 'border-b border-white/[0.075]' : ''
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br ${item.tone} ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12`}>
            <RadarIcon name={item.icon} className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.98rem] font-black leading-5 tracking-[-0.015em] text-zinc-50 sm:text-lg">
              {item.title}
            </h3>
            <p className="mt-0.5 text-[0.82rem] leading-5 text-zinc-400 sm:text-base">{item.description}</p>
          </div>
          <RadarIcon name="arrow" className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-300 sm:h-5 sm:w-5" />
        </div>
      ))}
    </section>
  )
}

function RadarIcon({ name, className }: { name: FeatureIcon; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  }

  if (name === 'trend') {
    return (
      <svg {...common}>
        <path d="M4 17l5-5 4 4 7-8" />
        <path d="M15 8h5v5" />
      </svg>
    )
  }

  if (name === 'layers') {
    return (
      <svg {...common}>
        <path d="M12 3l8 4-8 4-8-4 8-4Z" />
        <path d="M4 12l8 4 8-4" />
        <path d="M4 17l8 4 8-4" />
      </svg>
    )
  }

  if (name === 'hook') {
    return (
      <svg {...common}>
        <path d="M9 18a3 3 0 1 1 0-6h3V5" />
        <path d="M12 5c2.8 0 5 1.8 5 4.2 0 1.6-.9 2.9-2.4 3.6" />
      </svg>
    )
  }

  if (name === 'target') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
      </svg>
    )
  }

  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  )
}
