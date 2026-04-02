'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import CheckoutButton from '@/components/CheckoutButton';
import {
  MAX_ANALYSES_FREE, MAX_ANALYSES_PRO, MAX_ANALYSES_ELITE,
  MAX_HOOKS_PRO, MAX_HOOKS_ELITE,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_PRO_EUR, DISPLAY_CATALOG_ELITE_EUR } from '@/lib/stripe-pricing';
import HeroMockupPremium from '@/components/landing/HeroMockupPremium';
import FloatingParticles from '@/components/FloatingParticles';
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
const WALL_ROW1 = [
  {
    avatar: 'https://i.pravatar.cc/56?img=11',
    name: 'Julien B.',
    role: 'Créateur TikTok',
    tag: 'Créateur',
    tagCls: 'text-vn-fuchsia bg-vn-fuchsia/10 border-vn-fuchsia/20',
    metric: '+40% de rétention',
    quote: 'J\'ai analysé 3 vidéos en un soir. En 5 minutes j\'avais compris pourquoi mes hooks ne convertissaient pas. <b>+40% de rétention</b> sur les 3 posts suivants. Aucun autre outil ne m\'a donné ça.',
    sub: '28k abonnés',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=47',
    name: 'Sofia D.',
    role: 'Clipper & Monteuse',
    tag: 'Agence',
    tagCls: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    metric: '6 clients fidélisés',
    quote: 'Je livre pour <b>6 marques différentes</b>. Les analyses me permettent de justifier chaque choix de montage avec des données IA. Mes clients ne contestent plus. Ils reviennent.',
    sub: 'Freelance contenu',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=12',
    name: 'Marc T.',
    role: 'E-commerce · UGC Ads',
    tag: 'E-commerce',
    tagCls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    metric: '+30% ROAS',
    quote: 'Depuis que j\'analyse les vidéos avant de les diffuser, <b>mon ROAS a augmenté de 30%</b>. Je valide avant de mettre du budget. Indispensable.',
    sub: 'Boutique Shopify',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=33',
    name: 'Léa V.',
    role: 'Créatrice lifestyle',
    tag: 'Créateur',
    tagCls: 'text-vn-fuchsia bg-vn-fuchsia/10 border-vn-fuchsia/20',
    metric: '2M vues en 1 semaine',
    quote: 'J\'ai suivi les recommandations sur mon hook et mon montage. La vidéo suivante a fait <b>2 millions de vues</b>. Je ne poste plus rien sans analyser avant.',
    sub: '112k abonnés',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=55',
    name: 'Thomas K.',
    role: 'Coach business',
    tag: 'Créateur',
    tagCls: 'text-vn-fuchsia bg-vn-fuchsia/10 border-vn-fuchsia/20',
    metric: 'x3 sur les leads',
    quote: 'Mes vidéos TikTok génèrent mes leads. Depuis Viralynz, <b>j\'ai triplé mes conversions</b> en comprenant exactement où je perdais mon audience. Le ROI est immédiat.',
    sub: 'Formation en ligne',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=28',
    name: 'Amélie R.',
    role: 'Social Media Manager',
    tag: 'Agence',
    tagCls: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    metric: '4 clients satisfaits',
    quote: 'Je gère les comptes TikTok de <b>4 marques simultanément</b>. Viralynz me donne des recommandations concrètes que je peux livrer directement à mes clients. Gain de temps énorme.',
    sub: 'Agence digitale',
  },
];

const WALL_ROW2 = [
  {
    avatar: 'https://i.pravatar.cc/56?img=21',
    name: 'Romain S.',
    role: 'Créateur fitness',
    tag: 'Créateur',
    tagCls: 'text-vn-fuchsia bg-vn-fuchsia/10 border-vn-fuchsia/20',
    metric: '+68% de reach',
    quote: 'En 2 semaines d\'utilisation, mon reach organique a <b>augmenté de 68%</b>. L\'analyse du hook m\'a ouvert les yeux sur ce qui bloquait réellement l\'algo.',
    sub: '45k abonnés',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=39',
    name: 'Clara M.',
    role: 'Marque beauté',
    tag: 'Marque',
    tagCls: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    metric: '-60% de taux de fuite',
    quote: 'On diffusait des vidéos UGC sans les analyser. Après Viralynz, <b>notre taux de fuite a chuté de 60%</b>. On ne valide plus aucune vidéo sans l\'outil.',
    sub: 'DTC cosmétique',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=17',
    name: 'Kevin D.',
    role: 'Clipper professionnel',
    tag: 'Agence',
    tagCls: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    metric: '30% de revenus en plus',
    quote: 'Je facture maintenant <b>30% plus cher</b> car je livre avec un rapport d\'analyse IA. Mes clients voient la valeur. Je me différencie de tous les autres clippers.',
    sub: 'Freelance montage',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=52',
    name: 'Yasmine O.',
    role: 'Créatrice mode',
    tag: 'Créateur',
    tagCls: 'text-vn-fuchsia bg-vn-fuchsia/10 border-vn-fuchsia/20',
    metric: '500k vues premier mois',
    quote: 'J\'avais du mal à dépasser les 10k vues. Après avoir suivi les plans d\'action de Viralynz, <b>j\'ai passé 500k vues en un mois</b>. Le score m\'a tout expliqué.',
    sub: '88k abonnés',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=60',
    name: 'Antoine P.',
    role: 'Founder SaaS',
    tag: 'Marque',
    tagCls: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    metric: 'x4 sur l\'engagement',
    quote: 'On utilisait TikTok pour notre SaaS sans vraiment comprendre l\'algo. Depuis Viralynz, <b>notre engagement a été multiplié par 4</b>. On comprend enfin ce qui fonctionne.',
    sub: 'Startup tech',
  },
  {
    avatar: 'https://i.pravatar.cc/56?img=44',
    name: 'Inès L.',
    role: 'Influenceuse voyage',
    tag: 'Créateur',
    tagCls: 'text-vn-fuchsia bg-vn-fuchsia/10 border-vn-fuchsia/20',
    metric: '+90% de complétion',
    quote: 'L\'analyse de rétention m\'a montré exactement où les gens décrochaient. J\'ai ajusté mon montage et <b>mon taux de complétion a grimpé de 90%</b> en une semaine.',
    sub: '67k abonnés',
  },
];

/* ── TestiCard ──────────────────────────────────────────────── */
interface TestiCardProps {
  avatar: string; name: string; role: string;
  tag: string; tagCls: string; metric: string;
  quote: string; sub: string;
}
function TestiCard({ avatar, name, role, tag, tagCls, metric, quote, sub }: TestiCardProps) {
  return (
    <div className="flex-shrink-0 w-[320px] sm:w-[360px] flex flex-col p-5 rounded-2xl border border-white/[0.07] bg-[#0d0d12] hover:border-white/[0.14] transition-colors">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex gap-0.5" aria-hidden>
          {Array.from({ length: 5 }).map((_, j) => (
            <svg key={j} viewBox="0 0 20 20" className="w-3 h-3 text-vn-fuchsia" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tagCls}`}>{tag}</span>
      </div>
      {/* Metric highlight */}
      <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.16em] mb-2">{metric}</p>
      {/* Quote */}
      <p className="text-[13px] text-gray-400 leading-relaxed flex-1 mb-4"
        dangerouslySetInnerHTML={{ __html: `"${quote.replace(/<b>/g, '<strong class="text-white font-semibold">').replace(/<\/b>/g, '</strong>')}"` }}
      />
      {/* Author */}
      <div className="flex items-center gap-2.5 pt-3.5 border-t border-white/[0.06]">
        <img src={avatar} alt={name} width={36} height={36}
          className="w-9 h-9 rounded-full object-cover border border-white/[0.08] shrink-0" />
        <div>
          <p className="text-[12px] font-semibold text-white leading-none">{name}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{role} · {sub}</p>
        </div>
      </div>
    </div>
  );
}

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

function useUserCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/users/count')
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? null))
      .catch(() => {});
  }, []);
  return count;
}

function formatCount(n: number): string {
  return `+${n}`;
}

export default function HomeLanding() {
  const userCount = useUserCount();
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
      <section className="relative pt-10 sm:pt-14 lg:pt-20 pb-10 sm:pb-16 overflow-visible" id="top">
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
                <span className="hero-badge-text text-[10px] sm:text-[11px] font-semibold tracking-[0.10em] sm:tracking-[0.12em] uppercase text-white/90 whitespace-nowrap">
                  L&apos;outil TikTok pour les créateurs
                </span>
                <span className="hero-badge-arrow flex items-center overflow-hidden w-4" aria-hidden>
                  <svg className="h-3 w-3 shrink-0 text-white/50 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4"/>
                  </svg>
                </span>
              </Link>

              {/* H1 */}
              <h1 className="font-hero-inter font-black text-white landing-hero-title-glow tracking-[-0.05em] text-center lg:text-left max-[419px]:text-[1.95rem] max-[419px]:leading-[0.92] text-[2.45rem] leading-[0.91] sm:text-[3.1rem] sm:leading-[0.89] md:text-[3.6rem] md:leading-[0.88] lg:text-[3.4rem] lg:leading-[0.88] xl:text-[4.0rem] xl:leading-[0.87] 2xl:text-[4.5rem] 2xl:leading-[0.86]">
                <span className="block">Domine&nbsp;
                  <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">TikTok.</span>
                </span>
                <span className="block text-white text-[0.82em] tracking-[-0.03em] mt-1">Arrête de poster au hasard.</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 sm:mt-7 text-[1rem] sm:text-[1.07rem] text-gray-400 max-w-[420px] mx-auto lg:mx-0 leading-relaxed font-normal tracking-[-0.01em]">
                L&apos;IA te montre exactement pourquoi —{' '}
                et comment corriger ça immédiatement.
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
                <Link href="/features"
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
                  Rejoins{' '}
                  <span className="text-white font-bold">
                    {userCount !== null ? formatCount(userCount) : '+237'}
                  </span>{' '}
                  créateurs de contenu
                </p>
              </div>
            </div>

            {/* ── Right: mockup ─────────────────────────────────── */}
            <div className="flex-[6] w-full max-w-[520px] lg:max-w-none relative" id="produit">
              {/* Spotlight cone behind the mockup */}
              <div
                className="absolute -inset-16 pointer-events-none -z-10"
                style={{
                  background: 'radial-gradient(ellipse 80% 65% at 50% 38%, rgba(232,121,249,0.22) 0%, rgba(99,102,241,0.12) 42%, transparent 72%)',
                  filter: 'blur(32px)',
                  animation: 'heroHaloPulse 4.5s ease-in-out infinite',
                }}
                aria-hidden
              />
              <div
                className="absolute -inset-8 pointer-events-none -z-10"
                style={{
                  background: 'radial-gradient(ellipse 55% 45% at 50% 30%, rgba(232,121,249,0.12) 0%, transparent 65%)',
                  filter: 'blur(16px)',
                  animation: 'heroHaloPulse 3s ease-in-out 1s infinite',
                }}
                aria-hidden
              />
              <HeroMockupPremium />
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ═══════════════════════════════════════════ */}
      <div className="border-y border-white/[0.06] bg-white/[0.012] py-5">
        <div className={`max-w-5xl ${SI}`}>
          <div className="flex flex-wrap justify-center lg:justify-between gap-x-6 sm:gap-x-10 gap-y-4">
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
      <section id="probleme" className="relative py-14 sm:py-20 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-8">
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
      <section id="comment" className="relative py-14 sm:py-20 border-t border-white/[0.06] scroll-mt-24">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-10">
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
      <section id="demo" className="relative py-14 sm:py-20 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-8">
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
      <section id="diff" className="relative py-14 sm:py-20 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-8">
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
      <section id="avis" className="relative py-14 sm:py-20 border-t border-white/[0.06] overflow-hidden">

        {/* Fade edges */}
        <div className="absolute inset-y-0 left-0 w-24 sm:w-40 bg-gradient-to-r from-vn-void to-transparent z-10 pointer-events-none" aria-hidden />
        <div className="absolute inset-y-0 right-0 w-24 sm:w-40 bg-gradient-to-l from-vn-void to-transparent z-10 pointer-events-none" aria-hidden />

        {/* Header */}
        <FadeUp>
          <div className="text-center mb-4 px-5">
            <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06] mb-4">
              <span className="text-white">Ce qu&apos;ils en</span>{' '}
              <span className={G}>disent.</span>
            </h2>
            {/* Stats bar */}
            <div className="inline-flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-5 mb-10">
              {[
                { value: '4.9/5', label: 'note moyenne' },
                { value: '230+', label: 'utilisateurs actifs' },
                { value: '2 000+', label: 'analyses réalisées' },
                { value: '< 60s', label: 'par analyse' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="text-[1.4rem] font-black text-white leading-none">{value}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeUp>

        {/* Marquee row 1 — left */}
        <div className="relative mb-4">
          <div className="flex gap-4 w-max animate-[marquee_40s_linear_infinite]">
            {[...WALL_ROW1, ...WALL_ROW1].map((t, i) => (
              <TestiCard key={i} {...t} />
            ))}
          </div>
        </div>

        {/* Marquee row 2 — right */}
        <div className="relative">
          <div className="flex gap-4 w-max animate-[marquee_40s_linear_infinite_reverse]">
            {[...WALL_ROW2, ...WALL_ROW2].map((t, i) => (
              <TestiCard key={i} {...t} />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
      </section>

      {/* ══ 7. FEATURES ═══════════════════════════════════════════ */}
      <section id="features" className="relative py-14 sm:py-20 border-t border-white/[0.06]">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-8">
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
      <section id="tarifs" className="relative py-14 sm:py-20 border-t border-white/[0.06] scroll-mt-24">
        <div className={`max-w-5xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.06] mb-3">
                <span className="text-white">Simple, transparent,</span><br />
                <span className={G}>sans surprise.</span>
              </h2>
              <p className="text-gray-500 text-[14.5px] max-w-sm mx-auto">
                Commence gratuitement. Scale quand l&apos;analyse devient ton avantage.
              </p>
            </div>
          </FadeUp>

          {/* ── Cards — même style exact que /pricing ────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 md:items-end">

            {/* Starter */}
            <FadeUp delay={0.05} className="md:pr-3">
              <div className="rounded-2xl border border-white/[0.07] bg-[#09090f] p-6 h-full flex flex-col">
                <div className="mb-7">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-white/[0.04] text-gray-600 border border-white/[0.05]">
                      Starter
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="text-[2.5rem] font-black text-white leading-none">Gratuit</span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">
                    Pour découvrir Viralynz sans risque et tester tes {MAX_ANALYSES_FREE} premières analyses.
                  </p>
                </div>
                <Link href="/analyzer"
                  className="w-full text-center py-3 rounded-xl font-semibold text-sm text-gray-400 bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:text-gray-200 transition-all mb-6 block">
                  Commencer gratuitement
                </Link>
                <div className="h-px bg-white/[0.04] mb-5" />
                <ul className="space-y-3 flex-1">
                  {[
                    { label: `${MAX_ANALYSES_FREE} analyses offertes`, ok: true },
                    { label: 'Score de viralité', ok: true },
                    { label: 'Analyse Hook / Montage / Rétention', ok: true },
                    { label: 'Recommandations IA basiques', ok: true },
                    { label: 'Dashboard coach', ok: true },
                    { label: 'Générateur de hooks', ok: false },
                    { label: "Plan d'action IA", ok: false },
                  ].map((f, i) => (
                    <li key={i} className={`flex items-center gap-2.5 ${!f.ok ? 'opacity-40' : ''}`}>
                      {f.ok
                        ? <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0 text-gray-600"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
                        : <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0 text-gray-700"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>
                      }
                      <span className={`text-[12px] leading-snug ${f.ok ? 'text-gray-500' : 'text-gray-700'}`}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>

            {/* Pro — ELEVATED */}
            <FadeUp delay={0.1} className="md:-mt-8 md:z-10 relative">
              {/* Popular badge */}
              <div className="flex justify-center mb-3 relative z-10">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-4 py-1 rounded-full bg-vn-fuchsia text-white shadow-lg shadow-vn-fuchsia/40">
                  ⭐ Le plus populaire
                </span>
              </div>
              <div className="relative flex flex-col rounded-[1.1rem] border border-vn-fuchsia/30 bg-gradient-to-b from-[#110815] to-[#0a0810] p-7 shadow-[0_8px_40px_-12px_rgba(232,121,249,0.25)] z-10 overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/70 to-transparent rounded-t-[1.1rem]" />
                {/* Particles inside card */}
                <FloatingParticles count={28} className="opacity-60" />
                <div className="relative mb-7">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/30">Pro</span>
                    <span className="text-[10px] text-vn-fuchsia/60 font-medium">Recommandé</span>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-[2.8rem] font-black text-white leading-none">{DISPLAY_CATALOG_PRO_EUR}€</span>
                    <span className="text-gray-500 text-sm pb-1.5">/ mois</span>
                  </div>
                  <p className="text-[13px] text-gray-300 leading-relaxed mt-2">
                    Pour les créateurs sérieux qui publient avec méthode et veulent des résultats constants.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {['C','A','M','T'].map(l => (
                        <div key={l} className="w-5 h-5 rounded-full bg-gradient-to-br from-vn-fuchsia/60 to-vn-indigo/60 border border-vn-void text-[8px] font-black text-white flex items-center justify-center">{l}</div>
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-500">Choisi par la majorité des créateurs Viralynz</span>
                  </div>
                </div>
                <CheckoutButton plan="pro"
                  className="relative w-full text-center py-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-vn-fuchsia/30 mb-6 block">
                  Commencer avec Pro
                </CheckoutButton>
                <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/30 to-transparent mb-6" />
                <ul className="space-y-3 flex-1">
                  {[
                    { label: `${MAX_ANALYSES_PRO} analyses / mois`, hi: true },
                    { label: 'Score de viralité complet', hi: false },
                    { label: 'Analyse Hook / Montage / Rétention', hi: false },
                    { label: 'Recommandations IA avancées', hi: true },
                    { label: 'Dashboard coach personnalisé', hi: false },
                    { label: `${MAX_HOOKS_PRO} hooks / mois`, hi: true },
                    { label: "Plan d'action IA", hi: false },
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0 text-vn-fuchsia"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
                      <span className={`text-[13px] leading-snug ${f.hi ? 'text-white font-semibold' : 'text-gray-300'}`}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>

            {/* Elite */}
            <FadeUp delay={0.15} className="md:pl-3">
              <div className="relative flex flex-col rounded-2xl border border-violet-500/20 bg-gradient-to-b from-[#0d0a14] to-[#080810] p-6 h-full">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent rounded-t-2xl" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.07),transparent_60%)] rounded-2xl pointer-events-none" />
                <div className="relative mb-7">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-violet-500/15 text-violet-300 border border-violet-500/25">Elite</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-vn-fuchsia/20 text-violet-300 border border-violet-500/20">🔥 Volume max</span>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-[2.5rem] font-black text-white leading-none">{DISPLAY_CATALOG_ELITE_EUR}€</span>
                    <span className="text-gray-500 text-sm pb-1.5">/ mois</span>
                  </div>
                  <p className="text-[12px] text-gray-400 leading-relaxed mt-2">
                    Pour scaler fort — plus de volume, stratégie avancée et insights viraux exclusifs.
                  </p>
                </div>
                <CheckoutButton plan="elite"
                  className="w-full text-center py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 to-vn-fuchsia hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/20 ring-1 ring-white/10 mb-6 block">
                  Passer en Elite
                </CheckoutButton>
                <div className="h-px bg-gradient-to-r from-transparent via-violet-500/25 to-transparent mb-6" />
                <ul className="space-y-3 flex-1">
                  {[
                    { label: `${MAX_ANALYSES_ELITE} analyses / mois`, e: true },
                    { label: 'Score de viralité complet', e: false },
                    { label: 'Analyse Hook / Montage / Rétention', e: false },
                    { label: 'Recommandations IA complètes', e: false },
                    { label: `${MAX_HOOKS_ELITE} hooks / mois`, e: true },
                    { label: 'Historique illimité', e: true },
                    { label: 'Stratégie Elite & Insights viraux', e: true },
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0 text-violet-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
                      <span className={`text-[13px] leading-snug ${f.e ? 'text-violet-200 font-semibold' : 'text-gray-400'}`}>{f.label}</span>
                      {f.e && <span className="ml-auto shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wide">Elite</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </div>

          {/* Trust bar */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-7 text-[11px] text-gray-600">
            {[
              { icon: '🔒', label: 'Paiement sécurisé Stripe' },
              { icon: '↩', label: 'Remboursement 7 jours' },
              { icon: '∞', label: 'Sans engagement' },
              { icon: '🔄', label: 'Quotas rechargés chaque mois' },
            ].map(t => (
              <span key={t.label} className="flex items-center gap-2">
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
              </span>
            ))}
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
      <section id="faq" className="relative py-14 sm:py-20 border-t border-white/[0.06] scroll-mt-24">
        <div className={`max-w-3xl ${SI}`}>
          <FadeUp>
            <div className="text-center mb-8 sm:mb-10">
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

      {/* ══ 10. ROADMAP ════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 border-t border-white/[0.06] overflow-hidden">

        {/* Grid background */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }} />
          <div className="absolute inset-0 bg-gradient-to-b from-vn-bg via-transparent to-vn-bg" />
        </div>

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-vn-indigo/[0.06] blur-[100px]" />
        </div>

        <div className={`relative max-w-6xl ${SI}`}>

          {/* Header */}
          <FadeUp>
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">En développement actif</span>
              </div>
              <h2 className="text-3xl sm:text-[2.8rem] lg:text-[3.2rem] font-black tracking-tight leading-tight mb-5">
                <span className="text-white">Viralynz devient</span><br />
                <span className={G}>ton arme secrète.</span>
              </h2>
              <p className="text-gray-500 text-[15px] max-w-[480px] mx-auto leading-relaxed">
                On construit l&apos;outil ultime pour comprendre et dominer les algorithmes. Voici où on va.
              </p>
            </div>
          </FadeUp>

          {/* Progress bar v1→v2→v3 */}
          <FadeUp delay={0.06}>
            <div className="relative mb-8 sm:mb-10 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                {[
                  { full: 'v1 — TikTok', short: 'v1' },
                  { full: 'v2 — Multi-plateforme', short: 'v2' },
                  { full: 'v3 — IA prédictive', short: 'v3' },
                ].map(({ full, short }, i) => (
                  <span key={full} className={`text-[11px] font-bold tracking-wide ${i === 0 ? 'text-emerald-400' : i === 1 ? 'text-vn-violet' : 'text-gray-600'}`}>
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
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                />
              </div>
              <p className="text-[10px] text-gray-700 mt-2 text-right">38% de la vision accomplie</p>
            </div>
          </FadeUp>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">

            {/* ── LIVE ── */}
            {[
              {
                tier: 'live' as const,
                badge: 'LIVE',
                badgeCls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
                dotCls: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse',
                borderCls: 'border-emerald-500/20 hover:border-emerald-500/40',
                glowCls: 'from-emerald-500/[0.07]',
                hoverGlow: 'hover:shadow-[0_0_40px_-8px_rgba(52,211,153,0.2)]',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
                title: 'Analyse TikTok IA',
                benefit: 'Sache en 30 secondes exactement pourquoi ta vidéo floppe — et comment la corriger.',
                detail: 'Score viral · Hook · Montage · Rétention',
              },
            ].map((card) => (
              <FadeUp key={card.title} delay={0.05}>
                <div className={`group relative p-6 rounded-2xl border ${card.borderCls} bg-gradient-to-b ${card.glowCls} to-transparent ${card.hoverGlow} hover:-translate-y-1 transition-all duration-300 overflow-hidden`}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-400/10 text-emerald-400`}>
                      {card.icon}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${card.badgeCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${card.dotCls}`} />
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-black text-white mb-2.5 tracking-tight">{card.title}</h3>
                  <p className="text-[13px] text-gray-400 leading-relaxed mb-4">{card.benefit}</p>
                  <p className="text-[10px] text-gray-700 font-medium tracking-wide">{card.detail}</p>
                </div>
              </FadeUp>
            ))}

            {/* ── EN DÉVELOPPEMENT ── */}
            {[
              {
                badge: 'EN DEV',
                badgeCls: 'bg-vn-violet/10 text-vn-violet border-vn-violet/25',
                dotCls: 'bg-vn-violet shadow-[0_0_6px_rgba(139,92,246,0.9)] animate-pulse',
                borderCls: 'border-vn-violet/15 hover:border-vn-violet/35',
                glowCls: 'from-vn-violet/[0.06]',
                hoverGlow: 'hover:shadow-[0_0_40px_-8px_rgba(139,92,246,0.18)]',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" />
                    <path strokeLinecap="round" d="M8 21h8M12 17v4" />
                  </svg>
                ),
                title: 'Instagram Reels',
                benefit: 'Comprends pourquoi tes Reels n\'explosent pas — et ce que l\'algo Meta récompense vraiment.',
                detail: 'Analyse Meta · Critères Reels · Score algorithme',
              },
              {
                badge: 'EN DEV',
                badgeCls: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
                dotCls: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.9)] animate-pulse',
                borderCls: 'border-blue-500/15 hover:border-blue-500/35',
                glowCls: 'from-blue-500/[0.06]',
                hoverGlow: 'hover:shadow-[0_0_40px_-8px_rgba(96,165,250,0.18)]',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
                title: 'YouTube Shorts',
                benefit: 'Identifie ce qui tue ta rétention sur YouTube — avant que l\'algo te pénalise définitivement.',
                detail: 'Algo YouTube · Rétention · Hook spécifique Shorts',
              },
            ].map((card, i) => (
              <FadeUp key={card.title} delay={0.1 + i * 0.06}>
                <div className={`group relative p-6 rounded-2xl border ${card.borderCls} bg-gradient-to-b ${card.glowCls} to-transparent ${card.hoverGlow} hover:-translate-y-1 transition-all duration-300 overflow-hidden`}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-vn-violet/10 text-vn-violet' : 'bg-blue-500/10 text-blue-400'}`}>
                      {card.icon}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${card.badgeCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${card.dotCls}`} />
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-black text-white mb-2.5 tracking-tight">{card.title}</h3>
                  <p className="text-[13px] text-gray-400 leading-relaxed mb-4">{card.benefit}</p>
                  <p className="text-[10px] text-gray-700 font-medium tracking-wide">{card.detail}</p>
                </div>
              </FadeUp>
            ))}

            {/* ── VISION (full width bottom row) ── */}
            {[
              {
                badge: 'VISION',
                badgeCls: 'bg-white/[0.05] text-gray-500 border-white/[0.10]',
                dotCls: 'bg-gray-600',
                borderCls: 'border-white/[0.07] hover:border-white/[0.12]',
                glowCls: 'from-white/[0.025]',
                hoverGlow: 'hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                  </svg>
                ),
                title: 'Comparaison & patterns',
                benefit: 'Comprends pourquoi certaines vidéos explosent et d\'autres meurent — automatiquement.',
                detail: 'Patterns viraux · Analyse cross-vidéo',
              },
              {
                badge: 'VISION',
                badgeCls: 'bg-white/[0.05] text-gray-500 border-white/[0.10]',
                dotCls: 'bg-gray-600',
                borderCls: 'border-white/[0.07] hover:border-white/[0.12]',
                glowCls: 'from-white/[0.025]',
                hoverGlow: 'hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                ),
                title: 'Trends en temps réel',
                benefit: 'Sache ce qui va exploser avant tout le monde — et publie au bon moment.',
                detail: 'Détection trends · Fenêtres d\'opportunité',
              },
              {
                badge: 'VISION',
                badgeCls: 'bg-white/[0.05] text-gray-500 border-white/[0.10]',
                dotCls: 'bg-gray-600',
                borderCls: 'border-white/[0.07] hover:border-white/[0.12]',
                glowCls: 'from-white/[0.025]',
                hoverGlow: 'hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.06)]',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                ),
                title: 'Suggestions IA prédictives',
                benefit: 'Reçois des idées de contenu générées par l\'IA — basées sur ce qui performe dans ta niche.',
                detail: 'Idées virales · Calendrier éditorial IA',
              },
            ].map((card, i) => (
              <FadeUp key={card.title} delay={0.18 + i * 0.05}>
                <div className={`group relative p-6 rounded-2xl border ${card.borderCls} bg-gradient-to-b ${card.glowCls} to-transparent ${card.hoverGlow} hover:-translate-y-0.5 transition-all duration-300 overflow-hidden opacity-60 hover:opacity-80`}>
                  <div className="absolute inset-0 backdrop-blur-[1px]" />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.04] text-gray-600">
                        {card.icon}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${card.badgeCls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${card.dotCls}`} />
                        {card.badge}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-black text-white/70 mb-2.5 tracking-tight">{card.title}</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed mb-4">{card.benefit}</p>
                    <p className="text-[10px] text-gray-700 font-medium tracking-wide">{card.detail}</p>
                  </div>
                </div>
              </FadeUp>
            ))}

          </div>

          {/* Bottom CTA */}
          <FadeUp delay={0.28}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 mt-14 pt-10 border-t border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
                <p className="text-[13px] text-gray-500">Mise à jour <span className="text-white font-semibold">chaque semaine</span> — tu es aux premières loges.</p>
              </div>
              <Link
                href="/changelog"
                className="shrink-0 inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.10] hover:border-white/[0.22] bg-white/[0.03] hover:bg-white/[0.06] rounded-full px-5 py-2.5 transition-all duration-300"
              >
                Voir toutes les nouveautés
                <Arrow className="w-3.5 h-3.5" />
              </Link>
            </div>
          </FadeUp>

        </div>
      </section>

      {/* ══ 11. CTA FINAL ═════════════════════════════════════════ */}
      <section className="relative py-14 sm:py-20 border-t border-white/[0.05] overflow-hidden">
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

    </div>
  );
}
