'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { rewriteHook } from '@/lib/viral-growth-engine';

export default function HookRewritePage() {
  const [hook, setHook] = useState("Aujourd'hui je vais vous expliquer comment améliorer vos vidéos TikTok");
  const variants = useMemo(() => rewriteHook(hook), [hook]);
  const [copied, setCopied] = useState('');

  const copy = async (value: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(''), 1400);
  };

  return (
    <main className="min-h-screen bg-[#020611] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-10%,rgba(124,58,237,0.28),transparent_64%),radial-gradient(ellipse_48%_36%_at_100%_20%,rgba(34,211,238,0.12),transparent_58%)]" />
      <section className="relative mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/80">Rewrite / V2</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Réécris une ouverture faible</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-400">
              Colle ton ouverture. Viralynz propose des versions plus directes, plus tendues et plus faciles à tester dans une structure retravaillée.
            </p>
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Hook original</label>
              <textarea
                value={hook}
                onChange={(event) => setHook(event.target.value)}
                className="mt-3 min-h-[150px] w-full resize-none rounded-2xl border border-white/[0.08] bg-black/30 p-4 text-sm font-semibold text-white outline-none transition focus:border-vn-violet/40"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {variants.map((variant) => (
              <article key={variant.type} className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] p-4 shadow-[0_24px_90px_-70px_rgba(124,58,237,0.9)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-violet/80">{variant.label}</p>
                  <span className="rounded-lg border border-emerald-300/18 bg-emerald-300/10 px-2.5 py-1 text-xs font-black text-emerald-200">{variant.score}</span>
                </div>
                <p className="mt-3 text-xl font-black leading-tight text-white">"{variant.hook}"</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{variant.why}</p>
                <button
                  type="button"
                  onClick={() => copy(variant.hook)}
                  className="mt-4 rounded-xl bg-white/[0.065] px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/[0.1]"
                >
                  {copied === variant.hook ? 'Copie' : 'Copier'}
                </button>
              </article>
            ))}
            <Link href="/dashboard/analyze" className="rounded-2xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-4 text-center text-sm font-black text-white transition hover:brightness-110">
              Analyser une vidéo complète
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
