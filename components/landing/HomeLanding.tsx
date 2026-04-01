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
import { faqItems, platformRoadmap } from '@/components/landing/landing-copy';

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

const toolkitSections: {
  featured?: boolean;
  bonus?: boolean;
  title: string;
  body: string;
  icon: ReactNode;
  className: string;
}[] = [
  {
    featured: true,
    title: 'Analyse vidéo IA',
    body: 'Le coeur de Viralynz : diagnostic hook, montage, rétention et CTA avec priorités claires.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
    ),
    className:
      'lg:col-span-2 lg:row-span-2 rounded-3xl border border-vn-fuchsia/20 bg-gradient-to-br from-vn-fuchsia/[0.08] via-vn-surface/70 to-vn-indigo/[0.08]',
  },
  {
    title: 'Diagnostic hook',
    body: 'Comprends en quelques minutes si ton ouverture retient, intrigue et donne envie de rester.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L6 12l7.5 7.5M6 12h13.5" />
      </svg>
    ),
    className: 'rounded-3xl border border-white/[0.08] bg-vn-surface/50',
  },
  {
    title: 'Rétention & structure',
    body: 'Repère où l’attention chute, ce qui coupe le rythme, et ce qui doit être ajusté en priorité.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
    className: 'rounded-3xl border border-white/[0.08] bg-vn-surface/50',
  },
  {
    title: 'Montage & rythme',
    body: 'Coupes, intensité visuelle, lisibilité : des recommandations actionnables vidéo après vidéo.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V4.875a1.125 1.125 0 011.125-1.125h17.25a1.125 1.125 0 011.125 1.125v13.5a1.125 1.125 0 01-1.125 1.125m-17.25 0h17.25"
        />
      </svg>
    ),
    className: 'rounded-3xl border border-white/[0.08] bg-vn-surface/50',
  },
  {
    title: 'Recommandations priorisées',
    body: 'Pas de bruit : uniquement les changements qui ont le plus de potentiel sur la prochaine publication.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586L11.42 15.17z"
        />
      </svg>
    ),
    className: 'rounded-3xl border border-white/[0.08] bg-vn-surface/50',
  },
  {
    bonus: true,
    title: 'Hook generator',
    body: 'Fonction bonus : génère des hooks testables rapidement, une fois l’analyse vidéo terminée.',
    icon: <IconSpark className="w-5 h-5" />,
    className: 'rounded-3xl border border-vn-fuchsia/25 bg-gradient-to-br from-vn-fuchsia/[0.1] to-vn-surface/50',
  },
];

const keyStats = [
  { value: '1 workflow', label: 'De la vidéo au plan d’action' },
  { value: '3 offres', label: 'Free · Pro · Elite' },
  { value: 'TikTok live', label: 'Reels & Shorts en roadmap' },
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
      <section className="relative pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-24 overflow-visible" id="top">
        {/* ── Ciel étoilé animé — hero uniquement ─────── */}
        <div className="stars-hero" aria-hidden>
          <div className="stars-layer-sm" />
          <div className="stars-layer-md" />
          <div className="stars-layer-lg" />
          <div className="stars-hero-mask" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[min(82vh,900px)] landing-band-magenta pointer-events-none opacity-95" aria-hidden />
        <div className="landing-section relative">
          <div className="text-center max-w-[94rem] mx-auto px-2 sm:px-1">
            <Link href="/pricing" className="hero-badge-pill inline-flex items-center gap-2.5 rounded-full border border-white/[0.14] landing-hero-badge px-5 py-2.5 sm:px-6 sm:py-3 mb-12 sm:mb-14 cursor-pointer select-none group no-underline">
              {/* Étoile scintillante */}
              <svg className="hero-badge-star h-3.5 w-3.5 shrink-0 text-vn-fuchsia" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0l1.6 5.4H15l-4.4 3.2 1.6 5.4L8 11l-4.2 3L5.4 8.6 1 5.4h5.4z"/>
              </svg>
              <span className="hero-badge-text text-[11px] sm:text-[12px] font-semibold tracking-[0.12em] uppercase text-white/90 whitespace-nowrap">
                L&apos;outil TikTok pour les Pros
              </span>
              {/* Flèche qui glisse sur hover */}
              <span className="hero-badge-arrow flex items-center overflow-hidden w-4" aria-hidden>
                <svg className="h-3 w-3 shrink-0 text-white/50 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </span>
            </Link>

            <h1 className="font-hero-inter font-black text-white landing-hero-title-glow max-[419px]:text-[2.05rem] max-[419px]:leading-[0.92] text-[2.45rem] leading-[0.93] sm:text-[3.35rem] sm:leading-[0.91] md:text-[4.1rem] md:leading-[0.90] lg:text-[4.9rem] lg:leading-[0.88] xl:text-[5.45rem] xl:leading-[0.87] 2xl:text-[5.9rem] 2xl:leading-[0.86] mx-auto px-3 sm:px-6 tracking-[-0.045em] max-w-none">
              <span className="text-white block">Domine TikTok.</span>
              <span className="block mt-1 sm:mt-1.5 md:mt-2 gradient-text-hero min-[420px]:whitespace-nowrap">
                Arrête de poster au{'\u00A0'}hasard.
              </span>
            </h1>

            <p className="mt-5 sm:mt-6 text-[1.0rem] sm:text-[1.1rem] md:text-[1.18rem] text-gray-400 max-w-lg mx-auto leading-relaxed font-normal tracking-[-0.01em]">
              Analyse hook, rétention et montage en quelques secondes.
              <span className="block mt-1.5 text-gray-500">
                Identifie ce qui bloque et corrige avant de reposter.
              </span>
            </p>

            <div className="mt-8 sm:mt-10 flex justify-center">
              <div className="relative group">
                <div
                  className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/55 via-vn-violet/45 to-vn-indigo/45 opacity-70 blur-lg transition-all duration-500 group-hover:opacity-100 group-hover:blur-xl group-hover:scale-[1.04]"
                  aria-hidden
                />
                <Link
                  href="/signup"
                  className="relative inline-flex items-center gap-2.5 min-h-[52px] rounded-full px-9 sm:px-11 text-[15px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 hover:scale-[1.025] active:scale-[0.98] transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_40px_-10px_rgba(232,121,249,0.65),0_24px_56px_-16px_rgba(99,102,241,0.35)]"
                >
                  Commencer gratuitement
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M3 8h10M9 4l4 4-4 4"/>
                  </svg>
                </Link>
              </div>
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
        </div>
      </section>

      <section className="relative pb-20 sm:pb-24">
        <div className="landing-section">
          <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-8">
            Conçu pour les créateurs short-form
          </div>
          <p className="text-center text-4xl sm:text-5xl font-display font-bold text-white mb-10">
            Viral<span className="gradient-text">ynz</span>
          </p>
          <div className="landing-arc-divider mb-16 sm:mb-20" />
          <div className="text-center max-w-4xl mx-auto mb-14 sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-vn-fuchsia mb-5">L’arsenal viral</p>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[3rem]">
              Tout ce qu’il te faut pour dominer le format court
            </h2>
          </div>
        </div>
      </section>

      <section id="fonctions" className="relative pb-24 sm:pb-28 lg:pb-32">
        <div className="landing-section max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 auto-rows-fr">
            {toolkitSections.map((card) => (
              <div
                key={card.title}
                className={`${card.className} relative overflow-hidden p-6 sm:p-7 landing-card-deep transition-all duration-300 hover:-translate-y-0.5`}
              >
                <div className="w-11 h-11 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-vn-fuchsia mb-5">
                  {card.icon}
                </div>
                <h3 className="font-display text-xl font-bold text-white mb-2.5">{card.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{card.body}</p>
                {card.featured && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {['Hook', 'Rétention', 'Montage', 'CTA'].map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-black/30 text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {card.bonus && (
                  <span className="absolute top-4 right-4 text-[10px] uppercase tracking-wider font-semibold text-vn-fuchsia">
                    Bonus
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-center mt-8 sm:mt-10">
            <Link
              href="/analyzer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white text-sm font-semibold px-7 py-3.5 hover:brightness-110 transition"
            >
              Découvrir les fonctionnalités
              <span aria-hidden>→</span>
            </Link>
          </p>
        </div>
      </section>

      <section id="gains" className="relative py-20 sm:py-24 border-y border-white/[0.06]">
        <div className="landing-section">
          <p className="text-xs text-center font-semibold uppercase tracking-[0.22em] text-vn-violet mb-4">Chiffres clés</p>
          <p className="text-center text-white text-lg sm:text-2xl font-medium mb-10 sm:mb-12">
            Une base solide pour créer, corriger et scaler tes vidéos
          </p>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {keyStats.map((stat) => (
              <div key={stat.value} className="text-center landing-card-deep rounded-2xl p-6 sm:p-7">
                <p className="font-display text-3xl sm:text-4xl gradient-text">{stat.value}</p>
                <p className="text-sm text-gray-400 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="tarifs"
        className="relative py-24 sm:py-28 lg:py-32 border-t border-white/[0.06] scroll-mt-24 bg-gradient-to-b from-black/35 via-vn-void to-black/40"
      >
        <div className="landing-section">
          <div className="text-center mb-14 sm:mb-16 max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-vn-fuchsia mb-5">Tarifs</p>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[3rem]">Choisis le plan adapté à ton activité</h2>
            <p className="mt-4 text-gray-400 text-sm sm:text-base">
              Commence gratuitement puis scale sur Pro ou Elite quand l’analyse vidéo devient ton avantage.
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
        className="relative py-24 sm:py-28 border-t border-white/[0.06] scroll-mt-24 bg-black/15"
      >
        <div className="landing-section max-w-3xl">
          <p className="text-xs text-center font-semibold uppercase tracking-[0.22em] text-vn-fuchsia mb-5">FAQ</p>
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

      <section id="roadmap" className="relative py-24 sm:py-28 border-t border-white/[0.05]">
        <div className="landing-section max-w-4xl">
          <p className="text-xs text-center font-semibold uppercase tracking-[0.22em] text-vn-fuchsia mb-5">Roadmap</p>
          <h2 className="landing-heading-xl text-3xl sm:text-4xl text-center mb-4">Plateformes à venir</h2>
          <p className="text-center text-gray-400 max-w-xl mx-auto text-sm sm:text-base mb-12">
            Viralynz évolue en continu. TikTok aujourd’hui, puis extension vers d’autres formats courts.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {platformRoadmap
              .filter((p) => p.status !== 'live')
              .map((p) => (
                <div key={p.name} className="landing-card-deep rounded-2xl p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-white font-semibold">{p.name}</p>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full bg-white/10 text-gray-300">
                      Prévu
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{p.desc}</p>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────── */}
      <section className="relative py-28 sm:py-36 px-5 sm:px-8 border-t border-white/[0.05] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-52 final-icon-wall opacity-80" aria-hidden />
        <div className="landing-section max-w-4xl">
          <div className="relative rounded-[2rem] p-[1px] bg-gradient-to-br from-white/15 via-vn-fuchsia/35 to-vn-indigo/40 shadow-[0_32px_100px_-40px_rgba(232,121,249,0.35)] mt-20">
            <div className="relative rounded-[calc(2rem-1px)] overflow-hidden bg-[#06060c] ring-1 ring-white/[0.06]">
              <div
                className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/18 via-[#0a0a12] to-vn-indigo/18"
                aria-hidden
              />
              <div className="absolute inset-0 landing-mesh opacity-40 mix-blend-overlay" aria-hidden />
              <div className="relative px-8 sm:px-12 lg:px-16 py-14 sm:py-16 lg:py-20 text-center">
                <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.8rem] mb-5">
                  Prends une longueur d’avance sur les autres.
                </h2>
                <p className="text-gray-400 max-w-lg mx-auto mb-10 text-sm sm:text-base leading-relaxed">
                  Rejoins les créateurs qui pilotent leurs performances avec méthode. Essai gratuit, sans engagement.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto">
                  <Link
                    href="/analyzer"
                    className="inline-flex justify-center items-center min-h-[52px] rounded-full px-10 text-sm font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-colors"
                  >
                    Essayer gratuitement
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
