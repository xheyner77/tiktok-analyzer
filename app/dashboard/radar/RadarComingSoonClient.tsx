'use client'

import { useState } from 'react'
import Link from 'next/link'

type IconName = 'signal' | 'format' | 'hook' | 'angle' | 'bell' | 'arrow'

const stripItems: Array<{
  icon: IconName
  title: string
  copy: string
}> = [
  {
    icon: 'signal',
    title: 'Tendances qui montent',
    copy: 'Avant que tout le monde copie.',
  },
  {
    icon: 'format',
    title: 'Formats encore early',
    copy: 'Repérer les structures encore fraîches.',
  },
  {
    icon: 'hook',
    title: 'Hooks à surveiller',
    copy: 'Voir les tensions qui émergent.',
  },
  {
    icon: 'angle',
    title: 'Angles à tester',
    copy: 'Choisir le prochain angle à tester.',
  },
]

export default function RadarComingSoonClient() {
  const [toastVisible, setToastVisible] = useState(false)

  const notifyLaunch = () => {
    setToastVisible(true)
    window.setTimeout(() => setToastVisible(false), 2600)
  }

  return (
    <main className="relative min-h-[calc(100dvh-5rem)] overflow-hidden bg-[#05060d] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(124,58,237,0.18),transparent_28%),radial-gradient(circle_at_82%_28%,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.08]" />
      <div className="pointer-events-none absolute left-1/2 top-[-24rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full border border-cyan-300/10 bg-cyan-300/[0.025] blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-4">
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.09] bg-white/[0.045] shadow-[0_28px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(139,92,246,0.13),transparent_36%,rgba(34,211,238,0.08))]" />
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />

          <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:p-8">
            <div className="max-w-2xl">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.07] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(103,232,249,0.7)]" />
                  Accès anticipé
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.24em] text-white/38">
                  Radar tendances
                </span>
              </div>

              <h1 className="max-w-2xl text-balance text-[2.45rem] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-5xl lg:text-[4.25rem]">
                Repère les signaux avant saturation.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-white/62 sm:text-base">
                Le futur module Viralynz analysera les hooks, formats et signaux TikTok pour t’aider à décider quoi tester avant les autres.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <WaitlistButton onClick={notifyLaunch} />
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-5 text-sm font-medium text-white/72 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
                >
                  Retour au dashboard
                </Link>
              </div>
            </div>

            <RadarVisual />
          </div>
        </section>

        <section className="rounded-[22px] border border-white/[0.08] bg-white/[0.035] px-4 py-3 backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-4">
            {stripItems.map((item) => (
              <div
                key={item.title}
                className="group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/[0.045]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-cyan-100/80">
                  <RadarIcon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                  <span className="block truncate text-xs text-white/45">{item.copy}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] px-5 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
              Sois prévenu dès l’ouverture du Radar.
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Les premiers accès seront réservés aux comptes actifs Viralynz.
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100/55">
              Pas de fausses tendances. Seulement des signaux exploitables.
            </p>
          </div>
          <WaitlistButton onClick={notifyLaunch} compact />
        </section>
      </div>

      {toastVisible ? (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-cyan-200/15 bg-[#0a1020]/95 px-4 py-3 text-sm font-medium text-cyan-50 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:left-auto sm:right-6 sm:w-auto sm:translate-x-0">
          Tu seras prévenu au lancement du Radar.
        </div>
      ) : null}
    </main>
  )
}

function WaitlistButton({
  onClick,
  compact = false,
}: {
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.09] text-sm font-semibold text-cyan-50 shadow-[0_0_40px_rgba(34,211,238,0.08)] transition hover:border-cyan-100/35 hover:bg-cyan-100/[0.13] ${
        compact ? 'h-10 px-4' : 'h-11 px-5'
      }`}
    >
      <RadarIcon name="bell" className="h-4 w-4 text-cyan-100/85" />
      Me prévenir au lancement
      {!compact ? (
        <RadarIcon
          name="arrow"
          className="h-4 w-4 text-cyan-100/60 transition group-hover:translate-x-0.5 group-hover:text-cyan-50"
        />
      ) : null}
    </button>
  )
}

function RadarVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#070914]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes softPing {
          0%, 100% { opacity: 0.34; transform: scale(1); }
          50% { opacity: 0.84; transform: scale(1.16); }
        }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),transparent_58%),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:auto,34px_34px,34px_34px] opacity-70" />
      <div className="absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/12" />
      <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/12" />
      <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/12" />
      <div className="absolute left-1/2 top-[9%] h-[82%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-100/12 to-transparent" />
      <div className="absolute left-[9%] top-1/2 h-px w-[82%] -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-100/12 to-transparent" />

      <div
        className="absolute left-1/2 top-1/2 h-[42%] w-[42%] origin-bottom-left bg-[conic-gradient(from_16deg,rgba(34,211,238,0.36),rgba(124,58,237,0.08)_24deg,transparent_52deg)] blur-[1px]"
        style={{ animation: 'radarSweep 8s linear infinite' }}
      />

      <SignalPoint className="left-[62%] top-[27%]" label="Early" />
      <SignalPoint className="left-[28%] top-[44%]" label="À surveiller" muted />
      <SignalPoint className="left-[72%] top-[67%]" label="À éviter" warn />

      <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.2em] text-white/38">
          <span>Bientôt dans Viralynz</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.7)]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['Early', 'À surveiller', 'À éviter'].map((status) => (
            <span
              key={status}
              className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-center text-[11px] font-medium text-white/70"
            >
              {status}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SignalPoint({
  className,
  label,
  muted = false,
  warn = false,
}: {
  className: string
  label: string
  muted?: boolean
  warn?: boolean
}) {
  const tone = warn
    ? 'bg-rose-300 shadow-[0_0_16px_rgba(253,164,175,0.65)]'
    : muted
      ? 'bg-indigo-200 shadow-[0_0_16px_rgba(199,210,254,0.55)]'
      : 'bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.8)]'

  return (
    <div className={`absolute ${className}`}>
      <span
        className={`block h-2.5 w-2.5 rounded-full ${tone}`}
        style={{ animation: 'softPing 3.8s ease-in-out infinite' }}
      />
      <span className="absolute left-3 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-medium text-white/62 backdrop-blur sm:block">
        {label}
      </span>
    </div>
  )
}

function RadarIcon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  if (name === 'signal') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M4 14.5a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 14.5a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 15.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'format') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M6 5.5h12M6 12h8M6 18.5h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M18 10.5v3l2 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'hook') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M16 5.5a4.5 4.5 0 0 0-4.5 4.5v4.5a4 4 0 1 1-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16 5.5h3v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'angle') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="m5 18 6-12 3.5 7L19 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 9H19v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'bell') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M18 10.5a6 6 0 1 0-12 0c0 5-2 5.8-2 5.8h16s-2-.8-2-5.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
