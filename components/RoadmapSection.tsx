'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const E = [0.16, 1, 0.3, 1] as const;

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: E, delay }}
    >
      {children}
    </motion.div>
  );
}

const cards = [
  /* ── LIVE ── */
  {
    status: 'live' as const,
    badge: 'LIVE',
    badgeCls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    dotCls: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse',
    borderCls: 'border-emerald-500/20 hover:border-emerald-500/40',
    glowCls: 'from-emerald-500/[0.07]',
    hoverGlow: 'hover:shadow-[0_0_40px_-8px_rgba(52,211,153,0.2)]',
    iconCls: 'bg-emerald-400/10 text-emerald-400',
    titleCls: 'text-white',
    descCls: 'text-gray-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Analyse TikTok IA',
    benefit: 'Sache en 30 secondes exactement pourquoi ta vidéo floppe — et comment la corriger.',
    detail: 'Score viral · Hook · Montage · Rétention',
    delay: 0.05,
  },
  /* ── EN DEV — Reels ── */
  {
    status: 'dev' as const,
    badge: 'EN DEV',
    badgeCls: 'bg-vn-violet/10 text-vn-violet border-vn-violet/25',
    dotCls: 'bg-vn-violet shadow-[0_0_6px_rgba(139,92,246,0.9)] animate-pulse',
    borderCls: 'border-vn-violet/15 hover:border-vn-violet/35',
    glowCls: 'from-vn-violet/[0.06]',
    hoverGlow: 'hover:shadow-[0_0_40px_-8px_rgba(139,92,246,0.18)]',
    iconCls: 'bg-vn-violet/10 text-vn-violet',
    titleCls: 'text-white',
    descCls: 'text-gray-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" />
        <path strokeLinecap="round" d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: 'Instagram Reels',
    benefit: "Comprends pourquoi tes Reels n'explosent pas — et ce que l'algo Meta récompense vraiment.",
    detail: 'Analyse Meta · Critères Reels · Score algorithme',
    delay: 0.10,
  },
  /* ── EN DEV — Shorts ── */
  {
    status: 'dev' as const,
    badge: 'EN DEV',
    badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
    dotCls: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.9)] animate-pulse',
    borderCls: 'border-blue-500/15 hover:border-blue-500/35',
    glowCls: 'from-blue-500/[0.06]',
    hoverGlow: 'hover:shadow-[0_0_40px_-8px_rgba(96,165,250,0.18)]',
    iconCls: 'bg-blue-500/10 text-blue-400',
    titleCls: 'text-white',
    descCls: 'text-gray-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'YouTube Shorts',
    benefit: "Identifie ce qui tue ta rétention sur YouTube — avant que l'algo te pénalise définitivement.",
    detail: 'Algo YouTube · Rétention · Hook spécifique Shorts',
    delay: 0.16,
  },
  /* ── VISION cards ── */
  {
    status: 'vision' as const,
    badge: 'VISION',
    badgeCls: 'bg-white/[0.05] text-gray-500 border-white/[0.10]',
    dotCls: 'bg-gray-600',
    borderCls: 'border-white/[0.07] hover:border-white/[0.12]',
    glowCls: 'from-white/[0.025]',
    hoverGlow: 'hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]',
    iconCls: 'bg-white/[0.04] text-gray-600',
    titleCls: 'text-white/70',
    descCls: 'text-gray-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    title: 'Comparaison & patterns',
    benefit: "Comprends pourquoi certaines vidéos explosent et d'autres meurent — automatiquement.",
    detail: 'Patterns viraux · Analyse cross-vidéo',
    delay: 0.22,
  },
  {
    status: 'vision' as const,
    badge: 'VISION',
    badgeCls: 'bg-white/[0.05] text-gray-500 border-white/[0.10]',
    dotCls: 'bg-gray-600',
    borderCls: 'border-white/[0.07] hover:border-white/[0.12]',
    glowCls: 'from-white/[0.025]',
    hoverGlow: 'hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]',
    iconCls: 'bg-white/[0.04] text-gray-600',
    titleCls: 'text-white/70',
    descCls: 'text-gray-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    title: 'Trends en temps réel',
    benefit: "Sache ce qui va exploser avant tout le monde — et publie au bon moment.",
    detail: "Détection trends · Fenêtres d'opportunité",
    delay: 0.27,
  },
  {
    status: 'vision' as const,
    badge: 'VISION',
    badgeCls: 'bg-white/[0.05] text-gray-500 border-white/[0.10]',
    dotCls: 'bg-gray-600',
    borderCls: 'border-white/[0.07] hover:border-white/[0.12]',
    glowCls: 'from-white/[0.025]',
    hoverGlow: 'hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]',
    iconCls: 'bg-white/[0.04] text-gray-600',
    titleCls: 'text-white/70',
    descCls: 'text-gray-600',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    title: 'Suggestions IA prédictives',
    benefit: "Reçois des idées de contenu générées par l'IA — basées sur ce qui performe dans ta niche.",
    detail: 'Idées virales · Calendrier éditorial IA',
    delay: 0.32,
  },
];

export default function RoadmapSection() {
  return (
    <section className="relative py-20 sm:py-28 border-t border-white/[0.06] overflow-hidden">

      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-vn-bg via-transparent to-vn-bg" />
      </div>

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-vn-indigo/[0.06] blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">

        {/* ── Header ──────────────────────────────────────────────── */}
        <FadeUp>
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">En développement actif</span>
            </div>
            <h2 className="text-3xl sm:text-[2.8rem] font-black tracking-tight leading-tight mb-5">
              <span className="text-white">Viralynz devient</span>
              <br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">
                ton arme secrète.
              </span>
            </h2>
            <p className="text-gray-500 text-[15px] max-w-[480px] mx-auto leading-relaxed">
              On construit l&apos;outil ultime pour comprendre et dominer les algorithmes. Voici où on va.
            </p>
          </div>
        </FadeUp>

        {/* ── Progress bar v1 → v2 → v3 ───────────────────────────── */}
        <FadeUp delay={0.06}>
          <div className="relative mb-8 sm:mb-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              {[
                { full: 'v1 — TikTok', short: 'v1', cls: 'text-emerald-400' },
                { full: 'v2 — Multi-plateforme', short: 'v2', cls: 'text-vn-violet' },
                { full: 'v3 — IA prédictive', short: 'v3', cls: 'text-gray-600' },
              ].map(({ full, short, cls }) => (
                <span key={full} className={`text-[11px] font-bold tracking-wide ${cls}`}>
                  <span className="hidden sm:inline">{full}</span>
                  <span className="sm:hidden">{short}</span>
                </span>
              ))}
            </div>
            <div className="h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-vn-fuchsia to-vn-indigo"
                initial={{ width: '0%' }}
                whileInView={{ width: '38%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease: E, delay: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-gray-700 mt-2 text-right">38% de la vision accomplie</p>
          </div>
        </FadeUp>

        {/* ── Cards grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {cards.map((card) => {
            const isVision = card.status === 'vision';
            return (
              <FadeUp key={card.title} delay={card.delay}>
                <div
                  className={`group relative p-6 rounded-2xl border ${card.borderCls} bg-gradient-to-b ${card.glowCls} to-transparent ${card.hoverGlow} hover:-translate-y-1 transition-all duration-300 overflow-hidden ${isVision ? 'opacity-60 hover:opacity-80' : ''}`}
                >
                  {isVision && <div className="absolute inset-0 backdrop-blur-[1px]" />}
                  <div className={isVision ? 'relative' : ''}>
                    <div className="flex items-start justify-between mb-5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconCls}`}>
                        {card.icon}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${card.badgeCls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${card.dotCls}`} />
                        {card.badge}
                      </span>
                    </div>
                    <h3 className={`text-[16px] font-black mb-2.5 tracking-tight ${card.titleCls}`}>{card.title}</h3>
                    <p className={`text-[13px] leading-relaxed mb-4 ${card.descCls}`}>{card.benefit}</p>
                    <p className="text-[10px] text-gray-700 font-medium tracking-wide">{card.detail}</p>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>

        {/* ── Bottom note ─────────────────────────────────────────── */}
        <FadeUp delay={0.38}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 mt-14 pt-10 border-t border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
              <p className="text-[13px] text-gray-500">
                Mise à jour <span className="text-white font-semibold">chaque semaine</span> — tu es aux premières loges.
              </p>
            </div>
            <Link
              href="/analyzer"
              className="shrink-0 inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.10] hover:border-white/[0.22] bg-white/[0.03] hover:bg-white/[0.06] rounded-full px-5 py-2.5 transition-all duration-300"
            >
              Analyser ma vidéo
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </FadeUp>

      </div>
    </section>
  );
}
