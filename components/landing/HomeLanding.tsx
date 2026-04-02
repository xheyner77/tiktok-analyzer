'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MAX_ANALYSES_FREE, MAX_ANALYSES_PRO, MAX_ANALYSES_ELITE,
  MAX_HOOKS_PRO, MAX_HOOKS_ELITE,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_PRO_EUR, DISPLAY_CATALOG_ELITE_EUR } from '@/lib/stripe-pricing';
import HeroMockupPremium from '@/components/landing/HeroMockupPremium';
import { faqItems } from '@/components/landing/landing-copy';

/* ── Constants ──────────────────────────────────────────────── */
const G   = 'bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent';
const SI  = 'mx-auto px-5 sm:px-8 lg:px-10';
const E   = [0.16, 1, 0.3, 1] as const;

/* ── Micro components ───────────────────────────────────────── */
function Arrow({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Check({ color = 'text-vn-fuchsia' }: { color?: string }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FaqChevron() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor"
      className="w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd"
        d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" />
    </svg>
  );
}

/* Scroll-reveal wrapper */
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.65, ease: E, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Testimonials data ──────────────────────────────────────── */
const testimonials = [
  {
    avatar: 'https://i.pravatar.cc/56?img=11',
    name: 'Julien B.',
    handle: '@julienb_content',
    role: 'Créateur TikTok · 28k abonnés',
    quote: 'J\'ai analysé 3 vidéos en un soir. En 5 minutes j\'avais compris pourquoi mes hooks ne convertissaient pas. +40% de rétention sur les 3 posts suivants. Aucun autre outil ne m\'a donné ça.',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=47',
    name: 'Sofia D.',
    handle: '@sofiadumontclip',
    role: 'Clipper & Monteuse',
    quote: 'Je livre du contenu pour 6 marques différentes. Les analyses me permettent de justifier chaque choix de montage avec des données IA. Mes clients ne contestent plus. Ils reviennent.',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=12',
    name: 'Marc T.',
    handle: '@marc_ecom_ads',
    role: 'E-commerce · UGC Ads',
    quote: 'J\'utilise des créateurs UGC pour mes pubs Meta. Depuis que j\'analyse les vidéos avant de les diffuser, mon ROAS a augmenté de 30%. Je valide avant de mettre du budget.',
  },
];

/* ── Features data ──────────────────────────────────────────── */
const features = [
  {
    icon: '🔬',
    title: 'Analyse IA frame par frame',
    desc: '14 images clés extraites, audio transcrit par Whisper, hook et structure décryptés par GPT-4o Vision. L\'IA voit ce que tu ne vois pas.',
    bullets: ['Vision IA sur chaque seconde', 'Transcription audio complète', 'Score structuré Hook · Montage · Rétention'],
    accent: 'from-vn-fuchsia/15 to-pink-500/5',
    border: 'border-vn-fuchsia/15',
  },
  {
    icon: '⚡',
    title: 'Plan d\'action priorisé',
    desc: 'Pas un rapport de 12 pages. 3 à 5 corrections classées par impact immédiat. Actionnable en 30 secondes.',
    bullets: ['Problème principal en 1 phrase', '5 actions concrètes max', 'Priorité par impact sur les vues'],
    accent: 'from-vn-violet/15 to-vn-indigo/5',
    border: 'border-vn-violet/15',
  },
  {
    icon: '🪝',
    title: 'Générateur de hooks',
    desc: '150 hooks/mois sur Pro. Génère des accroches basées sur ton contenu, ta niche et ton style — teste vite, itère mieux.',
    bullets: ['Hooks adaptés à ton angle', 'Multiples formulations', 'Basé sur les patterns viraux'],
    accent: 'from-vn-indigo/15 to-blue-500/5',
    border: 'border-vn-indigo/15',
  },
];

/* ─────────────────────────────────────────────────────────────── */

export default function HomeLanding() {
  return (
    <div className="relative min-h-screen bg-vn-void overflow-x-hidden">

      {/* ── Background ──────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-vn-void pointer-events-none" aria-hidden />
      <div className="fixed inset-0 landing-mesh pointer-events-none opacity-[0.88]" aria-hidden />
      <div className="fixed inset-0 landing-grid-fine pointer-events-none opacity-[0.32]" aria-hidden />
      <div className="fixed inset-0 landing-hero-aurora pointer-events-none opacity-[0.78]" aria-hidden />
      <div className="fixed inset-0 landing-vignette-page pointer-events-none" aria-hidden />
      <div className="fixed inset-0 landing-noise pointer-events-none mix-blend-overlay" aria-hidden />
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-52 left-1/2 -translate-x-1/2 w-[min(1200px,260vw)] h-[600px] rounded-full bg-vn-radial blur-3xl opacity-[0.95]" />
      </div>

      {/* ══ 1. HERO ═══════════════════════════════════════════════ */}
      <section className="relative pt-10 sm:pt-14 lg:pt-20 pb-16 sm:pb-24 overflow-visible" id="top">
        <div className="stars-hero" aria-hidden>
          <div className="stars-layer-sm" /><div className="stars-layer-md" /><div className="stars-layer-lg" />
          <div className="stars-hero-mask" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[min(90vh,1000px)] landing-band-magenta pointer-events-none opacity-95" aria-hidden />

        <div className="relative max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14 xl:gap-20">

            {/* ── Left: copy ────────────────────────────────────── */}
            <div className="flex-[5] flex flex-col items-center lg:items-start text-center lg:text-left">

              {/* Badge */}
              <Link href="/pricing"
                className="hero-badge-pill inline-flex items-center gap-2.5 rounded-full border border-white/[0.14] landing-hero-badge px-5 py-2.5 sm:px-6 sm:py-3 mb-6 sm:mb-7 cursor-pointer select-none group no-underline">
                <svg className="hero-badge-star h-3.5 w-3.5 shrink-0 text-vn-fuchsia" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M8 0l1.6 5.4H15l-4.4 3.2 1.6 5.4L8 11l-4.2 3L5.4 8.6 1 5.4h5.4z"/>
                </svg>
                <span className="hero-badge-text text-[11px] sm:text-[12px] font-semibold tracking-[0.12em] uppercase text-white/90 whitespace-nowrap">
                  L&apos;outil TikTok pour les créateurs
                </span>
                <span className="hero-badge-arrow flex items-center overflow-hidden w-4" aria-hidden>
                  <svg className="h-3 w-3 shrink-0 text-white/50 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4"/>
                  </svg>
                </span>
              </Link>

              {/* H1 */}
              <h1 className="font-hero-inter font-black text-white landing-hero-title-glow tracking-[-0.048em] max-[419px]:text-[2.05rem] max-[419px]:leading-[0.92] text-[2.55rem] leading-[0.92] sm:text-[3.3rem] sm:leading-[0.90] md:text-[3.8rem] md:leading-[0.89] lg:text-[3.6rem] lg:leading-[0.89] xl:text-[4.2rem] xl:leading-[0.88] 2xl:text-[4.8rem] 2xl:leading-[0.87]">
                <span className="block">Tu perds des vues</span>
                <span className={`block ${G}`}>sans comprendre&nbsp;pourquoi.</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-5 sm:mt-6 text-[1rem] sm:text-[1.07rem] text-gray-400 max-w-[440px] leading-relaxed font-normal tracking-[-0.01em]">
                L&apos;IA analyse ton hook, ton montage et ta rétention en quelques secondes.
                Tu sais exactement quoi corriger — avant de reposter.
              </p>

              {/* CTAs */}
              <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 sm:gap-4 w-full">
                <div className="relative group">
                  <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/55 via-vn-violet/45 to-vn-indigo/45 opacity-70 blur-lg transition-all duration-500 group-hover:opacity-100 group-hover:blur-xl group-hover:scale-[1.04]" aria-hidden />
                  <Link href="/analyzer"
                    className="relative inline-flex items-center gap-2.5 min-h-[52px] rounded-full px-9 sm:px-11 text-[15px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 hover:scale-[1.025] active:scale-[0.98] transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_40px_-10px_rgba(232,121,249,0.65)]">
                    Analyser ma vidéo
                    <Arrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <Link href="#comment"
                  className="inline-flex items-center gap-2 min-h-[52px] rounded-full px-7 text-[15px] font-medium text-gray-300 border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:text-white hover:border-white/[0.18] transition-all duration-300">
                  Voir comment ça marche
                </Link>
              </div>

              {/* Social proof */}
              <div className="mt-8 flex flex-col items-center lg:items-start gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {['https://i.pravatar.cc/40?img=11','https://i.pravatar.cc/40?img=47','https://i.pravatar.cc/40?img=12','https://i.pravatar.cc/40?img=44','https://i.pravatar.cc/40?img=15'].map((img, i) => (
                      <img key={i} src={img} alt="" width={36} height={36}
                        className="h-9 w-9 rounded-full border-[2.5px] border-[#030308] object-cover" aria-hidden />
                    ))}
                    <span className="h-9 w-9 rounded-full border-[2.5px] border-[#030308] bg-vn-elevated flex items-center justify-center text-[9px] font-bold text-white tracking-tight shrink-0">+1k</span>
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
                  Rejoins <span className="text-white font-bold">+1 300</span> créateurs de contenu
                </p>
              </div>
            </div>

            {/* ── Right: mockup ─────────────────────────────────── */}
            <div className="flex-[6] w-full max-w-[520px] lg:max-w-none" id="produit">
              <HeroMockupPremium />
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ═══════════════════════════════════════════ */}
      <div className="border-y border-white/[0.06] bg-white/[0.012] py-5">
        <div className={`max-w-5xl ${SI}`}>
          <div className="flex flex-wrap justify-center lg:justify-between gap-x-10 gap-y-4">
            {[
              { val: '10 000+',  label: 'vidéos analysées' },
              { val: '1 300+',   label: 'créateurs actifs' },
              { val: '30s',      label: 'pour un diagnostic complet' },
              { val: 'GPT-4o',   label: 'Vision + Whisper audio' },
            ].map(({ val, label }) => (
              <div key={val} className="flex items-center gap-3">
                <span className="text-[15px] font-black text-white tabular-nums">{val}</span>
                <span className="text-[12px] text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ 2. PROBLÈME ═══════════════════════════════════════════ */}
      <section id="probleme" className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06] mb-5">
                <span className="text-white">Pourquoi tes vidéos</span><br />
                <span className={G}>ne marchent pas.</span>
              </h2>
              <p className="text-gray-500 text-[15px] max-w-sm mx-auto">
                Ce n&apos;est presque jamais l&apos;algorithme. C&apos;est toujours la vidéo.
              </p>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                n: '01',
                myth: 'Ce n\'est pas l\'algo.',
                truth: 'L\'algorithme pousse les vidéos qui retiennent. Si tes vues chutent, c\'est ta vidéo — pas TikTok qui te censure.',
                color: 'text-red-400',
                bg: 'from-red-500/8 to-transparent',
                border: 'border-red-500/15',
              },
              {
                n: '02',
                myth: 'Ton hook te coûte des vues.',
                truth: '70% des spectateurs décident de rester dans les 2 premières secondes. C\'est là que tout se joue — et que tu perds.',
                color: 'text-amber-400',
                bg: 'from-amber-500/8 to-transparent',
                border: 'border-amber-500/15',
              },
              {
                n: '03',
                myth: 'Tu perds tout à 3 secondes.',
                truth: 'Sans montage rythmé et points d\'attention, tu perds l\'audience avant même d\'avoir dit quelque chose d\'intéressant.',
                color: 'text-orange-400',
                bg: 'from-orange-500/8 to-transparent',
                border: 'border-orange-500/15',
              },
            ].map(({ n, myth, truth, color, bg, border }, i) => (
              <FadeUp key={n} delay={i * 0.1}>
                <div className={`h-full p-6 sm:p-7 rounded-2xl border ${border} bg-gradient-to-br ${bg}`}>
                  <span className="text-[10px] font-black text-gray-700 uppercase tracking-[0.18em]">{n}</span>
                  <h3 className={`text-[16px] font-bold mt-3 mb-3 ${color}`}>{myth}</h3>
                  <p className="text-[13.5px] text-gray-500 leading-relaxed">{truth}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. SOLUTION ═══════════════════════════════════════════ */}
      <section id="comment" className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06]">
                <span className="text-white">Viralynz analyse ta vidéo</span><br />
                <span className={G}>comme l&apos;algorithme.</span>
              </h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-10 relative">
            <div className="hidden sm:block absolute top-[22px] left-[calc(16.67%+1.625rem)] right-[calc(16.67%+1.625rem)] h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} aria-hidden />

            {[
              { n: '01', title: 'Tu uploades ta vidéo', body: 'Glisse ton fichier MP4. L\'IA extrait 14 frames, transcrit l\'audio et analyse chaque seconde de contenu.' },
              { n: '02', title: 'L\'IA analyse tout', body: 'Hook, rythme, rétention — décryptés par GPT-4o Vision. Un score structuré, un problème principal isolé.' },
              { n: '03', title: 'Tu sais quoi corriger', body: 'Un plan d\'action court, priorisé, actionnable. Pas un rapport — une checklist. Tu corriges, tu repostes.' },
            ].map(({ n, title, body }, i) => (
              <FadeUp key={n} delay={i * 0.12}>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-11 h-11 rounded-full bg-vn-void border border-white/[0.14] flex items-center justify-center shrink-0 relative z-10 shadow-[0_0_0_4px_rgba(3,3,8,1)]">
                    <span className="text-[11px] font-black text-white tracking-tight">{n}</span>
                  </div>
                  <div className="h-px flex-1 bg-white/[0.06] sm:hidden" aria-hidden />
                </div>
                <h3 className="text-[17px] font-bold text-white mb-2.5 tracking-tight">{title}</h3>
                <p className="text-[13.5px] text-gray-500 leading-relaxed">{body}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. DEMO OUTPUT ════════════════════════════════════════ */}
      <section id="demo" className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06] mb-4">
                <span className="text-white">Voilà ce que tu reçois</span><br />
                <span className={G}>en 30 secondes.</span>
              </h2>
              <p className="text-gray-500 text-[15px] max-w-sm mx-auto">Exemple d&apos;analyse réelle sur une vidéo TikTok.</p>
            </div>
          </FadeUp>

          <FadeUp delay={0.15}>
            {/* Demo card */}
            <div className="rounded-[20px] overflow-hidden"
              style={{ background: 'linear-gradient(150deg, #10101c 0%, #0a0a14 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7), 0 0 80px -40px rgba(232,121,249,0.12)' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/[0.06]"
                style={{ background: 'rgba(255,255,255,0.015)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-vn-fuchsia" style={{ boxShadow: '0 0 8px rgba(232,121,249,0.8)' }} />
                  <span className="text-[12px] text-gray-400 font-medium">Viralynz · Analyse complète</span>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: 'rgba(234,179,8,0.12)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.2)' }}>
                  68 / 100 · Moyen
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
                {/* Left: score */}
                <div className="p-5 sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-600 mb-4">Score global</p>

                  {/* Big score */}
                  <div className="flex items-baseline gap-2 mb-5">
                    <span className="text-[3.5rem] font-black text-white leading-none">68</span>
                    <span className="text-gray-600 text-lg">/100</span>
                  </div>

                  {/* Pillar scores */}
                  <div className="space-y-3">
                    {[
                      { name: 'Hook',      score: 71, color: '#4ade80', pct: '71%' },
                      { name: 'Montage',   score: 55, color: '#fbbf24', pct: '55%' },
                      { name: 'Rétention', score: 48, color: '#f87171', pct: '48%' },
                    ].map(({ name, score, color, pct }) => (
                      <div key={name}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-[12px] text-gray-500">{name}</span>
                          <span className="text-[12px] font-bold" style={{ color }}>{score}</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <motion.div className="h-full rounded-full"
                            style={{ background: color, width: 0 }}
                            whileInView={{ width: pct }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: E, delay: 0.3 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Verdict badge */}
                  <div className="mt-5 flex items-center gap-2 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.14)' }}>
                    <span className="text-sm">⚡</span>
                    <p className="text-[11.5px] leading-snug" style={{ color: '#fca5a5' }}>
                      Rétention critique — chute à 6s, montage trop lent
                    </p>
                  </div>
                </div>

                {/* Right: plan */}
                <div className="p-5 sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-600 mb-4">Plan d&apos;action</p>

                  <div className="space-y-3 mb-6">
                    {[
                      { priority: 'CRITIQUE', action: 'Couper l\'intro — commence direct au sujet, pas de présentation', tag: 'Montage' },
                      { priority: 'IMPORTANT', action: 'Ajouter un pattern interrupt à 4s — texte, son ou cut rapide', tag: 'Rétention' },
                      { priority: 'IMPORTANT', action: 'Reformuler le hook — poser une question ou révéler un chiffre dès l\'image 1', tag: 'Hook' },
                    ].map(({ priority, action, tag }, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white mt-0.5"
                          style={{ background: 'linear-gradient(135deg, #e879f9, #6366f1)' }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${priority === 'CRITIQUE' ? 'text-red-400' : 'text-amber-400'}`}>{priority}</span>
                            <span className="text-[9px] text-gray-700">·</span>
                            <span className="text-[9px] text-gray-600">{tag}</span>
                          </div>
                          <p className="text-[12px] text-gray-400 leading-snug">{action}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Viral insight */}
                  <div className="p-3.5 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, rgba(232,121,249,0.07), rgba(99,102,241,0.04))', border: '1px solid rgba(232,121,249,0.15)' }}>
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-vn-fuchsia mb-1.5">✨ Insight viral</p>
                    <p className="text-[11.5px] text-gray-400 leading-snug">
                      Les vidéos similaires qui performe débutent par une révélation contre-intuitive. Reformuler le hook sur ce modèle pourrait doubler la rétention à 10s.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>

          <div className="mt-8 text-center">
            <Link href="/analyzer"
              className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white text-[14px] font-semibold px-8 py-3.5 hover:brightness-110 hover:scale-[1.02] transition-all shadow-lg shadow-vn-fuchsia/20">
              Analyser ma vidéo gratuitement
              <Arrow className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 5. TRANSFORMATION ══════════════════════════════════════ */}
      <section id="diff" className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06]">
                <span className="text-white">Avant.</span>{' '}
                <span className={G}>Après.</span>
              </h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-5">
            <FadeUp delay={0.05}>
              <div className="h-full p-7 sm:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.015]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-600 mb-6">❌ Sans Viralynz</p>
                <ul className="space-y-4">
                  {[
                    'Tu postes. Tu regardes les stats. Rien ne s\'explique.',
                    'Tu copies les créateurs qui marchent. Ça marche pas pareil.',
                    'Tu retestes au hasard en espérant que ça décolle.',
                    'Tu ne sais pas si c\'est le montage, le hook ou le sujet.',
                    'Chaque vidéo qui floppe = frustration + temps perdu.',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 text-gray-700 text-sm shrink-0">—</span>
                      <span className="text-[13.5px] text-gray-500 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>

            <FadeUp delay={0.12}>
              <div className="h-full p-7 sm:p-8 rounded-2xl border border-vn-fuchsia/20 bg-gradient-to-br from-vn-fuchsia/[0.07] to-vn-indigo/[0.04]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-vn-fuchsia mb-6">✓ Avec Viralynz</p>
                <ul className="space-y-4">
                  {[
                    'Tu sais exactement ce qui a bloqué ta vidéo.',
                    'Un score précis sur Hook, Montage et Rétention.',
                    'Un plan d\'action clair — 3 corrections prioritaires.',
                    'Tu corriges avant de reposter, pas après.',
                    'Chaque vidéo devient un apprentissage structuré.',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <Check />
                      <span className="text-[13.5px] text-gray-300 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══ 6. TESTIMONIALS ═══════════════════════════════════════ */}
      <section id="avis" className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06]">
                <span className="text-white">Ce qu&apos;ils en</span>{' '}
                <span className={G}>disent.</span>
              </h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map(({ avatar, name, handle, role, quote }, i) => (
              <FadeUp key={name} delay={i * 0.1}>
                <div className="h-full flex flex-col p-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] transition-colors">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4" aria-hidden>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <svg key={j} viewBox="0 0 20 20" className="w-3.5 h-3.5 text-vn-fuchsia" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-[13.5px] text-gray-400 leading-relaxed flex-1 mb-5">&ldquo;{quote}&rdquo;</p>
                  {/* Author */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                    <img src={avatar} alt={name} width={40} height={40}
                      className="w-10 h-10 rounded-full object-cover border border-white/[0.08]" />
                    <div>
                      <p className="text-[13px] font-semibold text-white">{name}</p>
                      <p className="text-[11px] text-gray-600">{role}</p>
                    </div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7. FEATURES ═══════════════════════════════════════════ */}
      <section id="features" className="relative py-24 sm:py-32 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06]">
                <span className="text-white">Tout ce qu&apos;il te faut</span><br />
                <span className={G}>pour performer.</span>
              </h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-3 gap-5">
            {features.map(({ icon, title, desc, bullets, accent, border }, i) => (
              <FadeUp key={title} delay={i * 0.1}>
                <div className={`h-full p-6 sm:p-7 rounded-2xl border ${border} bg-gradient-to-br ${accent} hover:-translate-y-0.5 transition-all duration-300`}>
                  <span className="text-2xl mb-5 block">{icon}</span>
                  <h3 className="text-[16px] font-bold text-white mb-2.5 tracking-tight">{title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed mb-5">{desc}</p>
                  <ul className="space-y-2">
                    {bullets.map(b => (
                      <li key={b} className="flex items-center gap-2.5 text-[12px] text-gray-400">
                        <Check color="text-vn-fuchsia" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. PRICING ════════════════════════════════════════════ */}
      <section id="tarifs" className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06] mb-3">
                <span className="text-white">Simple, transparent,</span><br />
                <span className={G}>sans surprise.</span>
              </h2>
              <p className="text-gray-500 text-[14.5px] max-w-sm mx-auto">
                Commence gratuitement. Scale quand l&apos;analyse devient ton avantage.
              </p>
            </div>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {/* Starter */}
            <FadeUp delay={0.05}>
              <div className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7 flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mb-3">Starter</p>
                <p className="text-[2.4rem] font-black text-white leading-none mb-1">0€</p>
                <p className="text-[13px] text-gray-600 mb-6">{MAX_ANALYSES_FREE} analyses · à vie</p>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {['Analyse IA complète', 'Score & diagnostic', 'Plan d\'action'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-gray-500"><Check />{f}</li>
                  ))}
                </ul>
                <Link href="/analyzer"
                  className="block text-center rounded-full py-3 text-[13.5px] font-semibold border border-white/[0.1] text-gray-400 hover:text-white hover:border-white/[0.2] transition-all">
                  Commencer gratuitement
                </Link>
              </div>
            </FadeUp>

            {/* Pro */}
            <FadeUp delay={0.1}>
              <div className="h-full relative rounded-2xl pro-pricing-card p-6 sm:p-8 flex flex-col ring-1 ring-vn-fuchsia/20">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-lg whitespace-nowrap z-10">
                  Le plus populaire
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-vn-fuchsia mb-3 mt-3">Pro</p>
                <p className="text-[2.4rem] font-black text-white leading-none mb-1">
                  {DISPLAY_CATALOG_PRO_EUR}€<span className="text-base font-normal text-gray-500 ml-1">/mois</span>
                </p>
                <p className="text-[13px] text-gray-500 mb-6">{MAX_ANALYSES_PRO} analyses · {MAX_HOOKS_PRO} hooks / mois</p>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {['Tout Starter +', 'Hook generator', 'Dashboard IA & historique', 'Recommandations avancées'].map((f, i) => (
                    <li key={f} className={`flex items-center gap-2.5 text-[13px] ${i === 0 ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                      {i > 0 ? <Check /> : <span className="w-4 shrink-0" />}{f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing"
                  className="block text-center rounded-full py-3.5 text-[13.5px] font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-lg shadow-vn-fuchsia/20">
                  Choisir Pro
                </Link>
              </div>
            </FadeUp>

            {/* Elite — HIGHLIGHTED */}
            <FadeUp delay={0.15}>
              <div className="h-full relative rounded-2xl elite-pricing-card p-6 sm:p-8 flex flex-col"
                style={{ boxShadow: '0 0 60px -20px rgba(168,85,247,0.3), 0 0 0 1px rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.25)' }}>
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white shadow-lg whitespace-nowrap z-10"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}>
                  ⚡ Meilleur résultat
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 mb-3 mt-3">Elite</p>
                <p className="text-[2.4rem] font-black text-white leading-none mb-1">
                  {DISPLAY_CATALOG_ELITE_EUR}€<span className="text-base font-normal text-gray-500 ml-1">/mois</span>
                </p>
                <p className="text-[13px] text-gray-500 mb-6">{MAX_ANALYSES_ELITE} analyses · {MAX_HOOKS_ELITE} hooks / mois</p>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {['Tout Pro +', 'Volume & profondeur max', 'Insights viraux débloqués', 'Support prioritaire'].map((f, i) => (
                    <li key={f} className={`flex items-center gap-2.5 text-[13px] ${i === 0 ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                      {i > 0 ? <Check color="text-purple-400" /> : <span className="w-4 shrink-0" />}{f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing"
                  className="block text-center rounded-full py-3.5 text-[13.5px] font-semibold text-white hover:brightness-110 transition-all"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)', boxShadow: '0 8px 24px rgba(168,85,247,0.3)' }}>
                  Choisir Elite
                </Link>
              </div>
            </FadeUp>
          </div>

          <p className="text-center mt-8">
            <Link href="/pricing" className="text-[13px] text-gray-600 hover:text-gray-400 transition-colors inline-flex items-center gap-1">
              Voir le détail complet des plans
              <Arrow className="w-3.5 h-3.5" />
            </Link>
          </p>
        </div>
      </section>

      {/* ══ 9. FAQ ════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-24 sm:py-32 border-t border-white/[0.06] scroll-mt-24">
        <div className={`max-w-3xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-12 sm:mb-14">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06] mb-3">
                <span className="text-white">Questions</span>{' '}
                <span className={G}>fréquentes.</span>
              </h2>
              <p className="text-gray-500 text-[14px]">Des réponses claires, sans bullshit.</p>
            </div>
          </FadeUp>

          <div className="space-y-3">
            {[
              {
                q: 'Est-ce que ça marche vraiment ?',
                a: 'L\'analyse repose sur GPT-4o Vision + Whisper : 14 frames extraites, audio transcrit, structure décryptée. Le résultat est un score structuré, un problème principal et un plan d\'action concret. Pas un rapport flou — une checklist actionnable.',
              },
              {
                q: 'Combien de temps ça prend ?',
                a: 'Entre 20 et 45 secondes selon la durée de ta vidéo. Tu uploades, tu attends quelques secondes, tu reçois ton diagnostic complet.',
              },
              {
                q: 'Est-ce que c\'est pour débutant ?',
                a: 'Oui. Les analyses sont écrites pour être comprises sans jargon. Tu peux les lire seul ou les partager avec un monteur, un créateur UGC ou un client.',
              },
              ...faqItems.slice(0, 4),
            ].map(item => (
              <details key={item.q}
                className="group rounded-2xl landing-card-deep border-white/[0.06] open:border-vn-fuchsia/25 open:shadow-[0_0_48px_-24px_rgba(232,121,249,0.2)] transition-all duration-300">
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

      {/* ══ 10. CTA FINAL ═════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 border-t border-white/[0.05] overflow-hidden">
        <div className={`max-w-4xl ${SI}`}>
          <FadeUp>
            <div className="relative rounded-[1.75rem] p-[1px] shadow-[0_32px_100px_-40px_rgba(232,121,249,0.35)]"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(232,121,249,0.35), rgba(99,102,241,0.4))' }}>
              <div className="relative rounded-[calc(1.75rem-1px)] overflow-hidden bg-[#06060c]"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/[0.12] via-[#0a0a12] to-vn-indigo/[0.12]" aria-hidden />
                <div className="absolute inset-0 landing-mesh opacity-30 mix-blend-overlay" aria-hidden />
                <div className="relative px-8 sm:px-12 lg:px-16 py-14 sm:py-16 text-center">
                  <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black tracking-tight leading-tight mb-4">
                    <span className="text-white">Prêt à arrêter de poster</span><br />
                    <span className={G}>au hasard ?</span>
                  </h2>
                  <p className="text-gray-500 max-w-md mx-auto mb-10 text-[14.5px] leading-relaxed">
                    {MAX_ANALYSES_FREE} analyses gratuites — sans carte bancaire, sans engagement.
                    Résultats en quelques secondes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    <div className="relative group">
                      <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/55 to-vn-indigo/45 opacity-70 blur-lg transition-all duration-500 group-hover:opacity-100" aria-hidden />
                      <Link href="/analyzer"
                        className="relative inline-flex items-center gap-2.5 min-h-[52px] rounded-full px-10 text-[15px] font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 hover:scale-[1.02] transition-all shadow-xl">
                        Analyser ma vidéo
                        <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                    <Link href="/pricing" className="text-[13.5px] text-gray-500 hover:text-gray-300 transition-colors">
                      Voir les plans →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════ */}
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
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-gray-600">
              <Link href="/analyzer"       className="hover:text-white transition-colors">Analyser</Link>
              <Link href="/features"       className="hover:text-white transition-colors">Fonctionnalités</Link>
              <Link href="/hook-generator" className="hover:text-white transition-colors">Hooks</Link>
              <Link href="/pricing"        className="hover:text-white transition-colors">Tarifs</Link>
              <Link href="/changelog"      className="hover:text-white transition-colors">Nouveautés</Link>
              <Link href="/login"          className="hover:text-white transition-colors">Connexion</Link>
            </nav>
          </div>
          <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between gap-4 text-[11px] text-gray-700">
            <p>© {new Date().getFullYear()} Viralynz. Tous droits réservés.</p>
            <p>TikTok aujourd&apos;hui — Reels &amp; Shorts en roadmap.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
