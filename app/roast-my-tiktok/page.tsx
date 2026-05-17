'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { rewriteHook } from '@/lib/viral-growth-engine';

export default function RoastMyTikTokPage() {
  const [hook, setHook] = useState('Je vais vous montrer 3 conseils pour améliorer vos vidéos');
  const [niche, setNiche] = useState('business');
  const variants = useMemo(() => rewriteHook(hook), [hook]);
  const best = variants[0];
  const roast = hook.toLowerCase().includes('je vais') || hook.toLowerCase().includes('conseils')
    ? 'Ton hook explique avant de donner une raison de rester. Le sujet peut être bon, mais l’ouverture ressemble à une intro YouTube.'
    : 'Le hook a une base exploitable. La reconstruction doit rendre la preuve plus visible avant le contexte.';

  return (
    <main className="min-h-screen bg-[#020611] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(239,68,68,0.18),transparent_60%),radial-gradient(ellipse_45%_35%_at_100%_20%,rgba(124,58,237,0.18),transparent_58%)]" />
      <section className="relative mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-200/80">Public mode</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Roast my TikTok</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400">
              Partage un diagnostic court, concret et propre. Pas de motivation. Juste le problème du hook, la preuve manquante et une structure à remonter.
            </p>
            <div className="mt-6 grid gap-3">
              <input
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-vn-violet/40"
                placeholder="Niche"
              />
              <textarea
                value={hook}
                onChange={(event) => setHook(event.target.value)}
                className="min-h-[150px] resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm font-semibold text-white outline-none focus:border-vn-violet/40"
                placeholder="Colle ton hook"
              />
            </div>
          </div>

          <article className="rounded-[1.75rem] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-5 shadow-[0_34px_110px_-78px_rgba(239,68,68,0.95)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200/80">TikTok roast - {niche || 'niche'}</p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-white">Le vrai problème de ce hook</h2>
            <div className="mt-5 rounded-2xl border border-red-300/16 bg-red-300/[0.07] p-4">
              <p className="text-sm leading-relaxed text-gray-200">{roast}</p>
            </div>
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/25 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Hook original</p>
              <p className="mt-2 text-lg font-black text-white">"{hook}"</p>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-300/16 bg-emerald-300/[0.07] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/80">Reconstruction conseillée</p>
              <p className="mt-2 text-xl font-black leading-tight text-white">"{best?.hook}"</p>
              <p className="mt-3 text-sm text-gray-400">{best?.why}</p>
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Powered by Viralynz</p>
            <Link href="/dashboard/analyze" className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-3 text-sm font-black text-white transition hover:brightness-110">
              Obtenir l’analyse complète
            </Link>
          </article>
        </div>
      </section>
    </main>
  );
}
