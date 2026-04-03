import type { Metadata } from 'next';
import Link from 'next/link';
import FloatingParticles from '@/components/FloatingParticles';
import RoadmapSection from '@/components/RoadmapSection';

export const metadata: Metadata = {
  title: 'Nouveautés — Viralynz',
  description: 'Toutes les nouveautés, améliorations et mises à jour de Viralynz.',
};

type EntryType = 'Nouveauté' | 'Amélioration' | 'Correction' | 'Infrastructure';

interface ChangeItem {
  type: EntryType;
  text: string;
}

interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  tags: string[];
  items: ChangeItem[];
}

const TYPE_STYLES: Record<EntryType, string> = {
  'Nouveauté':      'bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/20',
  'Amélioration':   'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  'Correction':     'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  'Infrastructure': 'bg-gray-500/15 text-gray-400 border border-gray-500/20',
};

const entries: ChangeEntry[] = [
  {
    version: 'v1.0.0',
    date: '3 avril 2026',
    title: 'Lancement de Viralynz 🎉',
    tags: ['Launch', 'Feature', 'Dashboard'],
    items: [
      { type: 'Nouveauté', text: 'Analyse vidéo IA complète — upload MP4, diagnostic en quelques secondes' },
      { type: 'Nouveauté', text: 'Score de viralité de 0 à 100 avec explication détaillée' },
      { type: 'Nouveauté', text: 'Diagnostic précis : hook, montage et rétention analysés séparément' },
      { type: 'Nouveauté', text: 'Problème principal identifié automatiquement par l\'IA' },
      { type: 'Nouveauté', text: 'Plan d\'action priorisé — 3 à 5 corrections concrètes et actionnables' },
      { type: 'Nouveauté', text: 'Courbe d\'attention estimée frame par frame par vision IA' },
      { type: 'Nouveauté', text: 'Hook generator — génère des hooks viraux adaptés à ton contexte (Pro & Elite)' },
      { type: 'Nouveauté', text: 'Dashboard personnel avec historique des analyses et progression' },
      { type: 'Nouveauté', text: '3 analyses gratuites à l\'inscription — sans carte bancaire' },
      { type: 'Nouveauté', text: 'Support TikTok complet — Instagram Reels & YouTube Shorts en roadmap' },
    ],
  },
];

const stats = [
  { value: 10,   label: 'Nouveautés',   color: 'text-vn-fuchsia' },
  { value: 0,    label: 'Améliorations', color: 'text-blue-400' },
  { value: 0,    label: 'Corrections',   color: 'text-amber-400' },
  { value: 1,    label: 'Versions',      color: 'text-purple-400' },
];

function RocketIcon() {
  return (
    <svg className="w-7 h-7 text-vn-fuchsia" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 01-2.58 5.841m0 0a6 6 0 01-5.84-7.38m5.84 7.38h.008"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="w-4 h-4 text-vn-fuchsia shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

export default function ChangelogPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Background glow + particles */}
      <div className="absolute top-0 inset-x-0 h-[480px] pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-gradient-to-b from-vn-fuchsia/10 to-transparent blur-3xl" />
        <FloatingParticles count={30} />
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-vn-fuchsia/20 to-vn-indigo/20 border border-vn-fuchsia/25 mb-6">
            <RocketIcon />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
            <span className="text-white">Toutes les</span>{' '}
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">nouveautés.</span>
          </h1>
          <p className="text-gray-400 text-[15px] sm:text-base max-w-xl mx-auto leading-relaxed mb-10">
            Toutes les nouveautés, améliorations et mises à jour de Viralynz.
            On construit le meilleur outil d&apos;analyse vidéo IA, ensemble.
          </p>

          {/* Stats */}
          <div className="inline-flex items-stretch gap-0 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            {stats.map(({ value, label, color }, i) => (
              <div
                key={label}
                className={`px-6 sm:px-8 py-4 sm:py-5 text-center ${i < stats.length - 1 ? 'border-r border-white/[0.07]' : ''}`}
              >
                <p className={`text-3xl sm:text-[2.2rem] font-black leading-none ${color} mb-1`}>
                  {value}
                </p>
                <p className="text-[11px] sm:text-[12px] text-gray-600 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────── */}
      <section className="relative py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          {entries.map((entry) => (
            <div key={entry.version} className="relative flex gap-6 sm:gap-8 pb-12 last:pb-0">

              {/* Timeline dot + line */}
              <div className="flex flex-col items-center shrink-0 pt-1">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-vn-fuchsia to-vn-indigo shadow-[0_0_12px_rgba(232,121,249,0.7)]" />
                  <div className="absolute inset-0 rounded-full bg-vn-fuchsia/30 scale-[2.5] animate-pulse" />
                </div>
                <div className="flex-1 w-px bg-gradient-to-b from-vn-fuchsia/30 via-white/[0.06] to-transparent mt-3" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-2">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/25 uppercase tracking-wider">
                      {entry.version}
                    </span>
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] text-gray-400 border border-white/[0.07] uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <time className="text-[12px] text-gray-600 font-medium shrink-0">
                    {entry.date}
                  </time>
                </div>

                {/* Title */}
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-6">
                  {entry.title}
                </h2>

                {/* Items */}
                <div className="space-y-2.5">
                  {entry.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3.5 p-4 sm:p-5 rounded-xl bg-[#0d0d12] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                    >
                      {/* Icon */}
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-vn-fuchsia/10 border border-vn-fuchsia/15 flex items-center justify-center shrink-0">
                        <SparkIcon />
                      </div>
                      {/* Content */}
                      <div className="flex items-start gap-3 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                        <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_STYLES[item.type]}`}>
                          {item.type}
                        </span>
                        <p className="text-[13.5px] sm:text-[14px] text-gray-300 leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

        </div>
      </section>

      {/* ── ROADMAP ──────────────────────────────────────────────────── */}
      <RoadmapSection />

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-t border-white/[0.06]">
        <div className="max-w-xl mx-auto px-5 sm:px-8 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-gray-700 mb-4">Essaie maintenant</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-4">
            <span className="text-white">Lance ta première</span><br />
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">analyse.</span>
          </h2>
          <p className="text-gray-500 text-[14px] mb-8">
            3 analyses gratuites — sans carte bancaire.
          </p>
          <Link
            href="/analyzer"
            className="inline-flex items-center gap-2.5 min-h-[48px] rounded-full px-8 text-[14px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-vn-fuchsia/25"
          >
            Analyser ma vidéo
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
