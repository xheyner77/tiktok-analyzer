import Link from 'next/link';
import {
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_ANALYSES_ELITE,
  MAX_HOOKS_PRO,
  MAX_HOOKS_ELITE,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_PRO_EUR, DISPLAY_CATALOG_ELITE_EUR } from '@/lib/stripe-pricing';
import LandingProductMockup from '@/components/landing/LandingProductMockup';
import { faqItems } from '@/components/landing/landing-copy';

/* Shared spacing — avoids repeating px / centering everywhere */
const sectionInner = 'mx-auto px-5 sm:px-8 lg:px-10';
const label = 'text-[9px] font-bold uppercase tracking-[0.24em] text-gray-600';

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

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-vn-fuchsia" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const steps = [
  {
    n: '01',
    title: 'Importe ta vidéo',
    body: 'Upload ton fichier MP4. Ajoute le lien TikTok pour enrichir le contexte avec les stats publiques.',
  },
  {
    n: '02',
    title: "L'IA analyse tout",
    body: 'Hook, montage, rétention — décrypté frame par frame. Score structuré et problème principal identifié.',
  },
  {
    n: '03',
    title: 'Corrige ce qui bloque',
    body: "Un plan d'action clair, priorisé, actionnable. Tu sais exactement quoi corriger avant de reposter.",
  },
];

const valuePoints = [
  'Score de viralité (0–100)',
  'Problème principal identifié',
  "Plan d'action priorisé",
  'Analyse hook, montage, rétention',
  'Recommandations actionnables',
  "Courbe d'attention estimée",
  'Hook generator (Pro / Elite)',
  'Historique & progression',
];

const useCases = [
  {
    role: 'Créateur TikTok',
    pain: "Tu postes régulièrement mais certaines vidéos s'effondrent sans que tu comprennes pourquoi.",
    value: 'Tu identifies en 30 secondes ce qui a foiré — et tu corriges avant le prochain post.',
    icon: '🎬',
  },
  {
    role: 'Clipper & Monteur',
    pain: 'Tu livres du contenu pour des marques ou des créateurs. Tu veux des données pour justifier tes choix.',
    value: "Tu arrives avec un diagnostic IA. Tu parles data, pas ressenti.",
    icon: '✂️',
  },
  {
    role: 'E-com & Marques',
    pain: "Tu paies des créateurs UGC. Tu ne sais pas si le contenu va convertir avant de le diffuser.",
    value: 'Tu briefes avec précision. Tu valides avant de dépenser en pub.',
    icon: '📦',
  },
];

export default function HomeLanding() {
  return (
    <div className="relative min-h-screen bg-vn-void overflow-x-hidden">
      {/* Background layers */}
      <div className="fixed inset-0 bg-vn-void pointer-events-none" aria-hidden />
      <div className="fixed inset-0 landing-mesh pointer-events-none opacity-[0.88]" aria-hidden />
      <div className="fixed inset-0 landing-grid-fine pointer-events-none opacity-[0.32]" aria-hidden />
      <div className="fixed inset-0 landing-hero-aurora pointer-events-none opacity-[0.78]" aria-hidden />
      <div className="fixed inset-0 landing-vignette-page pointer-events-none" aria-hidden />
      <div className="fixed inset-0 landing-noise pointer-events-none mix-blend-overlay" aria-hidden />
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-52 left-1/2 -translate-x-1/2 w-[min(1200px,260vw)] h-[600px] rounded-full bg-vn-radial blur-3xl opacity-[0.95]" />
      </div>

      {/* ══ 1. HERO ══════════════════════════════════════════════════════════ */}
      <section className="relative pt-8 sm:pt-10 lg:pt-14 pb-16 sm:pb-20 overflow-visible" id="top">
        {/* Animated starry sky — hero only */}
        <div className="stars-hero" aria-hidden>
          <div className="stars-layer-sm" />
          <div className="stars-layer-md" />
          <div className="stars-layer-lg" />
          <div className="stars-hero-mask" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[min(82vh,900px)] landing-band-magenta pointer-events-none opacity-95" aria-hidden />

        <div className="landing-section relative">
          <div className="text-center max-w-[94rem] mx-auto px-2 sm:px-1">

            {/* Badge */}
            <Link
              href="/pricing"
              className="hero-badge-pill inline-flex items-center gap-2.5 rounded-full border border-white/[0.14] landing-hero-badge px-5 py-2.5 sm:px-6 sm:py-3 mb-6 sm:mb-7 cursor-pointer select-none group no-underline"
            >
              <svg className="hero-badge-star h-3.5 w-3.5 shrink-0 text-vn-fuchsia" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0l1.6 5.4H15l-4.4 3.2 1.6 5.4L8 11l-4.2 3L5.4 8.6 1 5.4h5.4z"/>
              </svg>
              <span className="hero-badge-text text-[11px] sm:text-[12px] font-semibold tracking-[0.12em] uppercase text-white/90 whitespace-nowrap">
                L&apos;outil TikTok pour les Pros
              </span>
              <span className="hero-badge-arrow flex items-center overflow-hidden w-4" aria-hidden>
                <svg className="h-3 w-3 shrink-0 text-white/50 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </span>
            </Link>

            {/* Headline */}
            <h1 className="font-hero-inter font-black text-white landing-hero-title-glow max-[419px]:text-[2.05rem] max-[419px]:leading-[0.92] text-[2.45rem] leading-[0.93] sm:text-[3.35rem] sm:leading-[0.91] md:text-[4.1rem] md:leading-[0.90] lg:text-[4.9rem] lg:leading-[0.88] xl:text-[5.45rem] xl:leading-[0.87] 2xl:text-[5.9rem] 2xl:leading-[0.86] mx-auto px-3 sm:px-6 tracking-[-0.045em] max-w-none">
              <span className="text-white block">Arrête de poster au{'\u00A0'}hasard.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 sm:mt-5 text-[1rem] sm:text-[1.08rem] md:text-[1.15rem] text-gray-400 max-w-2xl mx-auto leading-relaxed font-normal tracking-[-0.01em] px-4">
              Comprends pourquoi tes vidéos ne marchent pas — et corrige-les en quelques secondes.
            </p>

            {/* CTAs */}
            <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <div className="relative group">
                <div
                  className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/55 via-vn-violet/45 to-vn-indigo/45 opacity-70 blur-lg transition-all duration-500 group-hover:opacity-100 group-hover:blur-xl group-hover:scale-[1.04]"
                  aria-hidden
                />
                <Link
                  href="/analyzer"
                  className="relative inline-flex items-center gap-2.5 min-h-[52px] rounded-full px-9 sm:px-11 text-[15px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 hover:scale-[1.025] active:scale-[0.98] transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_40px_-10px_rgba(232,121,249,0.65),0_24px_56px_-16px_rgba(99,102,241,0.35)]"
                >
                  Lancer mon analyse
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </div>
              <Link
                href="#produit"
                className="inline-flex items-center gap-2 min-h-[52px] rounded-full px-7 text-[15px] font-medium text-gray-300 border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white hover:border-white/[0.18] transition-all duration-300"
              >
                Voir un exemple
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-7 sm:mt-8 flex flex-col items-center gap-2.5">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {[
                    { seed: 'felix',  img: 'https://i.pravatar.cc/40?img=11' },
                    { seed: 'sophie', img: 'https://i.pravatar.cc/40?img=47' },
                    { seed: 'marc',   img: 'https://i.pravatar.cc/40?img=12' },
                    { seed: 'clara',  img: 'https://i.pravatar.cc/40?img=44' },
                    { seed: 'thomas', img: 'https://i.pravatar.cc/40?img=15' },
                  ].map(({ seed, img }) => (
                    <img
                      key={seed}
                      src={img}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full border-[2.5px] border-[#030308] object-cover"
                      aria-hidden
                    />
                  ))}
                  <span className="h-9 w-9 rounded-full border-[2.5px] border-[#030308] bg-vn-elevated flex items-center justify-center text-[9px] font-bold text-white tracking-tight shrink-0">
                    +1k
                  </span>
                </div>
                <div className="flex items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" className="w-4 h-4 text-vn-fuchsia drop-shadow-[0_0_8px_rgba(232,121,249,0.35)]" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              <p className="text-[13.5px] text-gray-400 font-medium">
                Rejoins <span className="text-white font-bold">+1300</span> créateurs de contenu
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 2. PRODUCT PREVIEW ══════════════════════════════════════════════ */}
      <section id="produit" className="relative pt-8 sm:pt-10 pb-20 sm:pb-24 scroll-mt-20">
        <div className="landing-section">
          <div className="text-center mb-10">
            <p className={`${label} mb-3`}>Exemple de résultat</p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              <span className="text-white">Score, diagnostic, plan d&apos;action —</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">en quelques secondes.</span>
            </h2>
          </div>
          <div className="relative -mx-4 sm:-mx-8 lg:-mx-10">
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-16 w-[min(94vw,1320px)] h-[260px] rounded-[999px] bg-gradient-to-r from-vn-fuchsia/28 via-vn-violet/24 to-vn-indigo/20 blur-3xl opacity-90"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-20 w-[min(95vw,1360px)] h-[280px] rounded-[999px] bg-gradient-to-t from-vn-fuchsia/30 via-vn-indigo/15 to-transparent blur-3xl opacity-80"
              aria-hidden
            />
            <LandingProductMockup variant="hero" className="hero-mockup-pulse" />
          </div>
        </div>
      </section>

      {/* ══ 3. PROBLÈME ═════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        {/* FIX: max-w-4xl mx-auto instead of landing-section max-w-4xl (cascade bug) */}
        <div className={`max-w-4xl ${sectionInner}`}>
          <div className="text-center mb-14">
            <p className={`${label} mb-8`}>Le vrai problème</p>
            <h2 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.05] mb-6">
              <span className="text-white">Tu ne manques pas d&apos;idées.</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Tu manques de feedback.</span>
            </h2>
            <p className="text-gray-500 text-[15px] sm:text-base max-w-lg mx-auto leading-relaxed">
              Sans données claires, tu testes à l&apos;aveugle. Tu recommences les mêmes erreurs. Tu perds du temps à chaque vidéo.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                n: '1',
                text: 'Tu postes. Tu regardes les stats. Tu ne comprends pas ce qui a foiré.',
              },
              {
                n: '2',
                text: 'Tu copies ce qui marche pour les autres. Ça ne marche pas pareil pour toi.',
              },
              {
                n: '3',
                text: 'Tu recommences sans savoir quoi changer. Le prochain post est un autre test au hasard.',
              },
            ].map(({ n, text }) => (
              <div
                key={n}
                className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
              >
                <span className={`${label} block mb-3`}>
                  Situation {n}
                </span>
                <p className="text-[14px] sm:text-[15px] text-gray-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. COMMENT ÇA MARCHE ════════════════════════════════════════════ */}
      <section id="fonctions" className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24">
        {/* FIX: max-w-5xl mx-auto instead of landing-section max-w-5xl */}
        <div className={`max-w-5xl ${sectionInner}`}>
          <div className="text-center mb-14 sm:mb-16">
            <p className={`${label} mb-4`}>Comment ça marche</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">3 étapes. 30 secondes.</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Un plan clair.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 relative">
            {/* FIX: connector line now correctly at center of the 44px (h-11) circles = top 22px */}
            <div className="hidden sm:block absolute top-[22px] left-[calc(16.67%+1.625rem)] right-[calc(16.67%+1.625rem)] h-px bg-gradient-to-r from-white/[0.15] via-white/[0.08] to-white/[0.15]" aria-hidden />

            {steps.map((step) => (
              <div key={step.n} className="relative">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-11 h-11 rounded-full bg-vn-void border border-white/[0.15] flex items-center justify-center shrink-0 relative z-10 shadow-[0_0_0_4px_rgba(3,3,8,1)]">
                    <span className="text-[11px] font-black text-white tracking-tight">{step.n}</span>
                  </div>
                  <div className="h-px flex-1 bg-white/[0.06] sm:hidden" aria-hidden />
                </div>
                <h3 className="text-[17px] font-bold text-white mb-2.5 tracking-tight">{step.title}</h3>
                <p className="text-[13.5px] text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/analyzer"
              className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white text-[14px] font-semibold px-8 py-3.5 hover:brightness-110 hover:scale-[1.02] transition-all shadow-lg shadow-vn-fuchsia/20"
            >
              Essayer maintenant — c&apos;est gratuit
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 5. CE QUE TU OBTIENS ════════════════════════════════════════════ */}
      <section id="gains" className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24">
        {/* FIX: max-w-5xl mx-auto */}
        <div className={`max-w-5xl ${sectionInner}`}>
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div>
              <p className={`${label} mb-4`}>Ce que tu obtiens</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-5 leading-tight">
                <span className="text-white">Tout pour comprendre</span><br />
                <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">et corriger.</span>
              </h2>
              <p className="text-gray-500 text-[14.5px] leading-relaxed mb-8">
                Pas un rapport de 12 pages. Un diagnostic précis, une priorité claire, des actions concrètes.
              </p>
              <Link
                href="/analyzer"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-vn-fuchsia hover:text-white transition-colors"
              >
                Lancer mon analyse
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <ul className="grid grid-cols-1 gap-3">
              {valuePoints.map((point) => (
                <li key={point} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
                  <CheckIcon />
                  <span className="text-[14.5px] text-gray-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ══ 6. DIFFÉRENCIATION ══════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        {/* FIX: max-w-5xl mx-auto */}
        <div className={`max-w-5xl ${sectionInner}`}>
          <div className="text-center mb-14">
            <p className={`${label} mb-4`}>Notre différence</p>
            <h2 className="text-3xl sm:text-4xl lg:text-[2.8rem] font-black tracking-tight leading-tight">
              <span className="text-white">Pas un score.</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Un plan d&apos;action.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Without Viralynz */}
            <div className="p-7 sm:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-6">Sans Viralynz</p>
              <ul className="space-y-4">
                {[
                  'Un score flou sans contexte',
                  "Tu sais que c'est « pas top » mais pas pourquoi",
                  'Tu dois interpréter toi-même les métriques',
                  'Tu retestes au hasard en espérant que ça marche',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 text-gray-700 text-base leading-none shrink-0">—</span>
                    <span className="text-[13.5px] text-gray-500 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With Viralynz */}
            <div className="p-7 sm:p-8 rounded-2xl border border-vn-fuchsia/20 bg-gradient-to-br from-vn-fuchsia/[0.06] to-vn-indigo/[0.04]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-vn-fuchsia mb-6">Avec Viralynz</p>
              <ul className="space-y-4">
                {[
                  'Score 0–100 avec explication précise',
                  'Problème principal identifié en une phrase',
                  "Plan d'action avec 3 à 5 corrections concrètes",
                  'Tu sais exactement quoi changer pour la prochaine vidéo',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-[13.5px] text-gray-300 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 7. USE CASES ════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        {/* FIX: max-w-5xl mx-auto */}
        <div className={`max-w-5xl ${sectionInner}`}>
          <div className="text-center mb-14">
            <p className={`${label} mb-4`}>Pour qui</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">Fait pour toi si tu crées</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">du contenu short-form.</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {useCases.map(({ role, pain, value, icon }) => (
              <div
                key={role}
                className="p-6 sm:p-7 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-300"
              >
                <span className="text-2xl mb-5 block">{icon}</span>
                <h3 className="text-[16px] font-bold text-white mb-3 tracking-tight">{role}</h3>
                {/* FIX: text-gray-500 was text-gray-600 (too dark, nearly invisible) */}
                <p className="text-[13px] text-gray-500 leading-relaxed mb-4">{pain}</p>
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-[13px] text-gray-400 leading-relaxed">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. PRICING TEASER ═══════════════════════════════════════════════ */}
      <section
        id="tarifs"
        className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24"
      >
        {/* FIX: max-w-5xl mx-auto */}
        <div className={`max-w-5xl ${sectionInner}`}>
          <div className="text-center mb-14">
            <p className={`${label} mb-4`}>Tarifs</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
              <span className="text-white">3 analyses gratuites —</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">sans carte.</span>
            </h2>
            <p className="text-gray-500 text-[14.5px] max-w-md mx-auto">
              Commence gratuitement. Scale sur Pro ou Elite quand l&apos;analyse devient ton avantage concurrentiel.
            </p>
          </div>

          {/* FIX: items-stretch ensures cards stretch to same height, no alignment weirdness */}
          <div className="grid md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {/* Starter */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7 flex flex-col order-2 md:order-1 opacity-90">
              <p className={`${label} mb-3`}>Starter</p>
              <p className="text-[2.4rem] font-black text-white leading-none mb-1">0€</p>
              <p className="text-[13px] text-gray-600 mb-6">{MAX_ANALYSES_FREE} analyses · à vie</p>
              <ul className="space-y-2.5 flex-1 mb-7">
                {["Analyse IA complète", "Score & diagnostic", "Plan d'action"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[13px] text-gray-500">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/analyzer"
                className="block text-center rounded-full py-3 text-[13.5px] font-semibold border border-white/[0.1] text-gray-400 hover:text-white hover:border-white/[0.2] transition-all"
              >
                Commencer gratuitement
              </Link>
            </div>

            {/* Pro — featured */}
            {/* FIX: removed md:-mt-4 which caused alignment issues with items-stretch */}
            <div className="relative rounded-2xl pro-pricing-card p-6 sm:p-8 flex flex-col order-1 md:order-2 ring-1 ring-vn-fuchsia/20">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-lg whitespace-nowrap z-10">
                Le plus populaire
              </span>
              <p className={`${label} text-vn-fuchsia mb-3 mt-3`}>Pro</p>
              <p className="text-[2.4rem] font-black text-white leading-none mb-1">
                {DISPLAY_CATALOG_PRO_EUR}€
                <span className="text-base font-normal text-gray-500 ml-1">/mois</span>
              </p>
              <p className="text-[13px] text-gray-500 mb-6">
                {MAX_ANALYSES_PRO} analyses · {MAX_HOOKS_PRO} hooks / mois
              </p>
              <ul className="space-y-2.5 flex-1 mb-7">
                {["Tout Starter, plus :", "Hook generator", "Dashboard IA & historique", "Recommandations avancées"].map((f, i) => (
                  <li key={f} className={`flex items-center gap-2.5 text-[13px] ${i === 0 ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                    {i > 0 && <CheckIcon />}
                    {i === 0 && <span className="w-4 shrink-0" />}
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="block text-center rounded-full py-3.5 text-[13.5px] font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-lg shadow-vn-fuchsia/20"
              >
                Choisir Pro
              </Link>
            </div>

            {/* Elite */}
            <div className="rounded-2xl elite-pricing-card p-6 sm:p-7 flex flex-col order-3">
              <p className={`${label} text-purple-400 mb-3`}>Elite</p>
              <p className="text-[2.4rem] font-black text-white leading-none mb-1">
                {DISPLAY_CATALOG_ELITE_EUR}€
                <span className="text-base font-normal text-gray-500 ml-1">/mois</span>
              </p>
              <p className="text-[13px] text-gray-500 mb-6">
                {MAX_ANALYSES_ELITE} analyses · {MAX_HOOKS_ELITE} hooks / mois
              </p>
              <ul className="space-y-2.5 flex-1 mb-7">
                {["Tout Pro, plus :", "Volume & profondeur max", "Insights viraux débloqués", "Support prioritaire"].map((f, i) => (
                  <li key={f} className={`flex items-center gap-2.5 text-[13px] ${i === 0 ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                    {i > 0 && <CheckIcon />}
                    {i === 0 && <span className="w-4 shrink-0" />}
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="block text-center rounded-full py-3 text-[13.5px] font-semibold border border-purple-400/30 text-purple-300 hover:bg-purple-400/10 transition-all"
              >
                Choisir Elite
              </Link>
            </div>
          </div>

          <p className="text-center mt-8">
            <Link href="/pricing" className="text-[13px] text-gray-600 hover:text-gray-400 transition-colors inline-flex items-center gap-1">
              Voir le détail complet des fonctionnalités par plan
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        </div>
      </section>

      {/* ══ 9. FAQ ══════════════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24">
        {/* FIX: max-w-3xl mx-auto — was incorrectly inheriting max-w-7xl */}
        <div className={`max-w-3xl ${sectionInner}`}>
          <div className="text-center mb-12 sm:mb-14">
            <p className={`${label} mb-4`}>FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
              <span className="text-white">Questions</span>{' '}
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">fréquentes.</span>
            </h2>
            <p className="text-gray-500 text-[14px]">
              Des réponses claires, sans bullshit.
            </p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl landing-card-deep border-white/[0.06] open:border-vn-fuchsia/25 open:shadow-[0_0_48px_-24px_rgba(232,121,249,0.2)] transition-all duration-300"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left min-h-[56px] [&::-webkit-details-marker]:hidden">
                  <span className="text-[14px] sm:text-[15px] font-semibold text-white pr-2">{item.q}</span>
                  <FaqChevron />
                </summary>
                <p className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 text-[13.5px] text-gray-400 leading-relaxed border-t border-transparent group-open:border-white/[0.05] group-open:pt-4 -mt-1 group-open:mt-0">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 10. CTA FINAL ════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.05] overflow-hidden">
        {/* FIX: max-w-4xl mx-auto */}
        <div className={`max-w-4xl ${sectionInner}`}>
          <div className="relative rounded-[1.75rem] p-[1px] bg-gradient-to-br from-white/15 via-vn-fuchsia/35 to-vn-indigo/40 shadow-[0_32px_100px_-40px_rgba(232,121,249,0.35)]">
            <div className="relative rounded-[calc(1.75rem-1px)] overflow-hidden bg-[#06060c] ring-1 ring-white/[0.06]">
              <div className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/[0.12] via-[#0a0a12] to-vn-indigo/[0.12]" aria-hidden />
              <div className="absolute inset-0 landing-mesh opacity-30 mix-blend-overlay" aria-hidden />
              <div className="relative px-8 sm:px-12 lg:px-16 py-14 sm:py-16 text-center">
                <p className={`${label} mb-5`}>Prêt à comprendre ce qui bloque ?</p>
                <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black tracking-tight leading-tight mb-5">
                  <span className="text-white">Analyse ta première vidéo</span><br />
                  <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">maintenant.</span>
                </h2>
                <p className="text-gray-500 max-w-md mx-auto mb-10 text-[14.5px] leading-relaxed">
                  {MAX_ANALYSES_FREE} analyses gratuites — sans carte bancaire, sans engagement. Résultats en quelques secondes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <div className="relative group">
                    <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/55 to-vn-indigo/45 opacity-70 blur-lg transition-all duration-500 group-hover:opacity-100" aria-hidden />
                    <Link
                      href="/analyzer"
                      className="relative inline-flex items-center gap-2.5 min-h-[52px] rounded-full px-10 text-[15px] font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 hover:scale-[1.02] transition-all shadow-xl"
                    >
                      Lancer mon analyse
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                  <Link
                    href="/pricing"
                    className="text-[13.5px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Voir les plans →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="relative border-t border-white/[0.08] py-12 sm:py-14">
        <div className="landing-section">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div>
              <p className="font-display text-xl font-bold text-white">
                Viral<span className="gradient-text">ynz</span>
              </p>
              <p className="mt-2 text-[13px] text-gray-600 max-w-sm leading-relaxed">
                Analyse vidéo IA pour le court format. Comprends ce qui bloque. Corrige avant de reposter.
              </p>
            </div>
            {/* FIX: added Changelog link in footer nav */}
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-gray-600">
              <Link href="/analyzer" className="hover:text-white transition-colors">Analyser</Link>
              <Link href="/features" className="hover:text-white transition-colors">Fonctionnalités</Link>
              <Link href="/hook-generator" className="hover:text-white transition-colors">Hooks</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
              <Link href="/changelog" className="hover:text-white transition-colors">Nouveautés</Link>
              <Link href="/login" className="hover:text-white transition-colors">Connexion</Link>
            </nav>
          </div>
          <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between gap-4 text-[11px] text-gray-700">
            <p>© {new Date().getFullYear()} Viralynz. Tous droits réservés.</p>
            <p>TikTok aujourd&apos;hui — Reels & Shorts en roadmap.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
