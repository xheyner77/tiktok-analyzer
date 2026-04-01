import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';
import LandingProductMockup from '@/components/landing/LandingProductMockup';
import {
  credibilityBlocks,
  faqItems,
  platformRoadmap,
  roadmapColumns,
} from '@/components/landing/landing-copy';

const workflowSteps = [
  {
    n: '01',
    title: 'Importe ta vidéo',
    body: 'Fichier court (MP4 recommandé) + lien TikTok fortement conseillé pour croiser avec les signaux publics.',
  },
  {
    n: '02',
    title: 'Reçois le diagnostic IA',
    body: 'Hook, montage, rétention, structure et CTA : une lecture ordonnée — pas un commentaire vague.',
  },
  {
    n: '03',
    title: 'Améliore avec méthode',
    body: 'Tu sais quoi retoucher en premier. Le générateur de hooks t’aide à challenger l’ouverture — en complément, pas à la place de l’analyse.',
  },
];

const audiences = [
  {
    title: 'Créateurs & personal brands',
    desc: 'Passe de l’impression au critère : quoi tester sur la prochaine vidéo.',
  },
  {
    title: 'E‑commerce & UGC',
    desc: 'Aligne démos, preuves sociales et scripts sur une même grille de lecture.',
  },
  {
    title: 'Agences social & studios',
    desc: 'Retours clients plus nets : moins de « refais plus dynamique » sans repère.',
  },
  {
    title: 'Marketeurs & growth',
    desc: 'Moins de volume aveugle : chaque itération repose sur des priorités claires.',
  },
];

function FaqChevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 group-open:rotate-180"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconSpark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

function HeroTrustStars({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-0.5 ${className}`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="w-4 h-4 sm:w-[17px] sm:h-[17px] text-vn-fuchsia drop-shadow-[0_0_8px_rgba(232,121,249,0.35)]"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function SectionEyebrow({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'center';
}) {
  if (align === 'center') {
    return (
      <div className="flex justify-center mb-5 sm:mb-6">
        <div className="inline-flex items-center gap-3 sm:gap-4">
          <span className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent via-vn-fuchsia/45 to-vn-fuchsia/20 rounded-full" />
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-gray-500">{children}</p>
          <span className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent via-vn-violet/45 to-vn-violet/20 rounded-full" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 mb-4 sm:mb-5">
      <span className="h-px w-12 sm:w-20 shrink-0 bg-gradient-to-r from-vn-fuchsia/55 to-transparent rounded-full" />
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-gray-500">{children}</p>
    </div>
  );
}

const toolkitSections: {
  featured?: boolean;
  bonus?: boolean;
  soon?: boolean;
  title: string;
  body: string;
  icon: ReactNode;
}[] = [
  {
    featured: true,
    title: 'Analyse vidéo IA',
    body:
      'Vision sur les frames clés + contexte (durée, fichier, stats TikTok quand le lien est dispo). Tu obtiens une lecture honnête de ce qui retient — ou fait fuir.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Diagnostic hook',
    body: 'L’ouverture décryptée : promesse, curiosité, clarté du sujet — avec des repères actionnables pour la prochaine prise.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L6 12l7.5 7.5M6 12h13.5" />
      </svg>
    ),
  },
  {
    title: 'Rétention & structure',
    body: 'Où l’attention risque de chuter, comment la narration tient (ou lâche), et quoi resserrer pour garder la cadence.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    title: 'Montage & rythme',
    body: 'Coupes, dynamique visuelle, charge cognitive : des repères pour alléger ou intensifier au bon moment.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V4.875a1.125 1.125 0 011.125-1.125h17.25a1.125 1.125 0 011.125 1.125v13.5a1.125 1.125 0 01-1.125 1.125m-17.25 0h17.25"
        />
      </svg>
    ),
  },
  {
    title: 'Recommandations priorisées',
    body: 'Une liste courte, ordonnée : ce qui bouge le score en premier — applicable avant la prochaine publication.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586L11.42 15.17z"
        />
      </svg>
    ),
  },
  {
    bonus: true,
    title: 'Hook generator',
    body: 'Des accroches courtes, testables tout de suite — pour challenger ton angle une fois le diagnostic posé.',
    icon: <IconSpark className="w-5 h-5" />,
  },
  {
    soon: true,
    title: 'Insights multi‑plateformes',
    body: 'Même discipline produit : TikTok aujourd’hui, Reels & Shorts demain — pour une intelligence virale portable.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z"
        />
      </svg>
    ),
  },
];

const benefitPillars = [
  {
    title: 'Du temps',
    body: 'Moins d’aller‑retour flou. Tu sais quoi couper, quoi renforcer, quoi retester en premier.',
  },
  {
    title: 'De la clarté',
    body: 'Une grille partagée entre créateur, marque et agence — le même langage sur la table.',
  },
  {
    title: 'De meilleures décisions',
    body: 'Arbitrer avec des signaux structurés plutôt qu’avec une impression de scroll infini.',
  },
  {
    title: 'Moins de tests inutiles',
    body: 'Repère les frictions avant la mise en ligne — pas seulement après un flop.',
  },
  {
    title: 'Plus de chances de perf',
    body: 'Pas de promesse magique : des choix informés à chaque itération, sur un format impitoyable.',
  },
];

export default function HomeLanding() {
  return (
    <div className="relative min-h-screen bg-vn-void overflow-x-hidden">
      <div className="fixed inset-0 bg-vn-void pointer-events-none" aria-hidden />
      <div className="fixed inset-0 landing-mesh pointer-events-none opacity-[0.88]" aria-hidden />
      <div className="fixed inset-0 landing-grid-fine pointer-events-none opacity-[0.32]" aria-hidden />
      <div className="fixed inset-0 landing-hero-aurora pointer-events-none opacity-[0.78]" aria-hidden />
      <div className="fixed inset-0 landing-vignette-page pointer-events-none" aria-hidden />
      <div className="fixed inset-0 landing-noise pointer-events-none mix-blend-overlay" aria-hidden />
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-52 left-1/2 -translate-x-1/2 w-[min(1200px,260vw)] h-[600px] rounded-full bg-vn-radial blur-3xl opacity-[0.95]" />
      </div>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative pt-12 sm:pt-16 lg:pt-20 overflow-visible" id="top">
        <div className="absolute inset-x-0 top-0 h-[min(82vh,900px)] landing-band-magenta pointer-events-none opacity-95" aria-hidden />
        <div className="landing-section relative">
          <div className="text-center max-w-[94rem] mx-auto px-2 sm:px-1">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-full border border-white/[0.12] landing-hero-badge px-5 py-2 sm:px-6 sm:py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.17em] text-gray-500 mb-12 sm:mb-14 shadow-[0_0_52px_-12px_rgba(232,121,249,0.24)] transition-all duration-500 hover:shadow-[0_0_76px_-10px_rgba(232,121,249,0.36)] hover:border-white/[0.2]">
              <span className="flex items-center gap-2 normal-case tracking-normal text-white font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vn-fuchsia opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-vn-fuchsia shadow-[0_0_16px_rgba(232,121,249,0.85)]" />
                </span>
                Analyse vidéo IA
              </span>
              <span className="text-white/15 hidden sm:inline" aria-hidden>·</span>
              <span className="normal-case tracking-normal text-gray-500 font-medium">TikTok · Insights de performance</span>
            </div>

            <h1 className="landing-heading-xl landing-hero-title-glow text-[2.9rem] leading-[0.99] sm:text-[3.9rem] sm:leading-[0.96] md:text-[4.8rem] md:leading-[0.95] lg:text-[5.7rem] lg:leading-[0.92] xl:text-[6.25rem] 2xl:text-[6.7rem] mx-auto tracking-[-0.04em] px-1 max-w-[13.5ch]">
              <span className="text-white block">Arrête de deviner.</span>
              <span className="block mt-2 sm:mt-3">
                <span className="gradient-text-hero">Domine tes performances</span>
                <span className="text-white"> vidéo.</span>
              </span>
            </h1>

            <p className="mt-10 sm:mt-12 text-[1.06rem] sm:text-[1.2rem] md:text-[1.36rem] text-gray-100 max-w-2xl mx-auto leading-snug sm:leading-relaxed font-medium">
              Tu publies beaucoup, mais sans certitude.
              <span className="text-gray-300 font-normal block mt-1.5 sm:mt-2">
                Viralynz transforme chaque vidéo en plan d’action clair : moins de tests inutiles, plus de contenu qui
                performe.
              </span>
            </p>

            <div className="mt-12 sm:mt-14 md:mt-16 flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-3 justify-center items-stretch sm:items-start">
              <div className="flex flex-col items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto group">
                  <div
                    className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/60 via-vn-violet/52 to-vn-indigo/52 opacity-75 blur-lg transition-all duration-500 group-hover:opacity-100 group-hover:blur-2xl group-hover:scale-[1.04]"
                    aria-hidden
                  />
                  <Link
                    href="/analyzer"
                    className="relative inline-flex justify-center items-center w-full sm:w-auto min-h-[58px] rounded-full px-11 sm:px-12 text-[15px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_14px_48px_-10px_rgba(232,121,249,0.72),0_30px_66px_-16px_rgba(99,102,241,0.4)]"
                  >
                    Lancer mon analyse IA
                  </Link>
                </div>
                <p className="text-[12px] sm:text-[13px] text-gray-400 font-medium tracking-tight">
                  {MAX_ANALYSES_FREE} analyses gratuites — sans carte
                </p>
                <p className="text-[12px] sm:text-[13px] text-vn-violet/90 font-medium tracking-tight">
                  Chaque vidéo devient un test intelligent.
                </p>
              </div>
              <Link
                href="/signup"
                className="inline-flex justify-center items-center min-h-[58px] rounded-full px-10 sm:px-11 text-[15px] font-semibold text-gray-100 border border-white/[0.14] bg-white/[0.05] hover:bg-white/[0.11] hover:border-white/[0.26] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm w-full sm:w-auto"
              >
                Créer un compte
              </Link>
            </div>

            <div className="mt-11 sm:mt-14 flex flex-col items-center gap-2.5 max-w-xl mx-auto">
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {['CR', 'AG', 'EC', 'UG'].map((item) => (
                    <span
                      key={item}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-vn-elevated text-[10px] font-semibold text-gray-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <HeroTrustStars />
              </div>
              <p className="text-[13px] sm:text-sm text-gray-400 leading-relaxed text-center">
                Pensé pour les <span className="text-gray-300">créateurs</span>, <span className="text-gray-300">agences</span> et{' '}
                <span className="text-gray-300">e‑com</span> qui veulent un vrai avantage compétitif.
              </p>
            </div>
          </div>

          <div className="mt-20 sm:mt-24 lg:mt-28 -mx-4 sm:-mx-8 lg:-mx-10 relative hero-mockup-float">
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-12 sm:-top-20 w-[min(94vw,1320px)] h-[260px] rounded-[999px] bg-gradient-to-r from-vn-fuchsia/28 via-vn-violet/24 to-vn-indigo/20 blur-3xl opacity-95"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-24 w-[min(95vw,1360px)] h-[320px] rounded-[999px] bg-gradient-to-t from-vn-fuchsia/38 via-vn-indigo/18 to-transparent blur-3xl opacity-90"
              aria-hidden
            />
            <LandingProductMockup variant="hero" className="hero-mockup-pulse" />
          </div>

          <div className="mt-14 sm:mt-16 flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            {[
              'Diagnostic assisté par IA',
              'Priorités claires — pas un score opaque',
              'Hook generator en complément',
              'Pensé créateurs, marques & agences',
            ].map((label) => (
              <span
                key={label}
                className="text-xs sm:text-[13px] font-medium text-gray-400 px-4 py-2.5 rounded-full border border-white/[0.08] bg-black/40 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="landing-section px-5 sm:px-8 lg:px-10 py-2">
        <div className="landing-section-line-strong" />
      </div>

      {/* ── Produit / mockup massif ───────────────────── */}
      <section
        id="produit"
        className="relative py-24 sm:py-32 lg:py-40 scroll-mt-24 landing-band border-t border-white/[0.04]"
      >
        <div className="landing-section">
          <div className="max-w-3xl lg:max-w-4xl mb-14 sm:mb-20 lg:mb-24">
            <SectionEyebrow>Le produit</SectionEyebrow>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[3rem] xl:text-[3.15rem] leading-[1.08]">
              Une interface pensée pour la décision — pas pour le bruit.
            </h2>
            <p className="mt-6 text-base sm:text-lg text-gray-400 leading-relaxed max-w-2xl">
              Chaque écran ramène à l’essentiel : ce que la vidéo montre, ce que l’IA en déduit, et ce que tu dois traiter
              en premier. Le hook generator arrive après — quand tu veux tester des angles, pas quand tu devines.
            </p>
          </div>

          <LandingProductMockup variant="showcase" />
        </div>
      </section>

      {/* ── Toolkit ───────────────────────────────────── */}
      <section
        id="fonctions"
        className="relative py-24 sm:py-32 lg:py-36 scroll-mt-24 border-t border-white/[0.05] bg-gradient-to-b from-black/20 via-transparent to-black/25"
      >
        <div className="landing-section">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-14 sm:mb-20 lg:mb-24">
            <div className="max-w-2xl">
              <SectionEyebrow>
                <span className="text-vn-violet">Tout ce qu’il te faut</span>
              </SectionEyebrow>
              <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.9rem] leading-tight">
                L’arsenal pour décoder le court format
              </h2>
              <p className="mt-4 text-base sm:text-lg text-gray-400 leading-relaxed">
                Le cœur, c’est l’analyse vidéo. Le reste accélère ton exécution — sans diluer la promesse.
              </p>
            </div>
            <Link
              href="/analyzer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-vn-violet hover:text-white transition-colors shrink-0"
            >
              Ouvrir l’analyseur
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            {toolkitSections.map((card) => (
              <div
                key={card.title}
                className={`toolkit-card-premium group p-6 sm:p-8 transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-[0_24px_64px_-28px_rgba(0,0,0,0.75),0_0_0_1px_rgba(232,121,249,0.06)] ${
                  card.featured
                    ? 'lg:col-span-2 lg:min-h-[300px] flex flex-col justify-between ring-1 ring-vn-fuchsia/10 shadow-[0_0_80px_-40px_rgba(232,121,249,0.35)]'
                    : ''
                } ${card.bonus ? 'lg:col-span-1 border-vn-fuchsia/20 bg-gradient-to-b from-vn-fuchsia/[0.06] to-black/20' : ''} ${
                  card.soon ? 'lg:col-span-1 border-white/[0.07] bg-white/[0.03]' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        card.featured
                          ? 'bg-gradient-to-br from-vn-fuchsia/25 to-vn-indigo/20 text-vn-fuchsia'
                          : card.bonus
                            ? 'bg-vn-fuchsia/15 text-vn-fuchsia'
                            : 'bg-white/[0.06] text-vn-violet'
                      }`}
                    >
                      {card.icon}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {card.featured ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/10">
                          Cœur du produit
                        </span>
                      ) : null}
                      {card.bonus ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-vn-fuchsia/35 text-vn-fuchsia">
                          Bonus
                        </span>
                      ) : null}
                      {card.soon ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/15 text-gray-400">
                          Roadmap
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-3">{card.title}</h3>
                  <p className="text-sm sm:text-[15px] text-gray-400 leading-relaxed">{card.body}</p>
                </div>
                {card.featured ? (
                  <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-wrap gap-2">
                    {['Vision', 'Scores', 'Priorités', 'Historique'].map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-medium text-gray-500 px-3 py-1 rounded-full bg-black/40 border border-white/[0.06]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bénéfices ─────────────────────────────────── */}
      <section
        id="gains"
        className="relative py-28 sm:py-32 lg:py-40 scroll-mt-24 border-t border-white/[0.05] bg-gradient-to-b from-vn-indigo/[0.05] via-transparent to-black/30"
      >
        <div className="landing-section">
          <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-24">
            <SectionEyebrow align="center">
              <span className="text-vn-fuchsia">Ce que tu gagnes</span>
            </SectionEyebrow>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem]">Moins de hasard. Plus de contrôle.</h2>
            <p className="mt-5 text-gray-400 text-sm sm:text-base leading-relaxed">
              Viralynz ne promet pas la viralité : il rend tes choix plus lucides — à chaque vidéo.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-5">
            {benefitPillars.map((b, i) => (
              <div
                key={b.title}
                className="landing-card-deep landing-card-accent-top rounded-2xl p-6 sm:p-7 pt-8 text-left transition-all duration-300"
              >
                <span className="text-[10px] font-mono text-gray-600 mb-4 block tracking-wider">0{i + 1}</span>
                <h3 className="font-display font-bold text-white text-base mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Crédibilité ──────────────────────────────── */}
      <section
        id="confiance"
        className="relative py-24 sm:py-28 lg:py-36 scroll-mt-24 border-t border-white/[0.05] landing-band"
      >
        <div className="landing-section">
          <div className="max-w-3xl mb-14 sm:mb-16">
            <SectionEyebrow>
              <span className="text-vn-violet">Crédibilité</span>
            </SectionEyebrow>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.85rem] leading-tight">
              Sérieux produit, sans storytelling creux
            </h2>
            <p className="mt-5 text-gray-400 text-sm sm:text-base leading-relaxed max-w-2xl">
              Pas de chiffres inventés : une promesse honnête — la clarté sur ce que tu publies.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 lg:gap-7">
            {credibilityBlocks.map((c) => (
              <div
                key={c.title}
                className="landing-card-deep landing-card-accent-top rounded-3xl p-7 sm:p-8 pt-9 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-vn-violet/25 to-vn-indigo/15 flex items-center justify-center mb-6 text-vn-violet ring-1 ring-white/10 shadow-lg">
                  <IconSpark className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-white text-lg mb-3">{c.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audiences ─────────────────────────────────── */}
      <section
        id="profils"
        className="relative py-20 sm:py-28 lg:py-32 border-t border-white/[0.05] bg-black/20"
      >
        <div className="landing-section">
          <SectionEyebrow align="center">
            <span className="text-gray-500">Profils</span>
          </SectionEyebrow>
          <h2 className="landing-heading-xl text-3xl sm:text-4xl text-center mb-5">Qui en tire le plus ?</h2>
          <p className="text-center text-gray-400 max-w-xl mx-auto mb-14 text-sm sm:text-base leading-relaxed">
            Du créateur solo à l’équipe qui produit en volume — même exigence sur la clarté.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {audiences.map((a) => (
              <div
                key={a.title}
                className="landing-card-deep rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:border-vn-fuchsia/20"
              >
                <h3 className="font-display font-bold text-white mb-2 text-lg">{a.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Parcours ─────────────────────────────────── */}
      <section
        id="workflow"
        className="relative py-28 sm:py-32 lg:py-40 border-y border-white/[0.06] scroll-mt-24 bg-gradient-to-b from-white/[0.02] via-transparent to-black/25"
      >
        <div className="landing-section">
          <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-24">
            <SectionEyebrow align="center">
              <span className="text-vn-fuchsia">Parcours</span>
            </SectionEyebrow>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem]">
              De la vidéo au plan d’action — en trois étapes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-8 relative max-w-5xl mx-auto">
            <div
              className="hidden md:block absolute top-[2.75rem] left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/18 to-transparent"
              aria-hidden
            />
            {workflowSteps.map((s) => (
              <div
                key={s.n}
                className="relative text-center md:text-left landing-card-deep landing-card-accent-top rounded-2xl p-7 sm:p-8 pt-9"
              >
                <span className="inline-flex font-display text-4xl sm:text-5xl font-bold gradient-text-hero opacity-95 mb-5">
                  {s.n}
                </span>
                <h3 className="font-display text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto md:mx-0">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roadmap plateformes ──────────────────────── */}
      <section id="roadmap" className="relative py-24 sm:py-32 lg:py-36 scroll-mt-24 border-t border-white/[0.05]">
        <div className="landing-section">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
            <SectionEyebrow align="center">
              <span className="text-vn-violet">Roadmap</span>
            </SectionEyebrow>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem]">TikTok d’abord. Le reste suit.</h2>
            <p className="mt-5 text-gray-400 text-sm sm:text-base leading-relaxed">
              On bâtit une intelligence virale portable : même méthode, nouvelles surfaces vidéo.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-16 sm:mb-20">
            {platformRoadmap.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-6 sm:p-7 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                  p.status === 'live'
                    ? 'border-emerald-400/30 bg-gradient-to-b from-emerald-500/[0.1] to-black/35 shadow-[0_0_40px_-20px_rgba(52,211,153,0.25)]'
                    : 'landing-card-deep'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-display font-bold text-white">{p.name}</h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      p.status === 'live'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {p.status === 'live' ? 'Live' : 'À venir'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {roadmapColumns.map((col) => (
              <div
                key={col.phase}
                className="landing-card-deep rounded-3xl p-7 sm:p-8 relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${col.accent}`}
                  aria-hidden
                />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">{col.phase}</p>
                <ul className="space-y-4">
                  {col.items.map((item) => (
                    <li key={item} className="text-sm text-gray-400 flex gap-3 leading-relaxed">
                      <span className="text-vn-fuchsia shrink-0 mt-0.5">▸</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs ───────────────────────────────────── */}
      <section
        id="tarifs"
        className="relative py-28 sm:py-32 lg:py-40 border-t border-white/[0.06] scroll-mt-24 bg-gradient-to-b from-black/35 via-vn-void to-black/40"
      >
        <div className="landing-section">
          <div className="text-center mb-14 sm:mb-20 max-w-2xl mx-auto">
            <SectionEyebrow align="center">
              <span className="text-vn-fuchsia">Tarifs</span>
            </SectionEyebrow>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem]">Commence gratuitement</h2>
            <p className="mt-3 text-gray-400 text-sm sm:text-base">
              Passe sur Pro ou Elite quand l’analyse vidéo est dans ton rythme de production.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
            <div className="rounded-3xl landing-card-deep p-7 sm:p-8 flex flex-col order-2 md:order-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Free</p>
              <p className="font-display text-4xl font-bold text-white mt-3">0€</p>
              <p className="text-sm text-gray-500 mt-2 mb-8">{MAX_ANALYSES_FREE} analyses pour valider le produit</p>
              <ul className="text-sm text-gray-400 space-y-3 mb-10 flex-1">
                <li className="flex gap-2">
                  <span className="text-gray-600">·</span> Scores & lecture essentielle
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-600">·</span> Sans engagement
                </li>
              </ul>
              <Link
                href="/signup"
                className="block text-center rounded-full py-3.5 text-sm font-semibold border border-white/15 hover:bg-white/[0.05] transition-colors min-h-[48px] flex items-center justify-center"
              >
                Commencer
              </Link>
            </div>

            <div className="rounded-3xl pro-pricing-card p-7 sm:p-8 flex flex-col relative order-1 md:order-2 md:-mt-2 md:mb-2 md:shadow-2xl">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-lg">
                Le plus choisi
              </span>
              <p className="text-xs font-bold text-vn-fuchsia uppercase tracking-wider mt-2">Pro</p>
              <p className="font-display text-4xl font-bold text-white mt-2">
                {DISPLAY_CATALOG_PRO_EUR}€<span className="text-lg font-normal text-gray-500">/mois</span>
              </p>
              <p className="text-sm text-gray-400 mt-2 mb-8">
                {MAX_ANALYSES_PRO} analyses · {MAX_HOOKS_PRO} hooks / mois
              </p>
              <ul className="text-sm text-gray-300 space-y-3 mb-10 flex-1">
                <li className="flex gap-2">
                  <span className="text-vn-fuchsia">·</span> Analyse vidéo poussée
                </li>
                <li className="flex gap-2">
                  <span className="text-vn-fuchsia">·</span> Hook generator inclus
                </li>
              </ul>
              <Link
                href="/pricing"
                className="block text-center rounded-full py-3.5 text-sm font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all min-h-[48px] flex items-center justify-center shadow-lg shadow-vn-fuchsia/20"
              >
                Choisir Pro
              </Link>
            </div>

            <div className="rounded-3xl elite-pricing-card p-7 sm:p-8 flex flex-col order-3">
              <p className="text-xs font-bold text-vn-glow uppercase tracking-wider">Elite</p>
              <p className="font-display text-4xl font-bold text-white mt-3">
                {DISPLAY_CATALOG_ELITE_EUR}€<span className="text-lg font-normal text-gray-500">/mois</span>
              </p>
              <p className="text-sm text-gray-400 mt-2 mb-8">
                {MAX_ANALYSES_ELITE} analyses · {MAX_HOOKS_ELITE} hooks / mois
              </p>
              <ul className="text-sm text-gray-300 space-y-3 mb-10 flex-1">
                <li className="flex gap-2">
                  <span className="text-vn-glow">·</span> Volume & profondeur max
                </li>
                <li className="flex gap-2">
                  <span className="text-vn-glow">·</span> Support prioritaire
                </li>
              </ul>
              <Link
                href="/pricing"
                className="block text-center rounded-full py-3.5 text-sm font-semibold border border-vn-violet/45 text-vn-glow hover:bg-vn-violet/10 transition-colors min-h-[48px] flex items-center justify-center"
              >
                Choisir Elite
              </Link>
            </div>
          </div>
          <p className="text-center mt-10">
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              Voir le détail des fonctionnalités par plan
              <span aria-hidden>→</span>
            </Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section
        id="faq"
        className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24 bg-black/15"
      >
        <div className="landing-section max-w-3xl">
          <SectionEyebrow align="center">
            <span className="text-gray-500">FAQ</span>
          </SectionEyebrow>
          <h2 className="landing-heading-xl text-3xl sm:text-4xl text-center mb-5">Questions fréquentes</h2>
          <p className="text-center text-gray-500 text-sm sm:text-base mb-12 sm:mb-14 max-w-lg mx-auto leading-relaxed">
            Transparence avant paiement — le même niveau d’exigence que dans le produit.
          </p>
          <div className="space-y-3.5">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl landing-card-deep border-white/[0.06] open:border-vn-fuchsia/25 open:shadow-[0_0_48px_-24px_rgba(232,121,249,0.2)] transition-all duration-300"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left min-h-[56px] [&::-webkit-details-marker]:hidden">
                  <span className="text-sm sm:text-[15px] font-semibold text-white pr-2">{item.q}</span>
                  <FaqChevron />
                </summary>
                <p className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 text-sm text-gray-400 leading-relaxed border-t border-transparent group-open:border-white/[0.05] group-open:pt-4 -mt-1 group-open:mt-0">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────── */}
      <section className="relative py-28 sm:py-36 px-5 sm:px-8 border-t border-white/[0.05]">
        <div className="landing-section max-w-4xl">
          <div className="relative rounded-[2rem] p-[1px] bg-gradient-to-br from-white/15 via-vn-fuchsia/35 to-vn-indigo/40 shadow-[0_32px_100px_-40px_rgba(232,121,249,0.35)]">
            <div className="relative rounded-[calc(2rem-1px)] overflow-hidden bg-[#06060c] ring-1 ring-white/[0.06]">
              <div
                className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/18 via-[#0a0a12] to-vn-indigo/18"
                aria-hidden
              />
              <div className="absolute inset-0 landing-mesh opacity-40 mix-blend-overlay" aria-hidden />
              <div className="relative px-8 sm:px-12 lg:px-16 py-14 sm:py-16 lg:py-20 text-center">
              <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.6rem] mb-5">
                Passe du feeling au <span className="gradient-text-hero">diagnostic</span>.
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto mb-10 text-sm sm:text-base leading-relaxed">
                Analyse ta prochaine vidéo avec Viralynz : une grille de lecture nette, des priorités — puis des hooks pour
                challenger l’ouverture si tu veux aller plus vite.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto">
                <Link
                  href="/analyzer"
                  className="inline-flex justify-center items-center min-h-[52px] rounded-full px-10 text-sm font-semibold bg-white text-vn-bg hover:bg-gray-100 transition-colors"
                >
                  Lancer une analyse
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex justify-center items-center min-h-[52px] rounded-full px-10 text-sm font-semibold border border-white/25 text-white hover:bg-white/10 transition-colors"
                >
                  Créer mon compte
                </Link>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.08] py-12 sm:py-14">
        <div className="landing-section">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div>
              <p className="font-display text-xl font-bold text-white">
                Viral<span className="gradient-text">ynz</span>
              </p>
              <p className="mt-2 text-sm text-gray-500 max-w-sm leading-relaxed">
                Intelligence virale pour le court format : analyse vidéo IA en premier, hook generator en accélérateur.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-500">
              <Link href="/analyzer" className="hover:text-white transition-colors">
                Analyser
              </Link>
              <Link href="/hook-generator" className="hover:text-white transition-colors">
                Hooks
              </Link>
              <Link href="/pricing" className="hover:text-white transition-colors">
                Tarifs
              </Link>
              <Link href="/login" className="hover:text-white transition-colors">
                Connexion
              </Link>
              <a href="https://viralynz.com" className="hover:text-white transition-colors">
                viralynz.com
              </a>
            </nav>
          </div>
          <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between gap-4 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Viralynz. Tous droits réservés.</p>
            <p className="text-gray-600">TikTok aujourd’hui — Reels, Shorts & suite en roadmap.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
