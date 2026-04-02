'use client';

import { useRef, useEffect, useState } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   HeroVideo
   Premium video player pour le hero de la homepage.

   Sources à placer dans /public/ :
     - /hero-demo.webm  (prioritaire, optimisé)
     - /hero-demo.mp4   (fallback)
     - /hero-fallback.jpg (image de secours)

   Si aucun fichier n'est présent, un placeholder produit animé s'affiche.
───────────────────────────────────────────────────────────────────────────── */

function AnimatedPlaceholder() {
  return (
    <div className="w-full p-5 sm:p-6 space-y-4 select-none">
      {/* ── Score ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <span className="text-[3.2rem] font-black leading-none text-white tabular-nums">68</span>
          <span className="text-[1.1rem] font-black text-white leading-none">/100</span>
        </div>
        <div className="pt-1">
          <p className="text-[13px] font-bold text-vn-fuchsia">Potentiel viral détecté</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Score de viralité global</p>
          <div className="mt-2 h-1.5 w-36 rounded-full bg-white/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo"
              style={{ width: '68%', transition: 'width 1.4s ease-out' }}
            />
          </div>
        </div>
      </div>

      {/* ── Trois piliers ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { name: 'Hook',      score: 80, bar: 'from-vn-fuchsia to-pink-400' },
          { name: 'Montage',   score: 65, bar: 'from-blue-400 to-vn-indigo'  },
          { name: 'Rétention', score: 59, bar: 'from-vn-indigo to-purple-400' },
        ].map(({ name, score, bar }) => (
          <div
            key={name}
            className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3"
          >
            <p className="text-[1.35rem] font-black text-white leading-none tabular-nums">{score}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{name}</p>
            <div className="mt-2.5 h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Problème principal ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.05] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-vn-fuchsia mb-1.5">
          Problème principal
        </p>
        <p className="text-[13px] text-white leading-snug">
          Hook trop lent — tu perds 60% de l'audience en 3 secondes
        </p>
      </div>

      {/* ── Plan d'action ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600">
          À corriger maintenant
        </p>
        {[
          'Commence avec une question ou une stat choc',
          'Accélère le montage dans les 5 premières secondes',
          'Ajoute un text overlay dès la première frame',
        ].map((action, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-[11px] font-black text-vn-fuchsia shrink-0 mt-0.5">{i + 1}.</span>
            <span className="text-[12px] text-gray-400 leading-snug">{action}</span>
          </div>
        ))}
      </div>

      {/* ── Verdict ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600 mb-1.5">
          Verdict
        </p>
        <p className="text-[12.5px] text-gray-300 leading-snug">
          Bonne base — le fond est solide. Corrige le hook et le rythme d'ouverture pour doubler ta rétention.
        </p>
      </div>
    </div>
  );
}

export default function HeroVideo() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [loaded,  setLoaded]  = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    const onError = () => setErrored(true);
    v.addEventListener('error', onError);
    return () => v.removeEventListener('error', onError);
  }, []);

  const showFallback = errored || !loaded;

  return (
    <div
      className="relative group w-full"
      style={{
        animation: 'heroVideoAppear 0.8s cubic-bezier(0.16,1,0.3,1) both',
        animationDelay: '0.25s',
      }}
    >
      {/* ── Ambient glow pulse ──────────────────────────────────────────── */}
      <div
        className="absolute -inset-6 sm:-inset-10 rounded-[36px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(232,121,249,0.18) 0%, rgba(99,102,241,0.14) 55%, transparent 100%)',
          animation: 'vnPulseSoft 4s ease-in-out infinite',
        }}
        aria-hidden
      />

      {/* ── Ring sur hover ──────────────────────────────────────────────── */}
      <div
        className="absolute -inset-px rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(232,121,249,0.35) 0%, transparent 50%, rgba(99,102,241,0.35) 100%)',
        }}
        aria-hidden
      />

      {/* ── Container principal ─────────────────────────────────────────── */}
      <div
        className="relative rounded-[20px] overflow-hidden border border-white/[0.10] transition-transform duration-500 ease-out group-hover:scale-[1.015]"
        style={{
          background: 'linear-gradient(150deg, #0f0f1b 0%, #080810 100%)',
          boxShadow:
            '0 40px 100px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.055), 0 0 60px -20px rgba(232,121,249,0.18)',
        }}
      >
        {/* Top shimmer line */}
        <div
          className="absolute top-0 inset-x-0 h-px pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
          }}
          aria-hidden
        />

        {/* ── Badge "IA en action" ─────────────────────────────────────── */}
        <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full border border-white/[0.12] shadow-lg"
          style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(12px)' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: '#e879f9',
              boxShadow: '0 0 8px 2px rgba(232,121,249,0.9)',
              animation: 'pulse 1.8s ease-in-out infinite',
            }}
            aria-hidden
          />
          <span className="text-[10px] font-semibold text-white/90 tracking-[0.1em] uppercase">
            IA en action
          </span>
        </div>

        {/* ── Vidéo ───────────────────────────────────────────────────── */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className={`w-full h-auto block transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
          aria-label="Démonstration de l'analyse vidéo IA Viralynz"
          onCanPlay={() => setLoaded(true)}
          onError={() => setErrored(true)}
        >
          <source src="/hero-demo.webm" type="video/webm" />
          <source src="/hero-demo.mp4"  type="video/mp4"  />
          {/* Fallback image si le navigateur ne supporte pas la vidéo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-fallback.jpg"
            alt="Aperçu de l'analyse Viralynz"
            className="w-full h-auto"
          />
        </video>

        {/* ── Placeholder animé (affiché tant que la vidéo ne charge pas) ─ */}
        {showFallback && <AnimatedPlaceholder />}

        {/* ── Overlays couleur sur la vidéo ───────────────────────────── */}
        {loaded && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.28) 0%, transparent 40%)',
              }}
              aria-hidden
            />
            <div
              className="absolute inset-0 pointer-events-none mix-blend-overlay"
              style={{
                background:
                  'linear-gradient(135deg, rgba(232,121,249,0.06) 0%, transparent 50%, rgba(99,102,241,0.08) 100%)',
              }}
              aria-hidden
            />
          </>
        )}

        {/* Bottom shimmer line */}
        <div
          className="absolute bottom-0 inset-x-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.35) 50%, transparent 100%)',
          }}
          aria-hidden
        />
      </div>

      {/* ── Reflet en bas ───────────────────────────────────────────────── */}
      <div
        className="absolute -bottom-8 inset-x-0 h-8 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(232,121,249,0.06) 0%, transparent 100%)',
          filter: 'blur(6px)',
        }}
        aria-hidden
      />
    </div>
  );
}
