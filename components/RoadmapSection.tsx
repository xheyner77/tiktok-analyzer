'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const E = [0.16, 1, 0.3, 1] as const;

const roadmapColumns = [
  {
    title: 'Live',
    status: 'Aujourd hui',
    tone: 'emerald',
    description: 'Le coeur du moteur de reconstruction deja disponible pour comprendre les flops TikTok.',
    items: [
      { title: 'Analyse TikTok structurée', detail: 'Score vidéo, diagnostic hook, rythme, rétention et CTA.' },
      { title: 'Plan de remontage', detail: 'Quoi couper, quoi avancer, quoi reformuler.' },
      { title: 'Hook Lab', detail: 'Angles d ouverture et hooks classes par objectif.' },
      { title: 'Dashboard V2', detail: 'Prioriser les videos qui meritent une meilleure version.' },
    ],
  },
  {
    title: 'En developpement',
    status: 'V2',
    tone: 'cyan',
    description: 'Les prochaines briques pour rendre Viralynz plus utile sur tous les workflows createur.',
    items: [
      { title: 'Instagram Reels', detail: 'Adapter le diagnostic aux formats Reels.' },
      { title: 'YouTube Shorts', detail: 'Comparer les signaux courts entre plateformes.' },
      { title: 'Comparaison videos', detail: 'Comprendre pourquoi une version bat l autre.' },
      { title: 'Bibliotheque de hooks', detail: 'Sauvegarder, classer et reutiliser les meilleurs angles.' },
    ],
  },
  {
    title: 'Vision',
    status: 'Futur',
    tone: 'violet',
    description: 'L ambition long terme : un moteur predictif qui apprend de chaque reconstruction.',
    items: [
      { title: 'Trends temps reel', detail: 'Relier une idee aux signaux qui montent.' },
      { title: 'Suggestions predictives', detail: 'Prevoir les angles les plus testables avant publication.' },
      { title: 'Memoire createur', detail: 'Retenir ton style, tes formats forts et tes patterns gagnants.' },
      { title: 'Tests A/B hooks et CTA', detail: 'Comparer plusieurs ouvertures avant de tourner.' },
    ],
  },
];

const toneStyles = {
  emerald: {
    badge: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    dot: 'bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.75)]',
    card: 'border-emerald-300/18 from-emerald-300/[0.07]',
    line: 'from-emerald-300 to-cyan-300',
  },
  cyan: {
    badge: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    dot: 'bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.75)]',
    card: 'border-cyan-300/18 from-cyan-300/[0.06]',
    line: 'from-cyan-300 to-vn-fuchsia',
  },
  violet: {
    badge: 'border-vn-fuchsia/25 bg-vn-fuchsia/10 text-fuchsia-100',
    dot: 'bg-vn-fuchsia shadow-[0_0_10px_rgba(232,121,249,0.75)]',
    card: 'border-vn-fuchsia/18 from-vn-fuchsia/[0.065]',
    line: 'from-vn-fuchsia to-vn-indigo',
  },
} as const;

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.65, ease: E, delay }}
    >
      {children}
    </motion.div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 8.2 6.4 11.5 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RoadmapSection() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] px-5 py-16 sm:px-8 sm:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-vn-bg via-transparent to-vn-bg" />
        <div className="absolute left-[12%] top-1/3 h-72 w-72 rounded-full bg-emerald-500/[0.045] blur-[95px]" />
        <div className="absolute right-[10%] top-1/4 h-80 w-80 rounded-full bg-vn-indigo/[0.055] blur-[105px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <FadeUp>
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">En developpement actif</span>
              </div>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-[2.8rem]">
                Viralynz devient <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">ton moteur de reconstruction.</span>
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-gray-400">
                Chaque semaine, Viralynz apprend a lire plus de signaux : hook vocal, texte ecran, rythme, tension,
                format et structure optimisée. Le but n est plus juste d analyser un flop, mais de reconstruire une
                meilleure version prete a tester.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.08em]">
                <span className="text-emerald-300">v1 · Reconstruction Engine</span>
                <span className="text-cyan-300">v2 · Multi-plateformes</span>
                <span className="hidden text-vn-fuchsia sm:inline">v3 · Predictif</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-vn-fuchsia"
                  initial={{ width: '0%' }}
                  whileInView={{ width: '42%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: E, delay: 0.25 }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {['V1 live', 'V2 en construction', 'V3 vision'].map((step) => (
                  <div key={step} className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-gray-400">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeUp>

        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          {roadmapColumns.map((column, index) => {
            const tone = toneStyles[column.tone as keyof typeof toneStyles];
            return (
              <FadeUp key={column.title} delay={0.08 + index * 0.06}>
                <article className={`h-full rounded-[1.35rem] border bg-gradient-to-b ${tone.card} to-white/[0.015] p-5 shadow-[0_28px_95px_-84px_rgba(99,102,241,0.85)]`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white">{column.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-400">{column.description}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {column.status}
                    </span>
                  </div>

                  <div className="mt-5 h-px bg-gradient-to-r from-transparent via-white/[0.16] to-transparent" />

                  <div className="mt-5 grid gap-2.5">
                    {column.items.map((item) => (
                      <div key={item.title} className="rounded-2xl border border-white/[0.07] bg-black/20 p-3.5">
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-300">
                            <CheckIcon />
                          </span>
                          <h4 className="text-sm font-black text-gray-100">{item.title}</h4>
                        </div>
                        <p className="mt-2 pl-7 text-xs leading-5 text-gray-500">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </FadeUp>
            );
          })}
        </div>

        <FadeUp delay={0.28}>
          <div className="mt-12 grid gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.025] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/75">Direction produit</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                On publie ce qui rend le moteur plus utile : plus de signaux lus, plus de contexte createur, plus de
                decisions actionnables pour remonter mieux.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-5 text-sm font-black text-white transition hover:border-white/[0.2] hover:bg-white/[0.07]"
            >
              Analyser ma video
              <ArrowIcon />
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
